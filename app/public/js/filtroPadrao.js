// Comportamento do filtro padrao (partials/filtroPadrao.ejs): abre/fecha o
// modal e, no "Buscar", avisa a pagina com o evento "filtro:aplicar".
(function () {
    const abrir = document.getElementById('openFilter');
    const fechar = document.getElementById('closeModal');
    const overlay = document.getElementById('modalOverlay');
    const buscar = document.getElementById('buscarBtn');
    if (!abrir || !overlay) return;

    const fecharModal = () => overlay.classList.remove('active');

    abrir.addEventListener('click', () => overlay.classList.add('active'));
    fechar.addEventListener('click', fecharModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fecharModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharModal();
    });

    buscar.addEventListener('click', () => {
        const valores = Array.from(overlay.querySelectorAll('input[type="checkbox"]:checked'))
            .map((c) => c.value);
        document.dispatchEvent(new CustomEvent('filtro:aplicar', { detail: { valores } }));
        fecharModal();
    });
})();
