import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

/** Listas de categorias e locais (RF02.3). Usa CategoriaRepository e LocalRepository. */
export class ReferenciaController {
  public listarCategorias(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.3");
  }

  public listarLocais(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.3");
  }

  public criarCategoria(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.3");
  }

  public criarLocal(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.3");
  }
}
