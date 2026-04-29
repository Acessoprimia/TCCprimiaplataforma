const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  buscarForumPorMateria: `
    SELECT id_forum, id_materia, nome, descricao
    FROM ${TABELAS.forum}
    WHERE id_materia = ?
    LIMIT 1
  `,
  criarForum: `
    INSERT INTO ${TABELAS.forum}
      (id_materia, nome, descricao)
    VALUES (?, ?, ?)
  `,
  listarProfessoresPorForum: `
    SELECT p.id_professor, u.nome, m.nome AS materia
    FROM ${TABELAS.professores} p
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = p.id_professor
    INNER JOIN ${TABELAS.forum} f ON f.id_materia = p.id_materia
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
    WHERE f.id_forum = ?
      AND u.status = 'ativo'
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ForumModel = Object.freeze({
  async buscarForumPorMateria(idMateria, conexao) {
    const [foruns] = await banco(conexao).query(queries.buscarForumPorMateria, [idMateria]);
    return foruns[0] || null;
  },

  async buscarOuCriarForumPorMateria({ idMateria, nomeMateria }, conexao) {
    const forum = await this.buscarForumPorMateria(idMateria, conexao);

    if (forum) {
      return forum.id_forum;
    }

    const [resultado] = await banco(conexao).query(queries.criarForum, [
      idMateria,
      `Fórum de ${nomeMateria}`,
      `Dúvidas de ${nomeMateria}`,
    ]);
    return resultado.insertId;
  },

  async listarProfessoresPorForum(idForum, conexao) {
    const [professores] = await banco(conexao).query(queries.listarProfessoresPorForum, [
      idForum,
    ]);
    return professores;
  },
});

module.exports = ForumModel;
