const nodemailer = require("nodemailer");

const transportador = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  // Alguns provedores de hospedagem (ex.: Render) nao tem saida de rede IPv6,
  // mas o smtp.gmail.com resolve tambem para IPv6 e o Node pode tentar essa rota
  // primeiro, causando ENETUNREACH. Forcar IPv4 evita esse problema.
  family: 4,
});

const MailService = Object.freeze({
  async enviarNotificacaoContato({ nome, email, assunto, mensagem, origem, destinatario }) {
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
