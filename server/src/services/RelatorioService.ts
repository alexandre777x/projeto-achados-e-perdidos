import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { RelatorioDevolucoes } from "../module/RelatorioDevolucoes";
import { DevolucaoRepository } from "../repositories/DevolucaoRepository";

/** Monta o relatório de devoluções de um período (RF05.4). */
export class RelatorioService {
  private readonly devolucaoRepo = new DevolucaoRepository();

  public gerar(periodo: PeriodoDeDatas): RelatorioDevolucoes {
    return new RelatorioDevolucoes(
      periodo,
      this.devolucaoRepo.listarDevolvidos(periodo),
      this.devolucaoRepo.listarSobCustodia(periodo)
    );
  }
}
