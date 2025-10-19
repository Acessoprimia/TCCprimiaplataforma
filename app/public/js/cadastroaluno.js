// Mostrar/ocultar senha
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    campo.type = campo.type === "password" ? "text" : "password";
}

// Validação de senha em tempo real
function validarSenha() {
    const senha = document.getElementById("senha").value;

    const regras = {
        tamanho: senha.length >= 8 && senha.length <= 15,
        maiuscula: /[A-Z]/.test(senha),
        minuscula: /[a-z]/.test(senha),
        numero: /[0-9]/.test(senha),
        especial: /[@!#$%&]/.test(senha)
    };

    for (const regra in regras) {
        const li = document.getElementById(regra);
        if (regras[regra]) {
            li.classList.add("correto");
        } else {
            li.classList.remove("correto");
        }
    }

    validarConfirmarSenha(); // chama também a validação do confirmar senha
}

// Validação do confirmar senha
function validarConfirmarSenha() {
    const senha = document.getElementById("senha").value;
    const confirmar = document.getElementById("confirmar_senha").value;
    const erro = document.getElementById("erro-confirmar");

    if (!confirmar) {
        erro.textContent = "";
        erro.classList.remove("correto");
        return;
    }

    if (senha === confirmar) {
        erro.textContent = "As senhas conferem ✔";
        erro.classList.add("correto");
    } else {
        erro.textContent = "As senhas não são iguais ✖";
        erro.classList.remove("correto");
    }
}

// Inicializa a validação ao digitar
document.addEventListener("DOMContentLoaded", function() {
    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmar_senha");

    senhaInput.addEventListener("input", validarSenha);
    confirmarInput.addEventListener("input", validarConfirmarSenha);
});