import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

/** RF04 – Reivindicação de posse. Usa o ReivindicacaoRepository. */
export class ReivindicacaoController {
  /** RF04.1, RF04.2 (com provas de posse), RF04.6 */
  public abrir(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.1, RF04.2, RF04.6");
  }

  /** RF04.7 */
  public listarMinhas(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.7");
  }

  /** Fila da administração (RF04.4) */
  public listarAbertas(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.4");
  }

  /** RF04.3 */
  public listarMensagens(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.3");
  }

  /** RF04.3 */
  public enviarMensagem(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.3");
  }

  /** RF04.4, RF04.5 */
  public aprovar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.4, RF04.5");
  }

  /** RF04.4, RF04.5 */
  public rejeitar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF04.4, RF04.5");
  }
}
