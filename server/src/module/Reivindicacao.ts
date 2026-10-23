import { ErroDeNegocio } from "./ErroDeNegocio";
import { StatusReivindicacao } from "./StatusReivindicacao";

export interface DadosReivindicacao {
  itemId: number;
  reivindicanteId: number;
  respostasValidacao: string;
  status?: StatusReivindicacao;
  motivoRejeicao?: string | null;
  decididoPor?: number | null;
  dataAbertura?: string;
  dataDecisao?: string | null;
  id?: number;
}

/** Pedido de quem diz ser o dono de um item (RF04). */
export class Reivindicacao {
  public static readonly MAX_PROVAS = 3;

  private id?: number;
  private itemId: number;
  private reivindicanteId: number;
  private respostasValidacao: string;
  private status: StatusReivindicacao;
  private motivoRejeicao: string | null;
  private decididoPor: number | null;
  private dataAbertura?: string;
  private dataDecisao: string | null;

  constructor(dados: DadosReivindicacao) {
    const respostas = String(dados.respostasValidacao ?? "").trim();
    if (respostas.length === 0 || respostas.length > 2000) {
      throw new ErroDeNegocio("Responda às perguntas de validação (até 2000 caracteres).");
    }

    this.itemId = dados.itemId;
    this.reivindicanteId = dados.reivindicanteId;
    this.respostasValidacao = respostas;
    this.status = dados.status ?? StatusReivindicacao.ABERTA;
    this.motivoRejeicao = dados.motivoRejeicao ?? null;
    this.decididoPor = dados.decididoPor ?? null;
    this.dataAbertura = dados.dataAbertura;
    this.dataDecisao = dados.dataDecisao ?? null;
    this.id = dados.id;
  }

  /** RF04.4 */
  public aprovar(administradorId: number): void {
    this.exigirAberta();
    this.status = StatusReivindicacao.APROVADA;
    this.decididoPor = administradorId;
  }

  /** RF04.4: a rejeição exige motivo. */
  public rejeitar(administradorId: number, motivo: string): void {
    this.exigirAberta();
    motivo = String(motivo ?? "").trim();
    if (motivo.length === 0 || motivo.length > 500) {
      throw new ErroDeNegocio("Informe o motivo da rejeição (até 500 caracteres).");
    }
    this.status = StatusReivindicacao.REJEITADA;
    this.motivoRejeicao = motivo;
    this.decididoPor = administradorId;
  }

  private exigirAberta(): void {
    if (this.status !== StatusReivindicacao.ABERTA) {
      throw new ErroDeNegocio("Esta reivindicação já foi decidida.", 409);
    }
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getItemId(): number {
    return this.itemId;
  }

  public getReivindicanteId(): number {
    return this.reivindicanteId;
  }

  public getRespostasValidacao(): string {
    return this.respostasValidacao;
  }

  public getStatus(): StatusReivindicacao {
    return this.status;
  }

  public getMotivoRejeicao(): string | null {
    return this.motivoRejeicao;
  }

  public getDecididoPor(): number | null {
    return this.decididoPor;
  }

  public estaAprovada(): boolean {
    return this.status === StatusReivindicacao.APROVADA;
  }

  public toJSON() {
    return {
      id: this.id,
      itemId: this.itemId,
      reivindicanteId: this.reivindicanteId,
      respostasValidacao: this.respostasValidacao,
      status: this.status,
      motivoRejeicao: this.motivoRejeicao,
      dataAbertura: this.dataAbertura,
      dataDecisao: this.dataDecisao,
    };
  }
}
