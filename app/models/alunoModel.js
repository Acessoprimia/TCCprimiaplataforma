const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criarAluno: `
    INSERT INTO ${TABELAS.alunos}
      (id_aluno, RA, serie, data_nascimento)
    VALUES (?, ?, ?, ?)
  `,
  buscarPerfilCompleto: `
    SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, a.RA, a.serie, a.data_nascimento
    FROM ${TABELAS.usuarios} u
    LEFT JOIN ${TABELAS.alunos} a ON a.id_aluno = u.id_usuario
    WHERE u.id_usuario = ?
  `,
  buscarUltimoPerfil: `
    SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, a.RA, a.serie, a.data_nascimento
    FROM ${TABELAS.usuarios} u
    INNER JOIN ${TABELAS.alunos} a ON a.id_aluno = u.id_usuario
    WHERE u.tipo_usuario = 'aluno'
    ORDER BY u.id_usuario DESC
    LIMIT 1
  `,
  atualizarAluno: `
    UPDATE ${TABELAS.alunos}
    SET serie = ?
    WHERE id_aluno = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const AlunoModel = Object.freeze({
  async criar({ idAluno, ra, serie, dataNascimento }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarAluno, [
      idAluno,
      ra,
      serie,
      dataNascimento,
    ]);
    return resultado;
  },

  async buscarPerfilCompleto(idUsuario, conexao) {
    const [perfis] = await banco(conexao).query(queries.buscarPerfilCompleto, [idUsuario]);
    return perfis[0] || null;
  },

  async buscarUltimoPerfil(conexao) {
    const [perfis] = await banco(conexao).query(queries.buscarUltimoPerfil);
    return perfis[0] || null;
  },

  async atualizar({ serie, idAluno }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarAluno, [serie, idAluno]);
    return resultado;
  },
});

module.exports = AlunoModel;
