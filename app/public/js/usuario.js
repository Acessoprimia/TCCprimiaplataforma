// Selecionar todos os links de seleção de role
const roleLinks = document.querySelectorAll('[data-role]');

// Adicionar event listeners aos links
roleLinks.forEach(link => {
  link.addEventListener('click', handleRoleSelection);
});

/**
 * Função para lidar com a seleção de tipo de usuário
 * @param {Event} event - O evento de clique
 */
function handleRoleSelection(event) {
  const selectedLink = event.currentTarget;
  const role = selectedLink.getAttribute('data-role');

  // Log da seleção
  console.log(`Tipo de usuário selecionado: ${role}`);

  // Remover classe 'selected' de todos os links
  roleLinks.forEach(link => {
    link.classList.remove('selected');
  });

  // Adicionar classe 'selected' ao link clicado
  selectedLink.classList.add('selected');

  // O link vai navegar naturalmente para a URL definida em href
  // Se você quiser fazer algo antes de navegar, pode fazer aqui
}

// Suporte a navegação por teclado (Enter)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement.classList.contains('link')) {
    document.activeElement.click();
  }
});
