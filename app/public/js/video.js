const cards = document.querySelectorAll('article');

document.addEventListener('filtro:aplicar', (e) => {
    const selecionadas = e.detail.valores;

    // O cartao fica dentro de um <li>: e o item da lista que some.
    cards.forEach(card => {
        (card.closest('li') || card).style.display = selecionadas.length === 0 || selecionadas.includes(card.dataset.materia)
            ? ''
            : 'none';
    });
});
