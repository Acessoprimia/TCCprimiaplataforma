// Elementos do DOM
const btnAluno = document.querySelector('.btn-aluno');
const btnProfessor = document.querySelector('.btn-professor');

// Opcional: Adicionar efeito de ripple ao clicar
function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');

    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

// Adicionar evento de ripple (opcional)
btnAluno.addEventListener('click', createRipple);
btnProfessor.addEventListener('click', createRipple);

// Salvar tipo de usuário no sessionStorage (opcional)
btnAluno.addEventListener('click', () => {
    sessionStorage.setItem('tipoUsuario', 'aluno');
});

btnProfessor.addEventListener('click', () => {
    sessionStorage.setItem('tipoUsuario', 'professor');
});

// Animação de entrada
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.selecao-container');
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        container.style.transition = 'all 0.5s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);
});