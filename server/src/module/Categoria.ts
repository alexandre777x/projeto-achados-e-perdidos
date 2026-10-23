import { ErroDeNegocio } from "./ErroDeNegocio";

/** Lista mantida pelo administrador e usada no registro e na busca de itens (RF02.3). */
export class Categoria {
  private id?: number;
  private nome: string;

  constructor(nome: string, id?: number) {
    nome = String(nome ?? "").trim();
    if (nome.length < 2 || nome.length > 80) {
      throw new ErroDeNegocio("O nome da categoria precisa ter entre 2 e 80 caracteres.");
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
