const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criarMensagem: `
    INSERT INTO ${TABELAS.mensagensContato}
      (usuario_id, nome, email, assunto, mensagem, origem, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pendente')
  `,
  listarMensagens: `
    SELECT id, nome, email, assunto, mensagem, origem, status, resposta_admin, criado_em, resolvido_em
    FROM ${TABELAS.mensagensContato}
    ORDER BY criado_em DESC
  `,
  marcarRespondido: `
    UPDATE ${TABELAS.mensagensContato}
    SET status = 'respondido'
    WHERE id = ?
  `,
  responder: `
    UPDATE ${TABELAS.mensagensContato}
    SET resposta_admin = ?, status = 'respondido'
    WHERE id = ?
  `,
  resolver: `
    UPDATE ${TABELAS.mensagensContato}
    SET status = 'resolvido', resolvido_em = NOW()
    WHERE id = ?
  `,
  remover: `
    DELETE FROM ${TABELAS.mensagensContato}
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

  async responder({ id, resposta }, conexao) {
    const [resultado] = await banco(conexao).query(queries.responder, [resposta, id]);
    return resultado;
  },

  async resolver(id, conexao) {
    const [resultado] = await banco(conexao).query(queries.resolver, [id]);
    return resultado;
  },

  async remover(id, conexao) {
    const [resultado] = await banco(conexao).query(queries.remover, [id]);
    return resultado;
  },
});

module.exports = ContatoModel;
