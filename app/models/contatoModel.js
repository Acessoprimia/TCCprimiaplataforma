const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criarMensagem: `
    INSERT INTO ${TABELAS.mensagensContato}
      (usuario_id, nome, email, assunto, mensagem, origem, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pendente')
  `,
  listarMensagens: `
    SELECT id, nome, email, assunto, mensagem, origem, status, criado_em
    FROM ${TABELAS.mensagensContato}
    ORDER BY criado_em DESC
  `,
  marcarRespondido: `
    UPDATE ${TABELAS.mensagensContato}
    SET status = 'respondido'
    WHERE id = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ContatoModel = Object.freeze({
  async criar({ usuarioId, nome, email, assunto, mensagem, origem }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarMensagem, [
      usuarioId,
      nome,
      email,
      assunto,
      mensagem,
      origem,
    ]);
    return resultado.insertId;
  },

  async listar(conexao) {
    const [mensagens] = await banco(conexao).query(queries.listarMensagens);
    return mensagens;
  },

  async marcarRespondido(idMensagem, conexao) {
    const [resultado] = await banco(conexao).query(queries.marcarRespondido, [idMensagem]);
    return resultado;
  },
});

module.exports = ContatoModel;
