// Interacoes da pagina /admin/usuarios (alunos, professores, admins e premium).
// USUARIOS_MOCK vem de usuariosMock.js (carregado antes deste arquivo).
// Depende das funcoes compartilhadas definidas em common.js.

const TAMANHO_PAGINA_DESKTOP = 20;
const TAMANHO_PAGINA_MOBILE = 10;
// Mesmo breakpoint usado em admin.css para empilhar a tabela em telas pequenas.
const MEDIA_QUERY_MOBILE_USUARIOS = window.matchMedia("(max-width: 559px)");

function tamanhoPaginaAtual() {
    return MEDIA_QUERY_MOBILE_USUARIOS.matches ? TAMANHO_PAGINA_MOBILE : TAMANHO_PAGINA_DESKTOP;
}

const ROTULOS_TIPO_USUARIO = { aluno: "Aluno", professor: "Professor", admin: "Admin" };
const ROTULOS_STATUS_USUARIO = { ativo: "Ativo", bloqueado: "Bloqueado", inativo: "Inativo" };
const MAPA_TIPO_SELECT = { Aluno: "aluno", Professor: "professor", Admin: "admin" };

const estadoConsultaUsuarios = {
    busca: "",
    tipo: "todos",
    status: "todos",
    pagina: 1,
    tamanhoPagina: tamanhoPaginaAtual(),
};

const corpoTabelaUsuarios = document.getElementById("usuariosTabela");
const paginacaoInfoUsuarios = document.getElementById("usuariosPaginacaoInfo");
const paginacaoControlesUsuarios = document.getElementById("usuariosPaginacaoControles");
const campoBuscaUsuarios = document.getElementById("usuariosBusca");

// ---- Camada de dados ----
// Assinatura pronta para virar uma chamada de API: quando o backend estiver
// disponivel, o corpo desta funcao vira um fetch("/api/admin/usuarios?...")
// mantendo os mesmos parametros de entrada e o mesmo formato de retorno.
async function consultarUsuarios({ busca, tipo, status, pagina, tamanhoPagina }) {
    const buscaNormalizada = busca.trim().toLowerCase();

    const filtrados = USUARIOS_MOCK.filter((usuario) => {
        const combinaBusca = !buscaNormalizada
            || usuario.nome.toLowerCase().includes(buscaNormalizada)
            || usuario.email.toLowerCase().includes(buscaNormalizada)
            || usuario.idAcesso.toLowerCase().includes(buscaNormalizada);

        const combinaTipo = tipo === "todos"
            || (tipo === "premium" ? usuario.premium.ativo : usuario.tipoUsuario === tipo);

        const combinaStatus = status === "todos" || usuario.status === status;

        return combinaBusca && combinaTipo && combinaStatus;
    });

    const totalRegistros = filtrados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamanhoPagina));
    const paginaValida = Math.min(Math.max(1, pagina), totalPaginas);
    const inicio = (paginaValida - 1) * tamanhoPagina;
    const itens = filtrados.slice(inicio, inicio + tamanhoPagina);

    return { itens, totalRegistros, pagina: paginaValida, tamanhoPagina, totalPaginas };
}

function encontrarUsuarioPorId(id) {
    return USUARIOS_MOCK.find((usuario) => usuario.id === id);
}

function removerUsuarioPorId(id) {
    const indice = USUARIOS_MOCK.findIndex((usuario) => usuario.id === id);

    if (indice !== -1) {
        USUARIOS_MOCK.splice(indice, 1);
    }
}

// ---- Formatacao ----

function formatarDataHora(isoString) {
    return new Date(isoString).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function formatarData(isoString) {
    if (!isoString) {
        return "-";
    }

    return new Date(isoString).toLocaleDateString("pt-BR");
}

// ---- Renderizacao da tabela a partir do array retornado pela consulta ----

function linhaUsuarioHtml(usuario) {
    const premiumHtml = usuario.premium.ativo
        ? `<span class="status ativo">Ate ${formatarData(usuario.premium.ate)}</span>`
        : `<span class="status inativo">Nao</span>`;

    const acaoBloquear = usuario.status === "bloqueado"
        ? `<button type="button" data-admin-action="ativar-conta">Ativar conta</button>`
        : `<button type="button" data-admin-action="bloquear-conta">Bloquear</button>`;

    const acaoPremium = usuario.premium.ativo
        ? `<button type="button" data-admin-action="remover-premium">Remover premium</button>`
        : `<button type="button" data-admin-action="liberar-premium">Conceder premium</button>`;

    return `
        <tr data-usuario-id="${usuario.id}" data-tipo="${usuario.tipoUsuario}" data-status="${usuario.status}" data-premium="${usuario.premium.ativo ? "sim" : "nao"}">
            <td data-label="Nome">${escapeHtml(usuario.nome)}</td>
            <td data-label="Email">${escapeHtml(usuario.email)}</td>
            <td data-label="Tipo"><span class="badge ${usuario.tipoUsuario}">${ROTULOS_TIPO_USUARIO[usuario.tipoUsuario]}</span></td>
            <td data-label="Status"><span class="status ${usuario.status}">${ROTULOS_STATUS_USUARIO[usuario.status]}</span></td>
            <td data-label="Premium">${premiumHtml}</td>
            <td data-label="Ultimo acesso">${formatarDataHora(usuario.ultimoAcesso)}</td>
            <td data-label="ID">${usuario.idAcesso}</td>
            <td data-label="Acoes" class="table-actions-cell">
                <div class="table-menu-wrap">
                    <button type="button" class="table-menu-trigger" data-menu-toggle aria-haspopup="true" aria-expanded="false" aria-label="Acoes de ${escapeHtml(usuario.nome)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                    <div class="table-menu" role="menu">
                        <button type="button" data-admin-action="ver-perfil">Ver perfil</button>
                        <button type="button" data-admin-action="editar-usuario">Editar usuario</button>
                        <button type="button" data-admin-action="alterar-tipo-conta">Alterar tipo</button>
                        ${acaoBloquear}
                        ${acaoPremium}
                        <button type="button" class="danger" data-admin-action="excluir-conta">Excluir</button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function linhaVaziaUsuariosHtml() {
    return `<tr class="tabela-vazia"><td colspan="8">Nenhum usuario encontrado para os filtros selecionados.</td></tr>`;
}

function renderizarTabelaUsuarios(itens) {
    corpoTabelaUsuarios.innerHTML = itens.length ? itens.map(linhaUsuarioHtml).join("") : linhaVaziaUsuariosHtml();
}

// ---- Paginacao ----

function renderizarPaginacaoUsuarios({ totalRegistros, pagina, tamanhoPagina, totalPaginas }) {
    const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
    const fim = Math.min(pagina * tamanhoPagina, totalRegistros);

    paginacaoInfoUsuarios.textContent = `Mostrando ${inicio}-${fim} de ${totalRegistros.toLocaleString("pt-BR")} usuarios.`;

    paginacaoControlesUsuarios.innerHTML = `
        <button type="button" data-pagina-acao="anterior" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
        <span class="paginacao-atual">Pagina ${pagina} de ${totalPaginas}</span>
        <button type="button" data-pagina-acao="proxima" ${pagina >= totalPaginas ? "disabled" : ""}>Proxima</button>
    `;
}

// ---- Orquestracao: busca -> filtra -> pagina -> renderiza ----

async function atualizarTabelaUsuarios() {
    const resultado = await consultarUsuarios(estadoConsultaUsuarios);
    estadoConsultaUsuarios.pagina = resultado.pagina;
    renderizarTabelaUsuarios(resultado.itens);
    renderizarPaginacaoUsuarios(resultado);
}

// ---- Eventos: busca, filtros e paginacao ----

let temporizadorBuscaUsuarios = null;

campoBuscaUsuarios.addEventListener("input", () => {
    window.clearTimeout(temporizadorBuscaUsuarios);
    temporizadorBuscaUsuarios = window.setTimeout(() => {
        estadoConsultaUsuarios.busca = campoBuscaUsuarios.value;
        estadoConsultaUsuarios.pagina = 1;
        atualizarTabelaUsuarios();
    }, 250);
});

document.querySelectorAll("[data-filtro-usuarios]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-usuarios]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        estadoConsultaUsuarios.tipo = botao.dataset.filtroUsuarios;
        estadoConsultaUsuarios.pagina = 1;
        atualizarTabelaUsuarios();
    });
});

document.querySelectorAll("[data-filtro-status]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-status]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        estadoConsultaUsuarios.status = botao.dataset.filtroStatus;
        estadoConsultaUsuarios.pagina = 1;
        atualizarTabelaUsuarios();
    });
});

paginacaoControlesUsuarios.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-pagina-acao]");

    if (!botao || botao.disabled) {
        return;
    }

    estadoConsultaUsuarios.pagina += botao.dataset.paginaAcao === "anterior" ? -1 : 1;
    atualizarTabelaUsuarios();
});

// No mobile a tabela empilha em blocos por usuario, entao cada pagina fica
// menor (10 em vez de 20) para nao deixar a rolagem longa demais.
function sincronizarTamanhoPaginaUsuarios() {
    const novoTamanho = tamanhoPaginaAtual();

    if (novoTamanho === estadoConsultaUsuarios.tamanhoPagina) {
        return;
    }

    estadoConsultaUsuarios.tamanhoPagina = novoTamanho;
    estadoConsultaUsuarios.pagina = 1;
    atualizarTabelaUsuarios();
}

MEDIA_QUERY_MOBILE_USUARIOS.addEventListener("change", sincronizarTamanhoPaginaUsuarios);

// Alguns ambientes nao disparam o evento "change" do matchMedia ao redimensionar;
// o listener de resize (com debounce) garante que a pagina se ajuste de qualquer forma.
let temporizadorResizeUsuarios = null;
window.addEventListener("resize", () => {
    window.clearTimeout(temporizadorResizeUsuarios);
    temporizadorResizeUsuarios = window.setTimeout(sincronizarTamanhoPaginaUsuarios, 200);
});

// ---- Acoes administrativas (menu de tres pontos) ----

function tratarAcaoAdmin(botao) {
    const linha = botao.closest("tr");
    const usuario = linha && encontrarUsuarioPorId(Number(linha.dataset.usuarioId));

    if (!usuario) {
        return;
    }

    switch (botao.dataset.adminAction) {
        case "ver-perfil":
            // Futuramente buscar dados de login em GET /api/admin/usuarios/:id.
            abrirModalVisualizacao("Perfil do usuario", textoPerfilUsuario(usuario));
            break;
        case "editar-usuario":
            abrirModalEditarUsuario(usuario);
            break;
        case "alterar-tipo-conta":
            abrirModalAlterarTipo(usuario);
            break;
        case "bloquear-conta":
            confirmarBloqueio(usuario);
            break;
        case "ativar-conta":
            confirmarAtivacao(usuario);
            break;
        case "liberar-premium":
            liberarPremium(usuario);
            break;
        case "remover-premium":
            confirmarRemocaoPremium(usuario);
            break;
        case "excluir-conta":
            confirmarExclusao(usuario);
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

function textoPerfilUsuario(usuario) {
    return [
        `Nome: ${usuario.nome}`,
        `Email: ${usuario.email}`,
        `Tipo: ${ROTULOS_TIPO_USUARIO[usuario.tipoUsuario]}`,
        `Status: ${ROTULOS_STATUS_USUARIO[usuario.status]}`,
        usuario.materia ? `Materia: ${usuario.materia}` : null,
        `Premium: ${usuario.premium.ativo ? `Ate ${formatarData(usuario.premium.ate)}` : "Nao"}`,
        `Ultimo acesso: ${formatarDataHora(usuario.ultimoAcesso)}`,
        `ID de acesso: ${usuario.idAcesso}`,
    ].filter(Boolean).join("\n");
}

function abrirModalEditarUsuario(usuario) {
    // Esta area edita apenas nome/email de exibicao; senha e login ficam em fluxo proprio e auditado.
    abrirModal(
        "Editar usuario",
        "editar-usuario",
        campoTexto("nome", "Nome", usuario.nome) + campoTexto("email", "Email", usuario.email, "email"),
        usuario
    );
}

function abrirModalAlterarTipo(usuario) {
    abrirModal(
        "Alterar tipo de conta",
        "alterar-tipo-conta",
        campoLeitura("Conta selecionada", textoPerfilUsuario(usuario)) +
        campoSelect("tipo", "Novo tipo de conta", ["Aluno", "Professor", "Admin"], ROTULOS_TIPO_USUARIO[usuario.tipoUsuario]),
        usuario
    );
}

function confirmarBloqueio(usuario) {
    abrirConfirmacao("Bloquear conta", "Tem certeza que deseja bloquear esta conta? O usuario perdera acesso ate ser reativado.", () => {
        // Futuramente PUT /api/admin/usuarios/:id/status com status = "bloqueado".
        usuario.status = "bloqueado";
        atualizarTabelaUsuarios();
        mostrarAvisoAdmin("Conta bloqueada visualmente.");
    });
}

function confirmarAtivacao(usuario) {
    abrirConfirmacao("Ativar conta", "Tem certeza que deseja ativar esta conta novamente?", () => {
        // Futuramente PUT /api/admin/usuarios/:id/status com status = "ativo".
        usuario.status = "ativo";
        atualizarTabelaUsuarios();
        mostrarAvisoAdmin("Conta ativada visualmente.");
    });
}

function liberarPremium(usuario) {
    // Futuramente criar assinatura manual ou liberar periodo promocional no banco.
    usuario.premium = { ativo: true, ate: "2026-12-31" };
    atualizarTabelaUsuarios();
    mostrarAvisoAdmin("Premium liberado visualmente.");
}

function confirmarRemocaoPremium(usuario) {
    abrirConfirmacao("Remover premium", "Tem certeza que deseja remover o acesso premium deste usuario?", () => {
        // Futuramente atualizar assinatura premium e cancelar acesso no banco/pagamento.
        usuario.premium = { ativo: false, ate: null };
        atualizarTabelaUsuarios();
        mostrarAvisoAdmin("Premium removido visualmente.");
    });
}

function confirmarExclusao(usuario) {
    abrirConfirmacao("Excluir conta", "Tem certeza que deseja excluir esta conta? Esta acao deve ser auditada futuramente no banco.", () => {
        // Futuramente DELETE /api/admin/usuarios/:id (soft delete + auditoria).
        removerUsuarioPorId(usuario.id);
        atualizarTabelaUsuarios();
        mostrarAvisoAdmin("Conta excluida visualmente.");
    });
}

adminModalHandlers["editar-usuario"] = function salvarEdicaoUsuario(dados) {
    // Futuramente PUT /api/admin/usuarios/:id com validacao de email unico.
    modalOrigem.nome = dados.nome;
    modalOrigem.email = dados.email;
    atualizarTabelaUsuarios();
    mostrarAvisoAdmin("Usuario atualizado visualmente.");
};

adminModalHandlers["alterar-tipo-conta"] = function salvarTipoConta(dados) {
    // Futuramente PUT /api/admin/usuarios/:id/tipo para alterar apenas o tipo da conta.
    // Esta acao nao deve alterar email, senha ou outros detalhes de login.
    modalOrigem.tipoUsuario = MAPA_TIPO_SELECT[dados.tipo] || modalOrigem.tipoUsuario;
    atualizarTabelaUsuarios();
    mostrarAvisoAdmin("Tipo de conta alterado visualmente.");
};

// ---- Inicializacao ----

atualizarTabelaUsuarios();
