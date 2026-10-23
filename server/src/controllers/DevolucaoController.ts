import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { RelatorioService } from "../services/RelatorioService";

/** RF05 – Devolução e relatório (somente administração). */
export class DevolucaoController {
  private readonly relatorioService = new RelatorioService();

  /** RF05.1 a RF05.3 */
  public registrar(req: Request, res: Response): void {
    throw ErroDeNegocio.naoImplementado("RF05.1 a RF05.3");
  }

  /** RF05.4: ?de=AAAA-MM-DD&ate=AAAA-MM-DD */
  public relatorio(req: Request, res: Response): void {
    const periodo = new PeriodoDeDatas(req.query.de, req.query.ate);
    res.json(this.relatorioService.gerar(periodo));
  }

  /** RF05.5 */
  public relatorioCsv(req: Request, res: Response): void {
    const relatorio = this.relatorioService.gerar(new PeriodoDeDatas(req.query.de, req.query.ate));
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${relatorio.nomeDoArquivoCsv()}"`);
    res.send(relatorio.paraCsv());
  }
}
