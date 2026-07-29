const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const nomeModelo = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const modelo = genAI.getGenerativeModel({ model: nomeModelo });

const IaService = Object.freeze({
  async gerarSinopse({ titulo, autor, materia }) {
    const prompt = [
      `Escreva uma sinopse educativa e objetiva (no maximo 150 palavras)`,
      `para o material didatico "${titulo}"${autor ? `, de ${autor}` : ""}${materia ? `, da materia ${materia}` : ""}.`,
      `Escreva em portugues do Brasil, sem markdown, direto ao ponto,`,
      `para alunos do ensino medio.`,
    ].join(" ");

    const resultado = await modelo.generateContent(prompt);
    return resultado.response.text().trim();
  },
});

module.exports = IaService;
