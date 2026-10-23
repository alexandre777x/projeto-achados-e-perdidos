import { Repositorio } from "./Repositorio";
import { Local } from "../module/Local";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

interface LinhaLocal {
  id: number;
  nome: string;
}

/** Tabela local (RF02.3). */
export class LocalRepository extends Repositorio {
  /** Em ordem alfabética, para as listas de escolha. */
  public listarTodos(): Local[] {
    return this.db
      .prepare<[], LinhaLocal>("SELECT id, nome FROM local ORDER BY nome COLLATE NOCASE")
      .all()
      .map((linha) => new Local(linha.nome, linha.id));
  }

  public buscarPorId(id: number): Local | null {
    const linha = this.db.prepare<[number], LinhaLocal>("SELECT id, nome FROM local WHERE id = ?").get(id);
    return linha ? new Local(linha.nome, linha.id) : null;
  }

  /** Recusa nome repetido, sem diferenciar maiúsculas de minúsculas. */
  public salvar(local: Local): Local {
    const repetido = this.db.prepare("SELECT 1 FROM local WHERE nome = ? COLLATE NOCASE").get(local.getNome());
    if (repetido) {
      throw new ErroDeNegocio("Já existe um local com este nome.", 409);
    }
    const resultado = this.db.prepare("INSERT INTO local (nome) VALUES (?)").run(local.getNome());
    return new Local(local.getNome(), Number(resultado.lastInsertRowid));
  }
}
