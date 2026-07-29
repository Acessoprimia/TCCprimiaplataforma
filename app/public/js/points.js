  function goBack() {
            window.history.back();
        }

        function toggleMenu() {
            const modal = document.getElementById('optionsModal');
            const overlay = document.getElementById('modalOverlay');
            
            modal.classList.toggle('active');
            overlay.classList.toggle('active');
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
            alert('Denúncia enviada. Obrigado pelo feedback.');
            toggleMenu();
        }

        // Fechar modal ao pressionar ESC
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const modal = document.getElementById('optionsModal');
                const overlay = document.getElementById('modalOverlay');
                if (modal.classList.contains('active')) {
                    modal.classList.remove('active');
                    overlay.classList.remove('active');
                }
            }
        });