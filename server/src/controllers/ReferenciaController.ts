import { Request, Response } from "express";
import { Categoria } from "../module/Categoria";
import { CategoriaRepository } from "../repositories/CategoriaRepository";

/**
 * Lista de categorias (RF02.3). Quem está logado consulta; só o administrador cria.
 * O local deixou de ser lista: é escrito por quem registra o item.
 */
export class ReferenciaController {
  private readonly categoriaRepo = new CategoriaRepository();

  public listarCategorias(req: Request, res: Response): void {
    res.json(this.categoriaRepo.listarTodas());
  }

  /** O construtor de Categoria valida o nome. */
  public criarCategoria(req: Request, res: Response): void {
    const categoria = this.categoriaRepo.salvar(new Categoria(req.body?.nome));
    res.status(201).json(categoria);
  }
}
