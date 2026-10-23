import BetterSqlite3 from "better-sqlite3";
import { Database } from "../database/Database";

/**
 * Classe base para todos os repositórios: cada um ganha acesso à mesma
 * conexão com o banco sem precisar repetir a lógica de obtê-la.
 */
export abstract class Repositorio {
  protected readonly db: BetterSqlite3.Database;

  constructor() {
    this.db = Database.getInstancia().getConexao();
  }

  /**
   * Roda tudo de uma vez: se algo falhar, nada é gravado. Como todos os repositórios
   * usam a mesma conexão, a transação vale também para chamadas a outros repositórios.
   */
  public emTransacao<T>(operacao: () => T): T {
    return this.db.transaction(operacao)();
  }
}
