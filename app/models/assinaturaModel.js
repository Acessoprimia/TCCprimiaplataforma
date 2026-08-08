const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  buscarAtiva: `
    SELECT id_assinatura, status, data_inicio, data_fim
    FROM ${TABELAS.assinaturasPremium}
    WHERE id_usuario = ? AND status = 'ativa'
    LIMIT 1
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const AssinaturaModel = Object.freeze({
  async estaAtiva(idUsuario, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarAtiva, [idUsuario]);
    return linhas.length > 0;
  },
});

module.exports = AssinaturaModel;
