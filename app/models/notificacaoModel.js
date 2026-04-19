const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criar: `
    INSERT INTO ${TABELAS.notificacoes}
      (id_usuario, tipo, titulo, mensagem, link)
    VALUES (?, ?, ?, ?, ?)
  `,
  listarPorUsuario: `
    SELECT
      id_notificacao,
      tipo,
      titulo,
      mensagem,
      link,
      lida,
      data_criacao,
      TIMESTAMPDIFF(SECOND, data_criacao, NOW()) AS segundos_desde_criacao
    FROM ${TABELAS.notificacoes}
    WHERE id_usuario = ?
    ORDER BY data_criacao DESC
    LIMIT ?
  `,
  contarNaoLidas: `
    SELECT COUNT(*) AS total
    FROM ${TABELAS.notificacoes}
    WHERE id_usuario = ?
      AND lida = FALSE
  `,
  marcarComoLida: `
    UPDATE ${TABELAS.notificacoes}
    SET lida = TRUE
    WHERE id_notificacao = ?
      AND id_usuario = ?
  `,
  marcarTodasComoLidas: `
    UPDATE ${TABELAS.notificacoes}
    SET lida = TRUE
    WHERE id_usuario = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const NotificacaoModel = Object.freeze({
  async criar({ idUsuario, tipo, titulo, mensagem, link = "/sobre" }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idUsuario,
      tipo,
      titulo,
      mensagem,
      link,
    ]);
    return resultado.insertId;
  },

  async listarPorUsuario(idUsuario, limite = 10, conexao) {
    const [notificacoes] = await banco(conexao).query(queries.listarPorUsuario, [
      idUsuario,
      limite,
    ]);
    return notificacoes;
  },

  async contarNaoLidas(idUsuario, conexao) {
    const [linhas] = await banco(conexao).query(queries.contarNaoLidas, [idUsuario]);
    return linhas[0]?.total || 0;
  },

  async marcarComoLida({ idNotificacao, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.marcarComoLida, [
      idNotificacao,
      idUsuario,
    ]);
    return resultado;
  },

  async marcarTodasComoLidas(idUsuario, conexao) {
    const [resultado] = await banco(conexao).query(queries.marcarTodasComoLidas, [idUsuario]);
    return resultado;
  },
});

module.exports = NotificacaoModel;
