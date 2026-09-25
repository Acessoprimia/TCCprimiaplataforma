// Interacoes da pagina /admin/usuarios (alunos, professores, admins e premium).
// USUARIOS_MOCK vem dos dados reais embutidos pelo servidor no script
// #dados-usuarios (ver usuarios.ejs) - o nome ficou o mesmo de quando
// era gerado fake, mas o conteudo agora e o retorno real do banco.
// Depende das funcoes compartilhadas definidas em common.js.
const USUARIOS_MOCK = JSON.parse(document.getElementById("dados-usuarios").textContent);

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
    if (!isoString) {
        return "-";
    }

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
        ? `<span class="status ativo">Até ${formatarData(usuario.premium.ate)}</span>`
        : `<span class="status inativo">Não</span>`;

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
            <td data-label="Último acesso">${formatarDataHora(usuario.ultimoAcesso)}</td>
            <td data-label="ID">${usuario.idAcesso}</td>
            <td data-label="Ações" class="table-actions-cell">
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
                        ${usuario.temDiploma ? '<button type="button" data-admin-action="ver-diploma">Ver diploma</button>' : ""}
                        ${usuario.diplomaPendente ? '<button type="button" data-admin-action="ver-diploma-pendente">Ver novo diploma (pendente)</button><button type="button" data-admin-action="aprovar-diploma">Aprovar novo diploma</button><button type="button" class="danger" data-admin-action="recusar-diploma">Recusar novo diploma</button>' : ""}
                        <button type="button" data-admin-action="editar-usuario">Editar usuário</button>
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
    return `<tr class="tabela-vazia"><td colspan="8">Nenhum usuário encontrado para os filtros selecionados.</td></tr>`;
}

function renderizarTabelaUsuarios(itens) {
    corpoTabelaUsuarios.innerHTML = itens.length ? itens.map(linhaUsuarioHtml).join("") : linhaVaziaUsuariosHtml();
}

// ---- Paginacao ----

function renderizarPaginacaoUsuarios({ totalRegistros, pagina, tamanhoPagina, totalPaginas }) {
    const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
    const fim = Math.min(pagina * tamanhoPagina, totalRegistros);

    paginacaoInfoUsuarios.textContent = `Mostrando ${inicio}-${fim} de ${totalRegistros.toLocaleString("pt-BR")} usuários.`;

    paginacaoControlesUsuarios.innerHTML = `
        <button type="button" data-pagina-acao="anterior" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
        <span class="paginacao-atual">Página ${pagina} de ${totalPaginas}</span>
        <button type="button" data-pagina-acao="proxima" ${pagina >= totalPaginas ? "disabled" : ""}>Próxima</button>
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
            abrirModalVisualizacao("Perfil do usuário", textoPerfilUsuario(usuario));
            break;
        case "ver-diploma":
            window.open(`/admin/usuarios/${usuario.id}/diploma`, "_blank", "noopener");
            break;
        case "ver-diploma-pendente":
            window.open(`/admin/usuarios/${usuario.id}/diploma-pendente`, "_blank", "noopener");
            break;
        case "aprovar-diploma":
            decidirDiploma(usuario, "aprovar");
            break;
        case "recusar-diploma":
            decidirDiploma(usuario, "recusar");
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
            mostrarAvisoAdmin("Ação administrativa preparada.");
    }
}

function textoPerfilUsuario(usuario) {
    return [
        `Nome: ${usuario.nome}`,
        `Email: ${usuario.email}`,
        `Tipo: ${ROTULOS_TIPO_USUARIO[usuario.tipoUsuario]}`,
        `Status: ${ROTULOS_STATUS_USUARIO[usuario.status]}`,
        usuario.materia ? `Matéria: ${usuario.materia}` : null,
        usuario.diplomaPendente ? "Diploma: troca aguardando aprovação" : null,
        `Premium: ${usuario.premium.ativo ? `Até ${formatarData(usuario.premium.ate)}` : "Não"}`,
        `Último acesso: ${formatarDataHora(usuario.ultimoAcesso)}`,
        `ID de acesso: ${usuario.idAcesso}`,
    ].filter(Boolean).join("\n");
}

function abrirModalEditarUsuario(usuario) {
    // Esta area edita apenas nome/email de exibicao; senha e login ficam em fluxo proprio e auditado.
    abrirModal(
        "Editar usuário",
        "editar-usuario",
        campoTexto("nome", "Nome", usuario.nome) + campoTexto("email", "Email", usuario.email, "email"),
        usuario
    );
}

function abrirModalAlterarTipo(usuario) {
    // So visual por enquanto: mudar tipo_usuario de verdade tambem
    // precisaria criar/apagar a linha correspondente em Aluno ou
    // Professor (que tem campos obrigatorios proprios, tipo RA/serie ou
    // diploma/materia) - sem isso o resto do sistema quebra pra esse
    // usuario. Precisa de um fluxo proprio, nao so um select.
    abrirModal(
        "Alterar tipo de conta",
        "alterar-tipo-conta",
        campoLeitura("Conta selecionada", textoPerfilUsuario(usuario)) +
        campoSelect("tipo", "Novo tipo de conta", ["Aluno", "Professor", "Admin"], ROTULOS_TIPO_USUARIO[usuario.tipoUsuario]) +
        campoLeitura("Aviso", "Essa ação ainda não está disponível de verdade - mudar o tipo de conta exige recriar o cadastro de aluno/professor correspondente."),
        usuario
    );
}

function decidirDiploma(usuario, decisao) {
    const aprovar = decisao === "aprovar";
    abrirConfirmacao(
        aprovar ? "Aprovar novo diploma" : "Recusar novo diploma",
        aprovar
            ? "O novo diploma substituirá o atual e o arquivo antigo será apagado. Confirmar?"
            : "O novo diploma será descartado e o atual continua valendo. Confirmar?",
        async () => {
            try {
                await chamarApiAdmin(`/admin/usuarios/${usuario.id}/diploma/${decisao}`, {});
                usuario.diplomaPendente = false;
                atualizarTabelaUsuarios();
                mostrarAvisoAdmin(aprovar ? "Novo diploma aprovado." : "Novo diploma recusado.");
            } catch (erro) {
                mostrarAvisoAdmin(erro.message);
            }
        }
    );
}

function confirmarBloqueio(usuario) {
    abrirConfirmacao("Bloquear conta", "Tem certeza que deseja bloquear esta conta? O usuário perderá acesso até ser reativado.", async () => {
        try {
            await chamarApiAdmin(`/admin/usuarios/${usuario.id}/status`, { status: "bloqueado" });
            usuario.status = "bloqueado";
            atualizarTabelaUsuarios();
            mostrarAvisoAdmin("Conta bloqueada.");
        } catch (erro) {
            mostrarAvisoAdmin(erro.message);
        }
    });
}

function confirmarAtivacao(usuario) {
    abrirConfirmacao("Ativar conta", "Tem certeza que deseja ativar esta conta novamente?", async () => {
        try {
            await chamarApiAdmin(`/admin/usuarios/${usuario.id}/status`, { status: "ativo" });
            usuario.status = "ativo";
            atualizarTabelaUsuarios();
            mostrarAvisoAdmin("Conta ativada.");
        } catch (erro) {
            mostrarAvisoAdmin(erro.message);
        }
    });
}

async function liberarPremium(usuario) {
    try {
        await chamarApiAdmin(`/admin/usuarios/${usuario.id}/premium/conceder`, {});
        // Sem conceito de data de expiracao no banco (assinatura fica
        // ativa ate ser cancelada) - "ate" sempre null quando concedida.
        usuario.premium = { ativo: true, ate: null };
        atualizarTabelaUsuarios();
        mostrarAvisoAdmin("Premium concedido.");
    } catch (erro) {
        mostrarAvisoAdmin(erro.message);
    }
}

function confirmarRemocaoPremium(usuario) {
    abrirConfirmacao("Remover premium", "Tem certeza que deseja remover o acesso premium deste usuário?", async () => {
        try {
            await chamarApiAdmin(`/admin/usuarios/${usuario.id}/premium/remover`, {});
            usuario.premium = { ativo: false, ate: null };
            atualizarTabelaUsuarios();
            mostrarAvisoAdmin("Premium removido.");
        } catch (erro) {
            mostrarAvisoAdmin(erro.message);
        }
    });
}

function confirmarExclusao(usuario) {
    abrirConfirmacao("Excluir conta", "Tem certeza que deseja excluir esta conta? Essa ação apaga tudo relacionado a ela (cronogramas, respostas, etc) e não pode ser desfeita.", async () => {
        try {
            await chamarApiAdmin(`/admin/usuarios/${usuario.id}/excluir`, {});
            removerUsuarioPorId(usuario.id);
            atualizarTabelaUsuarios();
            mostrarAvisoAdmin("Conta excluída.");
        } catch (erro) {
            mostrarAvisoAdmin(erro.message);
        }
    });
}

adminModalHandlers["editar-usuario"] = async function salvarEdicaoUsuario(dados) {
    try {
        await chamarApiAdmin(`/admin/usuarios/${modalOrigem.id}/editar`, {
            nome: dados.nome,
            email: dados.email,
        });
        modalOrigem.nome = dados.nome;
        modalOrigem.email = dados.email;
        atualizarTabelaUsuarios();
        mostrarAvisoAdmin("Usuário atualizado.");
    } catch (erro) {
        mostrarAvisoAdmin(erro.message);
    }
};

adminModalHandlers["alterar-tipo-conta"] = function salvarTipoConta(dados) {
    // Futuramente PUT /api/admin/usuarios/:id/tipo para alterar apenas o tipo da conta.
    // Esta acao nao deve alterar email, senha ou outros detalhes de login.
    modalOrigem.tipoUsuario = MAPA_TIPO_SELECT[dados.tipo] || modalOrigem.tipoUsuario;
    atualizarTabelaUsuarios();
    mostrarAvisoAdmin("Tipo de conta alterado visualmente.");
};

// ---- Inicializacao ----

atualizarTabelaUsuarios().then(async () => {
    const abrirMenu = new URLSearchParams(window.location.search).get("menu") === "1";
    const linha = await destacarItemDaUrl({
        lista: USUARIOS_MOCK,
        estado: estadoConsultaUsuarios,
        atualizar: atualizarTabelaUsuarios,
        atributoLinha: "data-usuario-id",
        rotulo: "Usuário",
    });

    // Vindo do alerta de diploma: ja deixa o menu de acoes aberto.
    if (linha && abrirMenu) {
        window.setTimeout(() => linha.querySelector("[data-menu-toggle]")?.click(), 900);
    }
});
