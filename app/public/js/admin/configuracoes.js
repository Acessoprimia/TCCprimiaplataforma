// Interacoes da pagina /admin/configuracoes.
// Depende das funcoes compartilhadas definidas em common.js.

const formConfiguracoes = document.getElementById("formConfiguracoes");
const formBannerConfiguracoes = document.getElementById("formBannerConfiguracoes");

formConfiguracoes.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const botao = formConfiguracoes.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {
        const dados = Object.fromEntries(new FormData(formConfiguracoes).entries());
        await chamarApiAdmin("/admin/configuracoes", dados);
        mostrarAvisoAdmin("Configuracoes salvas.");
    } catch (erro) {
        mostrarAvisoAdmin(erro.message);
    } finally {
        botao.disabled = false;
    }
});

formBannerConfiguracoes.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const campoArquivo = formBannerConfiguracoes.querySelector('input[name="banner"]');

    if (!campoArquivo.files.length) {
        mostrarAvisoAdmin("Selecione uma imagem antes de atualizar o banner.");
        return;
    }

    const botao = formBannerConfiguracoes.querySelector('button[type="submit"]');
    botao.disabled = true;

    try {
        const formData = new FormData(formBannerConfiguracoes);
        await chamarApiAdminArquivo("/admin/configuracoes/banner", formData);
        mostrarAvisoAdmin("Banner atualizado.");
    } catch (erro) {
        mostrarAvisoAdmin(erro.message);
    } finally {
        botao.disabled = false;
    }
});
