// Dados temporarios para manter o painel funcionando enquanto o banco nao existe.
// Futuramente carregar estes dados de uma rota protegida, como GET /api/admin/dashboard.
// O backend devera conferir sessao/token e confirmar tipo_usuario === "admin" antes de responder.
const adminResumoSimulado = {
    alunos: 245,
    professores: 18,
    contasProfessor: 18,
    denunciasAbertas: 5,
    conteudos: 74,
    premium: 39,
    mensagens: 12
};

// Futuramente validar a sessao/token antes de permitir acoes sensiveis no front.
// const sessao = await fetch("/api/auth/session").then((resposta) => resposta.json());
// if (!sessao.usuario || sessao.usuario.tipo_usuario !== "admin") window.location.href = "/login";

let modalModo = "";
let modalOrigem = null;

const adminModal = document.getElementById("adminModal");
const adminModalTitulo = document.getElementById("adminModalTitulo");
const adminModalCampos = document.getElementById("adminModalCampos");
const adminModalForm = document.getElementById("adminModalForm");
const adminModalFechar = document.getElementById("adminModalFechar");
const adminModalCancelar = document.getElementById("adminModalCancelar");
const confirmModal = document.getElementById("confirmModal");
const confirmTitulo = document.getElementById("confirmTitulo");
const confirmTexto = document.getElementById("confirmTexto");
const confirmFechar = document.getElementById("confirmFechar");
const confirmCancelar = document.getElementById("confirmCancelar");
const confirmExecutar = document.getElementById("confirmExecutar");
let acaoConfirmada = null;

function mostrarAvisoAdmin(texto) {
    const toast = document.getElementById("adminToast");

    if (!toast) {
        return;
    }

    toast.textContent = texto;
    toast.classList.add("mostrar");

    window.clearTimeout(mostrarAvisoAdmin.timer);
    mostrarAvisoAdmin.timer = window.setTimeout(() => {
        toast.classList.remove("mostrar");
    }, 3000);
}

function abrirModal(titulo, modo, campos, origem = null) {
    modalModo = modo;
    modalOrigem = origem;
    adminModalTitulo.textContent = titulo;
    adminModalCampos.innerHTML = campos;
    adminModal.classList.add("aberto");
    adminModal.setAttribute("aria-hidden", "false");

    const botaoSalvar = adminModalForm.querySelector('button[type="submit"]');
    botaoSalvar.style.display = modo === "visualizar" ? "none" : "inline-block";

    const primeiroCampo = adminModalCampos.querySelector("input, textarea, select");

    if (primeiroCampo) {
        primeiroCampo.focus();
    }
}

function fecharModal() {
    adminModal.classList.remove("aberto");
    adminModal.setAttribute("aria-hidden", "true");
    adminModalCampos.innerHTML = "";
    modalModo = "";
    modalOrigem = null;
}

function abrirConfirmacao(titulo, texto, callback) {
    confirmTitulo.textContent = titulo;
    confirmTexto.textContent = texto;
    acaoConfirmada = callback;
    confirmModal.classList.add("aberto");
    confirmModal.setAttribute("aria-hidden", "false");
}

function fecharConfirmacao() {
    confirmModal.classList.remove("aberto");
    confirmModal.setAttribute("aria-hidden", "true");
    acaoConfirmada = null;
}

function campoTexto(nome, label, valor = "", tipo = "text") {
    return `
        <label>
            ${label}
            <input type="${tipo}" name="${nome}" value="${valor}">
        </label>
    `;
}

function campoArquivo(nome, label) {
    return `
        <label>
            ${label}
            <input type="file" name="${nome}">
        </label>
    `;
}

function campoTextarea(nome, label, valor = "") {
    return `
        <label>
            ${label}
            <textarea name="${nome}">${valor}</textarea>
        </label>
    `;
}

function campoLeitura(label, valor = "") {
    return `
        <section class="admin-readonly-box">
            <strong>${label}</strong>
            <p>${valor}</p>
        </section>
    `;
}

function campoSelect(nome, label, opcoes, selecionado = "") {
    const options = opcoes.map((opcao) => {
        const selected = opcao === selecionado ? "selected" : "";
        return `<option ${selected}>${opcao}</option>`;
    }).join("");

    return `
        <label>
            ${label}
            <select name="${nome}">${options}</select>
        </label>
    `;
}

function dadosFormulario() {
    return Object.fromEntries(new FormData(adminModalForm).entries());
}

function setStatus(elemento, texto, classe) {
    elemento.textContent = texto;
    elemento.className = `status ${classe}`;
}

function itemPai(botao) {
    return botao.closest("tr") || botao.closest(".content-admin-card") || botao.closest(".premium-card") || botao.closest(".materia-chip");
}

function removerItem(botao, mensagem) {
    const item = itemPai(botao);

    if (item) {
        item.remove();
        mostrarAvisoAdmin(mensagem);
    }
}

function confirmarRemocao(botao, titulo, texto, mensagem) {
    abrirConfirmacao(titulo, texto, () => {
        removerItem(botao, mensagem);
    });
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

function abrirModalUsuario(titulo, modo, origem = null) {
    abrirModal(
        titulo,
        modo,
        campoTexto("nome", "Nome completo", origem?.children?.[0]?.textContent || "") +
        campoTexto("email", "Email", origem?.children?.[1]?.textContent || "", "email") +
        campoSelect("tipo", "Tipo de conta", ["Aluno", "Professor", "Admin"], origem?.querySelector(".badge")?.textContent || "Aluno") +
        campoSelect("status", "Status", ["Ativo", "Pendente", "Bloqueado"], origem?.querySelector(".status")?.textContent || "Ativo"),
        origem
    );
}

function abrirModalConteudo(titulo, modo, origem = null) {
    const textoConteudo = origem?.querySelector("p")?.textContent || "";
    const materiaAtual = textoConteudo.match(/Materia:\s*([^|]+)/)?.[1]?.trim() || "Geral";

    abrirModal(
        titulo,
        modo,
        campoSelect("categoria", "Categoria", ["Biblioteca", "Livro", "Videoaula", "Cronograma", "Plano de estudo", "Simulado"], origem?.querySelector("span")?.textContent || "Biblioteca") +
        campoSelect("materia", "Materia", listarMaterias(), materiaAtual) +
        campoTexto("titulo", "Titulo", origem?.querySelector("h3")?.textContent || "") +
        campoSelect("status", "Status", ["Publicado", "Rascunho", "Agendado"], "Publicado") +
        campoSelect("acesso", "Acesso", ["Gratuito", "Premium"], origem?.textContent.includes("premium") ? "Premium" : "Gratuito"),
        origem
    );
}

function abrirModalMensagem(titulo, modo, textoInicial = "", origem = null) {
    abrirModal(titulo, modo, campoTextarea("mensagem", "Mensagem", textoInicial), origem);
}

function abrirModalResposta(titulo, modo, pergunta, origem = null) {
    abrirModal(
        titulo,
        modo,
        campoLeitura("Mensagem recebida", pergunta) +
        campoTextarea("resposta", "Resposta do administrador"),
        origem
    );
}

function abrirModalVisualizacao(titulo, conteudo, origem = null) {
    abrirModal(titulo, "visualizar", campoLeitura("Informacoes", conteudo), origem);
}

function listarMaterias() {
    const materias = Array.from(document.querySelectorAll("#materiasLista .materia-chip span"))
        .map((item) => item.textContent.trim());

    return materias.length ? ["Geral", ...materias] : ["Geral", "Matematica", "Portugues", "Biologia", "Historia", "Fisica", "Quimica", "Geografia", "Ingles", "Espanhol", "Literatura", "Filosofia", "Sociologia", "Artes", "Educacao Fisica"];
}

function textoDuvidaForum(item) {
    const materia = item.children[0]?.textContent.trim() || "Materia";
    const autor = item.children[1]?.textContent.trim() || "Aluno";
    const data = item.children[3]?.textContent.trim() || "";

    if (materia === "Matematica") {
        return `Autor: ${autor}\nMateria: ${materia}\nData: ${data}\n\nPergunta: Estou com dificuldade para fatorar o polinomio 5xb³ - 10x²b³ + 15x³b. Pode explicar o passo a passo?`;
    }

    return `Autor: ${autor}\nMateria: ${materia}\nData: ${data}\n\nPergunta: Qual e a relacao entre arte, religiao e filosofia na visao de Hegel?`;
}

function textoContato(item) {
    const nome = item.children[0]?.textContent.trim() || "Usuario";
    const email = item.children[1]?.textContent.trim() || "";
    const assunto = item.children[2]?.textContent.trim() || "Contato";

    if (assunto.includes("cadastro")) {
        return `Nome: ${nome}\nEmail: ${email}\nAssunto: ${assunto}\n\nMensagem: Tentei criar minha conta na Primia, mas nao consegui finalizar o cadastro. Podem verificar?`;
    }

    return `Nome: ${nome}\nEmail: ${email}\nAssunto: ${assunto}\n\nMensagem: Gostariamos de entender como a escola pode usar a Primia com alunos e professores.`;
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

function textoDenuncia(item) {
    const codigo = item.children[0]?.textContent.trim() || "DEN-000";
    const materia = item.children[1]?.textContent.trim() || "Materia";
    const conteudo = item.children[2]?.textContent.trim() || "Conteudo denunciado";
    const motivo = item.children[3]?.textContent.trim() || "Motivo nao informado";
    const status = item.children[4]?.textContent.trim() || "Aberta";
    const data = item.children[5]?.textContent.trim() || "";

    return `Denuncia: ${codigo}\nMateria: ${materia}\nStatus: ${status}\nData: ${data}\n\nConteudo denunciado: ${conteudo}\n\nMotivo da denuncia: ${motivo}`;
}

function salvarUsuario(dados) {
    const tabela = document.getElementById("usuariosTabela");
    const badgeClasse = dados.tipo.toLowerCase().replace("ã", "a");
    const statusClasse = dados.status === "Ativo" ? "ativo" : "pendente";

    // Futuramente salvar usuario no banco com POST /api/admin/usuarios ou PUT /api/admin/usuarios/:id.
    // O backend deve validar permissao de admin antes de alterar tipo, status ou excluir usuarios.
    if (modalOrigem) {
        modalOrigem.children[0].textContent = dados.nome;
        modalOrigem.children[1].textContent = dados.email;
        modalOrigem.children[2].innerHTML = `<span class="badge ${badgeClasse}">${dados.tipo}</span>`;
        modalOrigem.children[3].innerHTML = `<span class="status ${statusClasse}">${dados.status}</span>`;
        mostrarAvisoAdmin("Usuario atualizado visualmente.");
        return;
    }

    tabela.insertAdjacentHTML("afterbegin", `
        <tr>
            <td data-label="Nome">${dados.nome}</td>
            <td data-label="Email">${dados.email}</td>
            <td data-label="Tipo"><span class="badge ${badgeClasse}">${dados.tipo}</span></td>
            <td data-label="Status"><span class="status ${statusClasse}">${dados.status}</span></td>
            <td data-label="Acoes" class="table-actions">
                <button data-admin-action="ver-login-usuario">Ver login</button>
            </td>
        </tr>
    `);
    mostrarAvisoAdmin("Usuario adicionado temporariamente.");
}

function salvarConteudo(dados) {
    const lista = document.getElementById("conteudosLista");

    // Futuramente salvar conteudo no banco com POST /api/admin/conteudos.
    // Arquivos como livros e videoaulas devem ir para storage, gravando no banco apenas metadados e URL.
    const html = `
        <article class="content-admin-card">
            <span>${dados.categoria}</span>
            <h3>${dados.titulo}</h3>
            <p>Materia: ${dados.materia} | Status: ${dados.status.toLowerCase()} | Acesso: ${dados.acesso.toLowerCase()}</p>
            <nav>
                <button data-admin-action="editar-conteudo">Editar</button>
                <button data-admin-action="destacar-conteudo">Destacar</button>
                <button data-admin-action="premium-conteudo">${dados.acesso === "Premium" ? "Editar premium" : "Marcar premium"}</button>
                <button class="danger" data-admin-action="excluir-conteudo">Excluir</button>
            </nav>
        </article>
    `;

    if (modalOrigem) {
        modalOrigem.outerHTML = html;
        mostrarAvisoAdmin("Conteudo atualizado visualmente.");
        return;
    }

    lista.insertAdjacentHTML("afterbegin", html);
    mostrarAvisoAdmin("Conteudo adicionado temporariamente.");
}

function salvarMateria(dados) {
    const lista = document.getElementById("materiasLista");

    // Futuramente salvar materia com POST /api/admin/materias.
    // Antes de remover materia, verificar se ha conteudos, duvidas ou simulados vinculados.
    lista.insertAdjacentHTML("beforeend", `
        <article class="materia-chip">
            <span>${dados.nome}</span>
            <button type="button" data-admin-action="remover-materia">Remover</button>
        </article>
    `);
    mostrarAvisoAdmin("Materia adicionada temporariamente.");
}

function salvarTipoConta(dados) {
    const badge = modalOrigem.querySelector(".badge");
    const novoTipo = dados.tipo;
    const classe = novoTipo.toLowerCase().replace("ã", "a");

    // Futuramente PUT /api/admin/usuarios/:id/tipo para alterar apenas o tipo da conta.
    // Esta acao nao deve alterar email, senha ou outros detalhes de login.
    badge.textContent = novoTipo;
    badge.className = `badge ${classe}`;
    mostrarAvisoAdmin("Tipo de conta alterado visualmente.");
}

function registrarRespostaContato(item) {
    const status = item.querySelector(".status");

    if (status) {
        setStatus(status, "Respondido", "ativo");
    }

    item.classList.add("linha-destacada");
    // Futuramente salvar resposta em respostas_contato.
    // Apos salvar, atualizar status para "respondido" no banco e registrar id_admin_responsavel.
    mostrarAvisoAdmin("Contato respondido visualmente.");
}

function salvarConfiguracoes() {
    // Futuramente salvar configuracoes no banco com PUT /api/admin/configuracoes.
    // Guardar chave, valor, data_alteracao e id do admin responsavel pela mudanca.
    mostrarAvisoAdmin("Configuracoes salvas visualmente. A persistencia entrara com o banco.");
}

function tratarAcao(botao) {
    const acao = botao.dataset.adminAction;
    const item = itemPai(botao);

    switch (acao) {
        case "ver-login-usuario":
        case "ver-login-professor":
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
        case "adicionar-conteudo":
            abrirModalConteudo("Adicionar conteudo", "conteudo");
            break;
        case "editar-conteudo":
            abrirModalConteudo("Editar conteudo", "conteudo", item);
            break;
        case "destacar-conteudo":
            item.classList.toggle("destacado");
            // Futuramente PUT /api/admin/conteudos/:id/destaque.
            mostrarAvisoAdmin(item.classList.contains("destacado") ? "Conteudo destacado." : "Destaque removido.");
            break;
        case "premium-conteudo": {
            const texto = item.querySelector("p");
            const premium = texto.textContent.toLowerCase().includes("premium");
            texto.textContent = texto.textContent.replace(premium ? "premium" : "gratuito", premium ? "gratuito" : "premium");
            botao.textContent = premium ? "Marcar premium" : "Editar premium";
            // Futuramente atualizar campo is_premium no banco.
            mostrarAvisoAdmin("Regra premium alterada visualmente.");
            break;
        }
        case "excluir-conteudo":
            confirmarRemocao(botao, "Excluir conteudo", "Tem certeza que deseja excluir este conteudo?", "Conteudo removido visualmente.");
            break;
        case "visualizar-denuncia":
            abrirModalVisualizacao("Detalhes da denuncia", textoDenuncia(item), item);
            break;
        case "analisar-denuncia":
            setStatus(item.querySelector(".status"), "Em analise", "ativo");
            // Futuramente PUT /api/admin/denuncias/:id/status com status = "em_analise".
            mostrarAvisoAdmin("Denuncia marcada como em analise.");
            break;
        case "ignorar-denuncia":
            setStatus(item.querySelector(".status"), "Ignorada", "ativo");
            // Futuramente salvar decisao do admin e manter conteudo publicado.
            mostrarAvisoAdmin("Denuncia ignorada visualmente.");
            break;
        case "resolver-denuncia":
            setStatus(item.querySelector(".status"), "Resolvida", "ativo");
            // Futuramente finalizar denuncia com decisao administrativa.
            mostrarAvisoAdmin("Denuncia resolvida visualmente.");
            break;
        case "remover-conteudo-denunciado":
            abrirConfirmacao("Remover conteudo denunciado", "Tem certeza que deseja remover o conteudo denunciado?", () => {
                setStatus(item.querySelector(".status"), "Conteudo removido", "pendente");
                item.classList.add("linha-destacada");
                // Futuramente remover/inativar conteudo denunciado no banco sem responder a duvida.
                mostrarAvisoAdmin("Conteudo denunciado removido visualmente.");
            });
            break;
        case "editar-beneficios":
            abrirModalMensagem("Editar beneficios premium", "mensagem", "Simulados exclusivos\nVideoaulas premium\nPlanos personalizados");
            break;
        case "controlar-periodo-premium":
            abrirModal(
                "Controlar periodo premium",
                "mensagem",
                campoTexto("inicio", "Inicio do acesso", "", "date") +
                campoTexto("fim", "Fim do acesso", "", "date"),
                item
            );
            break;
        case "remover-premium":
            abrirConfirmacao("Remover premium", "Tem certeza que deseja remover o acesso premium deste usuario?", () => {
                item.querySelector("p").textContent = "Conta gratuita";
                item.querySelector("nav").innerHTML = `
                    <button data-admin-action="liberar-premium">Liberar premium</button>
                    <button data-admin-action="controlar-periodo-premium">Controlar periodo</button>
                `;
                // Futuramente atualizar assinatura premium e cancelar acesso no banco/pagamento.
                mostrarAvisoAdmin("Premium removido visualmente.");
            });
            break;
        case "liberar-premium":
            item.querySelector("p").textContent = "Premium ativo temporariamente";
            item.querySelector("nav").innerHTML = `
                <button data-admin-action="controlar-periodo-premium">Controlar periodo</button>
                <button class="danger" data-admin-action="remover-premium">Remover premium</button>
            `;
            // Futuramente criar assinatura manual ou liberar periodo promocional no banco.
            mostrarAvisoAdmin("Premium liberado visualmente.");
            break;
        case "visualizar-contato":
            abrirModalVisualizacao("Mensagem de contato", textoContato(item), item);
            break;
        case "responder-contato":
            abrirModalResposta("Responder contato", "resposta-contato", textoContato(item), item);
            break;
        case "resolver-contato":
            setStatus(item.querySelector(".status"), "Resolvido", "ativo");
            // Futuramente PUT /api/admin/contatos/:id/status com status = "resolvido".
            mostrarAvisoAdmin("Contato marcado como resolvido.");
            break;
        case "excluir-contato":
            confirmarRemocao(botao, "Excluir mensagem", "Tem certeza que deseja excluir esta mensagem de contato?", "Mensagem removida visualmente.");
            break;
        case "salvar-configuracoes":
            salvarConfiguracoes();
            break;
        case "adicionar-materia":
            abrirModal("Adicionar materia", "materia", campoTexto("nome", "Nome da materia"));
            break;
        case "remover-materia":
            confirmarRemocao(botao, "Remover materia", "Tem certeza que deseja remover esta materia? Futuramente o banco deve bloquear se houver conteudos vinculados.", "Materia removida visualmente.");
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-admin-action]");

    if (botao) {
        tratarAcao(botao);
    }
});

adminModalForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const dados = dadosFormulario();

    if (modalModo === "usuario") {
        salvarUsuario(dados);
    } else if (modalModo === "conteudo") {
        salvarConteudo(dados);
    } else if (modalModo === "materia") {
        salvarMateria(dados);
    } else if (modalModo === "alterar-tipo-conta") {
        salvarTipoConta(dados);
    } else if (modalModo === "resposta-contato") {
        registrarRespostaContato(modalOrigem);
    } else {
        // Futuramente salvar mensagens, encaminhamentos, respostas e periodos premium no banco.
        mostrarAvisoAdmin("Informacao salva visualmente.");
    }

    fecharModal();
});

adminModalFechar.addEventListener("click", fecharModal);
adminModalCancelar.addEventListener("click", fecharModal);
confirmFechar.addEventListener("click", fecharConfirmacao);
confirmCancelar.addEventListener("click", fecharConfirmacao);

confirmExecutar.addEventListener("click", () => {
    if (acaoConfirmada) {
        acaoConfirmada();
    }

    fecharConfirmacao();
});

adminModal.addEventListener("click", (evento) => {
    if (evento.target === adminModal) {
        fecharModal();
    }
});

confirmModal.addEventListener("click", (evento) => {
    if (evento.target === confirmModal) {
        fecharConfirmacao();
    }
});

document.querySelectorAll(".admin-side-link").forEach((link) => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".admin-side-link").forEach((item) => {
            item.classList.remove("ativo");
        });

        link.classList.add("ativo");
    });
});

console.log("Resumo admin simulado:", adminResumoSimulado);
