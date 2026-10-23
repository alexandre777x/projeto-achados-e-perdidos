import nodemailer, { Transporter } from "nodemailer";
import { Configuracao } from "../config/Configuracao";

export interface Email {
  para: string;
  assunto: string;
  texto: string;
}

/** Envio de e-mails. Sem SMTP configurado no .env, mostra a mensagem no terminal. */
export class EmailService {
  private readonly transporte: Transporter | null;

  constructor() {
    const { host, porta, usuario, senha } = Configuracao.smtp;
    this.transporte = host
      ? nodemailer.createTransport({
          host,
          port: porta,
          secure: porta === 465,
          auth: usuario ? { user: usuario, pass: senha } : undefined,
        })
      : null;
  }

  public async enviar(email: Email): Promise<void> {
    if (!this.transporte) {
      console.log(
        `\n[e-mail não enviado: SMTP_HOST vazio]\nPara: ${email.para}\nAssunto: ${email.assunto}\n${email.texto}\n`
      );
      return;
    }
    await this.transporte.sendMail({
      from: Configuracao.smtp.remetente,
      to: email.para,
      subject: email.assunto,
      text: email.texto,
    });
  }
}
