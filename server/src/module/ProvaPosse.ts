import path from "path";
import { Configuracao } from "../config/Configuracao";

/**
 * Arquivo que o reivindicante anexa para provar que é o dono (RF04.2): nota fiscal, foto antiga etc.
 * Até 3 por reivindicação, JPG, PNG ou PDF de até 5 MB. Fica na pasta privada provas/:
 * só o próprio reivindicante e o administrador podem baixar (RNF09).
 */
export class ProvaPosse {
  public static readonly TIPOS_ACEITOS = ["image/jpeg", "image/png", "application/pdf"];
  public static readonly TAMANHO_MAXIMO = 5 * 1024 * 1024;

  private id?: number;
  private caminho: string;
  private nomeOriginal: string;
  private reivindicacaoId: number;

  constructor(caminho: string, nomeOriginal: string, reivindicacaoId: number, id?: number) {
    this.caminho = caminho;
    this.nomeOriginal = nomeOriginal;
    this.reivindicacaoId = reivindicacaoId;
    this.id = id;
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getCaminho(): string {
    return this.caminho;
  }

  /** Caminho completo do arquivo, dentro da pasta privada de provas. */
  public getCaminhoNoDisco(): string {
    return path.join(Configuracao.pastaProvas, this.caminho);
  }

  public getNomeOriginal(): string {
    return this.nomeOriginal;
  }

  public getReivindicacaoId(): number {
    return this.reivindicacaoId;
  }

  /** Não expõe o caminho no disco. */
  public toJSON() {
    return { id: this.id, nomeOriginal: this.nomeOriginal };
  }
}
