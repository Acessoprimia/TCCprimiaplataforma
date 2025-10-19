function mostrarSenha(id) {
  const campo = document.getElementById(id);
  campo.type = campo.type === "password" ? "text" : "password";
}

document.getElementById("formProfessor").addEventListener("submit", (e) => {
  e.preventDefault();

  const nome = document.getElementById("nome");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");
  const confirmar = document.getElementById("confirmarSenha");
  const data = document.getElementById("dataNascimento");
  const diploma = document.getElementById("diploma");
  const materia = document.getElementById("materia");

  let valido = true;

  // limpar mensagens
  document.querySelectorAll("small").forEach(el => el.textContent = "");

  // Nome completo
  if (nome.value.trim().split(" ").length < 2) {
    setErro(nome, "Digite seu nome completo");
    valido = false;
  }

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    setErro(email, "Digite um email válido");
    valido = false;
  }

  // Senha
  const senhaRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@!#$%&]).{8,15}$/;
  if (!senhaRegex.test(senha.value)) {
    setErro(senha, "Senha inválida (8-15 caracteres, com maiúscula, minúscula, número e símbolo)");
    valido = false;
  }

  // Confirmar senha
  if (senha.value !== confirmar.value) {
    setErro(confirmar, "As senhas não são iguais");
    valido = false;
  }

  // Data de nascimento (mínimo 21 anos)
  const nascimento = new Date(data.value);
  const hoje = new Date();
  const idade = hoje.getFullYear() - nascimento.getFullYear();
  if (idade < 21) {
    setErro(data, "Professor deve ter pelo menos 21 anos");
    valido = false;
  }

  // Diploma
  if (diploma.files.length === 0) {
    setErro(diploma, "Envie um arquivo do diploma");
    valido = false;
  }

  // Matéria
  if (!materia.value) {
    setErro(materia, "Selecione uma matéria");
    valido = false;
  }

  if (valido) {
    e.target.submit();
  }
});

function setErro(input, mensagem) {
  const campo = input.closest(".campo");
  campo.querySelector("small").textContent = mensagem;
}
