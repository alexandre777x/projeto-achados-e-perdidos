// Envio de e-mails (RF01.6). Sem SMTP configurado no .env, mostra a mensagem no terminal.
const nodemailer = require('nodemailer');
const { smtp } = require('../config/env');

const transporte = smtp.host
  ? nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    })
  : null;

async function enviarEmail({ para, assunto, texto }) {
  if (!transporte) {
    console.log(`\n[e-mail não enviado: SMTP_HOST vazio]\nPara: ${para}\nAssunto: ${assunto}\n${texto}\n`);
    return;
  }
  await transporte.sendMail({ from: smtp.remetente, to: para, subject: assunto, text: texto });
}

module.exports = { enviarEmail };
