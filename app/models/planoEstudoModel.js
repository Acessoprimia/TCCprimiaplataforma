const crypto = require("crypto");
const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criarPlano: `
    INSERT INTO ${TABELAS.planosEstudo}
      (id_aluno, id_materia, hora_aula)
    VALUES (?, ?, ?)
  `,
  criarCronograma: `
    INSERT INTO ${TABELAS.cronogramas}
      (id_plano_estudos, data_inicio, data_fim, descricao, prioridade, concluido,
       titulo_cronograma, codigo_lote, hora_fim, tipo_atividade)
    VALUES (?, ?, ?, ?, 'media', FALSE, ?, ?, ?, ?)
  `,
  listarPorAluno: `
    SELECT c.id_cronograma, c.data_inicio, c.data_fim, c.descricao, c.prioridade, c.concluido,
           c.hora_fim, c.tipo_atividade,
           pe.id_plano_estudos, pe.hora_aula, m.nome AS materia
    FROM ${TABELAS.cronogramas} c
    INNER JOIN ${TABELAS.planosEstudo} pe ON pe.id_plano_estudos = c.id_plano_estudos
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = pe.id_materia
    WHERE pe.id_aluno = ? AND c.codigo_lote IS NULL
    ORDER BY c.data_inicio, pe.hora_aula
  `,
  listarCronogramasGerados: `
    SELECT c.codigo_lote, c.titulo_cronograma, MIN(c.data_inicio) AS data_inicio,
           COUNT(*) AS total_eventos, m.nome AS materia
    FROM ${TABELAS.cronogramas} c
    INNER JOIN ${TABELAS.planosEstudo} pe ON pe.id_plano_estudos = c.id_plano_estudos
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = pe.id_materia
    WHERE pe.id_aluno = ? AND c.codigo_lote IS NOT NULL
    GROUP BY c.codigo_lote, c.titulo_cronograma, m.nome
    ORDER BY data_inicio DESC
  `,
  listarEventosPorLote: `
    SELECT c.id_cronograma, c.data_inicio, c.descricao, c.titulo_cronograma,
           c.codigo_lote, c.hora_fim, c.tipo_atividade, c.prioridade, c.concluido,
           pe.hora_aula, m.nome AS materia
    FROM ${TABELAS.cronogramas} c
    INNER JOIN ${TABELAS.planosEstudo} pe ON pe.id_plano_estudos = c.id_plano_estudos
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = pe.id_materia
    WHERE c.codigo_lote = ? AND pe.id_aluno = ?
    ORDER BY c.data_inicio, pe.hora_aula
  `,
  atualizarPrioridade: `
    UPDATE ${TABELAS.cronogramas} c
    INNER JOIN ${TABELAS.planosEstudo} pe ON pe.id_plano_estudos = c.id_plano_estudos
    SET c.prioridade = ?
    WHERE c.id_cronograma = ? AND pe.id_aluno = ?
  `,
  atualizarConcluido: `
    UPDATE ${TABELAS.cronogramas} c
    INNER JOIN ${TABELAS.planosEstudo} pe ON pe.id_plano_estudos = c.id_plano_estudos
    SET c.concluido = ?
    WHERE c.id_cronograma = ? AND pe.id_aluno = ?
  `,
  // Apaga so os itens genericos (codigo_lote NULL) do proprio aluno, pra
  // ele poder regerar a rotina padrao. Os cronogramas que ele gerou por
  // IA/mao tem codigo_lote e ficam intactos.
  apagarGenericosDoAluno: `
    DELETE c FROM ${TABELAS.cronogramas} c
    INNER JOIN ${TABELAS.planosEstudo} pe ON pe.id_plano_estudos = c.id_plano_estudos
    WHERE pe.id_aluno = ? AND c.codigo_lote IS NULL
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const PlanoEstudoModel = Object.freeze({
  async criarItem(
    {
      idAluno,
      idMateria,
      horaAula,
      horaFim,
      dataInicio,
      dataFim,
      descricao,
      tipoAtividade,
      tituloCronograma,
      codigoLote,
    },
    conexao
  ) {
    const bancoUsado = banco(conexao);

    const [resultadoPlano] = await bancoUsado.query(queries.criarPlano, [
      idAluno,
      idMateria,
      horaAula,
    ]);

    const [resultadoCronograma] = await bancoUsado.query(queries.criarCronograma, [
      resultadoPlano.insertId,
      dataInicio,
      dataFim,
      descricao,
      tituloCronograma || null,
      codigoLote || null,
      horaFim || null,
      tipoAtividade || null,
    ]);

    return resultadoCronograma.insertId;
  },

  async criarEventos(eventos, { idAluno, idMateria, tituloCronograma }, conexao) {
    const bancoUsado = banco(conexao);
    const codigoLote = crypto.randomUUID();
    const idsCriados = [];

    for (const evento of eventos) {
      const descricaoCompleta = evento.descricao
        ? `${evento.titulo} - ${evento.descricao}`
        : evento.titulo;

      const id = await PlanoEstudoModel.criarItem(
        {
          idAluno,
          idMateria,
          horaAula: evento.hora_inicio,
          horaFim: evento.hora_fim,
          dataInicio: evento.data,
          dataFim: evento.data,
          descricao: descricaoCompleta.slice(0, 200),
          tipoAtividade: evento.tipo_atividade || "estudo",
          tituloCronograma,
          codigoLote,
        },
        bancoUsado
      );

      idsCriados.push(id);
    }

    return { idsCriados, codigoLote };
  },

  async listarPorAluno(idAluno, conexao) {
    const [itens] = await banco(conexao).query(queries.listarPorAluno, [idAluno]);
    return itens;
  },

  async listarCronogramasGerados(idAluno, conexao) {
    const [cronogramas] = await banco(conexao).query(queries.listarCronogramasGerados, [idAluno]);
    return cronogramas;
  },

  async listarEventosPorLote(codigoLote, idAluno, conexao) {
    const [eventos] = await banco(conexao).query(queries.listarEventosPorLote, [
      codigoLote,
      idAluno,
    ]);
    return eventos;
  },

  async atualizarPrioridade({ idCronograma, idAluno, prioridade }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarPrioridade, [
      prioridade,
      idCronograma,
      idAluno,
    ]);
    return resultado;
  },

  async atualizarConcluido({ idCronograma, idAluno, concluido }, conexao) {
    const [resultado] = await banco(conexao).query(queries.atualizarConcluido, [
      concluido,
      idCronograma,
      idAluno,
    ]);
    return resultado;
  },

  async apagarGenericosDoAluno(idAluno, conexao) {
    const [resultado] = await banco(conexao).query(queries.apagarGenericosDoAluno, [idAluno]);
    return resultado.affectedRows;
  },
});

module.exports = PlanoEstudoModel;
