// Mostrar/ocultar senha
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    const botao = document.getElementById('btn-olhinho-' + (idCampo === 'senha' ? 'senha' : 'confirmar'));
    const icon = botao.querySelector('.olhinho-icon');
    
    if (campo.type === "password") {
        campo.type = "text";
        icon.src = "../image/olho_fechado.webp";
        icon.alt = "Ocultar Senha";
    } else {
        campo.type = "password";
        icon.src = "../image/olho_aberto.webp";
        icon.alt = "Mostrar Senha";
    }
}

// Validação do nome
function validarNome() {
    const nome = document.getElementById("nomeCompleto").value.trim();
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

// Validação do email
function validarEmail() {
    const email = document.getElementById("email").value.trim();
    const erro = document.getElementById("erro-email");
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        erro.textContent = "Campo obrigatório!";
        erro.classList.remove("correto");
        return false;
    }

    if (!regex.test(email)) {
        erro.textContent = "Digite um e-mail válido!";
        erro.classList.remove("correto");
        return false;
    }

    erro.textContent = "E-mail válido ✔";
    erro.classList.add("correto");
    return true;
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

    validarConfirmarSenha();
    return todasCorretas;
}

// Validação do confirmar senha
function validarConfirmarSenha() {
    const senha = document.getElementById("senha").value;
    const confirmar = document.getElementById("confirmarSenha").value;
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
    const dataInput = document.getElementById("dataNascimento");
    const erro = document.getElementById("erro-data");
    const valor = dataInput.value;

    if (!valor) {
        erro.textContent = "Campo obrigatório!";
        return false;
    }

    const hoje = new Date();
    const nascimento = new Date(valor);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;

    if (idade < 21) {
        erro.textContent = "Idade mínima: 21 anos";
        erro.classList.remove("correto");
        return false;
    } else if (idade > 105) {
        erro.textContent = "Idade máxima: 105 anos";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "Data válida ✔";
        erro.classList.add("correto");
        return true;
    }
}

// Validação do diploma
function validarDiploma() {
    const diploma = document.getElementById("diploma").value;
    return diploma !== "";
}

// Validação da matéria
function validarMateria() {
    const materia = document.getElementById("materia").value;
    return materia !== "";
}

// Atualizar nome do arquivo de diploma
function atualizarNomeDiploma() {
    const diplomaInput = document.getElementById("diploma");
    const nomeArquivoSpan = document.querySelector(".nome-arquivo");
    
    if (diplomaInput.files && diplomaInput.files[0]) {
        nomeArquivoSpan.textContent = diplomaInput.files[0].name;
    } else {
        nomeArquivoSpan.textContent = "Selecione um arquivo";
    }
}

// Inicialização de eventos
document.addEventListener("DOMContentLoaded", function() {
    const form = document.querySelector(".form-cadastro");
    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmarSenha");
    const nomeInput = document.getElementById("nomeCompleto");
    const emailInput = document.getElementById("email");
    const dataInput = document.getElementById("dataNascimento");
    const diplomaInput = document.getElementById("diploma");

    senhaInput.addEventListener("input", validarSenha);
    senhaInput.addEventListener("input", validarConfirmarSenha);
    confirmarInput.addEventListener("input", validarConfirmarSenha);
    nomeInput.addEventListener("input", validarNome);
    emailInput.addEventListener("input", validarEmail);
    dataInput.addEventListener("change", validarDataNascimento);
    diplomaInput.addEventListener("change", atualizarNomeDiploma);

    form.addEventListener("submit", function(e) {
        const nomeValido = validarNome();
        const emailValido = validarEmail();
        const senhaValida = validarSenha();
        const confirmarValido = validarConfirmarSenha();
        const dataValida = validarDataNascimento();
        const diplomaValido = validarDiploma();
        const materiaValida = validarMateria();

        if (!nomeValido || !emailValido || !senhaValida || !confirmarValido || !dataValida || !diplomaValido || !materiaValida) {
            e.preventDefault();
            alert("Preencha corretamente todos os campos antes de enviar!");
        }
    });
});