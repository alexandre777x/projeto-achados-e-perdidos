import { ErroDeNegocio } from "./ErroDeNegocio";
import { TipoDocumento } from "./TipoDocumento";

/** Entrega do item ao dono, depois de uma reivindicação aprovada (RF05, RN01). */
export class Devolucao {
  private id?: number;
  private reivindicacaoId: number;
  private administradorId: number;
  private tipoDocumento: TipoDocumento;
  private dataHora?: string;

  constructor(
    reivindicacaoId: number,
    administradorId: number,
    tipoDocumento: TipoDocumento,
    id?: number,
    dataHora?: string
  ) {
    if (!Object.values(TipoDocumento).includes(tipoDocumento)) {
      throw new ErroDeNegocio("Informe o tipo de documento conferido.");
    }
    this.reivindicacaoId = reivindicacaoId;
    this.administradorId = administradorId;
    this.tipoDocumento = tipoDocumento;
    this.id = id;
    this.dataHora = dataHora;
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getReivindicacaoId(): number {
    return this.reivindicacaoId;
  }

  public getAdministradorId(): number {
    return this.administradorId;
  }

  public getTipoDocumento(): TipoDocumento {
    return this.tipoDocumento;
  }

  public toJSON() {
    return {
      id: this.id,
      reivindicacaoId: this.reivindicacaoId,
      administradorId: this.administradorId,
      tipoDocumento: this.tipoDocumento,
      dataHora: this.dataHora,
    };
  }
}
