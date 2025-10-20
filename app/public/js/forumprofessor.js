// Filtro de matérias
const filtro = document.getElementById('materia-filtro');
const cards = document.querySelectorAll('.card-duvida');

filtro.addEventListener('change', (e) => {
    const selectedMateria = e.target.value;

    cards.forEach(card => {
        if (selectedMateria === '' || card.dataset.materia === selectedMateria) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});

// Modal de resposta
const modal = document.getElementById('modal-resposta');
const botoesResponder = document.querySelectorAll('.btn-responder');
const btnFecharModal = document.getElementById('btn-fechar-modal');

function abrirModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

botoesResponder.forEach(botao => {
    botao.addEventListener('click', abrirModal);
});

btnFecharModal.addEventListener('click', fecharModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        fecharModal();
    }
});