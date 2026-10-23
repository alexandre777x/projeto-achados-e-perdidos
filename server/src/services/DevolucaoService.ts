import { Devolucao } from "../module/Devolucao";
import { StatusItem } from "../module/StatusItem";
import { TipoDocumento } from "../module/TipoDocumento";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { ItemRepository } from "../repositories/ItemRepository";
import { DevolucaoRepository } from "../repositories/DevolucaoRepository";
import { ReivindicacaoRepository, ReivindicacaoResumo } from "../repositories/ReivindicacaoRepository";

/** Entrega do item ao dono (RF05.1 a RF05.3, RN01). */
export class DevolucaoService {
  private readonly devolucaoRepo = new DevolucaoRepository();
  private readonly reivindicacaoRepo = new ReivindicacaoRepository();
  private readonly itemRepo = new ItemRepository();

  /**
   * RN01: só com reivindicação aprovada. Grava a devolução e muda o item para
   * DEVOLVIDO (RF05.3), o que o tira da busca; tudo junto ou nada.
   */
  public registrar(reivindicacaoId: number, tipoDocumento: unknown, administradorId: number): Devolucao {
    const devolucao = new Devolucao(reivindicacaoId, administradorId, tipoDocumento as TipoDocumento);

    return this.devolucaoRepo.emTransacao(() => {
      const reivindicacao = this.reivindicacaoRepo.buscarPorId(reivindicacaoId);
      if (!reivindicacao) {
        throw new ErroDeNegocio("Reivindicação não encontrada.", 404);
      }
      if (!reivindicacao.estaAprovada()) {
        throw new ErroDeNegocio("Só é possível devolver um item com reivindicação aprovada.", 409);
      }
      if (this.devolucaoRepo.buscarPorReivindicacao(reivindicacaoId)) {
        throw new ErroDeNegocio("A devolução deste item já foi registrada.", 409);
      }

      const item = this.itemRepo.buscarPorId(reivindicacao.getItemId());
      if (!item) {
        throw new ErroDeNegocio("Item não encontrado.", 404);
      }
      const anterior = item.mudarStatus(StatusItem.DEVOLVIDO);
      this.itemRepo.mudarStatus(item, anterior, administradorId);
      return this.devolucaoRepo.salvar(devolucao);
    });
  }

  public listarAguardandoDevolucao(): ReivindicacaoResumo[] {
    return this.reivindicacaoRepo.listarAguardandoDevolucao();
  }
}
