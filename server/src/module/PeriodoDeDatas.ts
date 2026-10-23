import { ErroDeNegocio } from "./ErroDeNegocio";

/** Intervalo de datas (AAAA-MM-DD) usado em filtros e relatórios. Um lado vazio fica aberto. */
export class PeriodoDeDatas {
  private static readonly INICIO_ABERTO = "0001-01-01";
  private static readonly FIM_ABERTO = "9999-12-31";

  private readonly de: string;
  private readonly ate: string;
  private readonly informado: { de: string | null; ate: string | null };

  constructor(de?: unknown, ate?: unknown) {
    const deTexto = PeriodoDeDatas.lerData(de);
    const ateTexto = PeriodoDeDatas.lerData(ate);

    this.de = deTexto ?? PeriodoDeDatas.INICIO_ABERTO;
    this.ate = ateTexto ?? PeriodoDeDatas.FIM_ABERTO;
    if (this.de > this.ate) {
      throw new ErroDeNegocio("A data inicial não pode ser depois da data final.");
    }
    this.informado = { de: deTexto, ate: ateTexto };
  }

  private static lerData(valor: unknown): string | null {
    if (valor === undefined || valor === null || valor === "") {
      return null;
    }
    const texto = String(valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(Date.parse(texto))) {
      throw new ErroDeNegocio("Use datas no formato AAAA-MM-DD.");
    }
    return texto;
  }

  public getDe(): string {
    return this.de;
  }

  public getAte(): string {
    return this.ate;
  }

  /** Para nomes de arquivo: "inicio" e "hoje" quando o lado não foi informado. */
  public descricaoCurta(): string {
    return `${this.informado.de ?? "inicio"}_${this.informado.ate ?? "hoje"}`;
  }

  public toJSON() {
    return this.informado;
  }
}
