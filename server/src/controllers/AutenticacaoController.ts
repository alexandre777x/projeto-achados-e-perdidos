import { Request, Response } from "express";
import { Configuracao } from "../config/Configuracao";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { AutenticacaoService } from "../services/AutenticacaoService";
import { RecuperacaoSenhaService } from "../services/RecuperacaoSenhaService";
import { SessaoDaRequisicao } from "../middlewares/SessaoDaRequisicao";

/** RF01 – Cadastro, login, logout e recuperação de senha. */
export class AutenticacaoController {
  private readonly servico = new AutenticacaoService();
  private readonly recuperacao = new RecuperacaoSenhaService();

  /** RF01.1, RF01.2, RF01.5 */
  public cadastrar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF01.1, RF01.2, RF01.5");
  }

  /** RF01.3: confere e-mail e senha e inicia a sessão. */
  public async entrar(req: Request, res: Response): Promise<void> {
    const { email, senha } = req.body ?? {};
    const usuario = await this.servico.entrar(email, senha);
    await SessaoDaRequisicao.iniciar(req, usuario);
    res.json(usuario);
  }

  /** RF01.4 */
  public async sair(req: Request, res: Response): Promise<void> {
    await SessaoDaRequisicao.encerrar(req);
    res.clearCookie(Configuracao.COOKIE_SESSAO);
    res.json({ mensagem: "Sessão encerrada." });
  }

  /** Dados de quem está logado, para o front-end montar o menu. */
  public async perfil(req: Request, res: Response): Promise<void> {
    const usuario = this.servico.usuarioLogado(SessaoDaRequisicao.usuarioId(req));
    if (!usuario) {
      await SessaoDaRequisicao.encerrar(req);
      res.status(401).json({ erro: "Faça login para continuar." });
      return;
    }
    res.json(usuario);
  }

  /** RF01.6: a resposta é sempre a mesma, para não revelar quais e-mails estão cadastrados. */
  public solicitarRecuperacao(req: Request, res: Response): void {
    this.recuperacao.solicitar(String(req.body?.email ?? "").trim());
    res.json({ mensagem: "Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha." });
  }

  /** RF01.6 */
  public async redefinirSenha(req: Request, res: Response): Promise<void> {
    const { token, senha } = req.body ?? {};
    await this.recuperacao.redefinir(String(token ?? ""), String(senha ?? ""));
    res.json({ mensagem: "Senha alterada. Você já pode entrar com a nova senha." });
  }
}
