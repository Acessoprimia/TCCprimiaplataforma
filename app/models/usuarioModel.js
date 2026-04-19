const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  buscarPorEmail: `
    SELECT id_usuario, nome, email, senha, tipo_usuario, status
    FROM ${TABELAS.usuarios}
    WHERE email = ?
    LIMIT 1
  `,
  buscarEmailDeOutroUsuario: `
    SELECT id_usuario
    FROM ${TABELAS.usuarios}
    WHERE email = ? AND id_usuario <> ?
    LIMIT 1
  `,
  criarUsuario: `
    INSERT INTO ${TABELAS.usuarios}
      (nome, senha, email, tipo_usuario, status)
    VALUES (?, ?, ?, ?, ?)
  `,
  atualizarPerfilBasico: `
    UPDATE ${TABELAS.usuarios}
    SET nome = ?, email = ?
    WHERE id_usuario = ?
  `,
  atualizarSenha: `
    UPDATE ${TABELAS.usuarios}
    SET senha = ?
    WHERE id_usuario = ?
  `,
  alterarTipoConta: `
    UPDATE ${TABELAS.usuarios}
    SET tipo_usuario = ?
    WHERE id_usuario = ?
  `,
  alterarStatusConta: `
    UPDATE ${TABELAS.usuarios}
    SET status = ?
    WHERE id_usuario = ?
  `,
  excluirConta: `
    DELETE FROM ${TABELAS.usuarios}
    WHERE id_usuario = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const UsuarioModel = Object.freeze({
  async buscarPorEmail(email, conexao) {
    const [usuarios] = await banco(conexao).query(queries.buscarPorEmail, [email]);
    return usuarios[0] || null;
  },

  async emailJaCadastrado(email, conexao) {
    const usuario = await this.buscarPorEmail(email, conexao);
    return Boolean(usuario);
  },

  async emailPertenceAOutroUsuario(email, idUsuario, conexao) {
    const [usuarios] = await banco(conexao).query(queries.buscarEmailDeOutroUsuario, [
      email,
      idUsuario,
    ]);
    return usuarios.length > 0;
  },

  async criar({ nome, senhaCriptografada, email, tipoUsuario, status }, conexao) {
    const [resultado] = await banco(conexao).query(queries.criarUsuario, [
      nome,
      senhaCriptografada,
      email,
      tipoUsuario,
      status,
    ]);

    return resultado.insertId;
  },

  async atualizarPerfilBasico({ nome, email, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarPerfilBasico, [
      nome,
      email,
      idUsuario,
    ]);
    return resultado;
  },

  async atualizarSenha({ senhaCriptografada, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarSenha, [
      senhaCriptografada,
      idUsuario,
    ]);
    return resultado;
  },

  async alterarTipoConta({ tipoUsuario, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.alterarTipoConta, [
      tipoUsuario,
      idUsuario,
    ]);
    return resultado;
  },

  async alterarStatusConta({ status, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.alterarStatusConta, [
      status,
      idUsuario,
    ]);
    return resultado;
  },

  async excluirConta(idUsuario, conexao) {
    const [resultado] = await banco(conexao).query(queries.excluirConta, [idUsuario]);
    return resultado;
  },
});

module.exports = UsuarioModel;
