const crypto = require("crypto");
const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  criar: `
    INSERT INTO ${TABELAS.planosAula}
      (id_professor, id_materia, data_atual, objetivos, conteudo, hora_inicio, hora_fim, is_premium, titulo_cronograma, codigo_lote)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  listarCronogramasPublicados: `
    SELECT pa.codigo_lote, pa.titulo_cronograma, MIN(pa.data_atual) AS data_inicio,
           pa.is_premium, COUNT(*) AS total_eventos, m.nome AS materia, u.nome AS professor
    FROM ${TABELAS.planosAula} pa
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = pa.id_materia
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = pa.id_professor
    WHERE pa.codigo_lote IS NOT NULL
    GROUP BY pa.codigo_lote, pa.titulo_cronograma, pa.is_premium, m.nome, u.nome
    ORDER BY data_inicio DESC
  `,
  listarCronogramasPorProfessor: `
    SELECT pa.codigo_lote, pa.titulo_cronograma, MIN(pa.data_atual) AS data_inicio,
           pa.is_premium, COUNT(*) AS total_eventos, m.nome AS materia
    FROM ${TABELAS.planosAula} pa
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = pa.id_materia
    WHERE pa.codigo_lote IS NOT NULL AND pa.id_professor = ?
    GROUP BY pa.codigo_lote, pa.titulo_cronograma, pa.is_premium, m.nome
    ORDER BY data_inicio DESC
  `,
  listarEventosPorLote: `
    SELECT pa.id_plano_aula, pa.data_atual, pa.objetivos, pa.conteudo, pa.hora_inicio, pa.hora_fim,
           pa.is_premium, pa.titulo_cronograma, m.nome AS materia, u.nome AS professor
    FROM ${TABELAS.planosAula} pa
    INNER JOIN ${TABELAS.materias} m ON m.id_materia = pa.id_materia
    INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = pa.id_professor
    WHERE pa.codigo_lote = ?
    ORDER BY pa.data_atual, pa.hora_inicio
  `,
});

function banco(conexao) {
  return conexao || pool;
}

const PlanoAulaModel = Object.freeze({
  async criar(
    {
      idProfessor,
      idMateria,
      dataAtual,
      objetivos,
      conteudo,
      horaInicio,
      horaFim,
      isPremium,
      tituloCronograma,
      codigoLote,
    },
    conexao
  ) {
    const [resultado] = await banco(conexao).query(queries.criar, [
      idProfessor,
      idMateria,
      dataAtual,
      objetivos,
      conteudo,
      horaInicio,
      horaFim,
      !!isPremium,
      tituloCronograma || null,
      codigoLote || null,
    ]);
    return resultado.insertId;
  },

  async criarEventos(eventos, { idProfessor, idMateria, tituloCronograma }, conexao) {
    const bancoUsado = banco(conexao);
    const codigoLote = crypto.randomUUID();
    const idsCriados = [];

    for (const evento of eventos) {
      const id = await PlanoAulaModel.criar(
        {
          idProfessor,
          idMateria,
          dataAtual: evento.data,
          objetivos: evento.titulo.slice(0, 200),
          conteudo: (evento.descricao || evento.titulo).slice(0, 200),
          horaInicio: evento.hora_inicio,
          horaFim: evento.hora_fim,
          isPremium: true,
          tituloCronograma,
          codigoLote,
        },
        bancoUsado
      );

      idsCriados.push(id);
    }

    return { idsCriados, codigoLote };
  },

  async listarCronogramasPublicados(conexao) {
    const [cronogramas] = await banco(conexao).query(queries.listarCronogramasPublicados);
    return cronogramas;
  },

  async listarCronogramasPorProfessor(idProfessor, conexao) {
    const [cronogramas] = await banco(conexao).query(queries.listarCronogramasPorProfessor, [
      idProfessor,
    ]);
    return cronogramas;
  },

  async listarEventosPorLote(codigoLote, conexao) {
    const [eventos] = await banco(conexao).query(queries.listarEventosPorLote, [codigoLote]);
    return eventos;
  },
});

module.exports = PlanoAulaModel;
