import { ErroDeNegocio } from "./ErroDeNegocio";

/** Conversa entre o reivindicante e o administrador dentro da reivindicação (RF04.3). */
export class Mensagem {
  private id?: number;
  private texto: string;
  private reivindicacaoId: number;
  private autorId: number;
  private dataEnvio?: string;

  constructor(texto: string, reivindicacaoId: number, autorId: number, id?: number, dataEnvio?: string) {
    texto = String(texto ?? "").trim();
    if (texto.length === 0 || texto.length > 1000) {
      throw new ErroDeNegocio("A mensagem precisa ter entre 1 e 1000 caracteres.");
    }
    this.texto = texto;
    this.reivindicacaoId = reivindicacaoId;
    this.autorId = autorId;
    this.id = id;
    this.dataEnvio = dataEnvio;
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getTexto(): string {
    return this.texto;
  }

  public getReivindicacaoId(): number {
    return this.reivindicacaoId;
  }

  public getAutorId(): number {
    return this.autorId;
  }

  public toJSON() {
    return {
      id: this.id,
      texto: this.texto,
      reivindicacaoId: this.reivindicacaoId,
      autorId: this.autorId,
      dataEnvio: this.dataEnvio,
    };
  }
}
