const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criarProfessor: `
    INSERT INTO ${TABELAS.professores}
      (id_professor, id_materia, diploma, data_nascimento)
    VALUES (?, ?, ?, ?)
  `,
  listarProfessores: `
    SELECT p.id_professor, u.nome, u.email, u.tipo_usuario, u.status, p.diploma
    FROM ${TABELAS.professores} p
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = p.id_professor
    ORDER BY u.nome
  `,
  definirDiplomaPendente: `
    UPDATE ${TABELAS.professores}
    SET diploma_pendente = ?, diploma_pendente_em = ?
    WHERE id_professor = ?
  `,
  aprovarDiplomaPendente: `
    UPDATE ${TABELAS.professores}
    SET diploma = diploma_pendente, diploma_pendente = NULL, diploma_pendente_em = NULL
    WHERE id_professor = ? AND diploma_pendente IS NOT NULL
  `,
  limparDiplomaPendente: `
    UPDATE ${TABELAS.professores}
    SET diploma_pendente = NULL, diploma_pendente_em = NULL
    WHERE id_professor = ?
  `,
  atualizarDiploma: `
    UPDATE ${TABELAS.professores}
    SET diploma = ?
    WHERE id_professor = ?
  `,
  buscarPerfilCompleto: `
    SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, u.foto_url, u.perfil_publico, u.foto_publica, p.id_materia, p.diploma, p.diploma_pendente, p.data_nascimento, m.nome AS materia
    FROM ${TABELAS.usuarios} u
    LEFT JOIN ${TABELAS.professores} p ON p.id_professor = u.id_usuario
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
    WHERE u.id_usuario = ?
  `,
  buscarUltimoPerfil: `
    SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, u.foto_url, u.perfil_publico, u.foto_publica, p.id_materia, p.diploma, p.data_nascimento, m.nome AS materia
    FROM ${TABELAS.usuarios} u
    INNER JOIN ${TABELAS.professores} p ON p.id_professor = u.id_usuario
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
    WHERE u.tipo_usuario = 'professor'
    ORDER BY u.id_usuario DESC
    LIMIT 1
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ProfessorModel = Object.freeze({
  async criar({ idProfessor, idMateria, diploma, dataNascimento }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarProfessor, [
      idProfessor,
      idMateria,
      diploma,
      dataNascimento,
    ]);
    return resultado;
  },

  async definirDiplomaPendente({ diplomaPendente, idProfessor }, conexao) {
    const [resultado] = await banco(conexao).query(queries.definirDiplomaPendente, [diplomaPendente, new Date(), idProfessor]);
    return resultado;
  },

  async aprovarDiplomaPendente(idProfessor, conexao) {
    const [resultado] = await banco(conexao).query(queries.aprovarDiplomaPendente, [idProfessor]);
    return resultado;
  },

  async limparDiplomaPendente(idProfessor, conexao) {
    const [resultado] = await banco(conexao).query(queries.limparDiplomaPendente, [idProfessor]);
    return resultado;
  },

  async atualizarDiploma({ diploma, idProfessor }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarDiploma, [diploma, idProfessor]);
    return resultado;
  },

  async listar(conexao) {
    const [professores] = await banco(conexao).query(queries.listarProfessores);
    return professores;
  },

  async buscarPerfilCompleto(idUsuario, conexao) {
    const [perfis] = await banco(conexao).query(queries.buscarPerfilCompleto, [idUsuario]);
    return perfis[0] || null;
  },

  async buscarUltimoPerfil(conexao) {
    const [perfis] = await banco(conexao).query(queries.buscarUltimoPerfil);
    return perfis[0] || null;
  },
});

module.exports = ProfessorModel;
