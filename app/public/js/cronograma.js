// Filtro de matérias
const filter = document.getElementById('materia-filter');
const cards = document.querySelectorAll('article');

filter.addEventListener('change', (e) => {
    const selectedMateria = e.target.value;

    cards.forEach(card => {
        if (selectedMateria === '' || card.dataset.materia === selectedMateria) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});

// Modal de imagem ampliada
const modal = document.getElementById('modal');
const modalImage = document.getElementById('modal-image');
const modalClose = document.querySelector('.modal-close');
const cardButtons = document.querySelectorAll('.card-button');

cardButtons.forEach(button => {
    button.addEventListener('click', () => {
        const imageSrc = button.dataset.image;
        const fullPath = '/image/' + imageSrc; // Caminho absoluto
        console.log('Tentando abrir imagem:', fullPath);
        modalImage.src = fullPath;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

modalClose.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
});