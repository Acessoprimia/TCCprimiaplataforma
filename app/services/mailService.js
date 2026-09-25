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

  async enviarRespostaContato({ nome, email, assunto, mensagem, resposta, replyTo }) {
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const assuntoFinal = assunto || "sem assunto";

    await sgMail.send({
      from: { email: EMAIL_REMETENTE, name: "Primia" },
      to: email,
      ...(replyTo ? { replyTo } : {}),
      subject: `Re: ${assuntoFinal} - Primia`,
      text: [
        `Ola, ${nome}!`,
        ``,
        resposta,
        ``,
        `--- Sua mensagem original ---`,
        mensagem,
      ].join("\n"),
      html: `
        <p>Ola, ${esc(nome)}!</p>
        <p style="white-space:pre-wrap;">${esc(resposta)}</p>
        <hr>
        <p style="color:#666;font-size:13px;"><strong>Sua mensagem original</strong></p>
        <p style="color:#666;font-size:13px;white-space:pre-wrap;">${esc(mensagem)}</p>
      `,
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

  async enviarEmailRedefinicaoSenha({ nome, email, token }) {
    const urlBase = process.env.URL_BASE_SITE || `http://localhost:${process.env.PORT || 3000}`;
    const link = `${urlBase}/redefinir-senha?token=${token}`;

    await sgMail.send({
      from: { email: EMAIL_REMETENTE, name: "Primia" },
      to: email,
      subject: "Redefinicao de senha - Primia",
      text: [
        `Ola, ${nome}!`,
        ``,
        `Recebemos um pedido para redefinir a senha da sua conta na Primia.`,
        `Crie uma nova senha pelo link abaixo (valido por 1 hora):`,
        link,
        ``,
        `Se voce nao pediu isso, ignore esta mensagem - sua senha atual continua valendo.`,
      ].join("\n"),
      html: `
        <p>Ola, ${nome}!</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta na Primia.</p>
        <p>Crie uma nova senha clicando no botao abaixo (valido por 1 hora):</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#2f6fed;color:#fff;text-decoration:none;border-radius:6px;">Redefinir senha</a></p>
        <p>Ou copie e cole este link no navegador:<br>${link}</p>
        <p>Se voce nao pediu isso, ignore esta mensagem - sua senha atual continua valendo.</p>
      `,
    });
  },
});

module.exports = MailService;
