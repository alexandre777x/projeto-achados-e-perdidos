import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

/** RF02 (registro) e RF03 (busca) de itens. Usa o ItemRepository. */
export class ItemController {
  /** RF03.1 a RF03.4 (filtros: categoria, local, de, ate, q) */
  public buscar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF03.1 a RF03.4");
  }

  /** RF03.5 */
  public detalhar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF03.5");
  }

  /** RF02.1 a RF02.5 (com upload de fotos) */
  public registrar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.1 a RF02.5");
  }

  /** RF02.6 */
  public confirmarRecebimento(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.6");
  }

  /** RF02.6 */
  public editar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.6");
  }

  /** RF02.6 */
  public excluir(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF02.6");
  }
}
