import { createHash, randomBytes } from "crypto";
import { Configuracao } from "../config/Configuracao";
import { Usuario } from "../module/Usuario";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { RecuperacaoSenhaRepository } from "../repositories/RecuperacaoSenhaRepository";
import { EmailService } from "./EmailService";

/**
 * Recuperação de senha por link enviado ao e-mail (RF01.6).
 * O link vale 60 minutos e só pode ser usado uma vez.
 */
export class RecuperacaoSenhaService {
  private static readonly MINUTOS_LINK = 60;

  private readonly usuarioRepo = new UsuarioRepository();
  private readonly recuperacaoRepo = new RecuperacaoSenhaRepository();
  private readonly emailService = new EmailService();

  /**
   * Gera e envia o link se o e-mail for de uma conta ativa. Quem chama responde sempre
   * a mesma coisa, para não revelar quais e-mails estão cadastrados.
   */
  public solicitar(email: string): void {
    if (!email) {
      throw new ErroDeNegocio("Informe o e-mail.");
    }

    const usuario = this.usuarioRepo.buscarPorEmail(email);
    if (!usuario || !usuario.estaAtivo()) {
      return;
    }

    const token = randomBytes(32).toString("hex");
    this.recuperacaoRepo.criar(
      usuario.getId() as number,
      RecuperacaoSenhaService.hash(token),
      RecuperacaoSenhaService.MINUTOS_LINK
    );

    const link = `${Configuracao.urlBase}/redefinir-senha.html?token=${token}`;
    // Sem await: a resposta não pode demorar mais quando o e-mail existe.
    this.emailService
      .enviar({
        para: usuario.getEmail(),
        assunto: "CampusLost – criar nova senha",
        texto:
          `Olá, ${usuario.getNome()}.\n\n` +
          `Para criar uma nova senha, abra o link abaixo (vale por ${RecuperacaoSenhaService.MINUTOS_LINK} minutos):\n${link}\n\n` +
          "Se você não pediu a troca, ignore este e-mail. Sua senha continua a mesma.",
      })
      .catch((erro) => console.error("Falha ao enviar e-mail de recuperação:", (erro as Error).message));
  }

  public async redefinir(token: string, novaSenha: string): Promise<void> {
    Usuario.validarSenha(novaSenha);

    const usuarioId = token ? this.recuperacaoRepo.usuarioDoTokenValido(RecuperacaoSenhaService.hash(token)) : null;
    if (usuarioId === null) {
      throw new ErroDeNegocio("Link inválido ou expirado. Peça um novo.");
    }

    this.recuperacaoRepo.trocarSenha(usuarioId, await Usuario.gerarHash(novaSenha));
  }

  /** O banco guarda só o hash: quem ler o banco não consegue usar os links. */
  private static hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
