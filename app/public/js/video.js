const cards = document.querySelectorAll('article');

document.addEventListener('filtro:aplicar', (e) => {
    const selecionadas = e.detail.valores;

    cards.forEach(card => {
        card.style.display = selecionadas.length === 0 || selecionadas.includes(card.dataset.materia)
            ? 'block'
            : 'none';
    });
});
