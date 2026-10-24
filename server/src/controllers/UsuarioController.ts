import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { ItemService } from "../services/ItemService";
import { UsuarioService } from "../services/UsuarioService";
import { SessaoDaRequisicao } from "../middlewares/SessaoDaRequisicao";

/** Gestão das contas pela administração. Para criar conta, a tela usa POST /api/auth/cadastro. */
export class UsuarioController {
  private readonly servico = new UsuarioService();

  /** ?q= procura no nome e no e-mail. */
  public listar(req: Request, res: Response): void {
    res.json(this.servico.listar(req.query.q));
  }

  /** Corpo: { perfil: "ALUNO" | "PROFESSOR" | "ADMINISTRADOR" } */
  public mudarPerfil(req: Request, res: Response): void {
    res.json(this.servico.mudarPerfil(UsuarioController.id(req), req.body?.perfil, SessaoDaRequisicao.usuarioId(req)));
  }

  /** Corpo: { ativo: true | false } */
  public mudarAtivo(req: Request, res: Response): void {
    res.json(this.servico.mudarAtivo(UsuarioController.id(req), req.body?.ativo, SessaoDaRequisicao.usuarioId(req)));
  }

  private static id(req: Request): number {
    const id = ItemService.lerId(req.params.id);
    if (id === null) {
      throw new ErroDeNegocio("Conta não encontrada.", 404);
    }
    return id;
  }
}
