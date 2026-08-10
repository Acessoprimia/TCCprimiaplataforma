document.addEventListener('DOMContentLoaded', function () {
    const template = document.getElementById('template-evento-manual');
    const container = document.getElementById('eventos-manual-container');
    const btnAdicionar = document.getElementById('btn-add-evento');

    if (!template || !container || !btnAdicionar) {
        return;
    }

    function renumerar() {
        const blocos = container.querySelectorAll('.pergunta-manual');

        blocos.forEach(function (bloco, indice) {
            bloco.querySelector('.pergunta-manual-numero').textContent = 'Evento ' + (indice + 1);
            bloco.querySelector('.campo-titulo-evento').name = 'eventos[' + indice + '][titulo]';
            bloco.querySelector('.campo-descricao-evento').name = 'eventos[' + indice + '][descricao]';
            bloco.querySelector('.campo-data-evento').name = 'eventos[' + indice + '][data]';
            bloco.querySelector('.campo-hora-inicio-evento').name = 'eventos[' + indice + '][hora_inicio]';
            bloco.querySelector('.campo-hora-fim-evento').name = 'eventos[' + indice + '][hora_fim]';
        });
    }

    function adicionarEvento() {
        const clone = template.content.cloneNode(true);

        clone.querySelector('.btn-remover-pergunta').addEventListener('click', function (evento) {
            evento.target.closest('.pergunta-manual').remove();
            renumerar();
        });

        container.appendChild(clone);
        renumerar();
    }

    btnAdicionar.addEventListener('click', adicionarEvento);

    // Comeca com um evento ja visivel, pra nao precisar clicar antes de usar
    adicionarEvento();
});
