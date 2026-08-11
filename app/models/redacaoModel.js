const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criar: `
    INSERT INTO ${TABELAS.redacoes}
      (id_aluno, tema, texto, tipo_redacao, nota_c1, nota_c2, nota_c3, nota_c4, nota_c5, nota_total,
       comentario_c1, comentario_c2, comentario_c3, comentario_c4, comentario_c5, comentario_geral)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  buscarPorId: `SELECT * FROM ${TABELAS.redacoes} WHERE id_redacao = ? LIMIT 1`,
  listarPorAluno: `
    SELECT id_redacao, tema, tipo_redacao, nota_total, criado_em
    FROM ${TABELAS.redacoes}
    WHERE id_aluno = ?
    ORDER BY criado_em DESC
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const RedacaoModel = Object.freeze({
  async criar({ idAluno, tema, texto, tipoRedacao, correcao }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idAluno,
      tema,
      texto,
      tipoRedacao,
      correcao.c1.nota,
      correcao.c2.nota,
      correcao.c3.nota,
      correcao.c4.nota,
      correcao.c5.nota,
      correcao.notaTotal,
      correcao.c1.comentario,
      correcao.c2.comentario,
      correcao.c3.comentario,
      correcao.c4.comentario,
      correcao.c5.comentario,
      correcao.comentarioGeral,
    ]);
    return resultado.insertId;
  },

  async buscarPorId(id, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarPorId, [id]);
    return linhas[0] || null;
  },

  async listarPorAluno(idAluno, conexao) {
    const [linhas] = await banco(conexao).query(queries.listarPorAluno, [idAluno]);
    return linhas;
  },
});

module.exports = RedacaoModel;
