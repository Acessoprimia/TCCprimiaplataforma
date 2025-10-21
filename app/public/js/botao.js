// Modal Flutuante - Aguarda o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    const modalFlutuante = document.getElementById('modal-flutuante');
    const btnAddFlutuante = document.getElementById('btn-add-flutuante');
    const btnFecharFlutuante = document.getElementById('btn-fechar-flutuante');

    function abrirModalFlutuante() {
        if (modalFlutuante) {
            modalFlutuante.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function fecharModalFlutuante() {
        if (modalFlutuante) {
            modalFlutuante.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    if (btnAddFlutuante) {
        btnAddFlutuante.addEventListener('click', abrirModalFlutuante);
    }

    if (btnFecharFlutuante) {
        btnFecharFlutuante.addEventListener('click', fecharModalFlutuante);
    }

    if (modalFlutuante) {
        modalFlutuante.addEventListener('click', (e) => {
            if (e.target === modalFlutuante) {
                fecharModalFlutuante();
            }
        });
    }
});