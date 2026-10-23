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
   * Num banco que já existe, aplica as migrações pendentes.
   * Devolve true se o banco acabou de ser criado.
   */
  public inicializar(): boolean {
    const jaExiste = this.conexao
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'usuario'")
      .get();
    if (jaExiste) {
      this.migrarLocalParaTexto();
      return false;
    }

    this.conexao.exec(Database.lerSql("schema.sql"));
    this.conexao.exec(Database.lerSql("seed.sql"));
    return true;
  }

  /**
   * Migração de 23/10/2026: o local do item deixou de ser escolhido numa lista (tabela local)
   * e passou a ser escrito por quem achou (coluna item.local_encontrado). Os itens antigos
   * recebem o nome do local que tinham. Antes de mudar, guarda uma cópia do banco ao lado
   * do arquivo original. Não faz nada se o banco já estiver no formato novo.
   *
   * O SQLite não remove uma coluna com chave estrangeira, então a tabela item é recriada:
   * cria a nova, copia os dados, apaga a antiga e renomeia (procedimento da documentação do SQLite).
   */
  private migrarLocalParaTexto(): void {
    const colunas = this.conexao.prepare<[], { name: string }>("PRAGMA table_info(item)").all();
    if (!colunas.some((c) => c.name === "local_id")) {
      return;
    }

    if (fs.existsSync(Configuracao.caminhoBanco)) {
      fs.copyFileSync(Configuracao.caminhoBanco, `${Configuracao.caminhoBanco}.antes-local-em-texto.bak`);
    }

    this.conexao.pragma("foreign_keys = OFF");
    try {
      this.conexao.transaction(() => {
        this.conexao.exec(`
          CREATE TABLE item_novo (
              id             INTEGER PRIMARY KEY AUTOINCREMENT,
              titulo         TEXT NOT NULL CHECK (length(titulo) BETWEEN 3 AND 80),
              descricao      TEXT NOT NULL CHECK (length(descricao) <= 1000),
              data_achado    TEXT NOT NULL,
              status         TEXT NOT NULL DEFAULT 'AGUARDANDO_RECEBIMENTO'
                             CHECK (status IN ('AGUARDANDO_RECEBIMENTO','DISPONIVEL','EM_REIVINDICACAO','DEVOLVIDO')),
              data_registro  TEXT NOT NULL DEFAULT (datetime('now')),
              local_encontrado TEXT NOT NULL CHECK (length(local_encontrado) BETWEEN 3 AND 150),
              categoria_id   INTEGER NOT NULL REFERENCES categoria(id),
              registrado_por INTEGER NOT NULL REFERENCES usuario(id)
          );

          INSERT INTO item_novo (id, titulo, descricao, data_achado, status, data_registro,
                                 local_encontrado, categoria_id, registrado_por)
          SELECT i.id, i.titulo, i.descricao, i.data_achado, i.status, i.data_registro,
                 CASE
                   WHEN l.nome IS NULL THEN 'Não informado'
                   WHEN length(l.nome) < 3 THEN 'Local ' || l.nome
                   ELSE substr(l.nome, 1, 150)
                 END,
                 i.categoria_id, i.registrado_por
          FROM item i
          LEFT JOIN local l ON l.id = i.local_id;

          DROP TABLE item;
          ALTER TABLE item_novo RENAME TO item;
          CREATE INDEX idx_item_busca ON item (status, categoria_id, data_achado);
          DROP TABLE local;
        `);

        const quebradas = this.conexao.pragma("foreign_key_check") as unknown[];
        if (quebradas.length > 0) {
          throw new Error(`Migração do local cancelada: ${quebradas.length} referência(s) inválida(s).`);
        }
      })();
    } finally {
      this.conexao.pragma("foreign_keys = ON");
    }
    console.log("Banco atualizado: o local dos itens agora é texto livre (cópia de segurança em .antes-local-em-texto.bak).");
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
