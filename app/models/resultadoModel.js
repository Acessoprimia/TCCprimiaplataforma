const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  contarFormulariosGerados: `
    SELECT COUNT(*) AS total FROM ${TABELAS.formularios} WHERE id_aluno = ?
  `,
  // JSON_LENGTH em vez de trazer schema_json inteiro pro Node so pra contar.
  somarPerguntasGeradas: `
    SELECT COALESCE(SUM(JSON_LENGTH(schema_json, '$.perguntas')), 0) AS total
    FROM ${TABELAS.formularios}
    WHERE id_aluno = ?
  `,
  contarSimuladosRespondidos: `
    SELECT COUNT(DISTINCT id_formulario) AS total
    FROM ${TABELAS.respostasFormulario}
    WHERE id_aluno = ?
  `,
  taxaAcertoGeral: `
    SELECT COUNT(*) AS total, COALESCE(SUM(correta), 0) AS acertos
    FROM ${TABELAS.respostasFormulario}
    WHERE id_aluno = ?
  `,
  // INNER JOIN com Materia descarta de proposito formularios sem
  // id_materia - eles ja contam no total geral, so nao aparecem
  // quebrados por materia.
  taxaAcertoPorMateria: `
    SELECT m.id_materia, m.nome AS materia,
           COUNT(*) AS total, COALESCE(SUM(rf.correta), 0) AS acertos
    FROM ${TABELAS.respostasFormulario} rf
    INNER JOIN ${TABELAS.formularios} f ON f.id_formulario = rf.id_formulario
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = f.id_materia
    WHERE rf.id_aluno = ?
    GROUP BY m.id_materia, m.nome
    ORDER BY m.nome
  `,
  contarRedacoes: `
    SELECT COUNT(*) AS total FROM ${TABELAS.redacoes} WHERE id_aluno = ?
  `,
  // Agregado SEMPRE por tipo_redacao - nota_c1..c5 mudam de SIGNIFICADO
  // por genero (c5 do ENEM e "proposta de intervencao", c5 de Narrativa
  // e outra coisa) - nunca misturar numa media cross-genero.
  mediaRedacaoPorGenero: `
    SELECT tipo_redacao, COUNT(*) AS total, AVG(nota_total) AS media_total
    FROM ${TABELAS.redacoes}
    WHERE id_aluno = ?
    GROUP BY tipo_redacao
  `,
  buscarAnalise: `SELECT * FROM ${TABELAS.resultados} WHERE id_aluno = ? LIMIT 1`,
  salvarAnalise: `
    INSERT INTO ${TABELAS.resultados}
      (id_aluno, diagnostico, pontos_fortes, recomendacao_geral, materias_fracas, recomendacoes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      diagnostico = VALUES(diagnostico),
      pontos_fortes = VALUES(pontos_fortes),
      recomendacao_geral = VALUES(recomendacao_geral),
      materias_fracas = VALUES(materias_fracas),
      recomendacoes = VALUES(recomendacoes)
  `,
});

function banco(conexao) {
  return conexao || pool;
}

function calcularTaxa(total, acertos) {
  return total > 0 ? Math.round((acertos / total) * 100) : null;
}

const ResultadoModel = Object.freeze({
  // Um unico ponto de agregacao usado TANTO pela tela (GET /resultados)
  // QUANTO pelo prompt da IA (POST /resultados/analisar) - garante que
  // o numero que o aluno ve e o que a IA recebeu sao sempre o mesmo.
  async buscarResumoAgregado(idAluno, conexao) {
    const bancoUsado = banco(conexao);

    const [
      [[{ total: totalFormularios }]],
      [[{ total: totalPerguntasGeradas }]],
      [[{ total: totalSimuladosRespondidos }]],
      [[{ total: totalRespostas, acertos: totalAcertos }]],
      [porMateriaLinhas],
      [[{ total: totalRedacoes }]],
      [porGeneroLinhas],
    ] = await Promise.all([
      bancoUsado.query(queries.contarFormulariosGerados, [idAluno]),
      bancoUsado.query(queries.somarPerguntasGeradas, [idAluno]),
      bancoUsado.query(queries.contarSimuladosRespondidos, [idAluno]),
      bancoUsado.query(queries.taxaAcertoGeral, [idAluno]),
      bancoUsado.query(queries.taxaAcertoPorMateria, [idAluno]),
      bancoUsado.query(queries.contarRedacoes, [idAluno]),
      bancoUsado.query(queries.mediaRedacaoPorGenero, [idAluno]),
    ]);

    return {
      totalFormularios,
      // SUM()+COALESCE() sobre JSON_LENGTH volta como string no mysql2
      // (diferente de COUNT(*), que ja vem como number) - forcado pra
      // number aqui pra nao propagar essa inconsistencia de tipo.
      totalPerguntasGeradas: Number(totalPerguntasGeradas),
      totalSimuladosRespondidos,
      totalPerguntasRespondidas: totalRespostas,
      taxaAcertoGeral: calcularTaxa(totalRespostas, totalAcertos),
      porMateria: porMateriaLinhas.map((linha) => ({
        idMateria: linha.id_materia,
        materia: linha.materia,
        total: linha.total,
        taxa: calcularTaxa(linha.total, linha.acertos),
      })),
      totalRedacoes,
      porGenero: porGeneroLinhas.map((linha) => ({
        tipoRedacao: linha.tipo_redacao,
        total: linha.total,
        mediaTotal: Math.round(linha.media_total),
      })),
    };
  },

  async buscarAnalise(idAluno, conexao) {
    const [linhas] = await banco(conexao).query(queries.buscarAnalise, [idAluno]);
    return linhas[0] || null;
  },

  async salvarAnalise({ idAluno, diagnostico, pontosFortes, recomendacaoGeral, materiasFracas, recomendacoes }, conexao) {
    await banco(conexao).query(queries.salvarAnalise, [
      idAluno,
      diagnostico,
      pontosFortes,
      recomendacaoGeral,
      JSON.stringify(materiasFracas),
      JSON.stringify(recomendacoes),
    ]);
  },
});

module.exports = ResultadoModel;
