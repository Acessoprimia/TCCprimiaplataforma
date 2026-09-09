const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarPorUsuario: `
    SELECT tipo, ativo
    FROM ${TABELAS.preferenciasNotificacao}
    WHERE id_usuario = ?
  `,
  // So precisa saber se existe um "desligado" explicito - sem linha
  // significa ligado (padrao de quem nunca mexeu nas configuracoes).
  estaDesligado: `
    SELECT 1
    FROM ${TABELAS.preferenciasNotificacao}
    WHERE id_usuario = ?
      AND tipo = ?
      AND ativo = FALSE
    LIMIT 1
  `,
  definir: `
    INSERT INTO ${TABELAS.preferenciasNotificacao}
      (id_usuario, tipo, ativo)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE ativo = VALUES(ativo)
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const PreferenciaNotificacaoModel = Object.freeze({
  // Devolve um mapa { tipo: ativo } so com o que a pessoa mexeu.
  async buscarMapaPorUsuario(idUsuario, conexao) {
    const [linhas] = await banco(conexao).query(queries.listarPorUsuario, [idUsuario]);

    return linhas.reduce((mapa, linha) => {
      mapa[linha.tipo] = Boolean(linha.ativo);
      return mapa;
    }, {});
  },

  async tipoEstaAtivo(idUsuario, tipo, conexao) {
    const [linhas] = await banco(conexao).query(queries.estaDesligado, [idUsuario, tipo]);
    return linhas.length === 0;
  },

  async definir({ idUsuario, tipo, ativo }, conexao) {
    const [resultado] = await banco(conexao).query(queries.definir, [
      idUsuario,
      tipo,
      Boolean(ativo),
    ]);
    return resultado;
  },
});

module.exports = PreferenciaNotificacaoModel;
