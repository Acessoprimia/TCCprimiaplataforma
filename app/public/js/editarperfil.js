// =============================================
// MOSTRAR/OCULTAR SENHA
// =============================================
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    const olhinho = campo.parentElement.querySelector(".mostrar-senha");
    const img = olhinho.querySelector(".icone-olho");

    if (campo.type === "password") {
        campo.type = "text";
        olhinho.classList.add("aberto");
        img.src = img.src.replace("olho_fechado.png", "olho_aberto.png");
    } else {
        campo.type = "password";
        olhinho.classList.remove("aberto");
        img.src = img.src.replace("olho_aberto.png", "olho_fechado.png");
    }
}

// =============================================
// VALIDAÇÃO - EDITAR PERFIL
// =============================================

// ---------- NOME ----------
function validarNome() {
    const nome = document.getElementById("nome").value.trim();
    const erro = document.getElementById("erro-nome");
    const regex = /^[A-Za-zÀ-ú]+(\s[A-Za-zÀ-ú]+)+$/;

    if (!nome) {
        erro.textContent = "Campo obrigatório!";
        erro.classList.remove("correto");
        return false;
    } else if (!regex.test(nome)) {
        erro.textContent = "Digite seu nome completo (pelo menos duas palavras)";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "Nome válido ✔";
        erro.classList.add("correto");
        return true;
    }
}

// ---------- EMAIL ----------
function validarEmail() {
    const email = document.getElementById("email").value.trim();
    const erro = document.getElementById("erro-email");
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        erro.textContent = "Campo obrigatório!";
        erro.classList.remove("correto");
        return false;
    } else if (!regex.test(email)) {
        erro.textContent = "Digite um e-mail válido!";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "E-mail válido ✔";
        erro.classList.add("correto");
        return true;
    }
}

// ---------- SÉRIE ----------
function validarSerie() {
    const serieInput = document.getElementById("serie");

    if (!serieInput) {
        return true;
    }

    const serie = serieInput.value;
    const erro = document.getElementById("erro-serie");

    if (!serie) {
        erro.textContent = "Selecione sua série!";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "Série válida ✔";
        erro.classList.add("correto");
        return true;
    }
}

// ---------- SENHA ----------
function validarSenha() {
    const senha = document.getElementById("senha").value;

    // Se a senha estiver vazia, não valida (campo opcional no editar perfil)
    if (!senha) {
        // Limpa as regras visuais
        ["tamanho", "maiuscula", "minuscula", "numero", "especial"].forEach(id => {
            const li = document.getElementById(id);
            if (li) li.classList.remove("correto");
        });
        validarConfirmarSenha();
        return true; // senha vazia = não quer alterar, tudo bem
    }

    const regras = {
        tamanho: senha.length >= 8 && senha.length <= 15,
        maiuscula: /[A-Z]/.test(senha),
        minuscula: /[a-z]/.test(senha),
        numero: /[0-9]/.test(senha),
        especial: /[@!#$%&]/.test(senha)
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

    validarConfirmarSenha();
    return todasCorretas;
}

// ---------- CONFIRMAR SENHA ----------
function validarConfirmarSenha() {
    const senha = document.getElementById("senha").value;
    const confirmar = document.getElementById("confirmar-senha").value;
    const erro = document.getElementById("erro-confirmar");

    // Se ambas estiverem vazias, não é erro (usuário não quer trocar senha)
    if (!senha && !confirmar) {
        if (erro) erro.textContent = "";
        return true;
    }

    if (!confirmar) {
        if (erro) erro.textContent = "";
        return false;
    }

    if (senha === confirmar) {
        if (erro) {
            erro.textContent = "As senhas conferem ✔";
            erro.classList.add("correto");
        }
        return true;
    } else {
        if (erro) {
            erro.textContent = "As senhas não são iguais ✖";
            erro.classList.remove("correto");
        }
        return false;
    }
}

// ---------- PREVIEW DO AVATAR ----------
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

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".editar-perfil");
    const nomeInput = document.getElementById("nome");
    const emailInput = document.getElementById("email");
    const serieInput = document.getElementById("serie");
    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmar-senha");

    // Eventos de validação em tempo real
    if (nomeInput) nomeInput.addEventListener("input", validarNome);
    if (emailInput) emailInput.addEventListener("input", validarEmail);
    if (serieInput) serieInput.addEventListener("change", validarSerie);
    if (senhaInput) senhaInput.addEventListener("input", validarSenha);
    if (confirmarInput) confirmarInput.addEventListener("input", validarConfirmarSenha);

    // Preview do avatar
    iniciarPreviewAvatar();

    // Submit
    if (form) {
        form.addEventListener("submit", function (e) {
            const nomeValido = validarNome();
            const emailValido = validarEmail();
            const serieValida = validarSerie();
            const senhaValida = validarSenha();
            const confirmarValido = validarConfirmarSenha();

            if (!nomeValido || !emailValido || !serieValida || !senhaValida || !confirmarValido) {
                e.preventDefault();
                alert("Preencha corretamente todos os campos antes de salvar!");
            }
        });
    }
});
