const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criar: `
    INSERT INTO Denuncia
      (id_usuario, tipo_conteudo, id_duvida, id_conteudo_alvo, motivo, descricao, prioridade)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  // id_conteudo_alvo nao tem FK de verdade (aponta pra Conteudo OU
  // Formulario dependendo de tipo_conteudo, tabelas diferentes) - por
  // isso o JOIN com cada uma so "liga" quando o tipo bate, evitando
  // casar um id_conteudo_alvo=5 de simulado com um Conteudo.id=5
  // completamente diferente por coincidencia de numero.
  listarTodas: `
    SELECT
      d.id_denuncia, d.tipo_conteudo, d.id_duvida, d.id_conteudo_alvo,
      d.motivo, d.descricao, d.prioridade, d.status, d.resolucao, d.resposta_admin,
      d.data_denuncia, d.data_resolucao,
      u.id_usuario, u.nome AS usuario_nome, u.tipo_usuario AS usuario_tipo,
      c.tipo AS conteudo_tipo,
      COALESCE(mf.nome, mc.nome, mform.nome) AS materia,
      COALESCE(dv.duvida, c.titulo, f.titulo) AS resumo_conteudo
    FROM ${TABELAS.denuncias} d
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = d.id_usuario
    LEFT JOIN ${TABELAS.duvidas} dv ON dv.id_duvida = d.id_duvida
    LEFT JOIN ${TABELAS.forum} fo ON fo.id_forum = dv.id_forum
    LEFT JOIN ${TABELAS.materias} mf ON mf.id_materia = fo.id_materia
    LEFT JOIN ${TABELAS.conteudos} c ON c.id = d.id_conteudo_alvo AND d.tipo_conteudo = 'conteudo'
    LEFT JOIN ${TABELAS.materias} mc ON mc.id_materia = c.materia_id
    LEFT JOIN ${TABELAS.formularios} f ON f.id_formulario = d.id_conteudo_alvo AND d.tipo_conteudo = 'formulario'
    LEFT JOIN ${TABELAS.materias} mform ON mform.id_materia = f.id_materia
    ORDER BY d.data_denuncia DESC
  `,
  buscarPorId: `
    SELECT id_denuncia, tipo_conteudo, id_duvida, id_conteudo_alvo, status
    FROM ${TABELAS.denuncias}
    WHERE id_denuncia = ?
    LIMIT 1
  `,
  responder: `
    UPDATE ${TABELAS.denuncias}
    SET resposta_admin = ?, status = IF(status = 'aberto', 'em_analise', status)
    WHERE id_denuncia = ?
  `,
  resolver: `
    UPDATE ${TABELAS.denuncias}
    SET status = 'resolvido', resolucao = ?, data_resolucao = NOW()
    WHERE id_denuncia = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const DenunciaModel = Object.freeze({
  async criar(
    { idUsuario, tipoConteudo, idDuvida, idConteudoAlvo, motivo, descricao, prioridade },
    conexao
  ) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idUsuario,
      tipoConteudo,
      idDuvida || null,
      idConteudoAlvo || null,
      motivo,
      descricao || null,
      prioridade || "media",
    ]);
    return resultado.insertId;
  },

  async listarTodas(conexao) {
    const [denuncias] = await banco(conexao).query(queries.listarTodas);
    return denuncias;
  },

  async buscarPorId(id, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarPorId, [id]);
    return linhas[0] || null;
  },

  async responder({ id, resposta }, conexao) {
    const [resultado] = await banco(conexao).query(queries.responder, [resposta, id]);
    return resultado;
  },

  async resolver({ id, resolucao }, conexao) {
    const [resultado] = await banco(conexao).query(queries.resolver, [resolucao, id]);
    return resultado;
  },
});

module.exports = DenunciaModel;
