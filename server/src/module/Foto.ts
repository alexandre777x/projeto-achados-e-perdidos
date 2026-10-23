import path from "path";
import { Configuracao } from "../config/Configuracao";

/** Foto de um item (RF02.2): de 1 a 3 por item, JPG ou PNG, até 5 MB cada. Pública. */
export class Foto {
  public static readonly TIPOS_ACEITOS = ["image/jpeg", "image/png"];
  public static readonly TAMANHO_MAXIMO = 5 * 1024 * 1024;

  private id?: number;
  private caminho: string;
  private itemId: number;

  constructor(caminho: string, itemId: number, id?: number) {
    this.caminho = caminho;
    this.itemId = itemId;
    this.id = id;
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getCaminho(): string {
    return this.caminho;
  }

  /** Caminho completo do arquivo, dentro da pasta de uploads. */
  public getCaminhoNoDisco(): string {
    return path.join(Configuracao.pastaUploads, this.caminho);
  }

  public getItemId(): number {
    return this.itemId;
  }

  public toJSON() {
    return { id: this.id, url: `/uploads/${this.caminho}` };
  }
}
