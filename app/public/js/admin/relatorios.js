// Interacoes da pagina /admin/relatorios (cards, graficos, resumo mensal e filtro de periodo).
// REGISTROS_DIARIOS_RELATORIOS_MOCK e DATA_REFERENCIA_RELATORIOS vem de relatoriosMock.js
// (carregado antes deste arquivo). Esta pagina nao depende de common.js: nao usa modais nem
// menus de acao, entao mantem apenas o pequeno utilitario de escape usado nas outras paginas.

function escapeHtmlRelatorios(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[caractere]));
}

const MESES_ABREVIADOS_RELATORIO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_COMPLETOS_RELATORIO = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ICONES_RESUMO_RELATORIO = {
    crescimento: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
    premium: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    conteudos: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
    duvidas: '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
};

// ---- Elementos ----

const resumoRelatorios = document.getElementById("relatoriosResumo");
const graficoUsuariosFrame = document.getElementById("graficoUsuariosFrame");
const graficoUsuariosLegenda = document.getElementById("graficoUsuariosLegenda");
const graficoConteudosFrame = document.getElementById("graficoConteudosFrame");
const graficoPremiumFrame = document.getElementById("graficoPremiumFrame");
const graficoMateriasFrame = document.getElementById("graficoMateriasFrame");
const tabelaRelatorios = document.getElementById("relatoriosTabela");
const painelPeriodoPersonalizado = document.getElementById("periodoPersonalizado");
const campoDataInicio = document.getElementById("periodoDataInicio");
const campoDataFim = document.getElementById("periodoDataFim");
const botaoAplicarPersonalizado = document.getElementById("periodoAplicar");

// ---- Estado do filtro de periodo ----

const ESTADO_PERIODO_RELATORIOS = {
    periodo: "30d",
    dataInicioPersonalizada: null,
    dataFimPersonalizada: null,
};

// ---- Utilitarios de data ----

function iniciarDoDia(data) {
    const copia = new Date(data);
    copia.setHours(0, 0, 0, 0);
    return copia;
}

function adicionarDias(data, quantidade) {
    const copia = new Date(data);
    copia.setDate(copia.getDate() + quantidade);
    return copia;
}

function chaveMesRelatorio(chaveDia) {
    return chaveDia.slice(0, 7);
}

function rotuloMesAbreviado(chaveMesStr) {
    const [ano, mes] = chaveMesStr.split("-").map(Number);
    return `${MESES_ABREVIADOS_RELATORIO[mes - 1]}/${String(ano).slice(2)}`;
}

function rotuloMesCompleto(chaveMesStr) {
    const [ano, mes] = chaveMesStr.split("-").map(Number);
    return `${MESES_COMPLETOS_RELATORIO[mes - 1]} de ${ano}`;
}

function rotuloDiaRelatorio(chaveDia) {
    const [, mes, dia] = chaveDia.split("-");
    return `${dia}/${mes}`;
}

// ---- Resolucao do periodo selecionado ----
// Calcula o intervalo atual e um intervalo anterior de mesma duracao (usado nos
// indicadores de variacao percentual dos cards). Pronta para virar parametros de
// uma futura chamada fetch("/api/admin/relatorios?inicio=...&fim=...").
function resolverIntervaloPeriodo(estado) {
    const hoje = iniciarDoDia(DATA_REFERENCIA_RELATORIOS);
    let inicio;
    let fim = hoje;

    switch (estado.periodo) {
        case "7d":
            inicio = adicionarDias(hoje, -6);
            break;
        case "12m":
            inicio = adicionarDias(hoje, -364);
            break;
        case "personalizado": {
            inicio = estado.dataInicioPersonalizada ? iniciarDoDia(new Date(`${estado.dataInicioPersonalizada}T00:00:00`)) : adicionarDias(hoje, -29);
            fim = estado.dataFimPersonalizada ? iniciarDoDia(new Date(`${estado.dataFimPersonalizada}T00:00:00`)) : hoje;

            if (inicio > fim) {
                [inicio, fim] = [fim, inicio];
            }

            break;
        }
        case "30d":
        default:
            inicio = adicionarDias(hoje, -29);
    }

    const duracaoDias = Math.round((fim - inicio) / 86400000) + 1;
    const fimAnterior = adicionarDias(inicio, -1);
    const inicioAnterior = adicionarDias(fimAnterior, -(duracaoDias - 1));
    const granularidade = duracaoDias <= 31 ? "dia" : "mes";

    return { inicio, fim, inicioAnterior, fimAnterior, granularidade };
}

function filtrarRegistrosPorIntervalo(registros, inicio, fim) {
    const inicioChave = formatarChaveDia(inicio);
    const fimChave = formatarChaveDia(fim);
    return registros.filter((registro) => registro.chave >= inicioChave && registro.chave <= fimChave);
}

// ---- Agregacao ----

function somarCampo(registros, campo) {
    return registros.reduce((total, registro) => total + registro[campo], 0);
}

function calcularVariacaoPercentual(atual, anterior) {
    if (anterior === 0) {
        return atual === 0 ? 0 : 100;
    }

    return Math.round(((atual - anterior) / anterior) * 100);
}

function agruparPorPeriodo(registros, granularidade, campos) {
    const grupos = new Map();

    registros.forEach((registro) => {
        const chaveGrupo = granularidade === "dia" ? registro.chave : chaveMesRelatorio(registro.chave);

        if (!grupos.has(chaveGrupo)) {
            const grupoInicial = { chave: chaveGrupo };
            campos.forEach((campo) => { grupoInicial[campo] = 0; });
            grupos.set(chaveGrupo, grupoInicial);
        }

        const grupo = grupos.get(chaveGrupo);
        campos.forEach((campo) => { grupo[campo] += registro[campo]; });
    });

    return Array.from(grupos.values()).sort((a, b) => a.chave.localeCompare(b.chave));
}

function rotulosPorGranularidade(grupos, granularidade) {
    return grupos.map((grupo) => (granularidade === "dia" ? rotuloDiaRelatorio(grupo.chave) : rotuloMesAbreviado(grupo.chave)));
}

// ---- Camada de dados: cards, series dos graficos e tabela ----
// Cada funcao abaixo recebe registros diarios ja filtrados pelo periodo e devolve a
// forma pronta para a interface. Quando a integracao real entrar, REGISTROS_DIARIOS_
// RELATORIOS_MOCK sera substituido pela resposta da API e estas funcoes de agregacao
// deixam de rodar no navegador, passando a vir prontas do backend.

function calcularCardsRelatorios(registrosPeriodo, registrosPeriodoAnterior) {
    const usuariosAtual = somarCampo(registrosPeriodo, "novosAlunos") + somarCampo(registrosPeriodo, "novosProfessores");
    const usuariosAnterior = somarCampo(registrosPeriodoAnterior, "novosAlunos") + somarCampo(registrosPeriodoAnterior, "novosProfessores");
    const premiumAtual = somarCampo(registrosPeriodo, "premiumsVendidos");
    const premiumAnterior = somarCampo(registrosPeriodoAnterior, "premiumsVendidos");
    const conteudosAtual = somarCampo(registrosPeriodo, "conteudosPublicados");
    const conteudosAnterior = somarCampo(registrosPeriodoAnterior, "conteudosPublicados");
    const duvidasAtual = somarCampo(registrosPeriodo, "duvidasRespondidas");
    const duvidasAnterior = somarCampo(registrosPeriodoAnterior, "duvidasRespondidas");

    return [
        { icone: "crescimento", rotulo: "Crescimento de usuarios", descricao: "Novos alunos e professores no periodo", valor: usuariosAtual, variacao: calcularVariacaoPercentual(usuariosAtual, usuariosAnterior) },
        { icone: "premium", rotulo: "Usuarios Premium", descricao: "Novas assinaturas premium no periodo", valor: premiumAtual, variacao: calcularVariacaoPercentual(premiumAtual, premiumAnterior) },
        { icone: "conteudos", rotulo: "Conteudos publicados", descricao: "Materiais publicados no periodo", valor: conteudosAtual, variacao: calcularVariacaoPercentual(conteudosAtual, conteudosAnterior) },
        { icone: "duvidas", rotulo: "Duvidas respondidas", descricao: "Duvidas do forum respondidas no periodo", valor: duvidasAtual, variacao: calcularVariacaoPercentual(duvidasAtual, duvidasAnterior) },
    ];
}

function construirSerieUsuarios(registrosPeriodo, granularidade) {
    const grupos = agruparPorPeriodo(registrosPeriodo, granularidade, ["novosAlunos", "novosProfessores"]);

    return {
        labels: rotulosPorGranularidade(grupos, granularidade),
        series: [
            { chave: "alunos", nome: "Novos alunos", cor: "#A398D1", valores: grupos.map((grupo) => grupo.novosAlunos) },
            { chave: "professores", nome: "Novos professores", cor: "#FF9C7D", valores: grupos.map((grupo) => grupo.novosProfessores) },
        ],
    };
}

function construirSerieConteudos(registrosPeriodo, granularidade) {
    const grupos = agruparPorPeriodo(registrosPeriodo, granularidade, ["conteudosPublicados"]);

    return {
        labels: rotulosPorGranularidade(grupos, granularidade),
        valores: grupos.map((grupo) => grupo.conteudosPublicados),
    };
}

function construirSeriePremium(registrosPeriodo, granularidade) {
    const grupos = agruparPorPeriodo(registrosPeriodo, granularidade, ["premiumsVendidos"]);

    return {
        labels: rotulosPorGranularidade(grupos, granularidade),
        series: [{ chave: "premium", nome: "Novas assinaturas premium", cor: "#6d63a8", valores: grupos.map((grupo) => grupo.premiumsVendidos) }],
    };
}

function construirAcessosPorMateria(registrosPeriodo) {
    const totais = {};
    MATERIAS_RELATORIO_MOCK.forEach((materia) => { totais[materia] = 0; });

    registrosPeriodo.forEach((registro) => {
        MATERIAS_RELATORIO_MOCK.forEach((materia) => {
            totais[materia] += registro.acessosPorMateria[materia];
        });
    });

    return MATERIAS_RELATORIO_MOCK
        .map((materia) => ({ materia, valor: totais[materia] }))
        .sort((a, b) => b.valor - a.valor);
}

function construirTabelaMensal(registrosPeriodo) {
    const grupos = agruparPorPeriodo(registrosPeriodo, "mes", ["novosAlunos", "novosProfessores", "conteudosPublicados", "premiumsVendidos"]);

    return grupos
        .slice()
        .sort((a, b) => b.chave.localeCompare(a.chave))
        .map((grupo) => ({
            mes: rotuloMesCompleto(grupo.chave),
            novosAlunos: grupo.novosAlunos,
            novosProfessores: grupo.novosProfessores,
            conteudosPublicados: grupo.conteudosPublicados,
            premiumsVendidos: grupo.premiumsVendidos,
        }));
}

// Assinatura pronta para virar uma chamada de API: quando o backend estiver disponivel,
// o corpo desta funcao vira um fetch("/api/admin/relatorios?periodo=...") mantendo o
// mesmo formato de retorno usado pela renderizacao abaixo.
async function consultarRelatorios(estado) {
    const { inicio, fim, inicioAnterior, fimAnterior, granularidade } = resolverIntervaloPeriodo(estado);
    const registrosPeriodo = filtrarRegistrosPorIntervalo(REGISTROS_DIARIOS_RELATORIOS_MOCK, inicio, fim);
    const registrosPeriodoAnterior = filtrarRegistrosPorIntervalo(REGISTROS_DIARIOS_RELATORIOS_MOCK, inicioAnterior, fimAnterior);

    return {
        cards: calcularCardsRelatorios(registrosPeriodo, registrosPeriodoAnterior),
        serieUsuarios: construirSerieUsuarios(registrosPeriodo, granularidade),
        serieConteudos: construirSerieConteudos(registrosPeriodo, granularidade),
        seriePremium: construirSeriePremium(registrosPeriodo, granularidade),
        materias: construirAcessosPorMateria(registrosPeriodo),
        tabela: construirTabelaMensal(registrosPeriodo),
    };
}

// ---- Renderizacao: cards ----

function badgeVariacaoHtml(variacao) {
    const classe = variacao > 0 ? "positiva" : variacao < 0 ? "negativa" : "neutra";
    const sinal = variacao > 0 ? "+" : "";
    return `<span class="metric-card-variacao ${classe}">${sinal}${variacao}%</span>`;
}

function cartaoRelatorioHtml(cartao) {
    return `
        <article class="metric-card">
            <header class="metric-card-head">
                <i class="metric-card-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES_RESUMO_RELATORIO[cartao.icone]}</svg>
                </i>
                <span>${cartao.rotulo}</span>
            </header>
            <strong>${cartao.valor.toLocaleString("pt-BR")}${badgeVariacaoHtml(cartao.variacao)}</strong>
            <p>${cartao.descricao}</p>
        </article>
    `;
}

function renderizarCardsRelatorios(cartoes) {
    resumoRelatorios.innerHTML = cartoes.map(cartaoRelatorioHtml).join("");
}

// ---- Renderizacao: graficos ----
// Os dois renderizadores abaixo produzem o mesmo SVG (classes de admin.css) que o
// grafico de crescimento do dashboard, mas montado em JS para poder ser recalculado a
// cada troca de periodo sem recarregar a pagina.

function renderizarGraficoLinhas({ frameEl, legendaEl, labels, series, idGradiente }) {
    if (!labels.length) {
        frameEl.innerHTML = '<p class="chart-vazio">Nenhum dado para o periodo selecionado.</p>';
        if (legendaEl) {
            legendaEl.innerHTML = "";
        }
        return;
    }

    const largura = 640;
    const altura = 240;
    const pad = { top: 16, right: 16, bottom: 30, left: 34 };
    const plotW = largura - pad.left - pad.right;
    const plotH = altura - pad.top - pad.bottom;
    const totalPontos = labels.length;
    const todosValores = series.flatMap((serie) => serie.valores);
    const escalaMaxima = Math.max(10, Math.ceil((Math.max(1, ...todosValores) * 1.15) / 10) * 10);
    const passoX = totalPontos > 1 ? plotW / (totalPontos - 1) : 0;

    const coordX = (indice) => pad.left + passoX * indice;
    const coordY = (valor) => pad.top + plotH - (valor / escalaMaxima) * plotH;
    const linhaBase = (pad.top + plotH).toFixed(1);

    const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map((fracao) => ({
        y: (pad.top + plotH * (1 - fracao)).toFixed(1),
        valor: Math.round(escalaMaxima * fracao),
    }));

    const seriesCalc = series.map((serie) => {
        const pontos = serie.valores.map((valor, indice) => ({ x: coordX(indice).toFixed(1), y: coordY(valor).toFixed(1) }));
        const linha = pontos.map((ponto, indice) => `${indice === 0 ? "M" : "L"}${ponto.x},${ponto.y}`).join(" ");
        const area = `${linha} L${coordX(totalPontos - 1).toFixed(1)},${linhaBase} L${coordX(0).toFixed(1)},${linhaBase} Z`;
        return { ...serie, pontos, linha, area };
    });

    const defsGradiente = `
        <linearGradient id="${idGradiente}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${seriesCalc[0].cor}" stop-opacity="0.32"></stop>
            <stop offset="100%" stop-color="${seriesCalc[0].cor}" stop-opacity="0"></stop>
        </linearGradient>
    `;

    const grade = linhasGrade.map((linha) => `
        <line class="chart-grid-line" x1="${pad.left}" y1="${linha.y}" x2="${largura - pad.right}" y2="${linha.y}"></line>
        <text class="chart-grid-label" x="${pad.left - 8}" y="${linha.y}" text-anchor="end">${linha.valor}</text>
    `).join("");

    const eixoX = labels.map((rotulo, indice) => `
        <text class="chart-axis-label" x="${coordX(indice).toFixed(1)}" y="${altura - 10}" text-anchor="middle">${escapeHtmlRelatorios(rotulo)}</text>
    `).join("");

    const area = `<path class="chart-area" d="${seriesCalc[0].area}" fill="url(#${idGradiente})"></path>`;

    const linhas = seriesCalc.map((serie) => `
        <path class="chart-line" d="${serie.linha}" stroke="${serie.cor}" fill="none"></path>
        ${serie.pontos.map((ponto) => `<circle class="chart-point" cx="${ponto.x}" cy="${ponto.y}" r="3.5" fill="${serie.cor}"></circle>`).join("")}
    `).join("");

    frameEl.innerHTML = `
        <svg class="growth-chart" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Grafico de linhas">
            <defs>${defsGradiente}</defs>
            ${grade}
            ${eixoX}
            ${area}
            ${linhas}
        </svg>
    `;

    if (legendaEl) {
        legendaEl.innerHTML = series.map((serie) => `<span><i class="chart-caption-dot" style="background-color: ${serie.cor}"></i>${escapeHtmlRelatorios(serie.nome)}</span>`).join("");
    }
}

function renderizarGraficoBarras({ frameEl, labels, valores, cor }) {
    if (!labels.length) {
        frameEl.innerHTML = '<p class="chart-vazio">Nenhum dado para o periodo selecionado.</p>';
        return;
    }

    const largura = 640;
    const altura = 240;
    const pad = { top: 16, right: 16, bottom: 30, left: 34 };
    const plotW = largura - pad.left - pad.right;
    const plotH = altura - pad.top - pad.bottom;
    const escalaMaxima = Math.max(5, Math.ceil((Math.max(1, ...valores) * 1.15) / 5) * 5);
    const totalBarras = labels.length;
    const espacoBarra = plotW / totalBarras;
    const larguraBarra = Math.min(28, espacoBarra * 0.5);
    const baseY = pad.top + plotH;

    const coordY = (valor) => pad.top + plotH - (valor / escalaMaxima) * plotH;
    const coordXCentro = (indice) => pad.left + espacoBarra * indice + espacoBarra / 2;

    const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map((fracao) => ({
        y: (pad.top + plotH * (1 - fracao)).toFixed(1),
        valor: Math.round(escalaMaxima * fracao),
    }));

    const grade = linhasGrade.map((linha) => `
        <line class="chart-grid-line" x1="${pad.left}" y1="${linha.y}" x2="${largura - pad.right}" y2="${linha.y}"></line>
        <text class="chart-grid-label" x="${pad.left - 8}" y="${linha.y}" text-anchor="end">${linha.valor}</text>
    `).join("");

    const eixoX = labels.map((rotulo, indice) => `
        <text class="chart-axis-label" x="${coordXCentro(indice).toFixed(1)}" y="${altura - 10}" text-anchor="middle">${escapeHtmlRelatorios(rotulo)}</text>
    `).join("");

    const barras = valores.map((valor, indice) => {
        const x = (coordXCentro(indice) - larguraBarra / 2).toFixed(1);
        const y = coordY(valor).toFixed(1);
        const alturaBarra = (baseY - coordY(valor)).toFixed(1);
        return `<rect class="chart-bar" x="${x}" y="${y}" width="${larguraBarra.toFixed(1)}" height="${alturaBarra}" rx="4" fill="${cor}"></rect>`;
    }).join("");

    frameEl.innerHTML = `
        <svg class="growth-chart" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Grafico de barras">
            ${grade}
            ${eixoX}
            ${barras}
        </svg>
    `;
}

function renderizarAcessosPorMateria(elemento, itens) {
    if (!itens.length) {
        elemento.innerHTML = '<p class="chart-vazio">Nenhum dado para o periodo selecionado.</p>';
        return;
    }

    const maximo = Math.max(1, ...itens.map((item) => item.valor));

    elemento.innerHTML = `
        <ul class="hbar-list">
            ${itens.map((item) => `
                <li class="hbar-row">
                    <span class="hbar-rotulo">${escapeHtmlRelatorios(item.materia)}</span>
                    <span class="hbar-track"><span class="hbar-fill" style="width: ${Math.round((item.valor / maximo) * 100)}%"></span></span>
                    <span class="hbar-valor">${item.valor.toLocaleString("pt-BR")}</span>
                </li>
            `).join("")}
        </ul>
    `;
}

// ---- Renderizacao: tabela ----

function linhaTabelaRelatorioHtml(linha) {
    return `
        <tr>
            <td data-label="Mes">${linha.mes}</td>
            <td data-label="Novos alunos">${linha.novosAlunos.toLocaleString("pt-BR")}</td>
            <td data-label="Novos professores">${linha.novosProfessores.toLocaleString("pt-BR")}</td>
            <td data-label="Conteudos publicados">${linha.conteudosPublicados.toLocaleString("pt-BR")}</td>
            <td data-label="Premiums vendidos">${linha.premiumsVendidos.toLocaleString("pt-BR")}</td>
        </tr>
    `;
}

function linhaVaziaTabelaRelatorioHtml() {
    return `<tr class="tabela-vazia"><td colspan="5">Nenhum dado para o periodo selecionado.</td></tr>`;
}

function renderizarTabelaRelatorios(linhas) {
    tabelaRelatorios.innerHTML = linhas.length ? linhas.map(linhaTabelaRelatorioHtml).join("") : linhaVaziaTabelaRelatorioHtml();
}

// ---- Orquestracao ----

async function atualizarRelatorios() {
    const resultado = await consultarRelatorios(ESTADO_PERIODO_RELATORIOS);

    renderizarCardsRelatorios(resultado.cards);

    renderizarGraficoLinhas({
        frameEl: graficoUsuariosFrame,
        legendaEl: graficoUsuariosLegenda,
        labels: resultado.serieUsuarios.labels,
        series: resultado.serieUsuarios.series,
        idGradiente: "gradienteGraficoUsuarios",
    });

    renderizarGraficoBarras({
        frameEl: graficoConteudosFrame,
        labels: resultado.serieConteudos.labels,
        valores: resultado.serieConteudos.valores,
        cor: "#FF9C7D",
    });

    renderizarGraficoLinhas({
        frameEl: graficoPremiumFrame,
        legendaEl: null,
        labels: resultado.seriePremium.labels,
        series: resultado.seriePremium.series,
        idGradiente: "gradienteGraficoPremium",
    });

    renderizarAcessosPorMateria(graficoMateriasFrame, resultado.materias);
    renderizarTabelaRelatorios(resultado.tabela);
}

// ---- Eventos: filtro de periodo ----

document.querySelectorAll("[data-filtro-periodo]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-periodo]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");

        const personalizado = botao.dataset.filtroPeriodo === "personalizado";
        painelPeriodoPersonalizado.classList.toggle("oculto", !personalizado);

        if (!personalizado) {
            ESTADO_PERIODO_RELATORIOS.periodo = botao.dataset.filtroPeriodo;
            atualizarRelatorios();
        }
    });
});

botaoAplicarPersonalizado.addEventListener("click", () => {
    ESTADO_PERIODO_RELATORIOS.periodo = "personalizado";
    ESTADO_PERIODO_RELATORIOS.dataInicioPersonalizada = campoDataInicio.value || null;
    ESTADO_PERIODO_RELATORIOS.dataFimPersonalizada = campoDataFim.value || null;
    atualizarRelatorios();
});

// ---- Inicializacao ----
// Limita o seletor de datas personalizado ao intervalo coberto pelos dados mockados,
// e pre-preenche com os ultimos 30 dias para dar um ponto de partida sensato.

(function inicializarSeletorPersonalizado() {
    const chaveHoje = formatarChaveDia(DATA_REFERENCIA_RELATORIOS);
    const chaveInicioMock = REGISTROS_DIARIOS_RELATORIOS_MOCK[0].chave;

    campoDataInicio.min = chaveInicioMock;
    campoDataInicio.max = chaveHoje;
    campoDataFim.min = chaveInicioMock;
    campoDataFim.max = chaveHoje;

    campoDataFim.value = chaveHoje;
    campoDataInicio.value = formatarChaveDia(adicionarDias(iniciarDoDia(DATA_REFERENCIA_RELATORIOS), -29));
})();

atualizarRelatorios();
