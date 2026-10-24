import "../ambiente";
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import BetterSqlite3 from "better-sqlite3";
import { Configuracao } from "../../src/config/Configuracao";
import { Database } from "../../src/database/Database";

/**
 * Migração "local em texto" (23/10/2026). Monta um banco no formato ANTIGO, com o
 * schema.sql e o seed.sql de antes da mudança (guardados em test/dados), cheio de
 * dados ligados ao item, e confere que a migração não perde nem quebra nada.
 */
const DADOS = path.join(__dirname, "..", "dados");

function montarBancoAntigo(): void {
  const antigo = new BetterSqlite3(Configuracao.caminhoBanco);
  antigo.exec(fs.readFileSync(path.join(DADOS, "schema-antes-local-texto.sql"), "utf8"));
  antigo.exec(fs.readFileSync(path.join(DADOS, "seed-antes-local-texto.sql"), "utf8"));
  antigo.exec(`
    INSERT INTO local (nome) VALUES ('Sl');  -- 2 letras: o local antigo aceitava, o novo exige 3
    INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES
      ('Admin Um', 'admin@undb.edu.br', 'h', 'ADMINISTRADOR'),
      ('Ana Aluna', 'ana@undb.edu.br', 'h', 'ALUNO');
    INSERT INTO item (id, titulo, descricao, data_achado, status, data_registro, categoria_id, local_id, registrado_por) VALUES
      (1, 'Mochila preta', 'Mochila', '2026-10-01', 'DEVOLVIDO', '2026-10-01 10:00:00', 3, 3, 2),
      (2, 'Chave com chaveiro', 'Chave', '2026-10-05', 'DISPONIVEL', '2026-10-05 10:00:00', 5, 1, 2),
      (7, 'Caderno', 'Caderno azul', '2026-10-06', 'EM_REIVINDICACAO', '2026-10-06 10:00:00', 4, 7, 2);
    INSERT INTO foto (caminho, item_id) VALUES ('a.png', 1), ('b.png', 2);
    INSERT INTO reivindicacao (id, status, respostas_validacao, item_id, reivindicante_id, decidido_por)
      VALUES (1, 'APROVADA', 'capinha', 1, 2, 1), (2, 'ABERTA', 'nome na capa', 7, 2, NULL);
    INSERT INTO devolucao (tipo_documento, reivindicacao_id, administrador_id) VALUES ('RG', 1, 1);
    INSERT INTO mensagem (texto, reivindicacao_id, autor_id) VALUES ('é meu', 1, 2);
    INSERT INTO historico_status (status_anterior, status_novo, item_id, usuario_id) VALUES
      (NULL, 'DISPONIVEL', 1, 1), ('DISPONIVEL', 'EM_REIVINDICACAO', 1, 2), ('EM_REIVINDICACAO', 'DEVOLVIDO', 1, 1);
  `);
  antigo.close();
}

const db = () => Database.getInstancia().getConexao();
const linhas = <T>(sql: string) => db().prepare(sql).all() as T[];

describe("migração: local da lista para texto livre", () => {
  let logs: string[] = [];

  before(() => {
    montarBancoAntigo();
    const logOriginal = console.log;
    console.log = (...partes: unknown[]) => logs.push(partes.join(" "));
    try {
      assert.equal(Database.getInstancia().inicializar(), false, "banco existente não é recriado");
    } finally {
      console.log = logOriginal;
    }
  });

  test("a coluna local_id sai e entra local_encontrado; a tabela local é removida", () => {
    const colunas = linhas<{ name: string }>("PRAGMA table_info(item)").map((c) => c.name);
    assert.ok(colunas.includes("local_encontrado"));
    assert.ok(!colunas.includes("local_id"));
    assert.equal(linhas("SELECT name FROM sqlite_master WHERE name = 'local'").length, 0);
  });

  test("cada item recebe o nome do local que tinha", () => {
    assert.deepEqual(linhas("SELECT id, local_encontrado FROM item ORDER BY id"), [
      { id: 1, local_encontrado: "Biblioteca" },
      { id: 2, local_encontrado: "Bloco A" },
      { id: 7, local_encontrado: "Local Sl" }, // nome curto demais ganha um prefixo para caber na regra nova
    ]);
  });

  test("nenhum outro dado do item muda, nem os ids", () => {
    assert.deepEqual(linhas("SELECT id, titulo, status, data_registro, categoria_id, registrado_por FROM item ORDER BY id"), [
      { id: 1, titulo: "Mochila preta", status: "DEVOLVIDO", data_registro: "2026-10-01 10:00:00", categoria_id: 3, registrado_por: 2 },
      { id: 2, titulo: "Chave com chaveiro", status: "DISPONIVEL", data_registro: "2026-10-05 10:00:00", categoria_id: 5, registrado_por: 2 },
      { id: 7, titulo: "Caderno", status: "EM_REIVINDICACAO", data_registro: "2026-10-06 10:00:00", categoria_id: 4, registrado_por: 2 },
    ]);
  });

  test("fotos, reivindicações, devolução, mensagens e histórico continuam ligados ao item", () => {
    assert.equal(linhas("SELECT 1 FROM foto f JOIN item i ON i.id = f.item_id").length, 2);
    assert.equal(linhas("SELECT 1 FROM reivindicacao r JOIN item i ON i.id = r.item_id").length, 2);
    assert.equal(linhas("SELECT 1 FROM devolucao d JOIN reivindicacao r ON r.id = d.reivindicacao_id").length, 1);
    assert.equal(linhas("SELECT 1 FROM mensagem").length, 1);
    assert.equal(linhas("SELECT 1 FROM historico_status h JOIN item i ON i.id = h.item_id").length, 3);
    assert.deepEqual(db().pragma("foreign_key_check"), []);
  });

  test("as chaves estrangeiras continuam ligadas e valendo depois da migração", () => {
    assert.equal(db().pragma("foreign_keys", { simple: true }), 1);
    assert.throws(() => db().prepare("INSERT INTO foto (caminho, item_id) VALUES ('x.png', 999)").run(), /FOREIGN KEY/);
    assert.throws(
      () => db().prepare("DELETE FROM item WHERE id = 1").run(),
      /FOREIGN KEY/,
      "a reivindicação e o histórico do item 1 impedem apagá-lo"
    );
  });

  test("as regras da coluna nova valem e o índice da busca foi recriado", () => {
    const inserir = (local: string) =>
      db()
        .prepare("INSERT INTO item (titulo, descricao, data_achado, local_encontrado, categoria_id, registrado_por) VALUES ('Teste', 'x', '2026-10-01', ?, 1, 1)")
        .run(local);
    assert.throws(() => inserir("ab"), /CHECK/);
    assert.doesNotThrow(() => inserir("Bloco B, escada"));
    assert.equal(linhas("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_item_busca'").length, 1);
  });

  test("guarda uma cópia do banco antigo antes de mudar", () => {
    const copia = `${Configuracao.caminhoBanco}.antes-local-em-texto.bak`;
    assert.ok(fs.existsSync(copia));
    const antigo = new BetterSqlite3(copia, { readonly: true });
    try {
      assert.equal((antigo.prepare("SELECT COUNT(*) AS n FROM local").get() as { n: number }).n, 7);
    } finally {
      antigo.close();
    }
    assert.ok(logs.some((l) => l.includes("Banco atualizado")));
  });

  test("cria a tabela das mensagens lidas, com as mensagens antigas já lidas pelos dois lados", () => {
    assert.deepEqual(linhas("SELECT reivindicacao_id, lado, ultima_mensagem_id FROM leitura_conversa ORDER BY lado"), [
      { reivindicacao_id: 1, lado: "ADMINISTRACAO", ultima_mensagem_id: 1 },
      { reivindicacao_id: 1, lado: "REIVINDICANTE", ultima_mensagem_id: 1 },
    ]);
    assert.ok(logs.some((l) => l.includes("mensagens não lidas")));
    assert.throws(
      () => db().prepare("INSERT INTO leitura_conversa (reivindicacao_id, lado) VALUES (1, 'OUTRO')").run(),
      /CHECK/
    );
  });

  test("rodar de novo não faz nada (o banco já está no formato novo)", () => {
    const antes = linhas("SELECT * FROM item ORDER BY id");
    logs = [];
    const logOriginal = console.log;
    console.log = (...partes: unknown[]) => logs.push(partes.join(" "));
    try {
      Database.getInstancia().inicializar();
    } finally {
      console.log = logOriginal;
    }
    assert.deepEqual(linhas("SELECT * FROM item ORDER BY id"), antes);
    assert.deepEqual(logs, []);
  });
});
