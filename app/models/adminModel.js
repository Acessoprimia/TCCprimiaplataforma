const pool = require("../../db");
const TABELAS = require("./tabelas");

const queries = Object.freeze({
  metricasDashboard: {
    totalAlunos: `SELECT COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'aluno'`,
    totalProfessores: `SELECT COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'professor'`,
    duvidasPendentes: `SELECT COUNT(*) AS total FROM ${TABELAS.duvidas} WHERE status = 'pendente'`,
    conteudosCadastrados: `SELECT COUNT(*) AS total FROM ${TABELAS.conteudos}`,
    usuariosPremium: `SELECT COUNT(*) AS total FROM ${TABELAS.assinaturasPremium} WHERE status = 'ativa'`,
    mensagensContato: `SELECT COUNT(*) AS total FROM ${TABELAS.mensagensContato} WHERE status = 'pendente'`,
  },
});

function banco(conexao) {
  return conexao || pool;
}

async function contar(query, conexao) {
  const [linhas] = await banco(conexao).query(query);
  return linhas[0]?.total || 0;
}

const AdminModel = Object.freeze({
  async buscarMetricasDashboard(conexao) {
    const metricas = queries.metricasDashboard;

    return {
      totalAlunos: await contar(metricas.totalAlunos, conexao),
      totalProfessores: await contar(metricas.totalProfessores, conexao),
      duvidasPendentes: await contar(metricas.duvidasPendentes, conexao),
      conteudosCadastrados: await contar(metricas.conteudosCadastrados, conexao),
      usuariosPremium: await contar(metricas.usuariosPremium, conexao),
      mensagensContato: await contar(metricas.mensagensContato, conexao),
    };
  },
});

module.exports = AdminModel;
