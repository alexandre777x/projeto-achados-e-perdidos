import { Request, Response, NextFunction } from "express";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { SessaoDaRequisicao } from "./SessaoDaRequisicao";

/** Controle de acesso por sessão: colocado antes do handler nas rotas protegidas. */
export class AutenticacaoMiddleware {
  /** Páginas que quem não entrou pode abrir: entrar, criar conta e recuperar a senha. */
  private static readonly PAGINAS_PUBLICAS = new Set([
    "/login.html",
    "/cadastro.html",
    "/esqueci-senha.html",
    "/redefinir-senha.html",
  ]);

  /** Arquivos de que as páginas públicas precisam (estilo, scripts, imagens). */
  private static readonly PASTAS_PUBLICAS = ["/css/", "/js/", "/img/"];

  /**
   * O site inteiro exige login. Fica aberto só o que está nas listas acima e a API,
   * que confere o login rota por rota. Quem não entrou é levado ao login, que depois
   * devolve a pessoa à página que ela tentou abrir. Quem já entrou e abre o login
   * vai direto para a página inicial.
   */
  public protegerPaginas(req: Request, res: Response, next: NextFunction): void {
    // Confere o caminho já decodificado, como o servidor de arquivos vai usá-lo:
    // "/css/..%2Fadmin.html" vira "/css/../admin.html" e precisa ser barrado aqui.
    let caminho: string;
    try {
      caminho = decodeURIComponent(req.path).toLowerCase();
    } catch {
      res.status(400).json({ erro: "Requisição inválida." });
      return;
    }
    if (caminho.includes("..") || caminho.includes("\\")) {
      res.status(404).json({ erro: "Página não encontrada." });
      return;
    }

    const logado = !!SessaoDaRequisicao.usuario(req);

    if (caminho.startsWith("/api/")) {
      return next();
    }
    if (logado) {
      return caminho === "/login.html" ? res.redirect("/") : next();
    }
    if (
      AutenticacaoMiddleware.PAGINAS_PUBLICAS.has(caminho) ||
      AutenticacaoMiddleware.PASTAS_PUBLICAS.some((pasta) => caminho.startsWith(pasta))
    ) {
      return next();
    }

    const voltar = req.method === "GET" && req.path !== "/" ? `?voltar=${encodeURIComponent(req.originalUrl)}` : "";
    res.redirect(`/login.html${voltar}`);
  }

  /** Qualquer usuário autenticado (aluno, professor ou administrador). */
  public exigirLogin(req: Request, res: Response, next: NextFunction): void {
    if (!SessaoDaRequisicao.usuario(req)) {
      res.status(401).json({ erro: "Faça login para continuar." });
      return;
    }
    next();
  }

  /** Só o perfil ADMINISTRADOR (RNF01.1: as demais pessoas recebem 403). */
  public exigirAdmin(req: Request, res: Response, next: NextFunction): void {
    const usuario = SessaoDaRequisicao.usuario(req);
    if (!usuario) {
      res.status(401).json({ erro: "Faça login para continuar." });
      return;
    }
    if (usuario.perfil !== PerfilUsuario.ADMINISTRADOR) {
      res.status(403).json({ erro: "Acesso restrito à administração." });
      return;
    }
    next();
  }
}
