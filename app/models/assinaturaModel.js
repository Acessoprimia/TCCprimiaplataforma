const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({

  buscarAtiva: `
    SELECT id_assinatura, status, data_inicio, data_fim
    FROM ${TABELAS.assinaturasPremium}
    WHERE id_usuario = ? AND status = 'ativa'
      AND (data_fim IS NULL OR data_fim >= CURDATE())
    LIMIT 1
  `,
  criar: `
    INSERT INTO ${TABELAS.assinaturasPremium}
      (id_usuario, status, data_inicio)
    VALUES (?, 'ativa', CURDATE())
  `,
  criarComPeriodo: `
    INSERT INTO ${TABELAS.assinaturasPremium}
      (id_usuario, status, data_inicio, data_fim)
    VALUES (?, 'ativa', CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))
  `,
  estenderPeriodo: `
    UPDATE ${TABELAS.assinaturasPremium}
    SET data_fim = DATE_ADD(?, INTERVAL ? DAY)
    WHERE id_assinatura = ?
  `,
  cancelarAtivas: `
    UPDATE ${TABELAS.assinaturasPremium}
    SET status = 'cancelada', data_fim = CURDATE()
    WHERE id_usuario = ? AND status = 'ativa'
  `,
  buscarQualquer: `
    SELECT id_assinatura FROM ${TABELAS.assinaturasPremium}
    WHERE id_usuario = ?
    LIMIT 1
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const AssinaturaModel = Object.freeze({
 
  async buscarAtivaDetalhe(idUsuario, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarAtiva, [idUsuario]);
    return linhas[0] || null;
  },

  async estaAtiva(idUsuario, conexao) {
    return (await AssinaturaModel.buscarAtivaDetalhe(idUsuario, conexao)) !== null;
  },


  async conceder(idUsuario, conexao) {
    const bancoUsado = banco(conexao);
    const jaAtiva = await AssinaturaModel.estaAtiva(idUsuario, bancoUsado);
    if (jaAtiva) return false;

    await bancoUsado.query(queries.criar, [idUsuario]);
    return true;
  },

 
  async concederPorPeriodo(idUsuario, dias, conexao) {
    const bancoUsado = banco(conexao);
    const ativa = await AssinaturaModel.buscarAtivaDetalhe(idUsuario, bancoUsado);

    if (ativa) {
     
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const baseData = ativa.data_fim && ativa.data_fim >= hoje ? ativa.data_fim : hoje;
      await bancoUsado.query(queries.estenderPeriodo, [baseData, dias, ativa.id_assinatura]);
      return;
    }

    await bancoUsado.query(queries.criarComPeriodo, [idUsuario, dias]);
  },

  async revogar(idUsuario, conexao) {
    const [resultado] = await banco(conexao).query(queries.cancelarAtivas, [idUsuario]);
    return resultado.affectedRows;
  },

  async jaTevePremium(idUsuario, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarQualquer, [idUsuario]);
    return linhas.length > 0;
  },
});

module.exports = AssinaturaModel;
