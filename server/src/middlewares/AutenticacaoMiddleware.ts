import { Request, Response, NextFunction } from "express";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { SessaoDaRequisicao } from "./SessaoDaRequisicao";

/** Controle de acesso por sessão: colocado antes do handler nas rotas protegidas. */
export class AutenticacaoMiddleware {
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
