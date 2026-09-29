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


  selectedLink.classList.add('selected');

}


document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement.classList.contains('link')) {
    document.activeElement.click();
  }
});
