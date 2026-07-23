// Funcoes e estado compartilhados entre as paginas do painel administrativo.
// Toda a persistencia aqui e simulada; a integracao com o banco entra depois.
// Cada pagina define sua propria tratarAcaoAdmin(botao) e registra handlers em adminModalHandlers.

let modalModo = "";
let modalOrigem = null;
let acaoConfirmada = null;
const adminModalHandlers = {};

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

function abrirModalVisualizacao(titulo, conteudo, origem = null) {
    abrirModal(titulo, "visualizar", campoLeitura("Informacoes", conteudo), origem);
}

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[caractere]));
}

function fecharTodosMenus() {
    document.querySelectorAll(".table-menu.aberto").forEach((menu) => menu.classList.remove("aberto"));
    document.querySelectorAll('[data-menu-toggle][aria-expanded="true"]').forEach((botao) => botao.setAttribute("aria-expanded", "false"));
}

document.addEventListener("click", (evento) => {
    const gatilhoMenu = evento.target.closest("[data-menu-toggle]");

    if (gatilhoMenu) {
        const menu = gatilhoMenu.nextElementSibling;
        const jaAberto = menu.classList.contains("aberto");
        fecharTodosMenus();

        if (!jaAberto) {
            menu.classList.add("aberto");
            gatilhoMenu.setAttribute("aria-expanded", "true");
        }

        return;
    }

    const botaoAcao = evento.target.closest("[data-admin-action]");

    if (botaoAcao && typeof tratarAcaoAdmin === "function") {
        tratarAcaoAdmin(botaoAcao);
        fecharTodosMenus();
        return;
    }

    if (!evento.target.closest(".table-menu")) {
        fecharTodosMenus();
    }
});

adminModalForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const dados = dadosFormulario();
    const handler = adminModalHandlers[modalModo];

    if (handler) {
        handler(dados);
    } else {
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
