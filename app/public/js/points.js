  function goBack() {
            window.history.back();
        }

        function fecharModaisLivro() {
            const overlay = document.getElementById('modalOverlay');
            document.getElementById('optionsModal').classList.remove('active');
            const reportModal = document.getElementById('reportModal');
            if (reportModal) {
                reportModal.classList.remove('active');
            }
            overlay.classList.remove('active');
        }

        function toggleMenu() {
            const modal = document.getElementById('optionsModal');
            const overlay = document.getElementById('modalOverlay');

            if (modal.classList.contains('active')) {
                fecharModaisLivro();
                return;
            }

            modal.classList.add('active');
            overlay.classList.add('active');
        }

        function toggleReportModal() {
            const modal = document.getElementById('reportModal');
            const overlay = document.getElementById('modalOverlay');

            if (modal.classList.contains('active')) {
                fecharModaisLivro();
                return;
            }

            modal.classList.add('active');
            overlay.classList.add('active');
        }

        function readBook() {
            alert('Abrindo o livro para leitura...');
            // Aqui você pode adicionar a lógica para abrir o leitor
        }

        function shareBook() {
            const titulo = typeof LIVRO_TITULO !== 'undefined' ? LIVRO_TITULO : 'este livro';

            if (navigator.share) {
                navigator.share({
                    title: titulo,
                    text: 'Confira este livro: ' + titulo,
                    url: window.location.href
                }).then(() => {
                    console.log('Compartilhado com sucesso');
                }).catch((error) => {
                    console.log('Erro ao compartilhar:', error);
                });
            } else {
                alert('Compartilhando: ' + titulo);
            }
            toggleMenu();
        }

        function reportBook() {
            document.getElementById('optionsModal').classList.remove('active');
            toggleReportModal();
        }

        const reportForm = document.getElementById('reportForm');

        if (reportForm) {
            reportForm.addEventListener('submit', async function(event) {
                event.preventDefault();

                const dados = Object.fromEntries(new FormData(reportForm).entries());
                const botaoEnviar = reportForm.querySelector('.report-submit');
                botaoEnviar.disabled = true;

                try {
                    const resposta = await fetch(`/livro/${LIVRO_ID}/denunciar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados),
                    });

                    const corpo = await resposta.json().catch(() => ({}));

                    if (!resposta.ok) {
                        throw new Error(corpo.erro || 'Nao foi possivel enviar a denuncia agora.');
                    }

                    alert('Denúncia enviada. Obrigado pelo feedback.');
                    reportForm.reset();
                    fecharModaisLivro();
                } catch (erro) {
                    alert(erro.message);
                } finally {
                    botaoEnviar.disabled = false;
                }
            });
        }

        // Fechar modal ao pressionar ESC
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                fecharModaisLivro();
            }
        });