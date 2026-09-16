// Elementos do DOM
const openFilter = document.getElementById('openFilter');
const closeModal = document.getElementById('closeModal');
const modalOverlay = document.getElementById('modalOverlay');
const buscarBtn = document.getElementById('buscarBtn');
const livrosGrid = document.getElementById('livrosGrid');

// Abrir modal
openFilter.addEventListener('click', () => {
    modalOverlay.classList.add('active');
});

// Fechar modal pelo X
closeModal.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

// Fechar modal clicando fora
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
    }
});

// Filtrar livros
buscarBtn.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.disciplina-item input[type="checkbox"]');
    const selectedDisciplinas = [];
    
    // Coletar disciplinas selecionadas
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedDisciplinas.push(checkbox.value);
        }
    });

    const livros = document.querySelectorAll('.livro-link');

    // Na biblioteca do professor cada livro vem embrulhado num .livro-item
    // (link + botao de excluir). Esconder so o link deixaria o botao orfao
    // na tela, entao esconde o wrapper quando ele existe.
    const alvoDoFiltro = livro => livro.closest('.livro-item') || livro;

    if (selectedDisciplinas.length === 0) {
        // Se nenhum filtro selecionado, mostra todos os livros
        livros.forEach(livro => {
            alvoDoFiltro(livro).style.display = 'block';
        });
    } else {
        // Filtra por disciplinas selecionadas
        livros.forEach(livro => {
            const card = livro.querySelector('.livro-card');
            const disciplina = card.getAttribute('data-disciplina');
            alvoDoFiltro(livro).style.display = selectedDisciplinas.includes(disciplina)
                ? 'block'
                : 'none';
        });
    }

    // Fechar modal após buscar
    modalOverlay.classList.remove('active');
});