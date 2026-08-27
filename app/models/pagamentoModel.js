const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criar: `
    INSERT INTO ${TABELAS.pagamentos}
      (id_usuario, referencia_externa, valor_centavos, dias_premium)
    VALUES (?, ?, ?, ?)
  `,
  buscarPorReferenciaExterna: `
    SELECT * FROM ${TABELAS.pagamentos} WHERE referencia_externa = ? LIMIT 1
  `,
  atualizarStatus: `
    UPDATE ${TABELAS.pagamentos}
    SET status = ?, id_transacao_gateway = ?
    WHERE referencia_externa = ?
  `,
  listarPorAluno: `
    SELECT * FROM ${TABELAS.pagamentos} WHERE id_usuario = ? ORDER BY criado_em DESC
  `,
  cancelarPendente: `
    UPDATE ${TABELAS.pagamentos}
    SET status = 'cancelado'
    WHERE id_pagamento = ? AND id_usuario = ? AND status = 'pendente'
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const PagamentoModel = Object.freeze({
  async criar({ idUsuario, referenciaExterna, valorCentavos, diasPremium }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idUsuario,
      referenciaExterna,
      valorCentavos,
      diasPremium,
    ]);
    return resultado.insertId;
  },

  async buscarPorReferenciaExterna(referenciaExterna, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarPorReferenciaExterna, [referenciaExterna]);
    return linhas[0] || null;
  },

  async atualizarStatus({ referenciaExterna, status, idTransacaoGateway }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarStatus, [
      status,
      idTransacaoGateway || null,
      referenciaExterna,
    ]);
    return resultado;
  },

  async listarPorAluno(idUsuario, conexao) {
    const [linhas] = await banco(conexao).query(queries.listarPorAluno, [idUsuario]);
    return linhas;
  },

  async cancelarPendente({ idPagamento, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.cancelarPendente, [idPagamento, idUsuario]);
    return resultado.affectedRows > 0;
  },
});

module.exports = PagamentoModel;
