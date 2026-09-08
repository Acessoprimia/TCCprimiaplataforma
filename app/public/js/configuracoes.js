// =============================================
// ABAS
// =============================================
function ativarAba(nomeAba) {
    const botoes = document.querySelectorAll(".aba-botao[data-aba-alvo]");
    const paineis = document.querySelectorAll(".config-painel[data-aba-painel]");

    let encontrou = false;

    botoes.forEach((botao) => {
        const ativo = botao.dataset.abaAlvo === nomeAba;
        botao.classList.toggle("aba-ativa", ativo);
        botao.setAttribute("aria-selected", ativo ? "true" : "false");
        if (ativo) encontrou = true;
    });

    paineis.forEach((painel) => {
        painel.hidden = painel.dataset.abaPainel !== nomeAba;
    });

    return encontrou;
}

function iniciarAbas() {
    const botoes = document.querySelectorAll(".aba-botao[data-aba-alvo]");
    const container = document.getElementById("configuracoes-app");

    if (!botoes.length || !container) return;

    botoes.forEach((botao) => {
        botao.addEventListener("click", () => {
            const nomeAba = botao.dataset.abaAlvo;
            ativarAba(nomeAba);

            const url = new URL(window.location.href);
            url.searchParams.set("aba", nomeAba);
            url.searchParams.delete("salvo");
            window.history.replaceState({}, "", url);
        });
    });

    const abaInicial = container.dataset.abaInicial || "perfil";
    if (!ativarAba(abaInicial)) {
        ativarAba("perfil");
    }
}

// =============================================
// TEMA (claro / escuro / automatico)
// =============================================
const CHAVE_TEMA = "primia-tema";

function aplicarTema(tema) {
    try {
        if (tema === "light" || tema === "dark") {
            localStorage.setItem(CHAVE_TEMA, tema);
            document.documentElement.setAttribute("data-theme", tema);
        } else {
            localStorage.removeItem(CHAVE_TEMA);
            document.documentElement.removeAttribute("data-theme");
        }
    } catch (e) {
        // localStorage indisponivel (modo privado, navegador bloqueando) -
        // o tema so nao fica salvo entre visitas, mas a troca ainda funciona.
    }

    document.querySelectorAll(".tema-botao[data-tema]").forEach((botao) => {
        const ativo = botao.dataset.tema === tema;
        botao.classList.toggle("ativo", ativo);
        botao.setAttribute("aria-checked", ativo ? "true" : "false");
    });
}

function iniciarTema() {
    const botoes = document.querySelectorAll(".tema-botao[data-tema]");
    if (!botoes.length) return;

    let temaSalvo = "auto";
    try {
        const valor = localStorage.getItem(CHAVE_TEMA);
        if (valor === "light" || valor === "dark") temaSalvo = valor;
    } catch (e) {}

    aplicarTema(temaSalvo);

    botoes.forEach((botao) => {
        botao.addEventListener("click", () => aplicarTema(botao.dataset.tema));
    });
}

// =============================================
// TAMANHO DA FONTE (padrao / grande / extra)
// =============================================
const CHAVE_FONTE = "primia-fonte";

function aplicarFonte(fonte) {
    try {
        if (fonte === "grande" || fonte === "extra") {
            localStorage.setItem(CHAVE_FONTE, fonte);
            document.documentElement.setAttribute("data-fonte", fonte);
        } else {
            localStorage.removeItem(CHAVE_FONTE);
            document.documentElement.removeAttribute("data-fonte");
        }
    } catch (e) {
        // localStorage indisponivel - a troca ainda funciona, so nao fica salva.
    }

    document.querySelectorAll(".fonte-botao[data-fonte]").forEach((botao) => {
        const ativo = botao.dataset.fonte === fonte;
        botao.classList.toggle("ativo", ativo);
        botao.setAttribute("aria-checked", ativo ? "true" : "false");
    });
}

function iniciarFonte() {
    const botoes = document.querySelectorAll(".fonte-botao[data-fonte]");
    if (!botoes.length) return;

    let fonteSalva = "padrao";
    try {
        const valor = localStorage.getItem(CHAVE_FONTE);
        if (valor === "grande" || valor === "extra") fonteSalva = valor;
    } catch (e) {}

    aplicarFonte(fonteSalva);

    botoes.forEach((botao) => {
        botao.addEventListener("click", () => aplicarFonte(botao.dataset.fonte));
    });
}

// =============================================
// MOSTRAR/OCULTAR SENHA
// =============================================
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    if (!campo) return;
    const olhinho = campo.parentElement.querySelector(".mostrar-senha");
    const img = olhinho.querySelector(".icone-olho");

    if (campo.type === "password") {
        campo.type = "text";
        olhinho.classList.add("aberto");
        img.src = img.src.replace("olho_fechado.webp", "olho_aberto.webp");
    } else {
        campo.type = "password";
        olhinho.classList.remove("aberto");
        img.src = img.src.replace("olho_aberto.webp", "olho_fechado.webp");
    }
}

// =============================================
// VALIDAÇÃO - ABA PERFIL
// =============================================
function validarNome() {
    const campo = document.getElementById("nome");
    if (!campo) return true;
    const nome = campo.value.trim();
    const erro = document.getElementById("erro-nome");
    const regex = /^[A-Za-zÀ-ú]+(\s[A-Za-zÀ-ú]+)+$/;

    if (!nome) {
        if (erro) { erro.textContent = "Campo obrigatório!"; erro.classList.remove("correto"); }
        return false;
    } else if (!regex.test(nome)) {
        if (erro) { erro.textContent = "Digite seu nome completo (pelo menos duas palavras)"; erro.classList.remove("correto"); }
        return false;
    } else {
        if (erro) { erro.textContent = "Nome válido ✔"; erro.classList.add("correto"); }
        return true;
    }
}

function validarEmail() {
    const campo = document.getElementById("email");
    if (!campo) return true;
    const email = campo.value.trim();
    const erro = document.getElementById("erro-email");
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        if (erro) { erro.textContent = "Campo obrigatório!"; erro.classList.remove("correto"); }
        return false;
    } else if (!regex.test(email)) {
        if (erro) { erro.textContent = "Digite um e-mail válido!"; erro.classList.remove("correto"); }
        return false;
    } else {
        if (erro) { erro.textContent = "E-mail válido ✔"; erro.classList.add("correto"); }
        return true;
    }
}

function validarSerie() {
    const serieInput = document.getElementById("serie");
    if (!serieInput) return true;

    const serie = serieInput.value;
    const erro = document.getElementById("erro-serie");

    if (!serie) {
        if (erro) { erro.textContent = "Selecione sua série!"; erro.classList.remove("correto"); }
        return false;
    } else {
        if (erro) { erro.textContent = "Série válida ✔"; erro.classList.add("correto"); }
        return true;
    }
}

function iniciarPreviewAvatar() {
    const input = document.getElementById("avatar-upload");
    const preview = document.getElementById("preview-avatar");

    if (input && preview) {
        input.addEventListener("change", function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    preview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function iniciarFormularioPerfil() {
    const form = document.getElementById("form-perfil");
    if (!form) return;

    const nomeInput = document.getElementById("nome");
    const emailInput = document.getElementById("email");
    const serieInput = document.getElementById("serie");

    if (nomeInput) nomeInput.addEventListener("input", validarNome);
    if (emailInput) emailInput.addEventListener("input", validarEmail);
    if (serieInput) serieInput.addEventListener("change", validarSerie);

    iniciarPreviewAvatar();

    form.addEventListener("submit", function (e) {
        const nomeValido = validarNome();
        const emailValido = validarEmail();
        const serieValida = validarSerie();

        if (!nomeValido || !emailValido || !serieValida) {
            e.preventDefault();
            alert("Preencha corretamente todos os campos antes de salvar!");
        }
    });
}

// =============================================
// VALIDAÇÃO - ABA SEGURANÇA (senha)
// =============================================
function validarSenhaNova() {
    const campo = document.getElementById("senha");
    if (!campo) return true;
    const senha = campo.value;

    const regras = {
        tamanho: senha.length >= 8 && senha.length <= 15,
        maiuscula: /[A-Z]/.test(senha),
        minuscula: /[a-z]/.test(senha),
        numero: /[0-9]/.test(senha),
        especial: /[@!#$%&]/.test(senha),
    };

    let todasCorretas = true;
    for (const regra in regras) {
        const li = document.getElementById(regra);
        if (li) {
            if (regras[regra]) {
                li.classList.add("correto");
            } else {
                li.classList.remove("correto");
                todasCorretas = false;
            }
        }
    }

    validarConfirmarSenhaNova();
    return todasCorretas;
}

function validarConfirmarSenhaNova() {
    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmar-senha");
    if (!senhaInput || !confirmarInput) return true;

    const senha = senhaInput.value;
    const confirmar = confirmarInput.value;
    const erro = document.getElementById("erro-confirmar");

    if (!confirmar) {
        if (erro) erro.textContent = "";
        return false;
    }

    if (senha === confirmar) {
        if (erro) { erro.textContent = "As senhas conferem ✔"; erro.classList.add("correto"); }
        return true;
    } else {
        if (erro) { erro.textContent = "As senhas não são iguais ✖"; erro.classList.remove("correto"); }
        return false;
    }
}

function iniciarFormularioSenha() {
    const form = document.getElementById("form-senha");
    if (!form) return;

    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmar-senha");

    if (senhaInput) senhaInput.addEventListener("input", validarSenhaNova);
    if (confirmarInput) confirmarInput.addEventListener("input", validarConfirmarSenhaNova);

    form.addEventListener("submit", function (e) {
        const senhaValida = validarSenhaNova();
        const confirmarValido = validarConfirmarSenhaNova();

        if (!senhaValida || !confirmarValido) {
            e.preventDefault();
            alert("Preencha corretamente a nova senha antes de salvar!");
        }
    });
}

// =============================================
// ZONA DE RISCO (desativar / excluir conta)
// =============================================
function iniciarZonaDeRisco() {
    const formDesativar = document.getElementById("form-desativar-conta");
    const formExcluir = document.getElementById("form-excluir-conta");

    if (formDesativar) {
        formDesativar.addEventListener("submit", function (e) {
            const confirmou = confirm("Tem certeza que deseja desativar sua conta? Você poderá pedir a reativação falando com o suporte.");
            if (!confirmou) e.preventDefault();
        });
    }

    if (formExcluir) {
        formExcluir.addEventListener("submit", function (e) {
            const confirmou = confirm("Tem certeza que deseja EXCLUIR sua conta? Essa ação não pode ser desfeita.");
            if (!confirmou) e.preventDefault();
        });
    }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener("DOMContentLoaded", function () {
    iniciarAbas();
    iniciarFormularioPerfil();
    iniciarFormularioSenha();
    iniciarZonaDeRisco();
    iniciarTema();
    iniciarFonte();
});
