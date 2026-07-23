// Interacoes da pagina /admin/conteudos (materias, livros, videoaulas, simulados, cronogramas e planos).
// MATERIAS_MOCK e CONTEUDOS_MOCK vem de conteudosMock.js (carregado antes deste arquivo).
// Depende das funcoes compartilhadas definidas em common.js.

const TAMANHO_PAGINA_CONTEUDOS = 10;

const STATUS_CLASSE_CONTEUDO = { publicado: "ativo", rascunho: "inativo", agendado: "pendente", arquivado: "arquivado" };
const STATUS_LABEL_CONTEUDO = { publicado: "Publicado", rascunho: "Rascunho", agendado: "Agendado", arquivado: "Arquivado" };
const ACESSO_CLASSE_CONTEUDO = { gratuito: "ativo", premium: "premium" };
const ACESSO_LABEL_CONTEUDO = { gratuito: "Gratuito", premium: "Premium" };

const MAPA_TIPO_LABEL_PARA_SLUG = {
    Livro: "livro", Videoaula: "videoaula", Simulado: "simulado", Cronograma: "cronograma", "Plano de estudo": "plano-de-estudo",
};
const MAPA_STATUS_LABEL_PARA_SLUG = { Publicado: "publicado", Rascunho: "rascunho", Agendado: "agendado" };

const estadoConsultaConteudos = {
    busca: "",
    tipo: "todos",
    materia: "todas",
    status: "todos",
    acesso: "todos",
    pagina: 1,
    tamanhoPagina: TAMANHO_PAGINA_CONTEUDOS,
};

const corpoTabelaConteudos = document.getElementById("conteudosTabela");
const paginacaoInfoConteudos = document.getElementById("conteudosPaginacaoInfo");
const paginacaoControlesConteudos = document.getElementById("conteudosPaginacaoControles");
const campoBuscaConteudos = document.getElementById("conteudosBusca");
const filtroMateriaConteudos = document.getElementById("conteudosFiltroMateria");
const resumoConteudos = document.getElementById("conteudosResumo");
const listaMaterias = document.getElementById("materiasLista");
const contagemMaterias = document.getElementById("materiasContagem");

// ---- Camada de dados ----
// Assinatura pronta para virar uma chamada de API: quando o backend estiver
// disponivel, o corpo desta funcao vira um fetch("/api/admin/conteudos?...")
// mantendo os mesmos parametros de entrada e o mesmo formato de retorno.
async function consultarConteudos({ busca, tipo, materia, status, acesso, pagina, tamanhoPagina }) {
    const buscaNormalizada = busca.trim().toLowerCase();

    const filtrados = CONTEUDOS_MOCK.filter((conteudo) => {
        const combinaBusca = !buscaNormalizada
            || conteudo.titulo.toLowerCase().includes(buscaNormalizada)
            || conteudo.autor.toLowerCase().includes(buscaNormalizada);

        const combinaTipo = tipo === "todos" || conteudo.tipo === tipo;
        const combinaMateria = materia === "todas" || conteudo.materia === materia;
        const combinaStatus = status === "todos" || conteudo.status === status;
        const combinaAcesso = acesso === "todos" || conteudo.acesso === acesso;

        return combinaBusca && combinaTipo && combinaMateria && combinaStatus && combinaAcesso;
    });

    const totalRegistros = filtrados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamanhoPagina));
    const paginaValida = Math.min(Math.max(1, pagina), totalPaginas);
    const inicio = (paginaValida - 1) * tamanhoPagina;
    const itens = filtrados.slice(inicio, inicio + tamanhoPagina);

    return { itens, totalRegistros, pagina: paginaValida, tamanhoPagina, totalPaginas };
}

function encontrarConteudoPorId(id) {
    return CONTEUDOS_MOCK.find((conteudo) => conteudo.id === id);
}

function proximoIdConteudo() {
    return CONTEUDOS_MOCK.reduce((maior, conteudo) => Math.max(maior, conteudo.id), 0) + 1;
}

// ---- Formatacao ----

function formatarDataConteudo(isoString) {
    return new Date(isoString).toLocaleDateString("pt-BR");
}

function formatarDataInputConteudo(isoString) {
    return new Date(isoString).toISOString().slice(0, 10);
}

function textoConteudo(conteudo) {
    return [
        `Titulo: ${conteudo.titulo}`,
        `Tipo: ${ROTULOS_TIPO_CONTEUDO[conteudo.tipo]}`,
        `Materia: ${conteudo.materia}`,
        `Status: ${STATUS_LABEL_CONTEUDO[conteudo.status]}`,
        `Acesso: ${ACESSO_LABEL_CONTEUDO[conteudo.acesso]}`,
        `Autor: ${conteudo.autor}`,
        `Data: ${formatarDataConteudo(conteudo.data)}`,
        conteudo.destaque ? "Em destaque" : null,
    ].filter(Boolean).join("\n");
}

// ---- Cards de resumo (calculados a partir de CONTEUDOS_MOCK) ----

const ICONES_RESUMO_CONTEUDO = {
    total: '<path d="M12 2 2 7l10 5 10-5-10-5Z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
    videoaula: '<circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon>',
    livro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
    simulado: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
    premium: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
};

function calcularResumoConteudos() {
    return {
        total: CONTEUDOS_MOCK.length,
        videoaula: CONTEUDOS_MOCK.filter((c) => c.tipo === "videoaula").length,
        livro: CONTEUDOS_MOCK.filter((c) => c.tipo === "livro").length,
        simulado: CONTEUDOS_MOCK.filter((c) => c.tipo === "simulado").length,
        premium: CONTEUDOS_MOCK.filter((c) => c.acesso === "premium").length,
    };
}

function cartaoResumoHtml(icone, rotulo, valor, descricao) {
    return `
        <article class="metric-card">
            <header class="metric-card-head">
                <i class="metric-card-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES_RESUMO_CONTEUDO[icone]}</svg>
                </i>
                <span>${rotulo}</span>
            </header>
            <strong>${valor}</strong>
            <p>${descricao}</p>
        </article>
    `;
}

function renderizarResumoConteudos() {
    const resumo = calcularResumoConteudos();

    resumoConteudos.innerHTML = [
        cartaoResumoHtml("total", "Total de conteudos", resumo.total, "Todos os itens cadastrados"),
        cartaoResumoHtml("videoaula", "Videoaulas", resumo.videoaula, "Aulas em video publicadas"),
        cartaoResumoHtml("livro", "Livros", resumo.livro, "Materiais de leitura"),
        cartaoResumoHtml("simulado", "Simulados", resumo.simulado, "Provas e exercicios"),
        cartaoResumoHtml("premium", "Conteudos premium", resumo.premium, "Acesso exclusivo assinantes"),
    ].join("");
}

// ---- Materias (mantidas, com contagem de conteudos por materia) ----

function contarConteudosPorMateria(materia) {
    return CONTEUDOS_MOCK.filter((conteudo) => conteudo.materia === materia).length;
}

function materiaChipHtml(materia) {
    return `
        <article class="materia-chip" data-materia-nome="${escapeHtml(materia)}">
            <span>${escapeHtml(materia)}</span>
            <span class="materia-chip-contagem">${contarConteudosPorMateria(materia)}</span>
            <button type="button" data-admin-action="remover-materia">Remover</button>
        </article>
    `;
}

function renderizarOpcoesFiltroMateria() {
    const valorAtual = filtroMateriaConteudos.value || "todas";
    const materiasOrdenadas = [...MATERIAS_MOCK].sort((a, b) => a.localeCompare(b, "pt-BR"));

    filtroMateriaConteudos.innerHTML = ["<option value=\"todas\">Todas as materias</option>"]
        .concat(materiasOrdenadas.map((materia) => `<option value="${escapeHtml(materia)}">${escapeHtml(materia)}</option>`))
        .join("");

    const aindaExiste = valorAtual === "todas" || MATERIAS_MOCK.includes(valorAtual);
    filtroMateriaConteudos.value = aindaExiste ? valorAtual : "todas";

    if (!aindaExiste) {
        estadoConsultaConteudos.materia = "todas";
    }
}

function renderizarMaterias() {
    const materiasOrdenadas = [...MATERIAS_MOCK].sort((a, b) => a.localeCompare(b, "pt-BR"));
    listaMaterias.innerHTML = materiasOrdenadas.map(materiaChipHtml).join("");
    contagemMaterias.textContent = `${MATERIAS_MOCK.length} materias cadastradas`;
    renderizarOpcoesFiltroMateria();
}

function confirmarRemocaoMateria(nome) {
    if (!nome) {
        return;
    }

    abrirConfirmacao(
        "Remover materia",
        "Tem certeza que deseja remover esta materia? Futuramente o banco deve bloquear se houver conteudos vinculados.",
        () => {
            // Futuramente DELETE /api/admin/materias/:id (bloqueado se houver conteudos vinculados).
            const indice = MATERIAS_MOCK.indexOf(nome);

            if (indice !== -1) {
                MATERIAS_MOCK.splice(indice, 1);
            }

            renderizarMaterias();
            mostrarAvisoAdmin("Materia removida visualmente.");
        }
    );
}

adminModalHandlers.materia = function salvarMateria(dados) {
    const nome = dados.nome.trim();

    // Futuramente POST /api/admin/materias.
    if (nome && !MATERIAS_MOCK.includes(nome)) {
        MATERIAS_MOCK.push(nome);
    }

    renderizarMaterias();
    mostrarAvisoAdmin("Materia adicionada temporariamente.");
};

// ---- Renderizacao da tabela de conteudos a partir do array retornado ----

function linhaConteudoHtml(conteudo) {
    const acaoDestaque = conteudo.destaque
        ? `<button type="button" data-admin-action="remover-destaque">Remover destaque</button>`
        : `<button type="button" data-admin-action="destacar-conteudo">Destacar</button>`;

    const acaoPremium = conteudo.acesso === "premium"
        ? `<button type="button" data-admin-action="tornar-gratuito">Tornar gratuito</button>`
        : `<button type="button" data-admin-action="tornar-premium">Tornar premium</button>`;

    const acaoArquivar = conteudo.arquivado
        ? `<button type="button" data-admin-action="desarquivar-conteudo">Desarquivar</button>`
        : `<button type="button" data-admin-action="arquivar-conteudo">Arquivar</button>`;

    const tituloHtml = conteudo.destaque
        ? `<span class="conteudo-destaque-icone" title="Conteudo em destaque">★</span>${escapeHtml(conteudo.titulo)}`
        : escapeHtml(conteudo.titulo);

    return `
        <tr data-conteudo-id="${conteudo.id}" data-tipo="${conteudo.tipo}" data-status="${conteudo.status}" data-acesso="${conteudo.acesso}">
            <td data-label="Titulo">${tituloHtml}</td>
            <td data-label="Tipo"><span class="badge ${conteudo.tipo}">${ROTULOS_TIPO_CONTEUDO[conteudo.tipo]}</span></td>
            <td data-label="Materia">${escapeHtml(conteudo.materia)}</td>
            <td data-label="Status"><span class="status ${STATUS_CLASSE_CONTEUDO[conteudo.status]}">${STATUS_LABEL_CONTEUDO[conteudo.status]}</span></td>
            <td data-label="Acesso"><span class="status ${ACESSO_CLASSE_CONTEUDO[conteudo.acesso]}">${ACESSO_LABEL_CONTEUDO[conteudo.acesso]}</span></td>
            <td data-label="Autor">${escapeHtml(conteudo.autor)}</td>
            <td data-label="Data">${formatarDataConteudo(conteudo.data)}</td>
            <td data-label="Acoes" class="table-actions-cell">
                <div class="table-menu-wrap">
                    <button type="button" class="table-menu-trigger" data-menu-toggle aria-haspopup="true" aria-expanded="false" aria-label="Acoes de ${escapeHtml(conteudo.titulo)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                    <div class="table-menu" role="menu">
                        <button type="button" data-admin-action="visualizar-conteudo">Visualizar</button>
                        <button type="button" data-admin-action="editar-conteudo">Editar</button>
                        ${acaoDestaque}
                        ${acaoPremium}
                        <button type="button" data-admin-action="duplicar-conteudo">Duplicar</button>
                        ${acaoArquivar}
                        <button type="button" class="danger" data-admin-action="excluir-conteudo">Excluir</button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function linhaVaziaConteudosHtml() {
    return `<tr class="tabela-vazia"><td colspan="8">Nenhum conteudo encontrado para os filtros selecionados.</td></tr>`;
}

function renderizarTabelaConteudos(itens) {
    corpoTabelaConteudos.innerHTML = itens.length ? itens.map(linhaConteudoHtml).join("") : linhaVaziaConteudosHtml();
}

// ---- Paginacao ----

function renderizarPaginacaoConteudos({ totalRegistros, pagina, tamanhoPagina, totalPaginas }) {
    const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
    const fim = Math.min(pagina * tamanhoPagina, totalRegistros);

    paginacaoInfoConteudos.textContent = `Mostrando ${inicio}-${fim} de ${totalRegistros.toLocaleString("pt-BR")} conteudos.`;

    paginacaoControlesConteudos.innerHTML = `
        <button type="button" data-pagina-acao="anterior" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
        <span class="paginacao-atual">Pagina ${pagina} de ${totalPaginas}</span>
        <button type="button" data-pagina-acao="proxima" ${pagina >= totalPaginas ? "disabled" : ""}>Proxima</button>
    `;
}

// ---- Orquestracao: busca -> filtra -> pagina -> renderiza ----

async function atualizarConteudos() {
    const resultado = await consultarConteudos(estadoConsultaConteudos);
    estadoConsultaConteudos.pagina = resultado.pagina;
    renderizarTabelaConteudos(resultado.itens);
    renderizarPaginacaoConteudos(resultado);
    renderizarResumoConteudos();
}

// ---- Modal de conteudo (adicionar/editar) ----

function abrirModalConteudo(tituloModal, modo, conteudo = null) {
    abrirModal(
        tituloModal,
        modo,
        campoSelect("tipo", "Categoria", Object.values(ROTULOS_TIPO_CONTEUDO), conteudo ? ROTULOS_TIPO_CONTEUDO[conteudo.tipo] : "Livro") +
        campoSelect("materia", "Materia", MATERIAS_MOCK, conteudo ? conteudo.materia : MATERIAS_MOCK[0]) +
        campoTexto("titulo", "Titulo", conteudo ? conteudo.titulo : "") +
        campoTexto("autor", "Autor", conteudo ? conteudo.autor : "Equipe Primia") +
        campoTexto("data", "Data", conteudo ? formatarDataInputConteudo(conteudo.data) : formatarDataInputConteudo(new Date().toISOString()), "date") +
        campoSelect("status", "Status", ["Publicado", "Rascunho", "Agendado"], conteudo ? (STATUS_LABEL_CONTEUDO[conteudo.status] || "Publicado") : "Publicado") +
        campoSelect("acesso", "Acesso", ["Gratuito", "Premium"], conteudo ? ACESSO_LABEL_CONTEUDO[conteudo.acesso] : "Gratuito"),
        conteudo
    );
}

adminModalHandlers.conteudo = function salvarConteudo(dados) {
    const tipoSlug = MAPA_TIPO_LABEL_PARA_SLUG[dados.tipo] || "livro";
    const statusSlug = MAPA_STATUS_LABEL_PARA_SLUG[dados.status] || "publicado";
    const acessoSlug = dados.acesso.toLowerCase();
    const dataIso = new Date(dados.data).toISOString();

    if (modalOrigem) {
        // Futuramente PUT /api/admin/conteudos/:id.
        modalOrigem.titulo = dados.titulo;
        modalOrigem.tipo = tipoSlug;
        modalOrigem.materia = dados.materia;
        modalOrigem.status = statusSlug;
        modalOrigem.acesso = acessoSlug;
        modalOrigem.autor = dados.autor;
        modalOrigem.data = dataIso;
        mostrarAvisoAdmin("Conteudo atualizado visualmente.");
    } else {
        // Futuramente POST /api/admin/conteudos. Arquivos (livros/videoaulas) vao
        // para storage; o banco guarda apenas metadados e a URL do arquivo.
        CONTEUDOS_MOCK.unshift({
            id: proximoIdConteudo(),
            titulo: dados.titulo,
            tipo: tipoSlug,
            materia: dados.materia,
            status: statusSlug,
            acesso: acessoSlug,
            autor: dados.autor,
            data: dataIso,
            destaque: false,
            arquivado: false,
            statusAnterior: null,
        });
        mostrarAvisoAdmin("Conteudo adicionado temporariamente.");
    }

    estadoConsultaConteudos.pagina = 1;
    atualizarConteudos();
};

// ---- Acoes administrativas (menu de tres pontos) ----

function alternarDestaqueConteudo(conteudo, valor) {
    // Futuramente PUT /api/admin/conteudos/:id/destaque.
    conteudo.destaque = valor;
    atualizarConteudos();
    mostrarAvisoAdmin(valor ? "Conteudo destacado." : "Destaque removido.");
}

function alternarAcessoConteudo(conteudo, valor) {
    // Futuramente atualizar campo is_premium no banco.
    conteudo.acesso = valor;
    atualizarConteudos();
    mostrarAvisoAdmin(valor === "premium" ? "Conteudo marcado como premium." : "Conteudo marcado como gratuito.");
}

function duplicarConteudo(conteudo) {
    // Futuramente POST /api/admin/conteudos/:id/duplicar.
    CONTEUDOS_MOCK.unshift({
        ...conteudo,
        id: proximoIdConteudo(),
        titulo: `${conteudo.titulo} (copia)`,
        status: "rascunho",
        destaque: false,
        arquivado: false,
        statusAnterior: null,
    });
    estadoConsultaConteudos.pagina = 1;
    atualizarConteudos();
    mostrarAvisoAdmin("Conteudo duplicado visualmente.");
}

function confirmarArquivarConteudo(conteudo, arquivar) {
    const titulo = arquivar ? "Arquivar conteudo" : "Desarquivar conteudo";
    const texto = arquivar
        ? "Tem certeza que deseja arquivar este conteudo? Ele deixara de aparecer para os usuarios."
        : "Tem certeza que deseja restaurar este conteudo do arquivo?";

    abrirConfirmacao(titulo, texto, () => {
        // Futuramente PUT /api/admin/conteudos/:id/arquivar.
        if (arquivar) {
            conteudo.statusAnterior = conteudo.status;
            conteudo.status = "arquivado";
        } else {
            conteudo.status = conteudo.statusAnterior || "publicado";
            conteudo.statusAnterior = null;
        }

        conteudo.arquivado = arquivar;
        atualizarConteudos();
        mostrarAvisoAdmin(arquivar ? "Conteudo arquivado visualmente." : "Conteudo restaurado visualmente.");
    });
}

function confirmarExclusaoConteudo(conteudo) {
    abrirConfirmacao("Excluir conteudo", "Tem certeza que deseja excluir este conteudo?", () => {
        // Futuramente DELETE /api/admin/conteudos/:id.
        const indice = CONTEUDOS_MOCK.findIndex((item) => item.id === conteudo.id);

        if (indice !== -1) {
            CONTEUDOS_MOCK.splice(indice, 1);
        }

        atualizarConteudos();
        mostrarAvisoAdmin("Conteudo removido visualmente.");
    });
}

function tratarAcaoAdmin(botao) {
    const acao = botao.dataset.adminAction;

    if (acao === "adicionar-conteudo") {
        abrirModalConteudo("Adicionar conteudo", "conteudo");
        return;
    }

    if (acao === "adicionar-materia") {
        abrirModal("Adicionar materia", "materia", campoTexto("nome", "Nome da materia"));
        return;
    }

    if (acao === "remover-materia") {
        confirmarRemocaoMateria(botao.closest(".materia-chip")?.dataset.materiaNome);
        return;
    }

    const linha = botao.closest("tr[data-conteudo-id]");
    const conteudo = linha && encontrarConteudoPorId(Number(linha.dataset.conteudoId));

    if (!conteudo) {
        return;
    }

    switch (acao) {
        case "visualizar-conteudo":
            abrirModalVisualizacao("Detalhes do conteudo", textoConteudo(conteudo));
            break;
        case "editar-conteudo":
            abrirModalConteudo("Editar conteudo", "conteudo", conteudo);
            break;
        case "destacar-conteudo":
            alternarDestaqueConteudo(conteudo, true);
            break;
        case "remover-destaque":
            alternarDestaqueConteudo(conteudo, false);
            break;
        case "tornar-premium":
            alternarAcessoConteudo(conteudo, "premium");
            break;
        case "tornar-gratuito":
            alternarAcessoConteudo(conteudo, "gratuito");
            break;
        case "duplicar-conteudo":
            duplicarConteudo(conteudo);
            break;
        case "arquivar-conteudo":
            confirmarArquivarConteudo(conteudo, true);
            break;
        case "desarquivar-conteudo":
            confirmarArquivarConteudo(conteudo, false);
            break;
        case "excluir-conteudo":
            confirmarExclusaoConteudo(conteudo);
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

// ---- Eventos: busca, filtros e paginacao ----

let temporizadorBuscaConteudos = null;

campoBuscaConteudos.addEventListener("input", () => {
    window.clearTimeout(temporizadorBuscaConteudos);
    temporizadorBuscaConteudos = window.setTimeout(() => {
        estadoConsultaConteudos.busca = campoBuscaConteudos.value;
        estadoConsultaConteudos.pagina = 1;
        atualizarConteudos();
    }, 250);
});

document.querySelectorAll("[data-filtro-conteudos]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-conteudos]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        estadoConsultaConteudos.tipo = botao.dataset.filtroConteudos;
        estadoConsultaConteudos.pagina = 1;
        atualizarConteudos();
    });
});

document.querySelectorAll("[data-filtro-status-conteudo]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-status-conteudo]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        estadoConsultaConteudos.status = botao.dataset.filtroStatusConteudo;
        estadoConsultaConteudos.pagina = 1;
        atualizarConteudos();
    });
});

document.querySelectorAll("[data-filtro-acesso-conteudo]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-acesso-conteudo]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        estadoConsultaConteudos.acesso = botao.dataset.filtroAcessoConteudo;
        estadoConsultaConteudos.pagina = 1;
        atualizarConteudos();
    });
});

filtroMateriaConteudos.addEventListener("change", () => {
    estadoConsultaConteudos.materia = filtroMateriaConteudos.value;
    estadoConsultaConteudos.pagina = 1;
    atualizarConteudos();
});

paginacaoControlesConteudos.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-pagina-acao]");

    if (!botao || botao.disabled) {
        return;
    }

    estadoConsultaConteudos.pagina += botao.dataset.paginaAcao === "anterior" ? -1 : 1;
    atualizarConteudos();
});

// ---- Inicializacao ----

renderizarMaterias();
atualizarConteudos();
