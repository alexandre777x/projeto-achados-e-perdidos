import { Request, Response, NextFunction } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

/**
 * Último middleware: transforma qualquer erro em resposta JSON.
 * ErroDeNegocio usa o próprio status e mensagem; o resto vira 500 sem detalhes,
 * para não mostrar o funcionamento interno ao usuário.
 */
export class ErrorHandlerMiddleware {
  public tratar(erro: Error, req: Request, res: Response, next: NextFunction): void {
    if (erro instanceof ErroDeNegocio) {
      res.status(erro.status).json({ erro: erro.message });
      return;
    }

    // JSON malformado no corpo da requisição (vem do express.json)
    const status = (erro as { status?: number }).status;
    if (status === 400) {
      res.status(400).json({ erro: "Requisição inválida." });
      return;
    }

    console.error(erro);
    res.status(500).json({ erro: "Erro interno do servidor." });
  }

  /** Rotas /api que não existem. */
  public naoEncontrado(req: Request, res: Response): void {
    res.status(404).json({ erro: "Rota não encontrada." });
  }
}
