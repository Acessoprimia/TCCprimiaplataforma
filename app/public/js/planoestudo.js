function editar(btn) {
    const item = btn.closest('.item-lista');
    const label = item.querySelector('label');
    const textoAtual = label.textContent;
    const id = label.getAttribute('for');
 
    const input = document.createElement('input');
    input.type = 'text';
    input.value = textoAtual;
    input.className = 'input-editar';
 
    label.replaceWith(input);
    btn.disabled = true;
    input.focus();
    input.select();
 
    function salvar() {
        const novoTexto = input.value.trim() || textoAtual;
        const novoLabel = document.createElement('label');
        novoLabel.setAttribute('for', id);
        novoLabel.className = 'label-checkbox';
        novoLabel.textContent = novoTexto;
        if (item.querySelector('.checkbox').checked) {
            novoLabel.classList.add('riscado');
        }
        input.replaceWith(novoLabel);
        btn.disabled = false;
    }
 
    input.addEventListener('blur', salvar);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { input.value = textoAtual; input.blur(); }
    });
}
 
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.checkbox').forEach(function(cb) {
        cb.addEventListener('change', function() {
            const label = this.closest('.item-lista').querySelector('label');
            if (label) label.classList.toggle('riscado', this.checked);
        });
    });
});
 