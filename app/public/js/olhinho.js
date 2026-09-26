// Mostrar/ocultar senha. Compartilhado por todas as telas com campo de senha:
// o botao .mostrar-senha fica no mesmo .campo-wrapper do input.
function toggleSenha(idCampo) {
    const campo = document.getElementById(idCampo);
    if (!campo) return;
    const olhinho = campo.parentElement.querySelector(".mostrar-senha");
    const img = olhinho && olhinho.querySelector(".icone-olho");
    const mostrar = campo.type === "password";

    campo.type = mostrar ? "text" : "password";
    if (!olhinho) return;
    olhinho.classList.toggle("aberto", mostrar);
    if (img) {
        img.src = img.src.replace(
            mostrar ? "olho_fechado.webp" : "olho_aberto.webp",
            mostrar ? "olho_aberto.webp" : "olho_fechado.webp"
        );
    }
}
