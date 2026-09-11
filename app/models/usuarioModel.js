const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  buscarPorEmail: `
    SELECT id_usuario, nome, email, senha, tipo_usuario, status, email_verificado
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
      (nome, senha, email, tipo_usuario, status, token_verificacao_email, token_verificacao_email_expira)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  confirmarEmailPorToken: `
    UPDATE ${TABELAS.usuarios}
    SET email_verificado = TRUE, token_verificacao_email = NULL, token_verificacao_email_expira = NULL
    WHERE token_verificacao_email = ? AND token_verificacao_email_expira > NOW()
  `,
  salvarTokenVerificacaoEmail: `
    UPDATE ${TABELAS.usuarios}
    SET token_verificacao_email = ?, token_verificacao_email_expira = ?
    WHERE id_usuario = ? AND email_verificado = FALSE
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
  atualizarFoto: `
    UPDATE ${TABELAS.usuarios}
    SET foto_url = ?
    WHERE id_usuario = ?
  `,
  atualizarPerfilPublico: `
    UPDATE ${TABELAS.usuarios}
    SET perfil_publico = ?
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
  atualizarUltimoLogin: `
    UPDATE ${TABELAS.usuarios}
    SET ultimo_login = NOW()
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

  async criar(
    { nome, senhaCriptografada, email, tipoUsuario, status, tokenVerificacao, tokenVerificacaoExpira },
    conexao
  ) {
    const [resultado] = await banco(conexao).query(queries.criarUsuario, [
      nome,
      senhaCriptografada,
      email,
      tipoUsuario,
      status,
      tokenVerificacao || null,
      tokenVerificacaoExpira || null,
    ]);

    return resultado.insertId;
  },

  async confirmarEmailPorToken(token, conexao) {
    const [resultado] = await banco(conexao).query(queries.confirmarEmailPorToken, [token]);
    return resultado.affectedRows > 0;
  },

  async salvarTokenVerificacaoEmail({ idUsuario, token, expiraEm }, conexao) {
    const [resultado] = await banco(conexao).query(queries.salvarTokenVerificacaoEmail, [
      token,
      expiraEm,
      idUsuario,
    ]);
    return resultado.affectedRows > 0;
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

  async atualizarFoto({ fotoUrl, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarFoto, [fotoUrl, idUsuario]);
    return resultado;
  },

  async atualizarPerfilPublico({ perfilPublico, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarPerfilPublico, [
      Boolean(perfilPublico),
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

  async atualizarUltimoLogin(idUsuario, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarUltimoLogin, [idUsuario]);
    return resultado;
  },
});

module.exports = UsuarioModel;
