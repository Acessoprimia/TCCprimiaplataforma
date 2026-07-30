document.addEventListener('DOMContentLoaded', function () {
    const template = document.getElementById('template-pergunta-manual');
    const container = document.getElementById('perguntas-manual-container');
    const btnAdicionar = document.getElementById('btn-add-pergunta');

    if (!template || !container || !btnAdicionar) {
        return;
    }

    function renumerar() {
        const blocos = container.querySelectorAll('.pergunta-manual');

        blocos.forEach(function (bloco, indice) {
            bloco.querySelector('.pergunta-manual-numero').textContent = 'Pergunta ' + (indice + 1);
            bloco.querySelector('.campo-enunciado').name = 'perguntas[' + indice + '][enunciado]';
            bloco.querySelector('.campo-explicacao').name = 'perguntas[' + indice + '][explicacao]';

            bloco.querySelectorAll('.campo-alternativa').forEach(function (campo) {
                campo.name = 'perguntas[' + indice + '][alternativas][]';
            });

            bloco.querySelectorAll('.radio-correta').forEach(function (radio, indiceAlt) {
                radio.name = 'perguntas[' + indice + '][correta]';
                radio.value = indiceAlt;
            });
        });
    }

    function adicionarPergunta() {
        const clone = template.content.cloneNode(true);

        clone.querySelector('.btn-remover-pergunta').addEventListener('click', function (evento) {
            evento.target.closest('.pergunta-manual').remove();
            renumerar();
        });

        container.appendChild(clone);
        renumerar();
    }

    btnAdicionar.addEventListener('click', adicionarPergunta);

    // Comeca com uma pergunta ja visivel, pra nao precisar clicar antes de usar
    adicionarPergunta();
});
