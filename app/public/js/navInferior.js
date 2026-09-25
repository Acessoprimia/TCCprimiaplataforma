// Barra de navegacao inferior: marca o item da pagina atual e faz o botao
// "Menu" abrir o mesmo menu lateral do hamburguer do topo.
(function () {
    const barra = document.querySelector('.nav-inferior');
    if (!barra) return;

    const caminho = window.location.pathname.replace(/\/+$/, '') || '/';
    barra.querySelectorAll('a.nav-inferior-item').forEach((link) => {
        const destino = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, '') || '/';
        if (destino === caminho) {
            link.classList.add('ativo');
            link.setAttribute('aria-current', 'page');
        }
    });

    const botaoMenu = document.getElementById('navInferiorMenu');
    const hamburger = document.getElementById('hamburger');
    if (botaoMenu && hamburger) {
        botaoMenu.addEventListener('click', () => hamburger.click());
    }

    // O hamburguer do topo fica escondido (navInferior.css), entao o menu
    // lateral precisa de um jeito proprio de fechar.
    const menuLateral = document.getElementById('navMobile');
    if (menuLateral && hamburger) {
        const fechar = document.createElement('button');
        fechar.type = 'button';
        fechar.className = 'nav-mobile-fechar';
        fechar.setAttribute('aria-label', 'Fechar menu');
        fechar.innerHTML = '&times;';
        fechar.addEventListener('click', () => hamburger.click());
        menuLateral.appendChild(fechar);
    }
})();
