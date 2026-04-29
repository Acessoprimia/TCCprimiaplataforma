const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarPorDuvida: `
    SELECT
      r.id_resposta,
      r.id_duvida,
      r.resposta,
      r.data_resposta,
      TIMESTAMPDIFF(SECOND, r.data_resposta, NOW()) AS segundos_desde_resposta,
      p.id_professor,
      u.nome AS professor_nome,
      m.nome AS materia
    FROM ${TABELAS.respostas} r
    INNER JOIN ${TABELAS.professores} p ON p.id_professor = r.id_professor
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = p.id_professor
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
    WHERE r.id_duvida = ?
    ORDER BY r.data_resposta ASC
  `,
  criar: `
    INSERT INTO ${TABELAS.respostas}
      (id_professor, id_duvida, resposta)
    VALUES (?, ?, ?)
  `,
  excluirDaDuvidaDoAluno: `
    DELETE r
    FROM ${TABELAS.respostas} r
    INNER JOIN ${TABELAS.duvidas} d ON d.id_duvida = r.id_duvida
    WHERE d.id_duvida = ?
      AND d.id_aluno = ?
  `,
  excluirDoProfessor: `
    DELETE FROM ${TABELAS.respostas}
    WHERE id_resposta = ?
      AND id_professor = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const RespostaModel = Object.freeze({
  async listarPorDuvida(idDuvida, conexao) {
    const [respostas] = await banco(conexao).query(queries.listarPorDuvida, [idDuvida]);
    return respostas;
  },

  async criar({ idProfessor, idDuvida, resposta }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idProfessor,
      idDuvida,
      resposta,
    ]);
    return resultado.insertId;
  },

  async excluirDaDuvidaDoAluno({ idDuvida, idAluno }, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirDaDuvidaDoAluno, [
      idDuvida,
      idAluno,
    ]);
    return resultado;
  },

  async excluirDoProfessor({ idResposta, idProfessor }, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirDoProfessor, [
      idResposta,
      idProfessor,
    ]);
    return resultado;
  },
});

module.exports = RespostaModel;
