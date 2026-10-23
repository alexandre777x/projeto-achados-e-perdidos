import { Request, Response } from "express";
import { Categoria } from "../module/Categoria";
import { Local } from "../module/Local";
import { CategoriaRepository } from "../repositories/CategoriaRepository";
import { LocalRepository } from "../repositories/LocalRepository";

/** Listas de categorias e locais (RF02.3). Qualquer um consulta; só o administrador cria. */
export class ReferenciaController {
  private readonly categoriaRepo = new CategoriaRepository();
  private readonly localRepo = new LocalRepository();

  public listarCategorias(req: Request, res: Response): void {
    res.json(this.categoriaRepo.listarTodas());
  }

  public listarLocais(req: Request, res: Response): void {
    res.json(this.localRepo.listarTodos());
  }

  /** O construtor de Categoria valida o nome. */
  public criarCategoria(req: Request, res: Response): void {
    const categoria = this.categoriaRepo.salvar(new Categoria(req.body?.nome));
    res.status(201).json(categoria);
  }

  /** O construtor de Local valida o nome. */
  public criarLocal(req: Request, res: Response): void {
    const local = this.localRepo.salvar(new Local(req.body?.nome));
    res.status(201).json(local);
  }
}
