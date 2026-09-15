// Mostrar/ocultar senha na tela de nova senha. Nao reaproveita login.js
// porque aquele arquivo assume que #email e #senha existem juntos na pagina.
function alternarSenha(idCampo) {
  const campo = document.getElementById(idCampo);
  campo.type = campo.type === "password" ? "text" : "password";
}
