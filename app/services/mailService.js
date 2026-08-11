const nodemailer = require("nodemailer");

const transportador = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
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
});

module.exports = MailService;
