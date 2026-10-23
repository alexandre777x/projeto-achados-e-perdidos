import { Request } from "express";
import { SessionData } from "express-session";
import { Usuario } from "../module/Usuario";

export type UsuarioDaSessao = SessionData["usuario"];

/** Quem está logado na requisição, guardado na sessão (cookie) pelo login. */
export class SessaoDaRequisicao {
  public static usuario(req: Request): UsuarioDaSessao | null {
    return req.session.usuario ?? null;
  }

  /** Para rotas protegidas por exigirLogin, onde o usuário com certeza existe. */
  public static usuarioId(req: Request): number {
    return (req.session.usuario as UsuarioDaSessao).id;
  }

  /** Gera uma sessão nova no login, para um cookie antigo não herdar o acesso. */
  public static iniciar(req: Request, usuario: Usuario): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      req.session.regenerate((erro) => {
        if (erro) {
          return rejeitar(erro);
        }
        req.session.usuario = {
          id: usuario.getId() as number,
          nome: usuario.getNome(),
          perfil: usuario.getPerfil(),
        };
        resolver();
      });
    });
  }

  public static encerrar(req: Request): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      req.session.destroy((erro) => (erro ? rejeitar(erro) : resolver()));
    });
  }
}
