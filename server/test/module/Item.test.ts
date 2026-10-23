import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Item, DadosItem } from "../../src/module/Item";
import { StatusItem } from "../../src/module/StatusItem";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { erroDeNegocio } from "../verificar";

function dados(alteracoes: Partial<DadosItem> = {}): DadosItem {
  return {
    titulo: "Garrafa azul",
    descricao: "Garrafa térmica",
    dataAchado: "2026-10-01",
    categoriaId: 1,
    localId: 1,
    registradoPor: 1,
    ...alteracoes,
  };
}

function hojeLocal(): string {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

describe("Item: validação do construtor (RF02.1, RF02.4)", () => {
  test("aceita dados válidos e tira espaços do título e da descrição", () => {
    const item = new Item(dados({ titulo: "  Garrafa  ", descricao: "  azul  " }));
    assert.equal(item.getTitulo(), "Garrafa");
    assert.equal(item.getDescricao(), "azul");
  });

  test("status padrão é AGUARDANDO_RECEBIMENTO", () => {
    assert.equal(new Item(dados()).getStatus(), StatusItem.AGUARDANDO_RECEBIMENTO);
  });

  test("título: limites de 3 e 80 caracteres", () => {
    assert.throws(() => new Item(dados({ titulo: "ab" })), erroDeNegocio(400, "título"));
    assert.throws(() => new Item(dados({ titulo: "a".repeat(81) })), erroDeNegocio(400, "título"));
    assert.doesNotThrow(() => new Item(dados({ titulo: "abc" })));
    assert.doesNotThrow(() => new Item(dados({ titulo: "a".repeat(80) })));
  });

  test("título ausente conta como vazio", () => {
    assert.throws(() => new Item(dados({ titulo: undefined as unknown as string })), erroDeNegocio(400, "título"));
  });

  test("descrição: obrigatória e com no máximo 1000 caracteres", () => {
    assert.throws(() => new Item(dados({ descricao: "   " })), erroDeNegocio(400, "descrição"));
    assert.throws(() => new Item(dados({ descricao: "a".repeat(1001) })), erroDeNegocio(400, "descrição"));
    assert.throws(() => new Item(dados({ descricao: undefined as unknown as string })), erroDeNegocio(400, "descrição"));
    assert.doesNotThrow(() => new Item(dados({ descricao: "a".repeat(1000) })));
  });

  test("data do achado: formato AAAA-MM-DD", () => {
    for (const data of ["01/10/2026", "2026-1-1", "", "2026-13-01"]) {
      assert.throws(() => new Item(dados({ dataAchado: data })), erroDeNegocio(400, "AAAA-MM-DD"), data);
    }
  });

  test("data do achado: hoje é aceito, amanhã não (RF02.4)", () => {
    assert.doesNotThrow(() => new Item(dados({ dataAchado: hojeLocal() })));
    assert.throws(() => new Item(dados({ dataAchado: "2999-01-01" })), erroDeNegocio(400, "futura"));
  });
});

describe("Item.statusInicial (RF02.5)", () => {
  test("administrador registra como DISPONIVEL", () => {
    assert.equal(Item.statusInicial(PerfilUsuario.ADMINISTRADOR), StatusItem.DISPONIVEL);
  });

  test("aluno e professor registram como AGUARDANDO_RECEBIMENTO", () => {
    assert.equal(Item.statusInicial(PerfilUsuario.ALUNO), StatusItem.AGUARDANDO_RECEBIMENTO);
    assert.equal(Item.statusInicial(PerfilUsuario.PROFESSOR), StatusItem.AGUARDANDO_RECEBIMENTO);
  });
});

describe("Item.mudarStatus: ciclo de vida do SRS", () => {
  const permitidas = new Set([
    "AGUARDANDO_RECEBIMENTO>DISPONIVEL",
    "DISPONIVEL>EM_REIVINDICACAO",
    "EM_REIVINDICACAO>DISPONIVEL",
    "EM_REIVINDICACAO>DEVOLVIDO",
  ]);
  const todos = Object.values(StatusItem);

  // As 16 combinações (de, para): 4 permitidas e 12 proibidas
  for (const de of todos) {
    for (const para of todos) {
      const permitida = permitidas.has(`${de}>${para}`);
      test(`${de} -> ${para}: ${permitida ? "permitida" : "proibida"}`, () => {
        const item = new Item(dados({ status: de }));
        if (permitida) {
          assert.equal(item.mudarStatus(para), de, "devolve o status anterior (para o histórico)");
          assert.equal(item.getStatus(), para);
        } else {
          assert.throws(() => item.mudarStatus(para), erroDeNegocio(409));
          assert.equal(item.getStatus(), de, "o status não muda quando a transição é recusada");
        }
      });
    }
  }

  test("DEVOLVIDO é estado final", () => {
    const item = new Item(dados({ status: StatusItem.DEVOLVIDO }));
    for (const para of todos) {
      assert.throws(() => item.mudarStatus(para), erroDeNegocio(409));
    }
  });
});

describe("Item: consultas e visão pública", () => {
  test("estaDisponivel só para DISPONIVEL", () => {
    for (const status of Object.values(StatusItem)) {
      assert.equal(new Item(dados({ status })).estaDisponivel(), status === StatusItem.DISPONIVEL);
    }
  });

  test("toJSON não revela quem registrou (RF03.5, RNF09)", () => {
    const json = new Item(dados({ registradoPor: 42, id: 7 })).toJSON();
    assert.equal(json.id, 7);
    assert.ok(!("registradoPor" in json));
    assert.ok(!JSON.stringify(json).includes("42"));
  });

  test("getters devolvem o que foi informado", () => {
    const item = new Item(dados({ categoriaId: 3, localId: 4, registradoPor: 5, dataRegistro: "2026-10-02 10:00:00" }));
    assert.equal(item.getCategoriaId(), 3);
    assert.equal(item.getLocalId(), 4);
    assert.equal(item.getRegistradoPor(), 5);
    assert.equal(item.getDataAchado(), "2026-10-01");
    assert.equal(item.getDataRegistro(), "2026-10-02 10:00:00");
  });
});
