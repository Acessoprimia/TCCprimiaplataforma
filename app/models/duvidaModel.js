const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listar: `
    SELECT
      d.id_duvida,
      d.duvida,
      d.status,
      d.data_envio,
      TIMESTAMPDIFF(SECOND, d.data_envio, NOW()) AS segundos_desde_envio,
      f.id_forum,
      f.nome AS forum_nome,
      m.id_materia,
      m.nome AS materia,
      a.serie,
      u.id_usuario AS id_aluno,
      u.nome AS aluno_nome
    FROM ${TABELAS.duvidas} d
    INNER JOIN ${TABELAS.forum} f ON f.id_forum = d.id_forum
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    INNER JOIN ${TABELAS.alunos} a ON a.id_aluno = d.id_aluno
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = a.id_aluno
    ORDER BY d.data_envio DESC
  `,
  listarPorProfessor: `
    SELECT
      d.id_duvida,
      d.duvida,
      d.status,
      d.data_envio,
      TIMESTAMPDIFF(SECOND, d.data_envio, NOW()) AS segundos_desde_envio,
      f.id_forum,
      f.nome AS forum_nome,
      m.id_materia,
      m.nome AS materia,
      a.serie,
      u.id_usuario AS id_aluno,
      u.nome AS aluno_nome
    FROM ${TABELAS.duvidas} d
    INNER JOIN ${TABELAS.forum} f ON f.id_forum = d.id_forum
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    INNER JOIN ${TABELAS.alunos} a ON a.id_aluno = d.id_aluno
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = a.id_aluno
    INNER JOIN ${TABELAS.professores} p ON p.id_materia = f.id_materia
    WHERE p.id_professor = ?
    ORDER BY d.data_envio DESC
  `,
  criar: `
    INSERT INTO ${TABELAS.duvidas}
      (id_aluno, id_forum, duvida)
    VALUES (?, ?, ?)
  `,
  excluirDoAluno: `
    DELETE FROM ${TABELAS.duvidas}
    WHERE id_duvida = ?
      AND id_aluno = ?
  `,
  marcarRespondida: `
    UPDATE ${TABELAS.duvidas}
    SET status = 'respondida'
    WHERE id_duvida = ?
  `,
  atualizarStatusPorRespostas: `
    UPDATE ${TABELAS.duvidas} d
    SET d.status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM ${TABELAS.respostas} r
        WHERE r.id_duvida = d.id_duvida
      ) THEN 'respondida'
      ELSE 'pendente'
    END
    WHERE d.id_duvida = ?
  `,
  buscarParaResposta: `
    SELECT
      d.id_duvida,
      d.id_aluno,
      d.duvida,
      f.id_materia,
      m.nome AS materia,
      p.id_professor
    FROM ${TABELAS.duvidas} d
    INNER JOIN ${TABELAS.forum} f ON f.id_forum = d.id_forum
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    INNER JOIN ${TABELAS.professores} p ON p.id_materia = f.id_materia
    WHERE d.id_duvida = ?
      AND p.id_professor = ?
    LIMIT 1
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const DuvidaModel = Object.freeze({
  async listar(conexao) {
    const [duvidas] = await banco(conexao).query(queries.listar);
    return duvidas;
  },

  async listarPorProfessor(idProfessor, conexao) {
    const [duvidas] = await banco(conexao).query(queries.listarPorProfessor, [idProfessor]);
    return duvidas;
  },

  async criar({ idAluno, idForum, duvida }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criar, [idAluno, idForum, duvida]);
    return resultado.insertId;
  },

  async excluirDoAluno({ idDuvida, idAluno }, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirDoAluno, [idDuvida, idAluno]);
    return resultado;
  },

  async marcarRespondida(idDuvida, conexao) {
    const [resultado] = await banco(conexao).query(queries.marcarRespondida, [idDuvida]);
    return resultado;
  },

  async atualizarStatusPorRespostas(idDuvida, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarStatusPorRespostas, [
      idDuvida,
    ]);
    return resultado;
  },

  async buscarParaResposta({ idDuvida, idProfessor }, conexao) {
    const [duvidas] = await banco(conexao).query(queries.buscarParaResposta, [
      idDuvida,
      idProfessor,
    ]);
    return duvidas[0] || null;
  },
});

module.exports = DuvidaModel;
