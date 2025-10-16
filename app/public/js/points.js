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
            if (navigator.share) {
                navigator.share({
                    title: '360° Matemática',
                    text: 'Confira este livro: 360° Matemática - Fundamental, Uma Nova Abordagem',
                    url: window.location.href
                }).then(() => {
                    console.log('Compartilhado com sucesso');
                }).catch((error) => {
                    console.log('Erro ao compartilhar:', error);
                });
            } else {
                alert('Compartilhando: 360° Matemática');
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