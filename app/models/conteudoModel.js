const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarPublicadosPorTipo: `
    SELECT c.id, c.titulo, c.autor, c.descricao, c.tipo, c.imagem_url, c.arquivo_url,
           c.is_premium, c.destaque, m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
    WHERE c.status = 'publicado' AND c.tipo = ?
    ORDER BY c.criado_em DESC
  `,
  buscarPorId: `
    SELECT c.id, c.titulo, c.autor, c.descricao, c.tipo, c.imagem_url, c.arquivo_url,
           c.is_premium, c.destaque, m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
    WHERE c.id = ? AND c.status = 'publicado'
    LIMIT 1
  `,
  criarConteudo: `
    INSERT INTO ${TABELAS.conteudos}
      (titulo, autor, descricao, tipo, materia_id, professor_id, arquivo_url, imagem_url, is_premium, destaque, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ConteudoModel = Object.freeze({
  async listarPublicadosPorTipo(tipo, conexao) {
    const [conteudos] = await banco(conexao).query(queries.listarPublicadosPorTipo, [tipo]);
    return conteudos;
  },

  async buscarPorId(id, conexao) {
    const [conteudos] = await banco(conexao).query(queries.buscarPorId, [id]);
    return conteudos[0] || null;
  },

  async criar(
    {
      titulo,
      autor,
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
      autor,
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
