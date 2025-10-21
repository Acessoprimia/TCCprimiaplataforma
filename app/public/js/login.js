// Mostrar/ocultar senha
function toggleSenha(idCampo) {
  const campo = document.getElementById(idCampo);
  campo.type = campo.type === "password" ? "text" : "password";
}

// Validação do email
function validarEmail() {
  const email = document.getElementById("email").value.trim();
  const erro = document.getElementById("erro-email");
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const erro = document.getElementById("erro-senha");

  if (!senha) {
    erro.textContent = "Campo obrigatório!";
    return false;
  } else if (senha.length < 6) {
    erro.textContent = "A senha deve ter pelo menos 6 caracteres!";
    return false;
  } else {
    erro.textContent = "";
    return true;
  }
}

// Envio do formulário
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".form-login");

  form.addEventListener("submit", (e) => {
    e.preventDefault(); // evita envio imediato

    const emailValido = validarEmail();
    const senhaValida = validarSenha();

    if (!emailValido || !senhaValida) return;

    const email = document.getElementById("email").value.trim();

    // Detecta professor ou aluno
    if (email.includes("prof") || email.includes("teacher")) {
      window.location.href = "/entradaprofessor";
    } else {
      window.location.href = "/entrada";
    }
  });
});
