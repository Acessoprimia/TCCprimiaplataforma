const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  listarPublicadosPorTipo: `
    SELECT c.id, c.titulo, c.autor, c.descricao, c.tipo, c.imagem_url, c.arquivo_url,
           c.is_premium, c.destaque, m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
    WHERE c.status = 'publicado' AND c.tipo = ?
    ORDER BY c.criado_em DESC
  `,
  buscarPorId: `
    SELECT c.id, c.titulo, c.autor, c.descricao, c.tipo, c.imagem_url, c.arquivo_url,
           c.is_premium, c.destaque, m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
    WHERE c.id = ? AND c.status = 'publicado'
    LIMIT 1
  `,
  criarConteudo: `
    INSERT INTO ${TABELAS.conteudos}
      (titulo, autor, descricao, tipo, materia_id, professor_id, arquivo_url, imagem_url, is_premium, destaque, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  // Pro admin/conteudos: TODOS os itens (qualquer status), nao so os
  // publicados. So livro/video - simulado, cronograma e plano de
  // estudo nao moram nesta tabela, tem suas proprias telas com os
  // professores.
  listarTodosAdmin: `
    SELECT c.id, c.titulo, c.autor, c.descricao, c.tipo, c.status, c.is_premium,
           c.destaque, c.arquivado, c.criado_em, c.materia_id, c.arquivo_url, c.imagem_url,
           m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
    ORDER BY c.criado_em DESC
  `,
  buscarPorIdAdmin: `
    SELECT c.id, c.titulo, c.autor, c.descricao, c.tipo, c.status, c.is_premium,
           c.destaque, c.arquivado, c.criado_em, c.materia_id, c.arquivo_url, c.imagem_url,
           m.nome AS materia
    FROM ${TABELAS.conteudos} c
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
    WHERE c.id = ?
    LIMIT 1
  `,
  atualizarMetadados: `
    UPDATE ${TABELAS.conteudos}
    SET titulo = ?, autor = ?, materia_id = ?, status = ?
    WHERE id = ?
  `,
  atualizarDestaque: `
    UPDATE ${TABELAS.conteudos} SET destaque = ? WHERE id = ?
  `,
  atualizarPremium: `
    UPDATE ${TABELAS.conteudos} SET is_premium = ? WHERE id = ?
  `,
  atualizarArquivado: `
    UPDATE ${TABELAS.conteudos} SET arquivado = ? WHERE id = ?
  `,
  remover: `
    DELETE FROM ${TABELAS.conteudos} WHERE id = ?
  `,
  listarRecomendadosPorMateria: `
    SELECT id, titulo, tipo
    FROM ${TABELAS.conteudos}
    WHERE materia_id = ? AND status = 'publicado' AND arquivado = 0
    ORDER BY destaque DESC, criado_em DESC
    LIMIT ?
  `,
  // Re-checagem pro snapshot salvo em Analise_Desempenho: quais IDs
  // recomendados ainda estao publicados/nao-arquivados (evita link
  // morto sem precisar rechamar a IA se um admin arquivar algo depois
  // da analise ter sido gerada).
  filtrarAindaPublicados: `
    SELECT id FROM ${TABELAS.conteudos}
    WHERE id IN (?) AND status = 'publicado' AND arquivado = 0
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const ConteudoModel = Object.freeze({
  async listarPublicadosPorTipo(tipo, conexao) {
    const [conteudos] = await banco(conexao).query(queries.listarPublicadosPorTipo, [tipo]);
    return conteudos;
  },

  async buscarPorId(id, conexao) {
    const [conteudos] = await banco(conexao).query(queries.buscarPorId, [id]);
    return conteudos[0] || null;
  },

  async criar(
    {
      titulo,
      autor,
      descricao,
      tipo,
      materiaId,
      professorId,
      arquivoUrl,
      imagemUrl,
      isPremium,
      destaque,
      status,
    },
    conexao
  ) {
    const [resultado] = await banco(conexao).query(queries.criarConteudo, [
      titulo,
      autor,
      descricao,
      tipo,
      materiaId,
      professorId,
      arquivoUrl,
      imagemUrl,
      isPremium,
      destaque,
      status,
    ]);
    return resultado.insertId;
  },

  async listarTodosAdmin(conexao) {
    const [conteudos] = await banco(conexao).query(queries.listarTodosAdmin);
    return conteudos;
  },

  async buscarPorIdAdmin(id, conexao) {
    const [conteudos] = await banco(conexao).query(queries.buscarPorIdAdmin, [id]);
    return conteudos[0] || null;
  },

  async atualizarMetadados({ id, titulo, autor, materiaId, status }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarMetadados, [
      titulo,
      autor,
      materiaId,
      status,
      id,
    ]);
    return resultado;
  },

  async atualizarDestaque({ id, destaque }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarDestaque, [!!destaque, id]);
    return resultado;
  },

  async atualizarPremium({ id, isPremium }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarPremium, [!!isPremium, id]);
    return resultado;
  },

  async atualizarArquivado({ id, arquivado }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarArquivado, [!!arquivado, id]);
    return resultado;
  },

  // Duplica so os metadados, apontando pro MESMO arquivo (nao existe
  // upload novo aqui) - vira rascunho, sem destaque nem arquivamento,
  // pro admin ajustar antes de publicar.
  async duplicar(id, conexao) {
    const bancoUsado = banco(conexao);
    const original = await ConteudoModel.buscarPorIdAdmin(id, bancoUsado);
    if (!original) return null;

    return ConteudoModel.criar(
      {
        titulo: `${original.titulo} (cópia)`,
        autor: original.autor,
        descricao: original.descricao,
        tipo: original.tipo,
        materiaId: original.materia_id,
        professorId: null,
        arquivoUrl: original.arquivo_url,
        imagemUrl: original.imagem_url,
        isPremium: original.is_premium,
        destaque: false,
        status: "rascunho",
      },
      bancoUsado
    );
  },

  async remover(id, conexao) {
    const [resultado] = await banco(conexao).query(queries.remover, [id]);
    return resultado;
  },

  async listarRecomendadosPorMateria(idMateria, limite, conexao) {
    const [linhas] = await banco(conexao).query(queries.listarRecomendadosPorMateria, [idMateria, limite]);
    return linhas;
  },

  async filtrarAindaPublicados(ids, conexao) {
    if (!ids.length) return [];
    const [linhas] = await banco(conexao).query(queries.filtrarAindaPublicados, [ids]);
    return linhas.map((linha) => linha.id);
  },
});

module.exports = ConteudoModel;
