// Impede envio duplo de formularios: no primeiro envio valido os botoes de
// submit ficam desativados ("Enviando..."), entao clicar de novo com o servidor
// lento nao cria outro registro. Formularios GET e com target/nova aba ficam de fora.
(function () {
    const TEXTO_ENVIANDO = "Enviando...";

    function desativar(form, botoes) {
        botoes.forEach((botao) => {
            if (botao.dataset.textoOriginal === undefined) {
                botao.dataset.textoOriginal = botao.tagName === "INPUT" ? botao.value : botao.textContent;
            }
            botao.disabled = true;
            botao.setAttribute("aria-busy", "true");
            if (botao.tagName === "INPUT") botao.value = TEXTO_ENVIANDO;
            else botao.textContent = TEXTO_ENVIANDO;
        });
        form.dataset.enviando = "true";
    }

    function reativar(form) {
        form.querySelectorAll("[data-texto-original]").forEach((botao) => {
            botao.disabled = false;
            botao.removeAttribute("aria-busy");
            if (botao.tagName === "INPUT") botao.value = botao.dataset.textoOriginal;
            else botao.textContent = botao.dataset.textoOriginal;
            delete botao.dataset.textoOriginal;
        });
        delete form.dataset.enviando;
    }

    document.addEventListener("submit", (evento) => {
        const form = evento.target;
        if (!(form instanceof HTMLFormElement)) return;
        if ((form.method || "get").toLowerCase() !== "post") return;
        if (form.target && form.target !== "_self") return;
        if (form.hasAttribute("data-permitir-reenvio")) return;

        if (form.dataset.enviando === "true") {
            evento.preventDefault();
            return;
        }

        const botoes = Array.from(form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]'));

        // Roda depois dos outros handlers: se algum validou e cancelou o envio, nao trava.
        setTimeout(() => {
            if (evento.defaultPrevented) return;
            desativar(form, botoes);
        }, 0);
    });

    // Voltar pelo historico (bfcache) traria a pagina com o botao ainda travado.
    window.addEventListener("pageshow", (evento) => {
        if (!evento.persisted) return;
        document.querySelectorAll("form[data-enviando]").forEach(reativar);
    });
})();
