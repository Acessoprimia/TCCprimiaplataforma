const pool = require("../../db");
const TABELAS = require("./tabelas");

const CHAVES_PADRAO = Object.freeze({
  aviso_site: "",
  texto_institucional: "",
  banner_principal_url: "",
  recurso_premium_destaque: "",
  periodo_teste_premium: "",
  email_contato_destino: "",
});

const queries = Object.freeze({
  listarTodas: `SELECT chave, valor FROM ${TABELAS.configuracoes}`,
  salvar: `
    INSERT INTO ${TABELAS.configuracoes} (chave, valor, id_admin_alteracao)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE valor = VALUES(valor), id_admin_alteracao = VALUES(id_admin_alteracao)
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ConfiguracaoModel = Object.freeze({
  async buscarMapa(conexao) {
    const [linhas] = await banco(conexao).query(queries.listarTodas);
    const mapa = { ...CHAVES_PADRAO };
    linhas.forEach((linha) => {
      mapa[linha.chave] = linha.valor || "";
    });
    return mapa;
  },

  async salvar({ chave, valor, idAdmin }, conexao) {
    await banco(conexao).query(queries.salvar, [chave, valor, idAdmin || null]);
  },
});

module.exports = ConfiguracaoModel;
