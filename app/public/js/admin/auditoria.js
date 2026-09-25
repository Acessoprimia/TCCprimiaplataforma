// Interacoes da pagina /admin/auditoria. Mesmo esquema de usuarios.js:
// os logs vem embutidos pelo servidor no script #dados-auditoria e busca,
// filtros e paginacao rodam no navegador. Nao carrega common.js porque a
// pagina nao tem modais (common.js depende deles).
const LOGS_AUDITORIA = JSON.parse(document.getElementById("dados-auditoria").textContent);

const TAMANHO_PAGINA_DESKTOP_AUDITORIA = 20;
const TAMANHO_PAGINA_MOBILE_AUDITORIA = 10;
// Mesmo breakpoint usado em admin.css para empilhar a tabela em telas pequenas.
const MEDIA_QUERY_MOBILE_AUDITORIA = window.matchMedia("(max-width: 559px)");

function tamanhoPaginaAuditoria() {
    return MEDIA_QUERY_MOBILE_AUDITORIA.matches ? TAMANHO_PAGINA_MOBILE_AUDITORIA : TAMANHO_PAGINA_DESKTOP_AUDITORIA;
}

const ROTULOS_TIPO_AUDITORIA = { aluno: "Aluno", professor: "Professor", admin: "Admin" };

const estadoConsultaAuditoria = {
    busca: "",
    tipo: "todos",
    acao: "todos",
    entidade: "todos",
    pagina: 1,
    tamanhoPagina: tamanhoPaginaAuditoria(),
};

const corpoTabelaAuditoria = document.getElementById("auditoriaTabela");
const paginacaoInfoAuditoria = document.getElementById("auditoriaPaginacaoInfo");
const paginacaoControlesAuditoria = document.getElementById("auditoriaPaginacaoControles");
const campoBuscaAuditoria = document.getElementById("auditoriaBusca");

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[caractere]));
}

// ---- Camada de dados ----

function consultarAuditoria({ busca, tipo, acao, entidade, pagina, tamanhoPagina }) {
    const buscaNormalizada = busca.trim().toLowerCase();

    const filtrados = LOGS_AUDITORIA.filter((log) => {
        const combinaBusca = !buscaNormalizada
            || String(log.nome || "").toLowerCase().includes(buscaNormalizada)
            || String(log.email || "").toLowerCase().includes(buscaNormalizada)
            || String(log.descricao || "").toLowerCase().includes(buscaNormalizada);

        return combinaBusca
            && (tipo === "todos" || log.tipoUsuario === tipo)
            && (acao === "todos" || log.acao === acao)
            && (entidade === "todos" || log.entidade === entidade);
    });

    const totalRegistros = filtrados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamanhoPagina));
    const paginaValida = Math.min(Math.max(1, pagina), totalPaginas);
    const inicio = (paginaValida - 1) * tamanhoPagina;
    const itens = filtrados.slice(inicio, inicio + tamanhoPagina);

    return { itens, totalRegistros, pagina: paginaValida, tamanhoPagina, totalPaginas };
}

// ---- Renderizacao da tabela ----

function linhaAuditoriaHtml(log) {
    const emailHtml = log.email ? escapeHtml(log.email) : "conta excluída";
    const tipoHtml = ROTULOS_TIPO_AUDITORIA[log.tipoUsuario]
        ? `<span class="badge ${log.tipoUsuario}">${ROTULOS_TIPO_AUDITORIA[log.tipoUsuario]}</span>`
        : escapeHtml(log.tipoUsuario);
    const entidadeHtml = escapeHtml(log.entidade) + (log.idEntidade ? ` #${escapeHtml(log.idEntidade)}` : "");

    return `
        <tr>
            <td data-label="Quando">${escapeHtml(log.quando)}</td>
            <td data-label="Quem">${escapeHtml(log.nome)}<br><small>${emailHtml}</small></td>
            <td data-label="Tipo">${tipoHtml}</td>
            <td data-label="Ação"><span class="auditoria-acao auditoria-acao-${escapeHtml(log.acao)}">${escapeHtml(log.acao)}</span></td>
            <td data-label="Entidade">${entidadeHtml}</td>
            <td data-label="Descrição">${escapeHtml(log.descricao)}</td>
        </tr>
    `;
}

function renderizarTabelaAuditoria(itens) {
    corpoTabelaAuditoria.innerHTML = itens.length
        ? itens.map(linhaAuditoriaHtml).join("")
        : `<tr class="tabela-vazia"><td colspan="6">Nenhuma atividade encontrada para os filtros selecionados.</td></tr>`;
}

// ---- Paginacao ----

function renderizarPaginacaoAuditoria({ totalRegistros, pagina, tamanhoPagina, totalPaginas }) {
    const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
    const fim = Math.min(pagina * tamanhoPagina, totalRegistros);

    paginacaoInfoAuditoria.textContent = `Mostrando ${inicio}-${fim} de ${totalRegistros.toLocaleString("pt-BR")} atividades.`;

    paginacaoControlesAuditoria.innerHTML = `
        <button type="button" data-pagina-acao="anterior" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
        <span class="paginacao-atual">Página ${pagina} de ${totalPaginas}</span>
        <button type="button" data-pagina-acao="proxima" ${pagina >= totalPaginas ? "disabled" : ""}>Próxima</button>
    `;
}

function atualizarTabelaAuditoria() {
    const resultado = consultarAuditoria(estadoConsultaAuditoria);
    estadoConsultaAuditoria.pagina = resultado.pagina;
    renderizarTabelaAuditoria(resultado.itens);
    renderizarPaginacaoAuditoria(resultado);
}

// ---- Eventos: busca, filtros e paginacao ----

let temporizadorBuscaAuditoria = null;

campoBuscaAuditoria.addEventListener("input", () => {
    window.clearTimeout(temporizadorBuscaAuditoria);
    temporizadorBuscaAuditoria = window.setTimeout(() => {
        estadoConsultaAuditoria.busca = campoBuscaAuditoria.value;
        estadoConsultaAuditoria.pagina = 1;
        atualizarTabelaAuditoria();
    }, 250);
});

// Cada grupo de pilulas (data-filtro-tipo / -acao / -entidade) controla a
// chave de mesmo nome em estadoConsultaAuditoria.
["tipo", "acao", "entidade"].forEach((chave) => {
    const seletor = `[data-filtro-${chave}]`;

    document.querySelectorAll(seletor).forEach((botao) => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(seletor).forEach((outro) => outro.classList.remove("ativo"));
            botao.classList.add("ativo");
            estadoConsultaAuditoria[chave] = botao.getAttribute(`data-filtro-${chave}`);
            estadoConsultaAuditoria.pagina = 1;
            atualizarTabelaAuditoria();
        });
    });
});

paginacaoControlesAuditoria.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-pagina-acao]");

    if (!botao || botao.disabled) {
        return;
    }

    estadoConsultaAuditoria.pagina += botao.dataset.paginaAcao === "anterior" ? -1 : 1;
    atualizarTabelaAuditoria();
});

// No mobile a tabela empilha em cards, entao cada pagina fica menor.
function sincronizarTamanhoPaginaAuditoria() {
    const novoTamanho = tamanhoPaginaAuditoria();

    if (novoTamanho === estadoConsultaAuditoria.tamanhoPagina) {
        return;
    }

    estadoConsultaAuditoria.tamanhoPagina = novoTamanho;
    estadoConsultaAuditoria.pagina = 1;
    atualizarTabelaAuditoria();
}

MEDIA_QUERY_MOBILE_AUDITORIA.addEventListener("change", sincronizarTamanhoPaginaAuditoria);

let temporizadorResizeAuditoria = null;
window.addEventListener("resize", () => {
    window.clearTimeout(temporizadorResizeAuditoria);
    temporizadorResizeAuditoria = window.setTimeout(sincronizarTamanhoPaginaAuditoria, 200);
});

atualizarTabelaAuditoria();
