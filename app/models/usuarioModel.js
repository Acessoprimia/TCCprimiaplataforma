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
  buscarNomePorId: `
    SELECT nome
    FROM ${TABELAS.usuarios}
    WHERE id_usuario = ?
    LIMIT 1
  `,
  // Perfil completo direto da Usuario, sem join com Aluno/Professor - serve
  // pro admin em /configuracoes, que nao tem tabela de subtipo propria.
  buscarPerfilCompleto: `
    SELECT id_usuario, nome, email, tipo_usuario, status, foto_url, perfil_publico, foto_publica, criado_em
    FROM ${TABELAS.usuarios}
    WHERE id_usuario = ?
    LIMIT 1
  `,
  criarUsuario: `
    INSERT INTO ${TABELAS.usuarios}
      (nome, senha, email, tipo_usuario, status, token_verificacao_email, token_verificacao_email_expira)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  // Compara contra ? (um Date gerado no Node), nao contra NOW() do MySQL -
  // mesmo motivo da nota em tokenRedefinicaoSenhaValido/redefinirSenhaPorToken
  // logo abaixo: o NOW() do servidor de banco le ~3h a frente do relogio
  // real nesse projeto. Aqui a janela de 24h disfarcava o problema, mas o
  // bug e o mesmo.
  confirmarEmailPorToken: `
    UPDATE ${TABELAS.usuarios}
    SET email_verificado = TRUE, token_verificacao_email = NULL, token_verificacao_email_expira = NULL
    WHERE token_verificacao_email = ? AND token_verificacao_email_expira > ?
  `,
  salvarTokenVerificacaoEmail: `
    UPDATE ${TABELAS.usuarios}
    SET token_verificacao_email = ?, token_verificacao_email_expira = ?
    WHERE id_usuario = ? AND email_verificado = FALSE
  `,
  salvarTokenRedefinicaoSenha: `
    UPDATE ${TABELAS.usuarios}
    SET token_redefinicao_senha = ?, token_redefinicao_senha_expira = ?
    WHERE id_usuario = ?
  `,
  // Compara contra ? (um Date gerado no Node), nao contra NOW() do MySQL: o
  // NOW() do servidor de banco voltou ~3h a frente do relogio real nesse
  // projeto (mesma familia do gotcha de timezone ja documentado com
  // toISOString() em formatarDataLocal()), o que expirava o token antes da
  // hora com uma janela curta de 1h. Gravando e comparando sempre com Date
  // do Node, os dois lados passam pela mesma conversao do driver.
  tokenRedefinicaoSenhaValido: `
    SELECT id_usuario
    FROM ${TABELAS.usuarios}
    WHERE token_redefinicao_senha = ? AND token_redefinicao_senha_expira > ?
    LIMIT 1
  `,
  // Troca a senha e queima o token na MESMA query: se dois pedidos usarem o
  // mesmo link ao mesmo tempo, so o primeiro encontra o token e o segundo ja
  // ve affectedRows = 0 (o WHERE nao casa mais).
  redefinirSenhaPorToken: `
    UPDATE ${TABELAS.usuarios}
    SET senha = ?, token_redefinicao_senha = NULL, token_redefinicao_senha_expira = NULL
    WHERE token_redefinicao_senha = ? AND token_redefinicao_senha_expira > ?
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
  atualizarFotoPublica: `
    UPDATE ${TABELAS.usuarios}
    SET foto_publica = ?
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

  async buscarNomePorId(idUsuario, conexao) {
    const [usuarios] = await banco(conexao).query(queries.buscarNomePorId, [idUsuario]);
    return usuarios[0]?.nome || null;
  },

  async buscarPerfilCompleto(idUsuario, conexao) {
    const [usuarios] = await banco(conexao).query(queries.buscarPerfilCompleto, [idUsuario]);
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
    const [resultado] = await banco(conexao).query(queries.confirmarEmailPorToken, [
      token,
      new Date(),
    ]);
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

  async salvarTokenRedefinicaoSenha({ idUsuario, token, expiraEm }, conexao) {
    const [resultado] = await banco(conexao).query(queries.salvarTokenRedefinicaoSenha, [
      token,
      expiraEm,
      idUsuario,
    ]);
    return resultado.affectedRows > 0;
  },

  async tokenRedefinicaoSenhaValido(token, conexao) {
    const [usuarios] = await banco(conexao).query(queries.tokenRedefinicaoSenhaValido, [
      token,
      new Date(),
    ]);
    return usuarios.length > 0;
  },

  async redefinirSenhaPorToken({ token, senhaCriptografada }, conexao) {
    const [resultado] = await banco(conexao).query(queries.redefinirSenhaPorToken, [
      senhaCriptografada,
      token,
      new Date(),
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

  async atualizarFotoPublica({ fotoPublica, idUsuario }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarFotoPublica, [
      Boolean(fotoPublica),
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
