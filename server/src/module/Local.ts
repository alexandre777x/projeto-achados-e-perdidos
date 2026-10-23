import { ErroDeNegocio } from "./ErroDeNegocio";

/** Lugar do campus onde o item foi encontrado, mantido pelo administrador (RF02.3). */
export class Local {
  private id?: number;
  private nome: string;

  constructor(nome: string, id?: number) {
    nome = String(nome ?? "").trim();
    if (nome.length < 2 || nome.length > 80) {
      throw new ErroDeNegocio("O nome do local precisa ter entre 2 e 80 caracteres.");
    }
    this.nome = nome;
    this.id = id;
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getNome(): string {
    return this.nome;
  }

  public toJSON() {
    return { id: this.id, nome: this.nome };
  }
}
