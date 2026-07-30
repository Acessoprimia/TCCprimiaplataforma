const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criarFormulario: `
    INSERT INTO ${TABELAS.formularios}
      (id_aluno, id_professor, id_materia, titulo, schema_json, gerado_por_ia)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  buscarPorId: `
    SELECT f.id_formulario, f.id_aluno, f.id_professor, f.id_materia, f.titulo,
           f.schema_json, f.gerado_por_ia, f.criado_em, m.nome AS materia
    FROM ${TABELAS.formularios} f
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    WHERE f.id_formulario = ?
    LIMIT 1
  `,
  listarPorAluno: `
    SELECT f.id_formulario, f.titulo, f.criado_em, m.nome AS materia
    FROM ${TABELAS.formularios} f
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    WHERE f.id_aluno = ?
    ORDER BY f.criado_em DESC
  `,
  listarPublicadosPremium: `
    SELECT f.id_formulario, f.titulo, f.criado_em, m.nome AS materia, u.nome AS professor
    FROM ${TABELAS.formularios} f
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    LEFT JOIN ${TABELAS.usuarios} u ON u.id_usuario = f.id_professor
    WHERE f.id_professor IS NOT NULL
    ORDER BY f.criado_em DESC
  `,
  listarPorProfessor: `
    SELECT f.id_formulario, f.titulo, f.criado_em, m.nome AS materia
    FROM ${TABELAS.formularios} f
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    WHERE f.id_professor = ?
    ORDER BY f.criado_em DESC
  `,
  criarResposta: `
    INSERT INTO ${TABELAS.respostasFormulario}
      (id_formulario, id_aluno, pergunta_ref, resposta_aluno, correta)
    VALUES (?, ?, ?, ?, ?)
  `,
  listarRespostas: `
    SELECT pergunta_ref, resposta_aluno, correta
    FROM ${TABELAS.respostasFormulario}
    WHERE id_formulario = ? AND id_aluno = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const FormularioModel = Object.freeze({
  async criar({ idAluno, idProfessor, idMateria, titulo, schemaJson, geradoPorIa }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarFormulario, [
      idAluno || null,
      idProfessor || null,
      idMateria || null,
      titulo,
      JSON.stringify(schemaJson),
      !!geradoPorIa,
    ]);
    return resultado.insertId;
  },

  async buscarPorId(id, conexao) {
    const [formularios] = await banco(conexao).query(queries.buscarPorId, [id]);
    return formularios[0] || null;
  },

  async listarPorAluno(idAluno, conexao) {
    const [formularios] = await banco(conexao).query(queries.listarPorAluno, [idAluno]);
    return formularios;
  },

  async listarPublicadosPremium(conexao) {
    const [formularios] = await banco(conexao).query(queries.listarPublicadosPremium);
    return formularios;
  },

  async listarPorProfessor(idProfessor, conexao) {
    const [formularios] = await banco(conexao).query(queries.listarPorProfessor, [idProfessor]);
    return formularios;
  },

  async salvarResposta({ idFormulario, idAluno, perguntaRef, respostaAluno, correta }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarResposta, [
      idFormulario,
      idAluno,
      perguntaRef,
      respostaAluno,
      correta,
    ]);
    return resultado.insertId;
  },

  async listarRespostas(idFormulario, idAluno, conexao) {
    const [respostas] = await banco(conexao).query(queries.listarRespostas, [idFormulario, idAluno]);
    return respostas;
  },
});

module.exports = FormularioModel;
