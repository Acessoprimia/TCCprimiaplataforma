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

    // Botao "Gerar sinopse com IA"
    const formFlutuante = document.getElementById('form-flutuante');
    const btnGerarSinopse = document.getElementById('btn-gerar-sinopse-ia');
    const campoSinopse = document.getElementById('campo-sinopse');
    const statusSinopse = document.getElementById('status-sinopse-ia');

    if (btnGerarSinopse && formFlutuante) {
        btnGerarSinopse.addEventListener('click', async function () {
            const titulo = formFlutuante.querySelector('[name="titulo"]').value.trim();
            const autor = formFlutuante.querySelector('[name="autor"]')?.value.trim() || '';
            const materiaId = formFlutuante.querySelector('[name="materia_id"]').value;
            const tipo = formFlutuante.querySelector('[name="tipo"]').value;

            if (!titulo) {
                statusSinopse.textContent = 'Preencha o titulo antes de gerar a sinopse.';
                return;
            }

            const dados = new FormData();
            dados.append('titulo', titulo);
            dados.append('autor', autor);
            dados.append('materia_id', materiaId);
            dados.append('tipo', tipo);

            if (tipo === 'video') {
                const urlVideo = formFlutuante.querySelector('[name="url_video"]')?.value.trim();
                if (!urlVideo) {
                    statusSinopse.textContent = 'Preencha o link do video antes de gerar a sinopse.';
                    return;
                }
                dados.append('url_video', urlVideo);
            } else {
                const arquivoInput = formFlutuante.querySelector('[name="arquivo"]');
                if (arquivoInput?.files[0]) {
                    dados.append('arquivo', arquivoInput.files[0]);
                }
            }

            btnGerarSinopse.disabled = true;
            statusSinopse.textContent = 'Gerando sinopse com IA...';

            try {
                const resposta = await fetch('/professor/conteudos/gerar-sinopse', {
                    method: 'POST',
                    body: dados,
                });
                const resultado = await resposta.json();

                if (!resposta.ok) {
                    throw new Error(resultado.erro || 'Erro ao gerar sinopse.');
                }

                campoSinopse.value = resultado.sinopse;
                statusSinopse.textContent = 'Sinopse gerada. Revise antes de enviar.';
            } catch (erro) {
                statusSinopse.textContent = erro.message;
            } finally {
                btnGerarSinopse.disabled = false;
            }
        });
    }
});