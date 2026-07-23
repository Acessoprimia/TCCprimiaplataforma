// Dados mockados do dashboard administrativo (sem banco/API por enquanto).
// Os nomes dos campos de "metricas" seguem o mesmo padrao usado em
// app/models/adminModel.js (buscarMetricasDashboard), para que a troca futura
// pelo modelo real exija apenas substituir a chamada abaixo, sem tocar na view.

const METRICAS_MOCK = Object.freeze({
  totalAlunos: 245,
  totalProfessores: 18,
  contasProfessor: 18,
  denunciasAbertas: 5,
  conteudosCadastrados: 74,
  usuariosPremium: 39,
  mensagensContato: 12,
});

const GRAFICO_CRESCIMENTO_MOCK = Object.freeze({
  labels: Object.freeze(["Fev", "Mar", "Abr", "Mai", "Jun", "Jul"]),
  series: Object.freeze([
    Object.freeze({ chave: "cadastros", nome: "Cadastros", cor: "#A398D1", valores: Object.freeze([40, 55, 48, 70, 62, 82]) }),
    Object.freeze({ chave: "duvidas", nome: "Duvidas respondidas", cor: "#FF9C7D", valores: Object.freeze([30, 42, 50, 58, 66, 74]) }),
    Object.freeze({ chave: "premium", nome: "Uso premium", cor: "#6d63a8", valores: Object.freeze([18, 24, 27, 33, 36, 45]) }),
  ]),
});

const PENDENCIAS_MOCK = Object.freeze([
  Object.freeze({ titulo: "18 professores", descricao: "Contas docentes cadastradas para consulta", prioridade: "baixa" }),
  Object.freeze({ titulo: "5 denuncias", descricao: "Moderacao do forum pendente", prioridade: "alta" }),
  Object.freeze({ titulo: "4 conteudos", descricao: "Materiais esperando publicacao", prioridade: "media" }),
  Object.freeze({ titulo: "12 mensagens", descricao: "Contato aguardando resposta", prioridade: "media" }),
]);

// Assinaturas assincronas de proposito: quando a integracao real entrar,
// estas funcoes serao substituidas por chamadas a Models (ex.: Models.admin),
// que tambem retornam Promise, sem exigir mudanca em quem as consome.
const AdminDashboardMock = Object.freeze({
  async buscarMetricas() {
    return { ...METRICAS_MOCK };
  },
  async buscarGraficoCrescimento() {
    return {
      labels: [...GRAFICO_CRESCIMENTO_MOCK.labels],
      series: GRAFICO_CRESCIMENTO_MOCK.series.map((serie) => ({ ...serie, valores: [...serie.valores] })),
    };
  },
  async buscarPendencias() {
    return PENDENCIAS_MOCK.map((item) => ({ ...item }));
  },
});

module.exports = AdminDashboardMock;
