import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { RelatorioService } from "../services/RelatorioService";
import { DevolucaoService } from "../services/DevolucaoService";
import { ItemService } from "../services/ItemService";
import { SessaoDaRequisicao } from "../middlewares/SessaoDaRequisicao";

/** RF05 – Devolução e relatório (somente administração). */
export class DevolucaoController {
  private readonly relatorioService = new RelatorioService();
  private readonly devolucaoService = new DevolucaoService();

  /** RF05.1 a RF05.3: corpo { reivindicacaoId, tipoDocumento } */
  public registrar(req: Request, res: Response): void {
    const reivindicacaoId = ItemService.lerId(req.body?.reivindicacaoId);
    if (reivindicacaoId === null) {
      throw new ErroDeNegocio("Informe a reivindicação aprovada.");
    }
    const devolucao = this.devolucaoService.registrar(
      reivindicacaoId,
      req.body?.tipoDocumento,
      SessaoDaRequisicao.usuarioId(req)
    );
    res.status(201).json(devolucao);
  }

  /** RF05.1: reivindicações aprovadas esperando o dono buscar o objeto. */
  public listarPendentes(req: Request, res: Response): void {
    res.json(this.devolucaoService.listarAguardandoDevolucao());
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
