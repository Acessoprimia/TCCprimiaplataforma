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
const NOTA_MAXIMA_COMPETENCIA = 200;
const TAMANHO_MINIMO_REDACAO = 50; // caracteres - evita gastar cota da IA com texto vazio/lixo
const TAMANHO_MAXIMO_REDACAO = 6000; // ~800-1000 palavras, folga generosa sobre o limite do ENEM

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

const SCHEMA_REDACAO = {
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      competencia1: {
        type: SchemaType.OBJECT,
        properties: {
          nota: { type: SchemaType.INTEGER },
          comentario: { type: SchemaType.STRING },
        },
      },
      competencia2: {
        type: SchemaType.OBJECT,
        properties: {
          nota: { type: SchemaType.INTEGER },
          comentario: { type: SchemaType.STRING },
        },
      },
      competencia3: {
        type: SchemaType.OBJECT,
        properties: {
          nota: { type: SchemaType.INTEGER },
          comentario: { type: SchemaType.STRING },
        },
      },
      competencia4: {
        type: SchemaType.OBJECT,
        properties: {
          nota: { type: SchemaType.INTEGER },
          comentario: { type: SchemaType.STRING },
        },
      },
      competencia5: {
        type: SchemaType.OBJECT,
        properties: {
          nota: { type: SchemaType.INTEGER },
          comentario: { type: SchemaType.STRING },
        },
      },
      comentarioGeral: { type: SchemaType.STRING },
    },
  },
};

const SCHEMA_ANALISE_DESEMPENHO = {
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      diagnostico: { type: SchemaType.STRING },
      pontosFortes: { type: SchemaType.STRING },
      recomendacaoGeral: { type: SchemaType.STRING },
      materiasFracas: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
      },
    },
  },
};

const LIMITE_MATERIAS_FRACAS = 3;

// Um "cliente" por chave, cada um com os 5 modelos que o servico usa.
// getGenerativeModel(...) so monta a config, nao faz nenhuma chamada de
// rede, entao criar N clientes de uma vez e barato.
const clientesGemini = coletarChavesGemini().map((chave) => {
  const genAI = new GoogleGenerativeAI(chave);
  return {
    modelo: genAI.getGenerativeModel({ model: nomeModelo }),
    modeloSimulado: genAI.getGenerativeModel({ model: nomeModelo, generationConfig: SCHEMA_SIMULADO }),
    modeloCronograma: genAI.getGenerativeModel({ model: nomeModelo, generationConfig: SCHEMA_CRONOGRAMA }),
    modeloRedacao: genAI.getGenerativeModel({ model: nomeModelo, generationConfig: SCHEMA_REDACAO }),
    modeloAnaliseDesempenho: genAI.getGenerativeModel({ model: nomeModelo, generationConfig: SCHEMA_ANALISE_DESEMPENHO }),
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

const SLUG_ENEM = "enem_dissertativo_argumentativo";

// Catalogo dos generos de redacao suportados. As 5 colunas nota_c1..c5/
// comentario_c1..c5 no banco sao genericas (servem pra qualquer genero)
// - so o CONTEUDO de cada slot (nome do criterio + instrucao de prompt)
// muda por genero aqui. VARCHAR no banco em vez de ENUM porque essa
// lista vive so aqui - manter um enum sincronizado no banco seria uma
// segunda fonte de verdade (ver comentario em schema.sql).
const PERFIS_REDACAO = Object.freeze({
  [SLUG_ENEM]: {
    rotulo: "📝 ENEM — Dissertativo-argumentativa",
    competencias: [
      "Domínio da norma culta da língua escrita",
      "Compreensão da proposta e aplicação de conceitos das áreas de conhecimento",
      "Seleção e organização de argumentos e informações",
      "Conhecimento dos mecanismos linguísticos para argumentação",
      "Proposta de intervenção que respeite os direitos humanos",
    ],
    instrucoes:
      `Você é um corretor de redações do ENEM. Avalie a redação abaixo sobre o tema ` +
      `"\${tema}", seguindo estritamente as 5 competências oficiais do ENEM, cada uma ` +
      `valendo de 0 a 200 pontos, em múltiplos de 20. Competência 1: domínio da norma ` +
      `culta. Competência 2: compreensão da proposta e aplicação de conceitos de várias ` +
      `áreas. Competência 3: seleção e organização de argumentos. Competência 4: ` +
      `conhecimento dos mecanismos linguísticos para argumentação. Competência 5: ` +
      `proposta de intervenção que respeite os direitos humanos.`,
  },
  artigo_opiniao: {
    rotulo: "💬 Artigo de opinião",
    competencias: [
      "Domínio da norma culta e adequação da linguagem",
      "Clareza e defesa do ponto de vista",
      "Qualidade e articulação dos argumentos",
      "Coesão e organização textual",
      "Força persuasiva da conclusão",
    ],
    instrucoes:
      `Você é um corretor de artigos de opinião. Avalie o texto abaixo sobre o tema ` +
      `"\${tema}" considerando 5 critérios, cada um valendo de 0 a 200 pontos em ` +
      `múltiplos de 20: (1) domínio da norma culta e adequação da linguagem ao gênero; ` +
      `(2) clareza e sustentação do ponto de vista defendido; (3) qualidade e ` +
      `articulação dos argumentos, incluindo uso de exemplos, dados ou contra-` +
      `argumentação; (4) coesão e organização textual, com conectivos adequados e ` +
      `progressão lógica das ideias; (5) força persuasiva da conclusão, retomando a ` +
      `tese e convencendo o leitor.`,
  },
  narrativa: {
    rotulo: "📖 Narrativa",
    competencias: [
      "Domínio da norma culta",
      "Enredo e desenvolvimento da história",
      "Construção de personagens",
      "Ambientação (espaço e tempo)",
      "Recursos linguísticos, coesão e fechamento",
    ],
    instrucoes:
      `Você é um corretor de textos narrativos. Avalie a narrativa abaixo com tema/mote ` +
      `"\${tema}" considerando 5 critérios, cada um valendo de 0 a 200 pontos em ` +
      `múltiplos de 20: (1) domínio da norma culta; (2) enredo e desenvolvimento da ` +
      `história, incluindo conflito e progressão; (3) construção de personagens, ` +
      `consistência e verossimilhança; (4) ambientação, construção do espaço e do ` +
      `tempo narrativo; (5) recursos linguísticos, coesão entre as partes e fechamento ` +
      `satisfatório da história.`,
  },
  resenha_critica: {
    rotulo: "🔎 Resenha crítica",
    competencias: [
      "Domínio da norma culta",
      "Apresentação e contextualização do objeto resenhado",
      "Capacidade de análise crítica",
      "Uso de argumentos e evidências",
      "Coesão, coerência e posicionamento final",
    ],
    instrucoes:
      `Você é um corretor de resenhas críticas. Avalie a resenha abaixo sobre ` +
      `"\${tema}" considerando 5 critérios, cada um valendo de 0 a 200 pontos em ` +
      `múltiplos de 20: (1) domínio da norma culta; (2) apresentação e contextualização ` +
      `adequada da obra ou objeto resenhado; (3) capacidade de análise crítica, indo ` +
      `além do resumo e avaliando pontos fortes e fracos; (4) uso de argumentos e ` +
      `evidências concretas do próprio objeto pra sustentar o julgamento; (5) coesão, ` +
      `coerência e posicionamento final claro.`,
  },
  cronica: {
    rotulo: "📰 Crônica",
    competencias: [
      "Domínio da norma culta e recursos de estilo",
      "Observação do cotidiano e originalidade",
      "Construção da narrativa (fluidez e ritmo)",
      "Uso de recursos literários (ironia, humor etc.)",
      "Coesão, coerência e fechamento reflexivo",
    ],
    instrucoes:
      `Você é um corretor de crônicas. Avalie o texto abaixo com tema/mote "\${tema}" ` +
      `considerando 5 critérios, cada um valendo de 0 a 200 pontos em múltiplos de 20: ` +
      `(1) domínio da norma culta e uso adequado de recursos de estilo; (2) observação ` +
      `do cotidiano e originalidade do olhar sobre o tema; (3) construção da narrativa, ` +
      `com fluidez e bom ritmo; (4) uso de recursos literários típicos do gênero, como ` +
      `ironia, humor ou coloquialidade controlada; (5) coesão, coerência e um ` +
      `fechamento reflexivo que arremate o texto.`,
  },
  carta_argumentativa: {
    rotulo: "✉️ Carta argumentativa",
    competencias: [
      "Domínio da norma culta e estrutura da carta",
      "Compreensão da proposta e do destinatário",
      "Seleção e organização dos argumentos",
      "Mecanismos linguísticos e tom adequado ao destinatário",
      "Proposta de ação ou solicitação concreta",
    ],
    instrucoes:
      `Você é um corretor de cartas argumentativas. Avalie a carta abaixo sobre ` +
      `"\${tema}" considerando 5 critérios, cada um valendo de 0 a 200 pontos em ` +
      `múltiplos de 20: (1) domínio da norma culta e adequação à estrutura do gênero ` +
      `carta; (2) compreensão da proposta e clareza sobre quem é o destinatário e qual ` +
      `o propósito da carta; (3) seleção e organização dos argumentos voltados a ` +
      `persuadir o destinatário específico; (4) mecanismos linguísticos de ` +
      `argumentação e adequação do tom e registro ao destinatário; (5) proposta de ` +
      `ação ou solicitação concreta ao final da carta.`,
  },
});

function resolverTipoRedacao(tipoRedacao) {
  return PERFIS_REDACAO[tipoRedacao] ? tipoRedacao : SLUG_ENEM;
}

// Fallback pro ENEM cobre tanto slug ausente/invalido quanto um slug
// orfao (redacao antiga referenciando um genero que um dia deixe de
// existir no catalogo) - nunca deixa a tela de resultado quebrar.
function buscarPerfilRedacao(tipoRedacao) {
  const slug = resolverTipoRedacao(tipoRedacao);
  return { slug, ...PERFIS_REDACAO[slug] };
}

function listarPerfisRedacao() {
  return Object.entries(PERFIS_REDACAO).map(([slug, perfil]) => ({ slug, rotulo: perfil.rotulo }));
}

function validarCompetencia(json, chave, indice, competencias) {
  const bloco = json?.[chave];
  const notaBruta = Number(bloco?.nota);

  if (!bloco || !Number.isFinite(notaBruta)) {
    throw new Error(`Competencia ${indice + 1} sem nota valida retornada pela IA.`);
  }

  // Clampa em vez de rejeitar: a IA as vezes extrapola por 1-2 pontos, e
  // o formato so aceita multiplos de 20 (0,20,40...200) - arredonda pro
  // multiplo de 20 mais proximo dentro do range.
  const notaClampada = Math.min(
    Math.max(Math.round(notaBruta / 20) * 20, 0),
    NOTA_MAXIMA_COMPETENCIA
  );

  return {
    nota: notaClampada,
    comentario:
      typeof bloco.comentario === "string" && bloco.comentario.trim()
        ? bloco.comentario.slice(0, 800)
        : `Sem comentário específico para ${competencias[indice]}.`,
  };
}

// Nunca confia na soma que a IA disser (nem existe campo pra isso no
// schema, de proposito) - a nota total e sempre recalculada aqui a
// partir das 5 notas ja validadas/clampadas.
function validarCorrecaoGerada(json, competencias) {
  const c1 = validarCompetencia(json, "competencia1", 0, competencias);
  const c2 = validarCompetencia(json, "competencia2", 1, competencias);
  const c3 = validarCompetencia(json, "competencia3", 2, competencias);
  const c4 = validarCompetencia(json, "competencia4", 3, competencias);
  const c5 = validarCompetencia(json, "competencia5", 4, competencias);

  return {
    c1,
    c2,
    c3,
    c4,
    c5,
    notaTotal: c1.nota + c2.nota + c3.nota + c4.nota + c5.nota,
    comentarioGeral:
      typeof json.comentarioGeral === "string" && json.comentarioGeral.trim()
        ? json.comentarioGeral.slice(0, 1500)
        : "Correcao gerada sem comentario geral.",
  };
}

function montarPromptAnaliseDesempenho(resumo, materiasDisponiveis) {
  const linhasMateria = resumo.porMateria.length
    ? resumo.porMateria
        .map((m) => `- ${m.materia}: ${m.taxa}% de acerto (${m.total} perguntas respondidas)`)
        .join("\n")
    : "- Nenhum simulado respondido com matéria definida ainda.";

  const linhasRedacao = resumo.porGenero.length
    ? resumo.porGenero
        .map((g) => `- ${buscarPerfilRedacao(g.tipoRedacao).rotulo}: ${g.total} redação(ões), nota média ${g.mediaTotal}/1000`)
        .join("\n")
    : "- Nenhuma redação enviada ainda.";

  return [
    `Você é um orientador educacional analisando o desempenho de um aluno do ensino médio`,
    `com base SOMENTE nos números abaixo (não invente nenhum dado que não esteja aqui).\n`,
    `Simulados: ${resumo.totalSimuladosRespondidos} respondidos, ${resumo.totalPerguntasRespondidas} perguntas,`,
    `taxa de acerto geral ${resumo.taxaAcertoGeral ?? "sem dados"}%.`,
    `Por matéria:\n${linhasMateria}\n`,
    `Redações: ${resumo.totalRedacoes} enviada(s).`,
    `Por gênero:\n${linhasRedacao}\n`,
    `Escreva em português do Brasil, tom construtivo e direto: "diagnostico" (visão geral,`,
    `2-4 frases), "pontosFortes" (o que vai bem, 2-3 frases), "recomendacaoGeral" (próximo`,
    `passo prático, 2-3 frases).\n`,
    `Em "materiasFracas", liste APENAS nomes escolhidos EXATAMENTE (mesma grafia) desta lista`,
    `de matérias que existem no site — nunca cite matéria fora desta lista, e nunca cite título`,
    `de livro ou vídeo, só o nome da matéria: ${materiasDisponiveis.map((m) => m.nome).join(", ")}.`,
  ].join(" ");
}

// Nunca confia direto no JSON: filtra materiasFracas mantendo SO o que
// bate (case-insensitive/trim) com materiasDisponiveis - nome inventado
// pela IA e descartado em silencio (nunca vira erro visivel, so reduz a
// lista). Devolve os OBJETOS {id_materia, nome} casados, nao a string
// crua da IA - o codigo que usa o resultado precisa do id pra buscar
// Conteudo de verdade (nunca a IA cita titulo de conteudo).
function validarAnaliseGerada(json, materiasDisponiveis) {
  if (!json || typeof json !== "object") {
    throw new Error("Formato invalido retornado pela IA.");
  }

  const textoOuFallback = (valor, fallback, tamanhoMaximo) =>
    typeof valor === "string" && valor.trim() ? valor.trim().slice(0, tamanhoMaximo) : fallback;

  const porNomeNormalizado = new Map(
    materiasDisponiveis.map((materia) => [materia.nome.trim().toLowerCase(), materia])
  );

  const brutas = Array.isArray(json.materiasFracas) ? json.materiasFracas : [];
  const materiasFracas = [];
  const vistos = new Set();

  for (const nomeCru of brutas) {
    if (typeof nomeCru !== "string") continue;
    const materia = porNomeNormalizado.get(nomeCru.trim().toLowerCase());
    if (!materia || vistos.has(materia.id_materia)) continue;
    vistos.add(materia.id_materia);
    materiasFracas.push(materia);
    if (materiasFracas.length >= LIMITE_MATERIAS_FRACAS) break;
  }

  return {
    diagnostico: textoOuFallback(json.diagnostico, "Análise gerada sem diagnóstico detalhado.", 1500),
    pontosFortes: textoOuFallback(json.pontosFortes, "Análise gerada sem pontos fortes detalhados.", 1000),
    recomendacaoGeral: textoOuFallback(json.recomendacaoGeral, "Continue praticando simulados e redações.", 1000),
    materiasFracas, // [{id_materia, nome}]
  };
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

  async corrigirRedacao({ tema, texto, tipoRedacao }) {
    const temaLimpo = String(tema || "").trim().slice(0, 200);
    const textoLimpo = String(texto || "").trim();

    if (textoLimpo.length < TAMANHO_MINIMO_REDACAO) {
      throw new Error(`A redacao precisa ter pelo menos ${TAMANHO_MINIMO_REDACAO} caracteres.`);
    }
    if (textoLimpo.length > TAMANHO_MAXIMO_REDACAO) {
      throw new Error(`A redacao passou do limite de ${TAMANHO_MAXIMO_REDACAO} caracteres.`);
    }

    const perfil = buscarPerfilRedacao(tipoRedacao);
    // As instrucoes de cada perfil guardam "${tema}" como texto literal
    // (nao interpolado - o tema so existe aqui, em tempo de chamada),
    // substituido na mao pra nao precisar transformar cada entrada do
    // catalogo numa funcao.
    const instrucoesComTema = perfil.instrucoes.replace(/\$\{tema\}/g, temaLimpo);

    const prompt = [
      instrucoesComTema,
      `Para cada critério dê uma nota e um comentário construtivo e específico em`,
      `português do Brasil, apontando acertos e o que melhorar. Dê também um`,
      `comentário geral sobre o texto.\n\nRedação do aluno:\n${textoLimpo}`,
    ].join(" ");

    const resultado = await gerarComRotacaoDeChave("modeloRedacao", prompt);

    let json;
    try {
      json = JSON.parse(resultado.response.text());
    } catch (erro) {
      throw new Error("A IA retornou um formato invalido de correcao.");
    }

    return validarCorrecaoGerada(json, perfil.competencias);
  },

  async analisarDesempenho({ resumo, materiasDisponiveis }) {
    const prompt = montarPromptAnaliseDesempenho(resumo, materiasDisponiveis);
    const resultado = await gerarComRotacaoDeChave("modeloAnaliseDesempenho", prompt);

    let json;
    try {
      json = JSON.parse(resultado.response.text());
    } catch (erro) {
      throw new Error("A IA retornou um formato invalido de analise.");
    }

    return validarAnaliseGerada(json, materiasDisponiveis);
  },

  // Exposta pro teste isolado da defesa anti-alucinacao (mesmo padrao
  // de validarFormulario/validarCronograma, ja expostas justamente pra
  // permitir reuso/teste).
  validarAnaliseGerada,

  // Expostas pro router/views montarem o seletor de genero e resolverem
  // o rotulo/competencias de uma redacao ja salva, sem duplicar o
  // catalogo PERFIS_REDACAO em outro arquivo.
  resolverTipoRedacao,
  buscarPerfilRedacao,
  listarPerfisRedacao,

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
