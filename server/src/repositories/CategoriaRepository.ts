import { Repositorio } from "./Repositorio";
import { Categoria } from "../module/Categoria";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

interface LinhaCategoria {
  id: number;
  nome: string;
}

/** Tabela categoria (RF02.3). */
export class CategoriaRepository extends Repositorio {
  /** Em ordem alfabética, para as listas de escolha. */
  public listarTodas(): Categoria[] {
    return this.db
      .prepare<[], LinhaCategoria>("SELECT id, nome FROM categoria ORDER BY nome COLLATE NOCASE")
      .all()
      .map((linha) => new Categoria(linha.nome, linha.id));
  }

  public buscarPorId(id: number): Categoria | null {
    const linha = this.db.prepare<[number], LinhaCategoria>("SELECT id, nome FROM categoria WHERE id = ?").get(id);
    return linha ? new Categoria(linha.nome, linha.id) : null;
  }

  /** Recusa nome repetido, sem diferenciar maiúsculas de minúsculas. */
  public salvar(categoria: Categoria): Categoria {
    const repetida = this.db
      .prepare("SELECT 1 FROM categoria WHERE nome = ? COLLATE NOCASE")
      .get(categoria.getNome());
    if (repetida) {
      throw new ErroDeNegocio("Já existe uma categoria com este nome.", 409);
    }
    const resultado = this.db.prepare("INSERT INTO categoria (nome) VALUES (?)").run(categoria.getNome());
    return new Categoria(categoria.getNome(), Number(resultado.lastInsertRowid));
  }
}
