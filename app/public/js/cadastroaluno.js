// Mostrar/ocultar senha
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    campo.type = campo.type === "password" ? "text" : "password";
}

// Validação do nome
function validarNome() {
    const nome = document.getElementById("nome").value.trim();
    const erro = document.getElementById("erro-nome");
    const regex = /^[A-Za-zÀ-ú]+(\s[A-Za-zÀ-ú]+)+$/;

    if (!nome) {
        erro.textContent = "Campo obrigatório!";
        return false;
    } else if (!regex.test(nome)) {
        erro.textContent = "Digite seu nome completo (pelo menos duas palavras)";
        return false;
    } else {
        erro.textContent = "";
        return true;
    }
}

// Validação da senha
function validarSenha() {
    const senha = document.getElementById("senha").value;
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
        if (regras[regra]) {
            li.classList.add("correto");
        } else {
            li.classList.remove("correto");
            todasCorretas = false;
        }
    }

    validarConfirmarSenha(); // atualiza também o confirmar senha
    return todasCorretas;
}

// Validação do confirmar senha
function validarConfirmarSenha() {
    const senha = document.getElementById("senha").value;
    const confirmar = document.getElementById("confirmar_senha").value;
    const erro = document.getElementById("erro-confirmar");

    if (!confirmar) {
        erro.textContent = "";
        erro.classList.remove("correto");
        return false;
    }

    if (senha === confirmar) {
        erro.textContent = "As senhas conferem ✔";
        erro.classList.add("correto");
        return true;
    } else {
        erro.textContent = "As senhas não são iguais ✖";
        erro.classList.remove("correto");
        return false;
    }
}

// Validação da data de nascimento
function validarDataNascimento() {
    const dataInput = document.getElementById("data_nascimento");
    const erro = document.getElementById("erro-data");
    const valor = dataInput.value;

    if (!valor) {
        erro.textContent = "Campo obrigatório!";
        erro.classList.remove("correto");
        return false;
    }

    const hoje = new Date();
    const nascimento = new Date(valor);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;

    if (idade < 15 || idade > 19) {
        erro.textContent = "Alunos devem ter entre 15 e 19 anos";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "Data válida ✔";
        erro.classList.add("correto");
        return true;
    }
}

// Validação do RA
function validarRA() {
    const raInput = document.getElementById("ra");
    const ra = raInput.value.trim().toUpperCase().replace(/\s+/g, "");
    const erro = document.getElementById("erro-ra");
    const formatoComSeparadores = /^[0-9]{6,15}-[0-9A-Z]{1,2}\/[A-Z]{2}$/;
    const formatoSemSeparadores = /^[0-9]{7,17}[A-Z]{2}$/;

    if (!ra) {
        erro.textContent = "Campo obrigatório!";
        erro.classList.remove("correto");
        return false;
    } else if (!formatoComSeparadores.test(ra) && !formatoSemSeparadores.test(ra)) {
        erro.textContent = "RA inválido. Use o formato 000123456789-0/SP ou 0001234567890SP.";
        erro.classList.remove("correto");
        return false;
    } else {
        raInput.value = ra;
        erro.textContent = "RA válido ✔";
        erro.classList.add("correto");
        return true;
    }
}

// Inicialização de eventos
document.addEventListener("DOMContentLoaded", function() {
    const form = document.querySelector(".form-cadastro");
    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmar_senha");
    const nomeInput = document.getElementById("nome");
    const dataInput = document.getElementById("data_nascimento");
    const raInput = document.getElementById("ra");

    senhaInput.addEventListener("input", validarSenha);
    senhaInput.addEventListener("input", validarConfirmarSenha);
    confirmarInput.addEventListener("input", validarConfirmarSenha);
    nomeInput.addEventListener("input", validarNome);
    dataInput.addEventListener("input", validarDataNascimento);
    raInput.addEventListener("input", validarRA);

    form.addEventListener("submit", function(e) {
        const nomeValido = validarNome();
        const senhaValida = validarSenha();
        const confirmarValido = validarConfirmarSenha();
        const dataValida = validarDataNascimento();
        const raValido = validarRA();

        if (!nomeValido || !senhaValida || !confirmarValido || !dataValida || !raValido) {
            e.preventDefault(); // bloqueia submit
            alert("Preencha corretamente todos os campos antes de enviar!");
        }
        // Se todos os campos estiverem corretos, o form envia para /cadastro.
    });
});
