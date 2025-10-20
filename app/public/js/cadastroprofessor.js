// cadastroprofessor.js - validações completas e submit controlado

// helpers
const $ = id => document.getElementById(id);

// Mostrar/ocultar senha (olhinho)
document.querySelectorAll(".toggleSenha").forEach(icon => {
  icon.addEventListener("click", () => {
    const targetId = icon.getAttribute("data-target");
    const input = $(targetId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    icon.classList.toggle("fa-eye-slash");
  });
});

// ----- validações individuais (mantendo mensagens estilo aluno) -----

function validarNome() {
  const el = $("nomeCompleto");
  const err = $("erro-nome");
  const v = el.value.trim();
  const re = /^[A-Za-zÀ-ú]+(\s[A-Za-zÀ-ú]+)+$/;
  if (!v) { err.textContent = "Campo obrigatório!"; return false; }
  if (!re.test(v)) { err.textContent = "Digite seu nome completo (pelo menos duas palavras)"; return false; }
  err.textContent = "";
  return true;
}

function validarEmail() {
  const el = $("email");
  // se quiser mensagem visual similar, crie um small com id erro-email no HTML
  // aqui só vamos bloquear envio se inválido
  const v = el.value.trim();
  const re = /^\S+@\S+\.\S+$/;
  if (!v) return false;
  return re.test(v);
}

function validarSenhaRegras() {
  const el = $("senha");
  const val = el.value;
  const cond = {
    tamanho: val.length >= 8 && val.length <= 15,
    maiuscula: /[A-Z]/.test(val),
    minuscula: /[a-z]/.test(val),
    numero: /[0-9]/.test(val),
    especial: /[@!#$%&]/.test(val)
  };
  // atualiza visual das li (assume que cada li tem ids: tamanho, maiuscula, minuscula, numero, especial)
  Object.keys(cond).forEach(k => {
    const li = $(k);
    if (!li) return;
    li.classList.toggle("valid", cond[k]);
    li.classList.toggle("invalid", !cond[k]);
  });
  return Object.values(cond).every(v => v);
}

function validarConfirmacao() {
  const s = $("senha").value;
  const c = $("confirmarSenha").value;
  const err = $("erro-confirmar");
  if (!c) { err.textContent = ""; return false; }
  if (s === c) { err.textContent = "As senhas conferem ✔"; err.style.color = "green"; return true; }
  err.textContent = "As senhas não conferem ✖"; err.style.color = "red"; return false;
}

function validarData() {
  const el = $("dataNascimento");
  const err = $("erro-data");
  const val = el.value;
  if (!val) { if (err) { err.textContent = "Campo obrigatório!"; } return false; }
  const hoje = new Date();
  const nasc = new Date(val);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  if (idade < 21) {
    if (err) { err.textContent = "Apenas professores com 21 anos ou mais podem se cadastrar."; err.style.color = "red"; }
    return false;
  }
  if (err) { err.textContent = ""; }
  return true;
}

function validarDiploma() {
  const inp = $("diploma");
  const err = $("erro-diploma");
  if (!inp) return false;
  const file = inp.files && inp.files[0];
  if (!file) {
    if (err) { err.textContent = "É necessário enviar um diploma."; err.style.color = "red"; }
    return false;
  }
  const allowed = ["application/pdf","image/png","image/jpeg"];
  if (!allowed.includes(file.type)) {
    if (err) { err.textContent = "Formato inválido (PDF, PNG, JPG)."; err.style.color = "red"; }
    return false;
  }
  // opcional: tamanho máximo 5MB
  const maxMB = 5;
  if (file.size > maxMB * 1024 * 1024) {
    if (err) { err.textContent = `Arquivo muito grande (máx ${maxMB}MB).`; err.style.color = "red"; }
    return false;
  }
  if (err) { err.textContent = ""; }
  return true;
}

function validarMateria() {
  const el = $("materia");
  const err = $("erro-materia");
  if (!el || !el.value) {
    if (err) { err.textContent = "Selecione uma matéria!"; }
    return false;
  }
  if (err) { err.textContent = ""; }
  return true;
}

// ----- real-time listeners -----
document.addEventListener("DOMContentLoaded", () => {
  if ($("nomeCompleto")) $("nomeCompleto").addEventListener("input", validarNome);
  if ($("email")) $("email").addEventListener("input", () => { /* optional visual */ });
  if ($("senha")) {
    $("senha").addEventListener("input", () => {
      validarSenhaRegras();
      validarConfirmacao(); // revalida confirmação quando senha muda
    });
  }
  if ($("confirmarSenha")) $("confirmarSenha").addEventListener("input", validarConfirmacao);
  if ($("dataNascimento")) $("dataNascimento").addEventListener("change", validarData);
  if ($("diploma")) $("diploma").addEventListener("change", validarDiploma);
  if ($("materia")) $("materia").addEventListener("change", validarMateria);

  // ----- submit handler que impede envio até tudo ok -----
  const form = document.getElementById("cadastroProfessorForm");
  if (!form) return;

  form.addEventListener("submit", function(e) {
    e.preventDefault(); // sempre previne por padrão; só submete manualmente se OK

    const nomeOk = validarNome();
    const emailOk = validarEmail();
    const senhaOk = validarSenhaRegras();
    const confirmarOk = validarConfirmacao();
    const dataOk = validarData();
    const diplomaOk = validarDiploma();
    const materiaOk = validarMateria();

    const tudoOk = nomeOk && emailOk && senhaOk && confirmarOk && dataOk && diplomaOk && materiaOk;

    if (!tudoOk) {
      // foca no primeiro campo com erro
      if (!nomeOk) { $("nomeCompleto").focus(); return; }
      if (!emailOk) { $("email").focus(); return; }
      if (!senhaOk) { $("senha").focus(); return; }
      if (!confirmarOk) { $("confirmarSenha").focus(); return; }
      if (!dataOk) { $("dataNascimento").focus(); return; }
      if (!diplomaOk) { $("diploma").focus(); return; }
      if (!materiaOk) { $("materia").focus(); return; }
      return;
    }

    // tudo certo: submete de verdade
    form.submit();
  });
});
