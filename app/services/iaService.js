const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { PDFParse } = require("pdf-parse");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const nomeModelo = process.env.GEMINI_MODEL || "gemini-flash-latest";
const modelo = genAI.getGenerativeModel({ model: nomeModelo });

const LIMITE_CARACTERES_PDF = 40000;
const QUANTIDADE_PADRAO_PERGUNTAS = 5;
const QUANTIDADE_MAXIMA_PERGUNTAS = 10;
const QUANTIDADE_ALTERNATIVAS = 4;
const DIFICULDADES_VALIDAS = ["facil", "medio", "dificil"];

const modeloSimulado = genAI.getGenerativeModel({
  model: nomeModelo,
  generationConfig: {
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
  },
});

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
    const resultado = await modelo.generateContent(prompt);
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
      const resultado = await modelo.generateContent([
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

    const resultado = await modeloSimulado.generateContent(prompt);

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
});

module.exports = IaService;
