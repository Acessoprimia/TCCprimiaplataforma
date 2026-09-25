const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  // criado_em vai explicito (e nao pelo DEFAULT CURRENT_TIMESTAMP): o relogio
  // do servidor de banco desse projeto esta 3h a frente do real, entao deixar
  // o banco preencher gravava a acao no futuro. Mesmo motivo pelo qual as
  // checagens de token no usuarioModel comparam contra um Date do Node.
  criar: `
    INSERT INTO ${TABELAS.logsAuditoria}
      (id_usuario, nome_usuario, tipo_usuario, acao, entidade, id_entidade, descricao, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  // LEFT JOIN (nao INNER): id_usuario vira NULL quando a conta e excluida,
  // e o registro ainda precisa aparecer na listagem do admin.
  listar: `
    SELECT
      l.id_log,
      l.id_usuario,
      l.nome_usuario,
      l.tipo_usuario,
      l.acao,
      l.entidade,
      l.id_entidade,
      l.descricao,
      l.criado_em,
      u.email AS email_usuario
    FROM ${TABELAS.logsAuditoria} l
    LEFT JOIN ${TABELAS.usuarios} u ON u.id_usuario = l.id_usuario
    ORDER BY l.criado_em DESC, l.id_log DESC
    LIMIT ?
  `,
  // Troca o nome guardado por "Conta removida (#id)" nas linhas de quem esta
  // pra ser excluido: o nome some, mas o numero antigo da conta continua
  // ligando as linhas da mesma pessoa (pseudonimizacao). Tem que rodar ANTES
  // do DELETE da conta (o FK zera o id_usuario ao apagar, e depois nao da
  // mais pra achar as linhas).
  anonimizar: `
    UPDATE ${TABELAS.logsAuditoria}
    SET nome_usuario = CONCAT('Conta removida (#', id_usuario, ')')
    WHERE id_usuario = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const AuditoriaModel = Object.freeze({
  async criar(
    { idUsuario, nomeUsuario, tipoUsuario, acao, entidade, idEntidade = null, descricao },
    conexao
  ) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idUsuario,
      nomeUsuario,
      tipoUsuario,
      acao,
      entidade,
      idEntidade,
      descricao,
      new Date(),
    ]);
    return resultado.insertId;
  },

  async anonimizarUsuario(idUsuario, conexao) {
    const [resultado] = await banco(conexao).query(queries.anonimizar, [idUsuario]);
    return resultado.affectedRows;
  },

  async listar({ limite = 2000 } = {}, conexao) {
    const [logs] = await banco(conexao).query(queries.listar, [limite]);
    return logs;
  },
});

module.exports = AuditoriaModel;
