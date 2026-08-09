const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { PDFParse } = require("pdf-parse");
const CronogramaService = require("./cronogramaService");

const nomeModelo = process.env.GEMINI_MODEL || "gemini-flash-latest";

const LIMITE_CARACTERES_PDF = 40000;
const QUANTIDADE_PADRAO_PERGUNTAS = 5;
const QUANTIDADE_MAXIMA_PERGUNTAS = 10;
const QUANTIDADE_ALTERNATIVAS = 4;
const DIFICULDADES_VALIDAS = ["facil", "medio", "dificil"];
const TIPOS_CRONOGRAMA_VALIDOS = ["diario", "semanal"];
const QUANTIDADE_MAXIMA_EVENTOS = 30;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Le GEMINI_API_KEY (compatibilidade com o formato antigo, usado ainda
// no deploy) mais GEMINI_API_KEY_1, _2, _3... A cota diaria do free
// tier e por PROJETO do Google Cloud, entao cada chave de um projeto
// diferente da direito a cota propria - e isso que permite rotacionar
// quando uma estoura.
function coletarChavesGemini() {
  const chaves = [];

  if (process.env.GEMINI_API_KEY) {
    chaves.push(process.env.GEMINI_API_KEY);
  }

  for (let indice = 1; process.env[`GEMINI_API_KEY_${indice}`]; indice++) {
    chaves.push(process.env[`GEMINI_API_KEY_${indice}`]);
  }

  const chavesUnicas = [...new Set(chaves)];

  if (chavesUnicas.length === 0) {
    throw new Error(
      "Nenhuma chave Gemini configurada. Defina GEMINI_API_KEY ou GEMINI_API_KEY_1/_2/... no .env."
    );
  }

  return chavesUnicas;
}

const SCHEMA_SIMULADO = {
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      perguntas: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            enunciado: { type: SchemaType.STRING },
            alternativas: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            correta: { type: SchemaType.INTEGER },
            explicacao: { type: SchemaType.STRING },
          },
          required: ["enunciado", "alternativas", "correta"],
        },
      },
    },
    required: ["perguntas"],
  },
};

const SCHEMA_CRONOGRAMA = {
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      eventos: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            titulo: { type: SchemaType.STRING },
            descricao: { type: SchemaType.STRING },
            data: { type: SchemaType.STRING },
            hora_inicio: { type: SchemaType.STRING },
            hora_fim: { type: SchemaType.STRING },
          },
          required: ["titulo", "data", "hora_inicio", "hora_fim"],
        },
      },
    },
    required: ["eventos"],
  },
};

// Um "cliente" por chave, cada um com os 3 modelos que o servico usa.
// getGenerativeModel(...) so monta a config, nao faz nenhuma chamada de
// rede, entao criar N clientes de uma vez e barato.
const clientesGemini = coletarChavesGemini().map((chave) => {
  const genAI = new GoogleGenerativeAI(chave);
  return {
    modelo: genAI.getGenerativeModel({ model: nomeModelo }),
    modeloSimulado: genAI.getGenerativeModel({ model: nomeModelo, generationConfig: SCHEMA_SIMULADO }),
    modeloCronograma: genAI.getGenerativeModel({ model: nomeModelo, generationConfig: SCHEMA_CRONOGRAMA }),
  };
});

// Indice da chave em uso agora. Fica "grudado" na proxima chave depois
// que uma estoura, pra nao ficar testando de novo uma chave ja sabida
// como esgotada a cada chamada - so volta pra primeira quando o
// processo reinicia (deploy novo, nodemon, etc), que e quando a cota
// diaria tende a ja ter resetado de qualquer forma.
let indiceChaveAtual = 0;

function ehErroDeCota(erro) {
  const mensagem = String(erro?.message || "");
  return /429|quota|Too Many Requests/i.test(mensagem);
}

// Chama generateContent no modelo indicado (por nome: "modelo",
// "modeloSimulado" ou "modeloCronograma"), tentando as chaves
// disponiveis em sequencia quando uma delas estoura a cota. So
// rotaciona em erro de cota - qualquer outro erro (chave invalida,
// rede, etc) sobe na hora, sem mascarar o problema real.
async function gerarComRotacaoDeChave(nomeModeloLogico, args) {
  let ultimoErro;

  for (let tentativa = 0; tentativa < clientesGemini.length; tentativa++) {
    const cliente = clientesGemini[indiceChaveAtual];

    try {
      return await cliente[nomeModeloLogico].generateContent(args);
    } catch (erro) {
      ultimoErro = erro;

      if (!ehErroDeCota(erro) || clientesGemini.length === 1) {
        throw erro;
      }

      console.error(
        `Chave Gemini #${indiceChaveAtual + 1} sem cota, tentando a proxima (${indiceChaveAtual + 2}/${clientesGemini.length})...`
      );
      indiceChaveAtual = (indiceChaveAtual + 1) % clientesGemini.length;
    }
  }

  throw ultimoErro;
}

// Mesma logica de nunca confiar direto no JSON: valida formato de data
// (YYYY-MM-DD) e hora (HH:MM), limita tamanho de texto e quantidade de
// eventos antes de virar linha no banco / aparecer no calendario.
function validarCronogramaGerado(json, quantidadeMaxima) {
  if (!json || !Array.isArray(json.eventos)) {
    throw new Error("Formato invalido retornado pela IA.");
  }

  const eventos = json.eventos.slice(0, quantidadeMaxima).map((evento, indice) => {
    if (typeof evento.titulo !== "string" || !evento.titulo.trim()) {
      throw new Error(`Evento ${indice + 1} sem titulo valido.`);
    }
    if (!REGEX_DATA.test(evento.data)) {
      throw new Error(`Evento ${indice + 1} com data invalida.`);
    }
    if (!REGEX_HORA.test(evento.hora_inicio) || !REGEX_HORA.test(evento.hora_fim)) {
      throw new Error(`Evento ${indice + 1} com horario invalido.`);
    }

    return {
      titulo: String(evento.titulo).slice(0, 150),
      descricao: typeof evento.descricao === "string" ? evento.descricao.slice(0, 300) : "",
      data: evento.data,
      hora_inicio: evento.hora_inicio,
      hora_fim: evento.hora_fim,
    };
  });

  if (eventos.length === 0) {
    throw new Error("A IA nao gerou nenhum evento valido.");
  }

  return { eventos };
}

// Nunca confiar direto no JSON que a IA devolve: valida tipo, tamanho e
// limites de cada campo antes de deixar isso virar um Formulario salvo
// no banco / renderizado pro aluno.
function validarFormularioGerado(json, quantidadeEsperada) {
  if (!json || !Array.isArray(json.perguntas)) {
    throw new Error("Formato invalido retornado pela IA.");
  }

  const perguntas = json.perguntas.slice(0, quantidadeEsperada).map((pergunta, indice) => {
    if (typeof pergunta.enunciado !== "string" || !pergunta.enunciado.trim()) {
      throw new Error(`Pergunta ${indice + 1} sem enunciado valido.`);
    }
    if (!Array.isArray(pergunta.alternativas) || pergunta.alternativas.length < 2) {
      throw new Error(`Pergunta ${indice + 1} sem alternativas validas.`);
    }

    const alternativas = pergunta.alternativas
      .slice(0, 6)
      .map((alternativa) => String(alternativa).slice(0, 300));
    const correta = Number.isInteger(pergunta.correta) ? pergunta.correta : -1;

    if (correta < 0 || correta >= alternativas.length) {
      throw new Error(`Pergunta ${indice + 1} com indice de resposta correta invalido.`);
    }

    return {
      id: `q${indice + 1}`,
      enunciado: String(pergunta.enunciado).slice(0, 500),
      alternativas,
      correta,
      explicacao: typeof pergunta.explicacao === "string" ? pergunta.explicacao.slice(0, 500) : "",
    };
  });

  if (perguntas.length === 0) {
    throw new Error("A IA nao gerou nenhuma pergunta valida.");
  }

  return { perguntas };
}

// Calcula datas de verdade em vez de deixar a IA fazer conta de dia da
// semana (erra com frequencia) - comeca em dataBase e pula sabado/domingo.
function calcularProximosDiasUteis(dataBase, quantidade) {
  const dias = [];
  const cursor = new Date(`${dataBase}T00:00:00`);

  while (dias.length < quantidade) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      // Formata pelo horario local: toISOString converte pra UTC e
      // devolvia o dia anterior em fuso positivo.
      const ano = cursor.getFullYear();
      const mes = String(cursor.getMonth() + 1).padStart(2, "0");
      const dia = String(cursor.getDate()).padStart(2, "0");
      dias.push(`${ano}-${mes}-${dia}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

// A IA promete "horarios diferentes e sem sobreposicao" mas nem sempre
// cumpre (mesmo problema que ja acontecia com as datas). A gente ja sabe
// quais blocos de horario fazem sentido pra quantidade pedida, entao
// forca isso no codigo em vez de confiar na IA - ver gerarBlocosDia().
const QUANTIDADE_PADRAO_DIARIO = 4;
const QUANTIDADE_PADRAO_SEMANAL = 10;
const QUANTIDADE_MINIMA_EVENTOS = 3;

function clamp(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function montarPrompt({ titulo, autor, materia, textoConteudo }) {
  const identificacao = [
    `"${titulo}"`,
    autor ? `, de ${autor}` : "",
    materia ? `, da materia ${materia}` : "",
  ].join("");

  if (textoConteudo) {
    return [
      `Com base no trecho a seguir de um material didatico ${identificacao},`,
      `escreva uma sinopse educativa e objetiva (no maximo 150 palavras),`,
      `em portugues do Brasil, sem markdown, direto ao ponto, para alunos do ensino medio.`,
      ``,
      `Trecho do material:`,
      `"""${textoConteudo}"""`,
    ].join("\n");
  }

  return [
    `Escreva uma sinopse educativa e objetiva (no maximo 150 palavras)`,
    `para o material didatico ${identificacao}.`,
    `Escreva em portugues do Brasil, sem markdown, direto ao ponto,`,
    `para alunos do ensino medio.`,
  ].join(" ");
}

const IaService = Object.freeze({
  async extrairTextoPdf(bufferPdf) {
    const parser = new PDFParse({ data: bufferPdf });
    const resultado = await parser.getText();
    await parser.destroy();
    return resultado.text.trim().slice(0, LIMITE_CARACTERES_PDF);
  },

  async gerarSinopse({ titulo, autor, materia, textoConteudo }) {
    const prompt = montarPrompt({ titulo, autor, materia, textoConteudo });
    const resultado = await gerarComRotacaoDeChave("modelo", prompt);
    return resultado.response.text().trim();
  },

  async gerarSinopseVideo({ titulo, materia, urlYoutube }) {
    const identificacao = [`"${titulo}"`, materia ? `, da materia ${materia}` : ""].join("");
    const promptTexto = [
      `Assista ao video a seguir e escreva uma sinopse educativa e objetiva`,
      `(no maximo 150 palavras) para a videoaula ${identificacao}.`,
      `Escreva em portugues do Brasil, sem markdown, direto ao ponto,`,
      `para alunos do ensino medio.`,
    ].join(" ");

    try {
      const resultado = await gerarComRotacaoDeChave("modelo", [
        { fileData: { mimeType: "video/*", fileUri: urlYoutube } },
        { text: promptTexto },
      ]);
      return resultado.response.text().trim();
    } catch (erro) {
      console.error(
        "Gemini nao conseguiu analisar o video (provavelmente nao esta publico), caindo para sinopse por metadado:",
        erro.message
      );
      return IaService.gerarSinopse({ titulo, materia });
    }
  },

  async gerarSimulado({ tema, materia, quantidade, dificuldade }) {
    const qtd = Math.min(
      Math.max(Number(quantidade) || QUANTIDADE_PADRAO_PERGUNTAS, 1),
      QUANTIDADE_MAXIMA_PERGUNTAS
    );
    const nivel = DIFICULDADES_VALIDAS.includes(dificuldade) ? dificuldade : "medio";
    const nivelTexto = {
      facil: "nivel facil, com perguntas diretas e objetivas",
      medio: "nivel medio",
      dificil: "nivel dificil, exigindo raciocinio mais elaborado",
    }[nivel];

    const prompt = [
      `Crie um simulado de multipla escolha com exatamente ${qtd} perguntas sobre "${tema}"`,
      materia ? `, da materia ${materia},` : ",",
      `${nivelTexto}, para alunos do ensino medio, em portugues do Brasil.`,
      `Cada pergunta deve ter exatamente ${QUANTIDADE_ALTERNATIVAS} alternativas, sendo apenas uma correta.`,
      `Retorne "correta" como o indice (comecando em 0) da alternativa certa.`,
      `Inclua uma breve explicacao da resposta correta em "explicacao".`,
    ].join(" ");

    const resultado = await gerarComRotacaoDeChave("modeloSimulado", prompt);

    let json;
    try {
      json = JSON.parse(resultado.response.text());
    } catch (erro) {
      throw new Error("A IA retornou um formato invalido de simulado.");
    }

    return validarFormularioGerado(json, qtd);
  },

  // Exposta pra reaproveitar a mesma validacao rigorosa quando o
  // professor monta o simulado na mao (nunca confiar em dado vindo de
  // formulario tambem, do mesmo jeito que nao se confia na IA).
  validarFormulario(json, quantidadeMaxima) {
    return validarFormularioGerado(json, quantidadeMaxima ?? QUANTIDADE_MAXIMA_PERGUNTAS);
  },

  async gerarCronograma({ materia, tema, tipo, dataInicio, quantidade }) {
    const tipoValido = TIPOS_CRONOGRAMA_VALIDOS.includes(tipo) ? tipo : "semanal";
    const dataBase = REGEX_DATA.test(dataInicio)
      ? dataInicio
      : new Date().toISOString().slice(0, 10);

    const diasUteis = calcularProximosDiasUteis(dataBase, 5);

    // "diario" cabe tudo num dia so, entao o teto e MAX_BLOCOS_POR_DIA.
    // "semanal" espalha pelos 5 dias uteis, entao o teto e por dia
    // tambem (senao um numero grande vira um dia absurdo de cheio) - o
    // total fica limitado por QUANTIDADE_MAXIMA_EVENTOS la embaixo.
    const blocosDia =
      tipoValido === "diario"
        ? CronogramaService.gerarBlocosDia(
            clamp(Number(quantidade) || QUANTIDADE_PADRAO_DIARIO, QUANTIDADE_MINIMA_EVENTOS, CronogramaService.MAX_BLOCOS_POR_DIA)
          )
        : CronogramaService.gerarBlocosDia(
            clamp(
              Math.ceil(clamp(Number(quantidade) || QUANTIDADE_PADRAO_SEMANAL, QUANTIDADE_MINIMA_EVENTOS, QUANTIDADE_MAXIMA_EVENTOS) / diasUteis.length),
              1,
              CronogramaService.MAX_BLOCOS_POR_DIA
            )
          );

    const instrucaoPorTipo = {
      diario: [
        `Crie exatamente ${blocosDia.length} blocos de estudo dentro do dia ${dataBase} apenas`,
        `(todos os eventos devem ter "data" igual a ${dataBase}), evoluindo o assunto a cada bloco.`,
      ].join(" "),
      semanal: [
        `Crie exatamente ${blocosDia.length} evento${blocosDia.length > 1 ? "s" : ""} por dia,`,
        `usando exatamente estas ${diasUteis.length} datas (dias uteis, segunda a sexta):`,
        `${diasUteis.join(", ")}. Sao ${diasUteis.length * blocosDia.length} eventos no total,`,
        `${blocosDia.length} por data, evoluindo o assunto ao longo da semana e ao longo do dia.`,
        `Nao use nenhuma outra data.`,
      ].join(" "),
    }[tipoValido];

    const prompt = [
      `Crie um cronograma de estudos sobre "${tema}"`,
      materia ? `, da materia ${materia},` : ",",
      `para alunos do ensino medio, em portugues do Brasil.`,
      instrucaoPorTipo,
      `Cada evento precisa de "titulo" curto, "descricao" breve (o que estudar),`,
      `"data" no formato YYYY-MM-DD, "hora_inicio" e "hora_fim" no formato HH:MM.`,
    ].join(" ");

    const resultado = await gerarComRotacaoDeChave("modeloCronograma", prompt);

    let json;
    try {
      json = JSON.parse(resultado.response.text());
    } catch (erro) {
      throw new Error("A IA retornou um formato invalido de cronograma.");
    }

    const cronogramaValidado = validarCronogramaGerado(json, QUANTIDADE_MAXIMA_EVENTOS);

    // A IA as vezes ignora a instrucao e repete a mesma data/horario em
    // varios eventos (mesmo pedindo explicitamente datas diferentes). A
    // gente ja sabe exatamente quais datas e blocos de horario devem ser
    // usados, entao forca isso no codigo em vez de confiar na IA.
    if (tipoValido === "diario") {
      cronogramaValidado.eventos = cronogramaValidado.eventos
        .slice(0, blocosDia.length)
        .map((evento, indice) => ({
          ...evento,
          data: dataBase,
          ...blocosDia[indice % blocosDia.length],
        }));
    } else if (tipoValido === "semanal") {
      cronogramaValidado.eventos = cronogramaValidado.eventos
        .slice(0, diasUteis.length * blocosDia.length)
        .map((evento, indice) => ({
          ...evento,
          data: diasUteis[Math.floor(indice / blocosDia.length)],
          ...blocosDia[indice % blocosDia.length],
        }));
    }

    return cronogramaValidado;
  },

  // Exposta pra reaproveitar a mesma validacao quando o professor monta
  // o cronograma na mao, mesmo principio do validarFormulario.
  validarCronograma(json, quantidadeMaxima) {
    return validarCronogramaGerado(json, quantidadeMaxima ?? QUANTIDADE_MAXIMA_EVENTOS);
  },
});

module.exports = IaService;
