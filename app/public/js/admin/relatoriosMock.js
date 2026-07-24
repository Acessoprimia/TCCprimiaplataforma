// Dados mockados da pagina /admin/relatorios (sem banco/API por enquanto).
// REGISTROS_DIARIOS_RELATORIOS_MOCK e o "array de objetos" consumido por relatorios.js:
// um registro por dia, com os totais daquele dia. Cards, graficos e a tabela mensal sao
// derivados desse array em tempo de execucao (agregacao por periodo). Quando a integracao
// real entrar, este array deixa de ser gerado aqui e passa a vir de uma API (ex.: GET
// /api/admin/relatorios?inicio=...&fim=...) que devolva os mesmos registros diarios — o
// restante do codigo (filtros de periodo, agregacao, graficos, tabela) nao precisa mudar.

const MATERIAS_RELATORIO_MOCK = [
    "Matematica", "Biologia", "Historia", "Quimica", "Fisica", "Portugues", "Geografia", "Filosofia",
];

// Ancora de tempo usada para gerar dados relativos deterministicos (mesma abordagem de
// usuariosMock.js, conteudosMock.js e suporteMock.js). Representa o "hoje" simulado.
const DATA_REFERENCIA_RELATORIOS = new Date("2026-07-23T00:00:00");

function formatarChaveDia(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function gerarRegistroDiarioRelatorio(indice, data) {
    const diaSemana = data.getDay();
    const fatorFimDeSemana = (diaSemana === 0 || diaSemana === 6) ? 0.55 : 1;
    // Leve tendencia de crescimento ao longo da serie, para os cards de variacao
    // percentual e os graficos terem uma curva plausivel em vez de ruido plano.
    const fatorTendencia = 1 + indice * 0.0022;

    const novosAlunos = Math.round((6 + (indice % 9)) * fatorFimDeSemana * fatorTendencia);
    const novosProfessores = indice % 5 === 0 ? 1 : 0;
    const conteudosPublicados = indice % 4 === 0 ? 1 + (indice % 3) : 0;
    const duvidasRespondidas = Math.round((10 + (indice % 15)) * fatorFimDeSemana * fatorTendencia);
    const premiumsVendidos = indice % 3 === 0 ? 1 : 0;

    const acessosPorMateria = {};
    MATERIAS_RELATORIO_MOCK.forEach((materia, materiaIndice) => {
        acessosPorMateria[materia] = Math.round((8 + ((indice + materiaIndice * 7) % 20)) * fatorFimDeSemana * fatorTendencia);
    });

    return {
        chave: formatarChaveDia(data),
        data: data.toISOString(),
        novosAlunos,
        novosProfessores,
        conteudosPublicados,
        duvidasRespondidas,
        premiumsVendidos,
        acessosPorMateria,
    };
}

function gerarRegistrosDiariosRelatorio(totalDias) {
    const registros = [];

    for (let indice = 0; indice < totalDias; indice += 1) {
        const data = new Date(DATA_REFERENCIA_RELATORIOS);
        data.setDate(data.getDate() - (totalDias - 1 - indice));
        registros.push(gerarRegistroDiarioRelatorio(indice, data));
    }

    return registros;
}

// ~14 meses de historico diario: cobre "Ultimos 12 meses" com folga para o calculo
// do periodo anterior (usado nos indicadores de variacao percentual dos cards).
const REGISTROS_DIARIOS_RELATORIOS_MOCK = gerarRegistrosDiariosRelatorio(430);
