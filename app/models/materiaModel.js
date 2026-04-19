const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarAtivas: `
    SELECT id_materia, nome, descricao
    FROM ${TABELAS.materias}
    ORDER BY nome
  `,
  buscarPorNome: `
    SELECT id_materia, nome
    FROM ${TABELAS.materias}
    WHERE nome = ?
    LIMIT 1
  `,
  criarMateria: `
    INSERT INTO ${TABELAS.materias}
      (nome, descricao)
    VALUES (?, ?)
  `,
  removerMateria: `
    DELETE FROM ${TABELAS.materias}
    WHERE id_materia = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const MateriaModel = Object.freeze({
  async listarAtivas(conexao) {
    const [materias] = await banco(conexao).query(queries.listarAtivas);
    return materias;
  },

  async buscarPorNome(nome, conexao) {
    const [materias] = await banco(conexao).query(queries.buscarPorNome, [nome]);
    return materias[0] || null;
  },

  async criar({ nome, descricao }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarMateria, [nome, descricao]);
    return resultado.insertId;
  },

  async buscarOuCriar(nome, conexao) {
    const materia = await this.buscarPorNome(nome, conexao);

    if (materia) {
      return materia.id_materia;
    }

    return this.criar(
      {
        nome,
        descricao: `Conteudos de ${nome}`,
      },
      conexao
    );
  },

  async remover(idMateria, conexao) {
    const [resultado] = await banco(conexao).query(queries.removerMateria, [idMateria]);
    return resultado;
  },
});

module.exports = MateriaModel;
