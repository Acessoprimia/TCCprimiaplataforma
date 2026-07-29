const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFParse } = require("pdf-parse");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const nomeModelo = process.env.GEMINI_MODEL || "gemini-flash-latest";
const modelo = genAI.getGenerativeModel({ model: nomeModelo });

const LIMITE_CARACTERES_PDF = 40000;

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

    const resultado = await modelo.generateContent([
      { fileData: { mimeType: "video/*", fileUri: urlYoutube } },
      { text: promptTexto },
    ]);
    return resultado.response.text().trim();
  },
});

module.exports = IaService;
