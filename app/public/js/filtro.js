// Filtro da biblioteca (aluno e professor): reage ao evento do filtro
// padrao (js/filtroPadrao.js) e esconde os livros de outras disciplinas.
document.addEventListener('filtro:aplicar', (e) => {
    const selecionadas = e.detail.valores;

    // Na biblioteca do professor cada livro vem embrulhado num .livro-item
    // (link + botao de excluir). Esconder so o link deixaria o botao orfao
    // na tela, entao esconde o wrapper quando ele existe.
    document.querySelectorAll('.livro-link').forEach((livro) => {
        const alvo = livro.closest('.livro-item') || livro;
        const disciplina = livro.querySelector('.livro-card').getAttribute('data-disciplina');
        alvo.style.display = selecionadas.length === 0 || selecionadas.includes(disciplina)
            ? 'block'
            : 'none';
    });
});
