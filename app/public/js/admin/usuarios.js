// Interacoes da pagina /admin/usuarios (alunos, professores, admins e premium).
// Depende das funcoes compartilhadas definidas em common.js.

function tratarAcaoAdmin(botao) {
    const acao = botao.dataset.adminAction;
    const item = itemPai(botao);

    switch (acao) {
        case "ver-login-usuario":
            // Futuramente buscar dados de login em GET /api/admin/usuarios/:id/login.
            // Esta consulta deve ser somente leitura e registrada em log_admin.
            abrirModalVisualizacao("Dados de login", textoLoginUsuario(item), item);
            break;
        case "alterar-tipo-conta":
            abrirModalAlterarTipo(item);
            break;
        case "bloquear-conta":
            confirmarBloqueio(item);
            break;
        case "ativar-conta":
            confirmarAtivacao(item);
            break;
        case "excluir-conta":
            confirmarRemocao(botao, "Excluir conta", "Tem certeza que deseja excluir esta conta? Esta acao deve ser auditada futuramente no banco.", "Conta excluida visualmente.");
            break;
        case "liberar-premium":
            liberarPremium(item);
            break;
        case "controlar-periodo-premium":
            abrirModalPeriodoPremium(item);
            break;
        case "remover-premium":
            confirmarRemocaoPremium(item);
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

function textoLoginUsuario(item) {
    const campos = Array.from(item.children).slice(0, -1).map((celula) => {
        return `${celula.dataset.label || "Dado"}: ${celula.textContent.trim()}`;
    });

    return campos.join("\n");
}

function abrirModalAlterarTipo(item) {
    const tipoAtual = item.querySelector(".badge")?.textContent.trim() || "Aluno";

    abrirModal(
        "Alterar tipo de conta",
        "alterar-tipo-conta",
        campoLeitura("Conta selecionada", textoLoginUsuario(item)) +
        campoSelect("tipo", "Novo tipo de conta", ["Aluno", "Professor", "Admin"], tipoAtual),
        item
    );
}

function confirmarBloqueio(item) {
    abrirConfirmacao("Bloquear conta", "Tem certeza que deseja bloquear esta conta? O usuario perdera acesso ate ser reativado.", () => {
        const status = item.querySelector(".status");
        setStatus(status, "Bloqueado", "pendente");
        const botaoBloquear = item.querySelector('[data-admin-action="bloquear-conta"]');

        if (botaoBloquear) {
            botaoBloquear.textContent = "Ativar";
            botaoBloquear.dataset.adminAction = "ativar-conta";
        }

        // Futuramente PUT /api/admin/usuarios/:id/status com status = "bloqueado".
        // Nao alterar senha nem detalhes de login nesta area.
        mostrarAvisoAdmin("Conta bloqueada visualmente.");
    });
}

function confirmarAtivacao(item) {
    abrirConfirmacao("Ativar conta", "Tem certeza que deseja ativar esta conta novamente?", () => {
        const status = item.querySelector(".status");
        setStatus(status, "Ativo", "ativo");
        const botaoAtivar = item.querySelector('[data-admin-action="ativar-conta"]');

        if (botaoAtivar) {
            botaoAtivar.textContent = "Bloquear";
            botaoAtivar.dataset.adminAction = "bloquear-conta";
        }

        // Futuramente PUT /api/admin/usuarios/:id/status com status = "ativo".
        mostrarAvisoAdmin("Conta ativada visualmente.");
    });
}

function definirPremiumNaLinha(item, ativo, dataFim = "") {
    const celula = item.querySelector('[data-label="Premium"]');
    item.dataset.premium = ativo ? "sim" : "nao";
    celula.innerHTML = ativo
        ? `<span class="status ativo">Ate ${dataFim || "-"}</span>`
        : `<span class="status pendente">Nao</span>`;

    const acoes = item.querySelector(".table-actions");
    const botaoPremium = acoes.querySelector('[data-admin-action="liberar-premium"], [data-admin-action="remover-premium"]');

    if (botaoPremium) {
        botaoPremium.textContent = ativo ? "Remover premium" : "Liberar premium";
        botaoPremium.dataset.adminAction = ativo ? "remover-premium" : "liberar-premium";
        botaoPremium.classList.toggle("danger", ativo);
    }
}

function liberarPremium(item) {
    // Futuramente criar assinatura manual ou liberar periodo promocional no banco.
    definirPremiumNaLinha(item, true, "definir");
    mostrarAvisoAdmin("Premium liberado visualmente.");
}

function confirmarRemocaoPremium(item) {
    abrirConfirmacao("Remover premium", "Tem certeza que deseja remover o acesso premium deste usuario?", () => {
        // Futuramente atualizar assinatura premium e cancelar acesso no banco/pagamento.
        definirPremiumNaLinha(item, false);
        mostrarAvisoAdmin("Premium removido visualmente.");
    });
}

function abrirModalPeriodoPremium(item) {
    abrirModal(
        "Controlar periodo premium",
        "periodo-premium",
        campoTexto("inicio", "Inicio do acesso", "", "date") +
        campoTexto("fim", "Fim do acesso", "", "date"),
        item
    );
}

adminModalHandlers["alterar-tipo-conta"] = function salvarTipoConta(dados) {
    const badge = modalOrigem.querySelector(".badge");
    const classe = dados.tipo.toLowerCase().replace("ã", "a");

    // Futuramente PUT /api/admin/usuarios/:id/tipo para alterar apenas o tipo da conta.
    // Esta acao nao deve alterar email, senha ou outros detalhes de login.
    badge.textContent = dados.tipo;
    badge.className = `badge ${classe}`;
    modalOrigem.dataset.tipo = classe;
    mostrarAvisoAdmin("Tipo de conta alterado visualmente.");
};

adminModalHandlers["periodo-premium"] = function salvarPeriodoPremium(dados) {
    // Futuramente salvar periodo_inicio/periodo_fim na assinatura premium do usuario.
    definirPremiumNaLinha(modalOrigem, true, dados.fim || "-");
    mostrarAvisoAdmin("Periodo premium atualizado visualmente.");
};

function aplicarFiltroUsuarios(filtro) {
    document.querySelectorAll("#usuariosTabela tr").forEach((linha) => {
        const mostrar = filtro === "todos"
            || (filtro === "premium" ? linha.dataset.premium === "sim" : linha.dataset.tipo === filtro);

        linha.classList.toggle("oculto", !mostrar);
    });
}

document.querySelectorAll("[data-filtro-usuarios]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-usuarios]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        aplicarFiltroUsuarios(botao.dataset.filtroUsuarios);
    });
});
