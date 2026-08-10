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
    denunciasAbertas: `SELECT COUNT(*) AS total FROM Denuncia WHERE status = 'pendente'`,
  },
  pendencias: {
    conteudosRascunho: `SELECT COUNT(*) AS total FROM ${TABELAS.conteudos} WHERE status = 'rascunho'`,
    denunciasPendentes: `SELECT COUNT(*) AS total FROM Denuncia WHERE status = 'pendente'`,
    mensagensPendentes: `SELECT COUNT(*) AS total FROM ${TABELAS.mensagensContato} WHERE status = 'pendente'`,
    totalProfessores: `SELECT COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'professor'`,
  },
  crescimentoCadastros: `
    SELECT DATE_FORMAT(criado_em, '%Y-%m') AS mes, COUNT(*) AS total
    FROM ${TABELAS.usuarios}
    WHERE criado_em >= ?
    GROUP BY mes
  `,
  crescimentoDuvidas: `
    SELECT DATE_FORMAT(data_resposta, '%Y-%m') AS mes, COUNT(*) AS total
    FROM ${TABELAS.respostas}
    WHERE data_resposta >= ?
    GROUP BY mes
  `,
  crescimentoPremium: `
    SELECT DATE_FORMAT(data_inicio, '%Y-%m') AS mes, COUNT(*) AS total
    FROM ${TABELAS.assinaturasPremium}
    WHERE data_inicio >= ?
    GROUP BY mes
  `,
  listarUsuarios: `
    SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, u.criado_em, u.ultimo_login,
           a.RA, a.serie, m.nome AS materia,
           EXISTS(
             SELECT 1 FROM ${TABELAS.assinaturasPremium} ap
             WHERE ap.id_usuario = u.id_usuario AND ap.status = 'ativa'
           ) AS premium_ativo,
           (
             SELECT MAX(ap2.data_fim) FROM ${TABELAS.assinaturasPremium} ap2
             WHERE ap2.id_usuario = u.id_usuario AND ap2.status = 'ativa'
           ) AS premium_ate
    FROM ${TABELAS.usuarios} u
    LEFT JOIN ${TABELAS.alunos} a ON a.id_aluno = u.id_usuario
    LEFT JOIN ${TABELAS.professores} p ON p.id_professor = u.id_usuario
    LEFT JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
    ORDER BY u.id_usuario DESC
  `,
  relatorioDiario: {
    novosAlunos: `SELECT DATE(criado_em) AS dia, COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'aluno' AND criado_em >= ? GROUP BY dia`,
    novosProfessores: `SELECT DATE(criado_em) AS dia, COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'professor' AND criado_em >= ? GROUP BY dia`,
    conteudosPublicados: `SELECT DATE(criado_em) AS dia, COUNT(*) AS total FROM ${TABELAS.conteudos} WHERE status = 'publicado' AND criado_em >= ? GROUP BY dia`,
    duvidasRespondidas: `SELECT DATE(data_resposta) AS dia, COUNT(*) AS total FROM ${TABELAS.respostas} WHERE data_resposta >= ? GROUP BY dia`,
    premiumsVendidos: `SELECT DATE(data_inicio) AS dia, COUNT(*) AS total FROM ${TABELAS.assinaturasPremium} WHERE data_inicio >= ? GROUP BY dia`,
    // Nao existe rastreamento de acesso no banco (nenhuma tela grava
    // "aluno X abriu conteudo Y") - em vez de inventar esse dado, o
    // grafico correspondente usa volume de CONTEUDO PUBLICADO por
    // materia, que e real e mede popularidade de outro jeito.
    conteudosPorMateriaEDia: `
      SELECT DATE(c.criado_em) AS dia, m.nome AS materia, COUNT(*) AS total
      FROM ${TABELAS.conteudos} c
      INNER JOIN ${TABELAS.materias} m ON m.id_materia = c.materia_id
      WHERE c.status = 'publicado' AND c.criado_em >= ?
      GROUP BY dia, materia
    `,
  },
});

const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function banco(conexao) {
  return conexao || pool;
}

async function contar(query, conexao) {
  const [linhas] = await banco(conexao).query(query);
  return linhas[0]?.total || 0;
}

// Constroi os ultimos "quantidade" meses (incluindo o atual), do mais
// antigo pro mais recente: [{ chave: 'YYYY-MM', rotulo: 'Mar' }, ...].
function ultimosMeses(quantidade) {
  const hoje = new Date();
  const meses = [];

  for (let i = quantidade - 1; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    meses.push({ chave, rotulo: MESES_ABREV[data.getMonth()], data });
  }

  return meses;
}

// Roda a query de contagem-por-mes e preenche os meses sem nenhuma
// linha com 0, na mesma ordem de "meses".
async function serieAgrupadaPorMes(query, meses, conexao) {
  const [linhas] = await banco(conexao).query(query, [meses[0].data]);
  const porMes = new Map(linhas.map((l) => [l.mes, l.total]));
  return meses.map((m) => porMes.get(m.chave) || 0);
}

// mysql2 devolve coluna DATE como Date em horario local da meia-noite -
// usar toISOString() converteria pra UTC e podia "voltar" um dia.
function formatarDataLocal(data) {
  const d = data instanceof Date ? data : new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mapaPorDia(linhas) {
  return new Map(linhas.map((l) => [formatarDataLocal(l.dia), l.total]));
}

const AdminModel = Object.freeze({
  async buscarMetricasDashboard(conexao) {
    const metricas = queries.metricasDashboard;
    const totalProfessores = await contar(metricas.totalProfessores, conexao);

    return {
      totalAlunos: await contar(metricas.totalAlunos, conexao),
      totalProfessores,
      // Nao existe estado "conta docente pendente de aprovacao" no
      // schema atual - toda linha em Professor ja e uma conta ativa,
      // entao esse numero e sempre igual a totalProfessores por agora.
      contasProfessor: totalProfessores,
      duvidasPendentes: await contar(metricas.duvidasPendentes, conexao),
      conteudosCadastrados: await contar(metricas.conteudosCadastrados, conexao),
      usuariosPremium: await contar(metricas.usuariosPremium, conexao),
      mensagensContato: await contar(metricas.mensagensContato, conexao),
      denunciasAbertas: await contar(metricas.denunciasAbertas, conexao),
    };
  },

  async buscarGraficoCrescimento(conexao) {
    const meses = ultimosMeses(6);

    const [cadastros, duvidas, premium] = await Promise.all([
      serieAgrupadaPorMes(queries.crescimentoCadastros, meses, conexao),
      serieAgrupadaPorMes(queries.crescimentoDuvidas, meses, conexao),
      serieAgrupadaPorMes(queries.crescimentoPremium, meses, conexao),
    ]);

    return {
      labels: meses.map((m) => m.rotulo),
      series: [
        { chave: "cadastros", nome: "Cadastros", cor: "#A398D1", valores: cadastros },
        { chave: "duvidas", nome: "Duvidas respondidas", cor: "#FF9C7D", valores: duvidas },
        { chave: "premium", nome: "Uso premium", cor: "#6d63a8", valores: premium },
      ],
    };
  },

  async buscarPendencias(conexao) {
    const p = queries.pendencias;

    const [conteudos, denuncias, mensagens, professores] = await Promise.all([
      contar(p.conteudosRascunho, conexao),
      contar(p.denunciasPendentes, conexao),
      contar(p.mensagensPendentes, conexao),
      contar(p.totalProfessores, conexao),
    ]);

    return [
      { titulo: `${professores} professores`, descricao: "Contas docentes cadastradas para consulta", prioridade: "baixa" },
      { titulo: `${denuncias} denuncias`, descricao: "Moderação do fórum pendente", prioridade: "alta" },
      { titulo: `${conteudos} conteudos`, descricao: "Materiais esperando publicação", prioridade: "media" },
      { titulo: `${mensagens} mensagens`, descricao: "Contato aguardando resposta", prioridade: "media" },
    ];
  },

  async listarUsuarios(conexao) {
    const [usuarios] = await banco(conexao).query(queries.listarUsuarios);
    return usuarios;
  },

  // Um registro por dia dos ultimos 430 dias (~14 meses, cobre "ultimos
  // 12 meses" com folga pro calculo de variacao percentual do periodo
  // anterior) - mesma janela que o mock antigo usava. Toda a filtragem
  // por periodo/agregacao mensal continua acontecendo no client
  // (relatorios.js), sem mudar nada la - so a fonte do array virou real.
  async buscarRelatorioDiario(conexao) {
    const bancoUsado = banco(conexao);
    const q = queries.relatorioDiario;
    const DIAS = 430;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataInicio = new Date(hoje);
    dataInicio.setDate(dataInicio.getDate() - (DIAS - 1));

    const [
      [alunos], [professores], [conteudos], [duvidas], [premiums], [materiaLinhas], materias,
    ] = await Promise.all([
      bancoUsado.query(q.novosAlunos, [dataInicio]),
      bancoUsado.query(q.novosProfessores, [dataInicio]),
      bancoUsado.query(q.conteudosPublicados, [dataInicio]),
      bancoUsado.query(q.duvidasRespondidas, [dataInicio]),
      bancoUsado.query(q.premiumsVendidos, [dataInicio]),
      bancoUsado.query(q.conteudosPorMateriaEDia, [dataInicio]),
      bancoUsado.query(`SELECT nome FROM ${TABELAS.materias} ORDER BY nome`).then(([l]) => l.map((m) => m.nome)),
    ]);

    const mAlunos = mapaPorDia(alunos);
    const mProfessores = mapaPorDia(professores);
    const mConteudos = mapaPorDia(conteudos);
    const mDuvidas = mapaPorDia(duvidas);
    const mPremiums = mapaPorDia(premiums);

    const materiaPorDia = new Map();
    materiaLinhas.forEach((linha) => {
      const dia = formatarDataLocal(linha.dia);
      if (!materiaPorDia.has(dia)) materiaPorDia.set(dia, {});
      materiaPorDia.get(dia)[linha.materia] = linha.total;
    });

    const registros = [];
    for (let i = 0; i < DIAS; i++) {
      const data = new Date(dataInicio);
      data.setDate(data.getDate() + i);
      const chave = formatarDataLocal(data);
      const acessosDoDia = materiaPorDia.get(chave) || {};

      // Todas as materias sempre presentes (mesmo com 0), pra bater com
      // o formato que o client ja espera - ele soma direto sem checar
      // se a chave existe.
      const acessosPorMateria = {};
      materias.forEach((nome) => {
        acessosPorMateria[nome] = acessosDoDia[nome] || 0;
      });

      registros.push({
        chave,
        data: data.toISOString(),
        novosAlunos: mAlunos.get(chave) || 0,
        novosProfessores: mProfessores.get(chave) || 0,
        conteudosPublicados: mConteudos.get(chave) || 0,
        duvidasRespondidas: mDuvidas.get(chave) || 0,
        premiumsVendidos: mPremiums.get(chave) || 0,
        acessosPorMateria,
      });
    }

    return { registros, materias };
  },
});

module.exports = AdminModel;
