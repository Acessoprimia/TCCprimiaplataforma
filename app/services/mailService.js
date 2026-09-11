const sgMail = require("@sendgrid/mail");

// SMTP puro (porta 465/587) fica bloqueado no plano gratuito do Render, entao
// o envio de e-mail usa a API HTTPS do SendGrid (porta 443) em vez de conexao
// SMTP direta - isso evita o bloqueio de porta do provedor de hospedagem.
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const EMAIL_REMETENTE = process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_USER;

const MailService = Object.freeze({
  async enviarNotificacaoContato({ nome, email, assunto, mensagem, origem, destinatario }) {
    await sgMail.send({
      from: { email: EMAIL_REMETENTE, name: "Primia" },
      to: destinatario || EMAIL_REMETENTE,
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

    await sgMail.send({
      from: { email: EMAIL_REMETENTE, name: "Primia" },
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
