const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarPublicados: `
    SELECT c.id, c.titulo, c.descricao, c.tipo, c.is_premium, c.destaque, m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id = c.materia_id
    WHERE c.status = 'publicado'
    ORDER BY c.criado_em DESC
  `,
  criarConteudo: `
    INSERT INTO ${TABELAS.conteudos}
      (titulo, descricao, tipo, materia_id, professor_id, arquivo_url, imagem_url, is_premium, destaque, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ConteudoModel = Object.freeze({
  async listarPublicados(conexao) {
    const [conteudos] = await banco(conexao).query(queries.listarPublicados);
    return conteudos;
  },

  async criar(
    {
      titulo,
      descricao,
      tipo,
      materiaId,
      professorId,
      arquivoUrl,
      imagemUrl,
      isPremium,
      destaque,
      status,
    },
    conexao
  ) {
    const [resultado] = await banco(conexao).query(queries.criarConteudo, [
      titulo,
      descricao,
      tipo,
      materiaId,
      professorId,
      arquivoUrl,
      imagemUrl,
      isPremium,
      destaque,
      status,
    ]);
    return resultado.insertId;
  },
});

module.exports = ConteudoModel;
