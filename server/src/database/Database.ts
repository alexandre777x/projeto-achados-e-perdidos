import fs from "fs";
import path from "path";
import BetterSqlite3 from "better-sqlite3";
import { Configuracao } from "../config/Configuracao";

/**
 * Encapsula a conexão com o banco SQLite (arquivo data/campuslost.db).
 * Implementada como singleton: a aplicação inteira compartilha a mesma conexão.
 */
export class Database {
  private static instancia: Database;

  private readonly conexao: BetterSqlite3.Database;

  private constructor() {
    fs.mkdirSync(path.dirname(Configuracao.caminhoBanco), { recursive: true });
    this.conexao = new BetterSqlite3(Configuracao.caminhoBanco);
    this.conexao.pragma("foreign_keys = ON");
  }

  public static getInstancia(): Database {
    if (!Database.instancia) {
      Database.instancia = new Database();
    }
    return Database.instancia;
  }

  public getConexao(): BetterSqlite3.Database {
    return this.conexao;
  }

  /**
   * Na primeira execução, cria as tabelas (schema.sql) e os dados iniciais (seed.sql).
   * Devolve true se o banco acabou de ser criado.
   */
  public inicializar(): boolean {
    const jaExiste = this.conexao
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'usuario'")
      .get();
    if (jaExiste) {
      return false;
    }

    this.conexao.exec(Database.lerSql("schema.sql"));
    this.conexao.exec(Database.lerSql("seed.sql"));
    return true;
  }

  public contarTabelas(): number {
    const linha = this.conexao
      .prepare<[], { total: number }>(
        "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .get();
    return linha?.total ?? 0;
  }

  private static lerSql(arquivo: string): string {
    return fs.readFileSync(path.join(Configuracao.PASTA_SQL, arquivo), "utf8");
  }
}
