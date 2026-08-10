const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  buscarAtiva: `
    SELECT id_assinatura, status, data_inicio, data_fim
    FROM ${TABELAS.assinaturasPremium}
    WHERE id_usuario = ? AND status = 'ativa'
    LIMIT 1
  `,
  criar: `
    INSERT INTO ${TABELAS.assinaturasPremium}
      (id_usuario, status, data_inicio)
    VALUES (?, 'ativa', CURDATE())
  `,
  cancelarAtivas: `
    UPDATE ${TABELAS.assinaturasPremium}
    SET status = 'cancelada', data_fim = CURDATE()
    WHERE id_usuario = ? AND status = 'ativa'
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

  // Idempotente: se ja existe assinatura ativa, nao cria outra (evita
  // acumular linhas 'ativa' duplicadas pro mesmo usuario).
  async conceder(idUsuario, conexao) {
    const bancoUsado = banco(conexao);
    const jaAtiva = await AssinaturaModel.estaAtiva(idUsuario, bancoUsado);
    if (jaAtiva) return false;

    await bancoUsado.query(queries.criar, [idUsuario]);
    return true;
  },

  // Cancela TODAS as linhas ativas do usuario, nao so a mais recente -
  // se por algum motivo existir mais de uma (nao deveria, mas ja
  // aconteceu em teste), garante que nenhuma fique esquecida ativa.
  async revogar(idUsuario, conexao) {
    const [resultado] = await banco(conexao).query(queries.cancelarAtivas, [idUsuario]);
    return resultado.affectedRows;
  },
});

module.exports = AssinaturaModel;
