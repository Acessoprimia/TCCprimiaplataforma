const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarAtivas: `
    SELECT id_materia, nome, descricao, icone_url, icone_svg
    FROM ${TABELAS.materias}
    ORDER BY nome
  `,
  buscarPorNome: `
    SELECT id_materia, nome
    FROM ${TABELAS.materias}
    WHERE nome = ?
    LIMIT 1
  `,
  buscarPorId: `
    SELECT id_materia, nome, descricao, icone_url, icone_svg
    FROM ${TABELAS.materias}
    WHERE id_materia = ?
    LIMIT 1
  `,
  criarMateria: `
    INSERT INTO ${TABELAS.materias}
      (nome, descricao, icone_url, icone_svg)
    VALUES (?, ?, ?, ?)
  `,
  removerMateria: `
    DELETE FROM ${TABELAS.materias}
    WHERE id_materia = ?
  `,
  // Sempre grava os dois campos juntos (um deles null) - assim trocar o
  // icone de raster pra SVG (ou vice-versa) limpa o campo antigo, em vez
  // de deixar dado orfao no banco.
  atualizarIcone: `
    UPDATE ${TABELAS.materias}
    SET icone_url = ?, icone_svg = ?
    WHERE id_materia = ?
  `,
  // So checa Professor porque e o unico vinculo com ON DELETE SET NULL
  // que quebraria algo importante em silencio (professor ficar sem
  // materia). Plano_de_Estudo/Plano_de_Aula/Forum sao ON DELETE
  // RESTRICT - o proprio banco ja bloqueia e o erro e traduzido lá em cima.
  contarProfessoresVinculados: `
    SELECT COUNT(*) AS total FROM ${TABELAS.professores} WHERE id_materia = ?
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

  async buscarPorId(idMateria, conexao) {
    const [materias] = await banco(conexao).query(queries.buscarPorId, [idMateria]);
    return materias[0] || null;
  },

  async criar({ nome, descricao, iconeUrl, iconeSvg }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarMateria, [
      nome,
      descricao || null,
      iconeUrl || null,
      iconeSvg || null,
    ]);
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

  async atualizarIcone({ idMateria, iconeUrl, iconeSvg }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarIcone, [
      iconeUrl || null,
      iconeSvg || null,
      idMateria,
    ]);
    return resultado;
  },

  async contarProfessoresVinculados(idMateria, conexao) {
    const [linhas] = await banco(conexao).query(queries.contarProfessoresVinculados, [idMateria]);
    return linhas[0]?.total || 0;
  },
});

module.exports = MateriaModel;
