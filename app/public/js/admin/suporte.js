// Interacoes da pagina /admin/suporte (denuncias do forum + mensagens de contato).
// DENUNCIAS_MOCK e CONTATOS_MOCK vem de suporteMock.js (carregado antes deste arquivo).
// Depende das funcoes compartilhadas definidas em common.js.

const TAMANHO_PAGINA_DESKTOP_SUPORTE = 10;
const TAMANHO_PAGINA_MOBILE_SUPORTE = 5;
// Mesmo breakpoint usado em admin.css para empilhar a tabela em telas pequenas.
const MEDIA_QUERY_MOBILE_SUPORTE = window.matchMedia("(max-width: 559px)");

function tamanhoPaginaAtualSuporte() {
    return MEDIA_QUERY_MOBILE_SUPORTE.matches ? TAMANHO_PAGINA_MOBILE_SUPORTE : TAMANHO_PAGINA_DESKTOP_SUPORTE;
}

const ROTULOS_TIPO_DENUNCIA = { forum: "Forum", videoaula: "Videoaula", livro: "Livro", simulado: "Simulado", outros: "Outros" };
const ROTULOS_PRIORIDADE_DENUNCIA = { alta: "Alta", media: "Media", baixa: "Baixa" };
const ROTULOS_STATUS_DENUNCIA = { aberto: "Aberto", em_analise: "Em analise", resolvido: "Resolvido" };
const CLASSES_STATUS_DENUNCIA = { aberto: "pendente", em_analise: "premium", resolvido: "ativo" };
const ROTULOS_RESOLUCAO_DENUNCIA = { resolvido: "Resolvida", ignorado: "Ignorada", conteudo_removido: "Conteudo removido" };

const ROTULOS_STATUS_CONTATO = { aberto: "Aberto", respondido: "Respondido", resolvido: "Resolvido" };
const CLASSES_STATUS_CONTATO = { aberto: "pendente", respondido: "premium", resolvido: "ativo" };

function formatarDataSuporte(isoString) {
    return isoString ? new Date(isoString).toLocaleDateString("pt-BR") : "-";
}

// ---- Abas (Denuncias / Contato) ----

const abaBotoesSuporte = document.querySelectorAll("[data-aba-alvo]");
const abaPaineisSuporte = document.querySelectorAll("[data-aba-painel]");

abaBotoesSuporte.forEach((botao) => {
    botao.addEventListener("click", () => {
        const alvo = botao.dataset.abaAlvo;

        abaBotoesSuporte.forEach((outro) => {
            outro.classList.toggle("aba-ativa", outro === botao);
            outro.setAttribute("aria-selected", outro === botao ? "true" : "false");
        });

        abaPaineisSuporte.forEach((painel) => {
            painel.classList.toggle("oculto", painel.dataset.abaPainel !== alvo);
        });
    });
});

// ---- Cards de resumo (calculados a partir de DENUNCIAS_MOCK e CONTATOS_MOCK) ----

const resumoSuporte = document.getElementById("suporteResumo");

const ICONES_RESUMO_SUPORTE = {
    abertas: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    analise: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    mensagens: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"></path><polyline points="22 6 12 13 2 6"></polyline>',
    resolvidas: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
};

function ehMesmoDiaSuporte(isoString) {
    if (!isoString) {
        return false;
    }

    return new Date(isoString).toDateString() === DATA_REFERENCIA_SUPORTE.toDateString();
}

function calcularResumoSuporte() {
    return {
        abertas: DENUNCIAS_MOCK.filter((denuncia) => denuncia.status === "aberto").length,
        analise: DENUNCIAS_MOCK.filter((denuncia) => denuncia.status === "em_analise").length,
        mensagensNovas: CONTATOS_MOCK.filter((contato) => contato.status === "aberto").length,
        resolvidasHoje: DENUNCIAS_MOCK.filter((denuncia) => denuncia.status === "resolvido" && ehMesmoDiaSuporte(denuncia.resolvidoEm)).length
            + CONTATOS_MOCK.filter((contato) => contato.status === "resolvido" && ehMesmoDiaSuporte(contato.resolvidoEm)).length,
    };
}

function cartaoResumoSuporteHtml(icone, rotulo, valor, descricao, alerta = false) {
    return `
        <article class="metric-card ${alerta ? "alerta" : ""}">
            <header class="metric-card-head">
                <i class="metric-card-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES_RESUMO_SUPORTE[icone]}</svg>
                </i>
                <span>${rotulo}</span>
            </header>
            <strong>${valor}</strong>
            <p>${descricao}</p>
        </article>
    `;
}

function renderizarResumoSuporte() {
    const resumo = calcularResumoSuporte();

    resumoSuporte.innerHTML = [
        cartaoResumoSuporteHtml("abertas", "Denuncias abertas", resumo.abertas, "Aguardando analise do admin", resumo.abertas > 0),
        cartaoResumoSuporteHtml("analise", "Em analise", resumo.analise, "Denuncias sendo avaliadas"),
        cartaoResumoSuporteHtml("mensagens", "Mensagens novas", resumo.mensagensNovas, "Contatos ainda nao respondidos"),
        cartaoResumoSuporteHtml("resolvidas", "Resolvidas hoje", resumo.resolvidasHoje, "Denuncias e contatos encerrados"),
    ].join("");
}

// ==== Aba Denuncias ====

const corpoTabelaDenuncias = document.getElementById("denunciasTabela");
const paginacaoInfoDenuncias = document.getElementById("denunciasPaginacaoInfo");
const paginacaoControlesDenuncias = document.getElementById("denunciasPaginacaoControles");
const campoBuscaDenuncias = document.getElementById("denunciasBusca");

const estadoConsultaDenuncias = {
    busca: "",
    status: "todos",
    prioridade: "todos",
    tipo: "todos",
    pagina: 1,
    tamanhoPagina: tamanhoPaginaAtualSuporte(),
};

// Assinatura pronta para virar uma chamada de API: quando o backend estiver
// disponivel, o corpo desta funcao vira um fetch("/api/admin/denuncias?...")
// mantendo os mesmos parametros de entrada e o mesmo formato de retorno.
async function consultarDenuncias({ busca, status, prioridade, tipo, pagina, tamanhoPagina }) {
    const buscaNormalizada = busca.trim().toLowerCase();

    const filtradas = DENUNCIAS_MOCK.filter((denuncia) => {
        const combinaBusca = !buscaNormalizada
            || denuncia.codigo.toLowerCase().includes(buscaNormalizada)
            || denuncia.usuario.nome.toLowerCase().includes(buscaNormalizada)
            || denuncia.motivo.toLowerCase().includes(buscaNormalizada);

        const combinaStatus = status === "todos" || denuncia.status === status;
        const combinaPrioridade = prioridade === "todos" || denuncia.prioridade === prioridade;
        const combinaTipo = tipo === "todos" || denuncia.tipo === tipo;

        return combinaBusca && combinaStatus && combinaPrioridade && combinaTipo;
    });

    const totalRegistros = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamanhoPagina));
    const paginaValida = Math.min(Math.max(1, pagina), totalPaginas);
    const inicio = (paginaValida - 1) * tamanhoPagina;
    const itens = filtradas.slice(inicio, inicio + tamanhoPagina);

    return { itens, totalRegistros, pagina: paginaValida, tamanhoPagina, totalPaginas };
}

function encontrarDenunciaPorId(id) {
    return DENUNCIAS_MOCK.find((denuncia) => denuncia.id === id);
}

function linhaDenunciaHtml(denuncia) {
    return `
        <tr data-denuncia-id="${denuncia.id}">
            <td data-label="ID">${denuncia.codigo}</td>
            <td data-label="Usuario">${escapeHtml(denuncia.usuario.nome)}<span class="celula-secundaria">${denuncia.usuario.idAcesso}</span></td>
            <td data-label="Tipo"><span class="badge ${denuncia.tipo}">${ROTULOS_TIPO_DENUNCIA[denuncia.tipo]}</span></td>
            <td data-label="Motivo">${escapeHtml(denuncia.motivo)}</td>
            <td data-label="Prioridade"><span class="priority-badge ${denuncia.prioridade}">${ROTULOS_PRIORIDADE_DENUNCIA[denuncia.prioridade]}</span></td>
            <td data-label="Status"><span class="status ${CLASSES_STATUS_DENUNCIA[denuncia.status]}">${ROTULOS_STATUS_DENUNCIA[denuncia.status]}</span></td>
            <td data-label="Data">${formatarDataSuporte(denuncia.criadoEm)}</td>
            <td data-label="Acoes" class="table-actions-cell">
                <div class="table-menu-wrap">
                    <button type="button" class="table-menu-trigger" data-menu-toggle aria-haspopup="true" aria-expanded="false" aria-label="Acoes da denuncia ${denuncia.codigo}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                    <div class="table-menu" role="menu">
                        <button type="button" data-admin-action="visualizar-denuncia">Visualizar</button>
                        <button type="button" data-admin-action="responder-denuncia">Responder</button>
                        <button type="button" data-admin-action="resolver-denuncia">Resolver</button>
                        <button type="button" data-admin-action="ignorar-denuncia">Ignorar</button>
                        <button type="button" class="danger" data-admin-action="remover-conteudo-denuncia">Remover conteudo</button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function linhaVaziaDenunciasHtml() {
    return `<tr class="tabela-vazia"><td colspan="8">Nenhuma denuncia encontrada para os filtros selecionados.</td></tr>`;
}

function renderizarTabelaDenuncias(itens) {
    corpoTabelaDenuncias.innerHTML = itens.length ? itens.map(linhaDenunciaHtml).join("") : linhaVaziaDenunciasHtml();
}

function renderizarPaginacaoDenuncias({ totalRegistros, pagina, tamanhoPagina, totalPaginas }) {
    const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
    const fim = Math.min(pagina * tamanhoPagina, totalRegistros);

    paginacaoInfoDenuncias.textContent = `Mostrando ${inicio}-${fim} de ${totalRegistros.toLocaleString("pt-BR")} denuncias.`;

    paginacaoControlesDenuncias.innerHTML = `
        <button type="button" data-pagina-acao="anterior" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
        <span class="paginacao-atual">Pagina ${pagina} de ${totalPaginas}</span>
        <button type="button" data-pagina-acao="proxima" ${pagina >= totalPaginas ? "disabled" : ""}>Proxima</button>
    `;
}

async function atualizarTabelaDenuncias() {
    const resultado = await consultarDenuncias(estadoConsultaDenuncias);
    estadoConsultaDenuncias.pagina = resultado.pagina;
    renderizarTabelaDenuncias(resultado.itens);
    renderizarPaginacaoDenuncias(resultado);
}

let temporizadorBuscaDenuncias = null;

campoBuscaDenuncias.addEventListener("input", () => {
    window.clearTimeout(temporizadorBuscaDenuncias);
    temporizadorBuscaDenuncias = window.setTimeout(() => {
        estadoConsultaDenuncias.busca = campoBuscaDenuncias.value;
        estadoConsultaDenuncias.pagina = 1;
        atualizarTabelaDenuncias();
    }, 250);
});

function registrarFiltroDenuncias(atributoSeletor, chaveDataset, chaveEstado) {
    document.querySelectorAll(`[${atributoSeletor}]`).forEach((botao) => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(`[${atributoSeletor}]`).forEach((outro) => outro.classList.remove("ativo"));
            botao.classList.add("ativo");
            estadoConsultaDenuncias[chaveEstado] = botao.dataset[chaveDataset];
            estadoConsultaDenuncias.pagina = 1;
            atualizarTabelaDenuncias();
        });
    });
}

registrarFiltroDenuncias("data-filtro-status-denuncia", "filtroStatusDenuncia", "status");
registrarFiltroDenuncias("data-filtro-prioridade-denuncia", "filtroPrioridadeDenuncia", "prioridade");
registrarFiltroDenuncias("data-filtro-tipo-denuncia", "filtroTipoDenuncia", "tipo");

paginacaoControlesDenuncias.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-pagina-acao]");

    if (!botao || botao.disabled) {
        return;
    }

    estadoConsultaDenuncias.pagina += botao.dataset.paginaAcao === "anterior" ? -1 : 1;
    atualizarTabelaDenuncias();
});

// ==== Aba Contato ====

const corpoTabelaContato = document.getElementById("contatoTabela");
const paginacaoInfoContato = document.getElementById("contatoPaginacaoInfo");
const paginacaoControlesContato = document.getElementById("contatoPaginacaoControles");
const campoBuscaContato = document.getElementById("contatoBusca");

const estadoConsultaContato = {
    busca: "",
    pagina: 1,
    tamanhoPagina: tamanhoPaginaAtualSuporte(),
};

// Mesma logica de consultarDenuncias: pronta para virar fetch("/api/admin/contatos?...").
async function consultarContatos({ busca, pagina, tamanhoPagina }) {
    const buscaNormalizada = busca.trim().toLowerCase();

    const filtrados = CONTATOS_MOCK.filter((contato) => {
        return !buscaNormalizada
            || contato.nome.toLowerCase().includes(buscaNormalizada)
            || contato.email.toLowerCase().includes(buscaNormalizada)
            || contato.assunto.toLowerCase().includes(buscaNormalizada);
    });

    const totalRegistros = filtrados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamanhoPagina));
    const paginaValida = Math.min(Math.max(1, pagina), totalPaginas);
    const inicio = (paginaValida - 1) * tamanhoPagina;
    const itens = filtrados.slice(inicio, inicio + tamanhoPagina);

    return { itens, totalRegistros, pagina: paginaValida, tamanhoPagina, totalPaginas };
}

function encontrarContatoPorId(id) {
    return CONTATOS_MOCK.find((contato) => contato.id === id);
}

function removerContatoPorId(id) {
    const indice = CONTATOS_MOCK.findIndex((contato) => contato.id === id);

    if (indice !== -1) {
        CONTATOS_MOCK.splice(indice, 1);
    }
}

function linhaContatoHtml(contato) {
    return `
        <tr data-contato-id="${contato.id}">
            <td data-label="ID">${contato.codigo}</td>
            <td data-label="Nome">${escapeHtml(contato.nome)}</td>
            <td data-label="Email">${escapeHtml(contato.email)}</td>
            <td data-label="Assunto">${escapeHtml(contato.assunto)}</td>
            <td data-label="Status"><span class="status ${CLASSES_STATUS_CONTATO[contato.status]}">${ROTULOS_STATUS_CONTATO[contato.status]}</span></td>
            <td data-label="Data">${formatarDataSuporte(contato.criadoEm)}</td>
            <td data-label="Acoes" class="table-actions-cell">
                <div class="table-menu-wrap">
                    <button type="button" class="table-menu-trigger" data-menu-toggle aria-haspopup="true" aria-expanded="false" aria-label="Acoes da mensagem de ${escapeHtml(contato.nome)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                    <div class="table-menu" role="menu">
                        <button type="button" data-admin-action="visualizar-contato">Visualizar</button>
                        <button type="button" data-admin-action="responder-contato">Responder</button>
                        <button type="button" data-admin-action="resolver-contato">Marcar resolvido</button>
                        <button type="button" class="danger" data-admin-action="excluir-contato">Excluir</button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function linhaVaziaContatoHtml() {
    return `<tr class="tabela-vazia"><td colspan="7">Nenhuma mensagem encontrada para a busca informada.</td></tr>`;
}

function renderizarTabelaContato(itens) {
    corpoTabelaContato.innerHTML = itens.length ? itens.map(linhaContatoHtml).join("") : linhaVaziaContatoHtml();
}

function renderizarPaginacaoContato({ totalRegistros, pagina, tamanhoPagina, totalPaginas }) {
    const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
    const fim = Math.min(pagina * tamanhoPagina, totalRegistros);

    paginacaoInfoContato.textContent = `Mostrando ${inicio}-${fim} de ${totalRegistros.toLocaleString("pt-BR")} mensagens.`;

    paginacaoControlesContato.innerHTML = `
        <button type="button" data-pagina-acao="anterior" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
        <span class="paginacao-atual">Pagina ${pagina} de ${totalPaginas}</span>
        <button type="button" data-pagina-acao="proxima" ${pagina >= totalPaginas ? "disabled" : ""}>Proxima</button>
    `;
}

async function atualizarTabelaContato() {
    const resultado = await consultarContatos(estadoConsultaContato);
    estadoConsultaContato.pagina = resultado.pagina;
    renderizarTabelaContato(resultado.itens);
    renderizarPaginacaoContato(resultado);
}

let temporizadorBuscaContato = null;

campoBuscaContato.addEventListener("input", () => {
    window.clearTimeout(temporizadorBuscaContato);
    temporizadorBuscaContato = window.setTimeout(() => {
        estadoConsultaContato.busca = campoBuscaContato.value;
        estadoConsultaContato.pagina = 1;
        atualizarTabelaContato();
    }, 250);
});

paginacaoControlesContato.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-pagina-acao]");

    if (!botao || botao.disabled) {
        return;
    }

    estadoConsultaContato.pagina += botao.dataset.paginaAcao === "anterior" ? -1 : 1;
    atualizarTabelaContato();
});

// ---- Responsividade da paginacao (mesmo criterio nas duas abas) ----

function sincronizarTamanhoPaginaSuporte() {
    const novoTamanho = tamanhoPaginaAtualSuporte();

    if (novoTamanho === estadoConsultaDenuncias.tamanhoPagina) {
        return;
    }

    estadoConsultaDenuncias.tamanhoPagina = novoTamanho;
    estadoConsultaDenuncias.pagina = 1;
    estadoConsultaContato.tamanhoPagina = novoTamanho;
    estadoConsultaContato.pagina = 1;
    atualizarTabelaDenuncias();
    atualizarTabelaContato();
}

MEDIA_QUERY_MOBILE_SUPORTE.addEventListener("change", sincronizarTamanhoPaginaSuporte);

// Alguns ambientes nao disparam o evento "change" do matchMedia ao redimensionar;
// o listener de resize (com debounce) garante que a pagina se ajuste de qualquer forma.
let temporizadorResizeSuporte = null;
window.addEventListener("resize", () => {
    window.clearTimeout(temporizadorResizeSuporte);
    temporizadorResizeSuporte = window.setTimeout(sincronizarTamanhoPaginaSuporte, 200);
});

// ---- Textos para os modais de visualizacao ----

function textoDenuncia(denuncia) {
    const linhas = [
        `Denuncia: ${denuncia.codigo}`,
        `Usuario: ${denuncia.usuario.nome} (${denuncia.usuario.idAcesso})`,
        `Tipo: ${ROTULOS_TIPO_DENUNCIA[denuncia.tipo]}`,
        `Materia: ${denuncia.materia}`,
        `Prioridade: ${ROTULOS_PRIORIDADE_DENUNCIA[denuncia.prioridade]}`,
        `Status: ${ROTULOS_STATUS_DENUNCIA[denuncia.status]}`,
        denuncia.resolucao ? `Desfecho: ${ROTULOS_RESOLUCAO_DENUNCIA[denuncia.resolucao]}` : null,
        `Data: ${formatarDataSuporte(denuncia.criadoEm)}`,
        "",
        `Conteudo denunciado: ${denuncia.conteudoDenunciado}`,
        "",
        `Motivo da denuncia: ${denuncia.motivo}`,
    ];

    return linhas.filter((linha) => linha !== null).join("\n");
}

function textoContato(contato) {
    return [
        `Nome: ${contato.nome}`,
        `Email: ${contato.email}`,
        `Assunto: ${contato.assunto}`,
        `Status: ${ROTULOS_STATUS_CONTATO[contato.status]}`,
        `Data: ${formatarDataSuporte(contato.criadoEm)}`,
        "",
        `Mensagem: ${contato.mensagem}`,
    ].join("\n");
}

// ---- Acoes administrativas (menu de tres pontos) ----

function tratarAcaoAdmin(botao) {
    const linha = botao.closest("tr");

    if (linha && linha.dataset.denunciaId) {
        tratarAcaoDenuncia(botao, linha);
        return;
    }

    if (linha && linha.dataset.contatoId) {
        tratarAcaoContato(botao, linha);
        return;
    }

    mostrarAvisoAdmin("Acao administrativa preparada.");
}

function tratarAcaoDenuncia(botao, linha) {
    const denuncia = encontrarDenunciaPorId(Number(linha.dataset.denunciaId));

    if (!denuncia) {
        return;
    }

    switch (botao.dataset.adminAction) {
        case "visualizar-denuncia":
            abrirModalVisualizacao("Detalhes da denuncia", textoDenuncia(denuncia));
            break;
        case "responder-denuncia":
            abrirModalRespostaDenuncia(denuncia);
            break;
        case "resolver-denuncia":
            confirmarDesfechoDenuncia(denuncia, "resolvido", "Marcar como resolvida", "Tem certeza que deseja marcar esta denuncia como resolvida?", "Denuncia resolvida visualmente.");
            break;
        case "ignorar-denuncia":
            confirmarDesfechoDenuncia(denuncia, "ignorado", "Ignorar denuncia", "Tem certeza que deseja ignorar esta denuncia? O conteudo permanece publicado.", "Denuncia ignorada visualmente.");
            break;
        case "remover-conteudo-denuncia":
            confirmarDesfechoDenuncia(denuncia, "conteudo_removido", "Remover conteudo denunciado", "Tem certeza que deseja remover o conteudo denunciado?", "Conteudo denunciado removido visualmente.");
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

function abrirModalRespostaDenuncia(denuncia) {
    abrirModal(
        "Responder denuncia",
        "resposta-denuncia",
        campoLeitura("Denuncia recebida", textoDenuncia(denuncia)) +
        campoTextarea("resposta", "Resposta do administrador"),
        denuncia
    );
}

function confirmarDesfechoDenuncia(denuncia, resolucao, titulo, texto, mensagem) {
    abrirConfirmacao(titulo, texto, () => {
        // Futuramente PUT /api/admin/denuncias/:id/status com status = "resolvido" e a resolucao escolhida.
        denuncia.status = "resolvido";
        denuncia.resolucao = resolucao;
        denuncia.resolvidoEm = new Date().toISOString();
        atualizarTabelaDenuncias();
        renderizarResumoSuporte();
        mostrarAvisoAdmin(mensagem);
    });
}

adminModalHandlers["resposta-denuncia"] = function registrarRespostaDenuncia() {
    const denuncia = modalOrigem;

    // Futuramente salvar a resposta em respostas_denuncia; responder move a denuncia para analise.
    if (denuncia.status === "aberto") {
        denuncia.status = "em_analise";
    }

    atualizarTabelaDenuncias();
    renderizarResumoSuporte();
    mostrarAvisoAdmin("Denuncia respondida visualmente.");
};

function tratarAcaoContato(botao, linha) {
    const contato = encontrarContatoPorId(Number(linha.dataset.contatoId));

    if (!contato) {
        return;
    }

    switch (botao.dataset.adminAction) {
        case "visualizar-contato":
            abrirModalVisualizacao("Mensagem de contato", textoContato(contato));
            break;
        case "responder-contato":
            abrirModalRespostaContato(contato);
            break;
        case "resolver-contato":
            confirmarResolucaoContato(contato);
            break;
        case "excluir-contato":
            confirmarExclusaoContato(contato);
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

function abrirModalRespostaContato(contato) {
    abrirModal(
        "Responder contato",
        "resposta-contato",
        campoLeitura("Mensagem recebida", textoContato(contato)) +
        campoTextarea("resposta", "Resposta do administrador"),
        contato
    );
}

function confirmarResolucaoContato(contato) {
    abrirConfirmacao("Marcar como resolvido", "Tem certeza que deseja marcar esta mensagem como resolvida?", () => {
        // Futuramente PUT /api/admin/contatos/:id/status com status = "resolvido".
        contato.status = "resolvido";
        contato.resolvidoEm = new Date().toISOString();
        atualizarTabelaContato();
        renderizarResumoSuporte();
        mostrarAvisoAdmin("Contato marcado como resolvido.");
    });
}

function confirmarExclusaoContato(contato) {
    abrirConfirmacao("Excluir mensagem", "Tem certeza que deseja excluir esta mensagem de contato?", () => {
        // Futuramente DELETE /api/admin/contatos/:id (soft delete + auditoria).
        removerContatoPorId(contato.id);
        atualizarTabelaContato();
        renderizarResumoSuporte();
        mostrarAvisoAdmin("Mensagem removida visualmente.");
    });
}

adminModalHandlers["resposta-contato"] = function registrarRespostaContato() {
    const contato = modalOrigem;

    // Futuramente salvar resposta em respostas_contato e atualizar status para "respondido" no banco.
    if (contato.status === "aberto") {
        contato.status = "respondido";
    }

    atualizarTabelaContato();
    renderizarResumoSuporte();
    mostrarAvisoAdmin("Contato respondido visualmente.");
};

// ---- Inicializacao ----

renderizarResumoSuporte();
atualizarTabelaDenuncias();
atualizarTabelaContato();
