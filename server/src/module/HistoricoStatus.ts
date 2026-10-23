import { StatusItem } from "./StatusItem";

/** Registro de cada mudança de status de um item: quem, quando, de onde para onde (RN05). */
export class HistoricoStatus {
  private id?: number;
  private itemId: number;
  private usuarioId: number;
  private statusAnterior: StatusItem | null;
  private statusNovo: StatusItem;
  private dataHora?: string;

  constructor(
    itemId: number,
    usuarioId: number,
    statusAnterior: StatusItem | null,
    statusNovo: StatusItem,
    id?: number,
    dataHora?: string
  ) {
    this.itemId = itemId;
    this.usuarioId = usuarioId;
    this.statusAnterior = statusAnterior;
    this.statusNovo = statusNovo;
    this.id = id;
    this.dataHora = dataHora;
  }

  public getItemId(): number {
    return this.itemId;
  }

  public getUsuarioId(): number {
    return this.usuarioId;
  }

  public getStatusAnterior(): StatusItem | null {
    return this.statusAnterior;
  }

  public getStatusNovo(): StatusItem {
    return this.statusNovo;
  }

  public toJSON() {
    return {
      id: this.id,
      itemId: this.itemId,
      usuarioId: this.usuarioId,
      statusAnterior: this.statusAnterior,
      statusNovo: this.statusNovo,
      dataHora: this.dataHora,
    };
  }
}
