const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarDuvidas: `
    SELECT d.id, d.titulo, d.pergunta, d.status, d.criado_em, u.nome AS autor, m.nome AS materia
    FROM ${TABELAS.duvidas} d
    INNER JOIN ${TABELAS.alunos} a ON a.id = d.aluno_id
    INNER JOIN ${TABELAS.usuarios} u ON u.id = a.usuario_id
    LEFT JOIN ${TABELAS.materias} m ON m.id = d.materia_id
    ORDER BY d.criado_em DESC
  `,
  listarDenuncias: `
    SELECT df.id, df.motivo, df.descricao, df.status, df.criado_em, d.titulo AS duvida_titulo, u.nome AS denunciante
    FROM ${TABELAS.denunciasForum} df
    LEFT JOIN ${TABELAS.duvidas} d ON d.id = df.duvida_id
    INNER JOIN ${TABELAS.usuarios} u ON u.id = df.denunciante_id
    ORDER BY df.criado_em DESC
  `,
  atualizarStatusDenuncia: `
    UPDATE ${TABELAS.denunciasForum}
    SET status = ?, resolvido_em = NOW()
    WHERE id = ?
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ForumModel = Object.freeze({
  async listarDuvidas(conexao) {
    const [duvidas] = await banco(conexao).query(queries.listarDuvidas);
    return duvidas;
  },

  async listarDenuncias(conexao) {
    const [denuncias] = await banco(conexao).query(queries.listarDenuncias);
    return denuncias;
  },

  async atualizarStatusDenuncia({ idDenuncia, status }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarStatusDenuncia, [
      status,
      idDenuncia,
    ]);
    return resultado;
  },
});

module.exports = ForumModel;
