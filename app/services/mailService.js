const nodemailer = require("nodemailer");
const dns = require("dns").promises;

const HOST_SMTP_GMAIL = "smtp.gmail.com";

// O nodemailer instalado resolve o host tanto em IPv4 quanto IPv6 e ESCOLHE
// UM ENDERECO ALEATORIO entre eles pra conectar (nao existe opcao "family"
// nessa versao). Em provedores como o Render, que nao tem rota de saida IPv6,
// isso causa ENETUNREACH de forma intermitente sempre que calha de sortear um
// endereco IPv6. Por isso resolvemos o IPv4 manualmente aqui e passamos o IP
// direto como host, mantendo "servername" com o hostname real pra o TLS
// continuar validando o certificado do Google corretamente.
async function criarTransportador() {
  let host = HOST_SMTP_GMAIL;

  try {
    const enderecosIpv4 = await dns.resolve4(HOST_SMTP_GMAIL);
    if (enderecosIpv4.length > 0) {
      host = enderecosIpv4[0];
    }
  } catch (erro) {
    console.error("Nao foi possivel resolver IPv4 de smtp.gmail.com, usando hostname padrao:", erro);
  }

  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    servername: HOST_SMTP_GMAIL,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

const MailService = Object.freeze({
  async enviarNotificacaoContato({ nome, email, assunto, mensagem, origem, destinatario }) {
    const transportador = await criarTransportador();
    await transportador.sendMail({
      from: `"Primia" <${process.env.GMAIL_USER}>`,
      to: destinatario || process.env.GMAIL_USER,
      replyTo: email,
      subject: `Novo contato: ${assunto || "sem assunto"}`,
      text: [
        `Nome: ${nome}`,
        `E-mail: ${email}`,
        `Origem: ${origem || "nao informado"}`,
        ``,
        `Mensagem:`,
        mensagem,
      ].join("\n"),
    });
  },

  async enviarEmailConfirmacao({ nome, email, token }) {
    const urlBase = process.env.URL_BASE_SITE || `http://localhost:${process.env.PORT || 3000}`;
    const link = `${urlBase}/confirmar-email?token=${token}`;
    const transportador = await criarTransportador();

    await transportador.sendMail({
      from: `"Primia" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Confirme seu e-mail - Primia",
      text: [
        `Ola, ${nome}!`,
        ``,
        `Confirme seu e-mail clicando no link abaixo (valido por 24 horas):`,
        link,
        ``,
        `Se voce nao criou uma conta na Primia, ignore esta mensagem.`,
      ].join("\n"),
      html: `
        <p>Ola, ${nome}!</p>
        <p>Confirme seu e-mail clicando no botao abaixo (valido por 24 horas):</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#2f6fed;color:#fff;text-decoration:none;border-radius:6px;">Confirmar e-mail</a></p>
        <p>Ou copie e cole este link no navegador:<br>${link}</p>
        <p>Se voce nao criou uma conta na Primia, ignore esta mensagem.</p>
      `,
    });
  },
});

module.exports = MailService;
