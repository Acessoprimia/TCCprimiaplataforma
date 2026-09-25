// Popover de Aparencia (tema + fonte) pra visitante deslogado - aberto pelo
// icone no header (desktop) ou pelo item "Aparencia" dentro do menu
// hamburguer (mobile), os dois controlando o mesmo painel. Mesma logica e
// mesmas chaves de localStorage da aba Aparencia em /configuracoes (ver
// public/js/configuracoes.js).

const aparenciaFlutuantePainel = document.getElementById("aparenciaFlutuantePainel");
const aparenciaFlutuanteFechar = document.getElementById("aparenciaFlutuanteFechar");
// Cada header (header.ejs, hdeslogado.ejs) declara o seu - so os que
// existirem na pagina atual entram na lista.
const aparenciaFlutuanteGatilhos = [
    document.getElementById("aparenciaFlutuanteBtn"),
    document.getElementById("aparenciaFlutuanteBtnMobile"),
].filter(Boolean);

function abrirAparenciaFlutuante() {
    aparenciaFlutuantePainel.hidden = false;
    aparenciaFlutuanteGatilhos.forEach((botao) => botao.setAttribute("aria-expanded", "true"));

    // Se veio do item do menu hamburguer, fecha o menu pra nao competir
    // com o popover na tela. toggleMenu() e global (hamburguer.js carrega
    // antes deste script).
    if (
        typeof navMobile !== "undefined" &&
        navMobile?.classList.contains("active") &&
        typeof toggleMenu === "function"
    ) {
        toggleMenu();
    }
}

function fecharAparenciaFlutuante() {
    aparenciaFlutuantePainel.hidden = true;
    aparenciaFlutuanteGatilhos.forEach((botao) => botao.setAttribute("aria-expanded", "false"));
}

aparenciaFlutuanteGatilhos.forEach((botao) => {
    botao.addEventListener("click", () => {
        if (aparenciaFlutuantePainel.hidden) {
            abrirAparenciaFlutuante();
        } else {
            fecharAparenciaFlutuante();
        }
    });
});

aparenciaFlutuanteFechar.addEventListener("click", fecharAparenciaFlutuante);

document.addEventListener("click", (evento) => {
    if (aparenciaFlutuantePainel.hidden) return;
    if (aparenciaFlutuantePainel.contains(evento.target)) return;
    if (aparenciaFlutuanteGatilhos.some((botao) => botao.contains(evento.target))) return;
    fecharAparenciaFlutuante();
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !aparenciaFlutuantePainel.hidden) {
        fecharAparenciaFlutuante();
        aparenciaFlutuanteGatilhos[0]?.focus();
    }
});

// =============================================
// TEMA (claro / escuro / automatico)
// =============================================
const CHAVE_TEMA_FLUTUANTE = "primia-tema";

function aplicarTemaFlutuante(tema) {
    try {
        if (tema === "light" || tema === "dark") {
            localStorage.setItem(CHAVE_TEMA_FLUTUANTE, tema);
            document.documentElement.setAttribute("data-theme", tema);
        } else {
            localStorage.removeItem(CHAVE_TEMA_FLUTUANTE);
            document.documentElement.removeAttribute("data-theme");
        }
    } catch (e) {
        // localStorage indisponivel (modo privado, navegador bloqueando) -
        // o tema so nao fica salvo entre visitas, mas a troca ainda funciona.
    }

    document.querySelectorAll(".tema-botao[data-tema]").forEach((botao) => {
        const ativo = botao.dataset.tema === tema;
        botao.classList.toggle("ativo", ativo);
        botao.setAttribute("aria-checked", ativo ? "true" : "false");
    });
}

function iniciarTemaFlutuante() {
    let temaSalvo = "auto";
    try {
        const valor = localStorage.getItem(CHAVE_TEMA_FLUTUANTE);
        if (valor === "light" || valor === "dark") temaSalvo = valor;
    } catch (e) {}

    aplicarTemaFlutuante(temaSalvo);

    document.querySelectorAll(".tema-botao[data-tema]").forEach((botao) => {
        botao.addEventListener("click", () => aplicarTemaFlutuante(botao.dataset.tema));
    });
}

// =============================================
// TAMANHO DA FONTE (padrao / grande / extra)
// =============================================
const CHAVE_FONTE_FLUTUANTE = "primia-fonte";

function aplicarFonteFlutuante(fonte) {
    try {
        if (fonte === "grande" || fonte === "extra") {
            localStorage.setItem(CHAVE_FONTE_FLUTUANTE, fonte);
            document.documentElement.setAttribute("data-fonte", fonte);
        } else {
            localStorage.removeItem(CHAVE_FONTE_FLUTUANTE);
            document.documentElement.removeAttribute("data-fonte");
        }
    } catch (e) {
        // localStorage indisponivel - a troca ainda funciona, so nao fica salva.
    }

    document.querySelectorAll(".fonte-botao[data-fonte]").forEach((botao) => {
        const ativo = botao.dataset.fonte === fonte;
        botao.classList.toggle("ativo", ativo);
        botao.setAttribute("aria-checked", ativo ? "true" : "false");
    });
}

function iniciarFonteFlutuante() {
    let fonteSalva = "padrao";
    try {
        const valor = localStorage.getItem(CHAVE_FONTE_FLUTUANTE);
        if (valor === "grande" || valor === "extra") fonteSalva = valor;
    } catch (e) {}

    aplicarFonteFlutuante(fonteSalva);

    document.querySelectorAll(".fonte-botao[data-fonte]").forEach((botao) => {
        botao.addEventListener("click", () => aplicarFonteFlutuante(botao.dataset.fonte));
    });
}

iniciarTemaFlutuante();
iniciarFonteFlutuante();
