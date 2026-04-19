const filtro = document.getElementById("materia-filtro");
const cards = document.querySelectorAll(".card-duvida");

function textoTempoRelativo(segundos) {
    const totalSegundos = Math.max(0, Number(segundos) || 0);
    const minutos = Math.floor(totalSegundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (totalSegundos < 60) return "agora pouco";
    if (minutos < 60) return `ha ${minutos} minuto${minutos === 1 ? "" : "s"}`;
    if (horas < 24) return `ha ${horas} hora${horas === 1 ? "" : "s"}`;
    return `ha ${dias} dia${dias === 1 ? "" : "s"}`;
}

function atualizarTemposRelativos() {
    document.querySelectorAll(".tempo-relativo").forEach((tempo) => {
        const segundos = (Number(tempo.dataset.segundos) || 0) + 30;
        tempo.dataset.segundos = String(segundos);
        tempo.textContent = textoTempoRelativo(segundos);
    });
}

setInterval(atualizarTemposRelativos, 30000);

if (filtro) {
    filtro.addEventListener("change", (e) => {
        const selectedMateria = e.target.value;

        cards.forEach((card) => {
            if (!card.dataset.materia || selectedMateria === "" || card.dataset.materia === selectedMateria) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }
        });
    });
}

const modal = document.getElementById("modal-resposta");
const botoesResponder = document.querySelectorAll(".btn-responder");
const btnFecharModal = document.getElementById("btn-fechar-modal");
const inputDuvida = document.getElementById("id-duvida-resposta");

function abrirModal(idDuvida) {
    if (!modal) return;
    if (inputDuvida) inputDuvida.value = idDuvida || "";
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function fecharModal() {
    if (!modal) return;
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
}

botoesResponder.forEach((botao) => {
    botao.addEventListener("click", () => abrirModal(botao.dataset.duvidaId));
});

if (btnFecharModal) btnFecharModal.addEventListener("click", fecharModal);

if (modal) {
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            fecharModal();
        }
    });
}
