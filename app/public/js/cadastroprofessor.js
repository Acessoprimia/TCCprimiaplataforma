// cadastroprofessor.js - validações completas e submit controlado

// Mostrar/ocultar senha
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    if (campo) {
        campo.type = campo.type === "password" ? "text" : "password";
    }
}

// Validação do nome completo
function validarNomeCompleto() {
    const nomeCompleto = document.getElementById("nome_completo").value.trim();
    const erro = document.getElementById("erro-nome-completo");
    const regex = /^[A-Za-zÀ-ú]+(\s[A-Za-zÀ-ú]+)+$/;

    if (!nomeCompleto) {
        erro.textContent = "Campo obrigatório!";
        return false;
    } else if (!regex.test(nomeCompleto)) {
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
    const regex = /^\S+@\S+\.\S+$/;

    if (!email) {
        erro.textContent = "Campo obrigatório!";
        return false;
    } else if (!regex.test(email)) {
        erro.textContent = "Digite um e-mail válido!";
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
        if (li) {
            if (regras[regra]) {
                li.classList.add("correto");
            } else {
                li.classList.remove("correto");
                todasCorretas = false;
            }
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

    if (idade < 21) { // Professores devem ter 21 anos ou mais
        erro.textContent = "Apenas professores com 21 anos ou mais podem se cadastrar.";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "Data válida ✔";
        erro.classList.add("correto");
        return true;
    }
}

// Validação do Diploma
function validarDiploma() {
    const diplomaInput = document.getElementById("diploma");
    const erro = document.getElementById("erro-diploma");
    const file = diplomaInput.files && diplomaInput.files[0];

    if (!file) {
        erro.textContent = "É necessário enviar um diploma.";
        erro.classList.remove("correto");
        return false;
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
        erro.textContent = "Formato inválido (PDF, PNG, JPG).";
        erro.classList.remove("correto");
        return false;
    }

    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
        erro.textContent = `Arquivo muito grande (máx ${maxSizeMB}MB).`;
        erro.classList.remove("correto");
        return false;
    }

    erro.textContent = "Diploma válido ✔";
    erro.classList.add("correto");
    return true;
}

// Validação da Matéria
function validarMateria() {
    const materia = document.getElementById("materia").value;
    const erro = document.getElementById("erro-materia");

    if (!materia) {
        erro.textContent = "Selecione uma matéria!";
        erro.classList.remove("correto");
        return false;
    } else {
        erro.textContent = "Matéria selecionada ✔";
        erro.classList.add("correto");
        return true;
    }
}

// Inicialização de eventos
document.addEventListener("DOMContentLoaded", function() {
    const form = document.querySelector(".form-cadastro");
    const nomeCompletoInput = document.getElementById("nome_completo");
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");
    const confirmarInput = document.getElementById("confirmar_senha");
    const dataInput = document.getElementById("data_nascimento");
    const diplomaInput = document.getElementById("diploma");
    const materiaInput = document.getElementById("materia");

    if (nomeCompletoInput) nomeCompletoInput.addEventListener("input", validarNomeCompleto);
    if (emailInput) emailInput.addEventListener("input", validarEmail);
    if (senhaInput) senhaInput.addEventListener("input", validarSenha);
    if (confirmarInput) confirmarInput.addEventListener("input", validarConfirmarSenha);
    if (dataInput) dataInput.addEventListener("input", validarDataNascimento);
    if (diplomaInput) diplomaInput.addEventListener("change", validarDiploma);
    if (materiaInput) materiaInput.addEventListener("change", validarMateria);

    if (form) {
        form.addEventListener("submit", function(e) {
            const nomeCompletoValido = validarNomeCompleto();
            const emailValido = validarEmail();
            const senhaValida = validarSenha();
            const confirmarValido = validarConfirmarSenha();
            const dataValida = validarDataNascimento();
            const diplomaValido = validarDiploma();
            const materiaValida = validarMateria();

            if (!nomeCompletoValido || !emailValido || !senhaValida || !confirmarValido || !dataValida || !diplomaValido || !materiaValida) {
                e.preventDefault(); // bloqueia submit
                alert("Preencha corretamente todos os campos antes de enviar!");
            }
        });
    }
});
