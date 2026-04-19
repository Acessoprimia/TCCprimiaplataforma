const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarDuvidas: `
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
  listarDuvidasPorProfessor: `
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
  listarRespostasPorDuvida: `
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
  criarDuvida: `
    INSERT INTO ${TABELAS.duvidas}
      (id_aluno, id_forum, duvida)
    VALUES (?, ?, ?)
  `,
  criarResposta: `
    INSERT INTO ${TABELAS.respostas}
      (id_professor, id_duvida, resposta)
    VALUES (?, ?, ?)
  `,
  excluirDuvidaDoAluno: `
    DELETE FROM ${TABELAS.duvidas}
    WHERE id_duvida = ?
      AND id_aluno = ?
  `,
  excluirRespostasDaDuvidaDoAluno: `
    DELETE r
    FROM ${TABELAS.respostas} r
    INNER JOIN ${TABELAS.duvidas} d ON d.id_duvida = r.id_duvida
    WHERE d.id_duvida = ?
      AND d.id_aluno = ?
  `,
  excluirRespostaDoProfessor: `
    DELETE FROM ${TABELAS.respostas}
    WHERE id_resposta = ?
      AND id_professor = ?
  `,
  marcarDuvidaRespondida: `
    UPDATE ${TABELAS.duvidas}
    SET status = 'respondida'
    WHERE id_duvida = ?
  `,
  atualizarStatusDuvidaPorRespostas: `
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
  buscarDuvidaParaResposta: `
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

async function anexarRespostas(duvidas, conexao) {
  const resultado = [];

  for (const duvida of duvidas) {
    const [respostas] = await banco(conexao).query(queries.listarRespostasPorDuvida, [
      duvida.id_duvida,
    ]);
    resultado.push({ ...duvida, respostas });
  }

  return resultado;
}

const ForumModel = Object.freeze({
  async listarDuvidas(conexao) {
    const [duvidas] = await banco(conexao).query(queries.listarDuvidas);
    return anexarRespostas(duvidas, conexao);
  },

  async listarDuvidasPorProfessor(idProfessor, conexao) {
    const [duvidas] = await banco(conexao).query(queries.listarDuvidasPorProfessor, [
      idProfessor,
    ]);
    return anexarRespostas(duvidas, conexao);
  },

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

  async criarDuvida({ idAluno, idForum, duvida }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarDuvida, [
      idAluno,
      idForum,
      duvida,
    ]);
    return resultado.insertId;
  },

  async criarResposta({ idProfessor, idDuvida, resposta }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarResposta, [
      idProfessor,
      idDuvida,
      resposta,
    ]);
    return resultado.insertId;
  },

  async excluirDuvidaDoAluno({ idDuvida, idAluno }, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirDuvidaDoAluno, [
      idDuvida,
      idAluno,
    ]);
    return resultado;
  },

  async excluirRespostasDaDuvidaDoAluno({ idDuvida, idAluno }, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirRespostasDaDuvidaDoAluno, [
      idDuvida,
      idAluno,
    ]);
    return resultado;
  },

  async excluirRespostaDoProfessor({ idResposta, idProfessor }, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirRespostaDoProfessor, [
      idResposta,
      idProfessor,
    ]);
    return resultado;
  },

  async marcarDuvidaRespondida(idDuvida, conexao) {
    const [resultado] = await banco(conexao).query(queries.marcarDuvidaRespondida, [idDuvida]);
    return resultado;
  },

  async atualizarStatusDuvidaPorRespostas(idDuvida, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarStatusDuvidaPorRespostas, [
      idDuvida,
    ]);
    return resultado;
  },

  async buscarDuvidaParaResposta({ idDuvida, idProfessor }, conexao) {
    const [duvidas] = await banco(conexao).query(queries.buscarDuvidaParaResposta, [
      idDuvida,
      idProfessor,
    ]);
    return duvidas[0] || null;
  },

  async listarProfessoresPorForum(idForum, conexao) {
    const [professores] = await banco(conexao).query(queries.listarProfessoresPorForum, [
      idForum,
    ]);
    return professores;
  },
});

module.exports = ForumModel;
