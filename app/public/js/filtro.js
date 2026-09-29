document.addEventListener('filtro:aplicar', (e) => {
    const selecionadas = e.detail.valores;


    document.querySelectorAll('.livro-link').forEach((livro) => {
        const alvo = livro.closest('.livro-item') || livro;
        const disciplina = livro.querySelector('.livro-card').getAttribute('data-disciplina');
        alvo.style.display = selecionadas.length === 0 || selecionadas.includes(disciplina)
            ? 'block'
            : 'none';
    });
});
