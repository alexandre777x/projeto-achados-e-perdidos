import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PeriodoDeDatas } from "../../src/module/PeriodoDeDatas";
import { RelatorioDevolucoes, ItemDevolvido, ItemSobCustodia } from "../../src/module/RelatorioDevolucoes";
import { StatusItem } from "../../src/module/StatusItem";
import { erroDeNegocio } from "../verificar";

describe("PeriodoDeDatas", () => {
  test("lados vazios ficam abertos", () => {
    for (const vazio of [undefined, null, ""]) {
      const p = new PeriodoDeDatas(vazio, vazio);
      assert.equal(p.getDe(), "0001-01-01");
      assert.equal(p.getAte(), "9999-12-31");
      assert.equal(p.descricaoCurta(), "inicio_hoje");
      assert.deepEqual(p.toJSON(), { de: null, ate: null });
    }
  });

  test("datas informadas são mantidas", () => {
    const p = new PeriodoDeDatas("2026-10-01", "2026-10-31");
    assert.equal(p.getDe(), "2026-10-01");
    assert.equal(p.getAte(), "2026-10-31");
    assert.equal(p.descricaoCurta(), "2026-10-01_2026-10-31");
  });

  test("o mesmo dia nos dois lados é válido", () => {
    assert.doesNotThrow(() => new PeriodoDeDatas("2026-10-01", "2026-10-01"));
  });

  test("data inicial depois da final é recusada (CT17)", () => {
    assert.throws(() => new PeriodoDeDatas("2026-10-31", "2026-10-01"), erroDeNegocio(400, "inicial"));
  });

  test("formato diferente de AAAA-MM-DD é recusado", () => {
    for (const data of ["01/10/2026", "2026-10", "ontem", "2026-13-01"]) {
      assert.throws(() => new PeriodoDeDatas(data), erroDeNegocio(400, "AAAA-MM-DD"), data);
      assert.throws(() => new PeriodoDeDatas(undefined, data), erroDeNegocio(400, "AAAA-MM-DD"), data);
    }
  });
});

function devolvido(alteracoes: Partial<ItemDevolvido> = {}): ItemDevolvido {
  return {
    id: 1,
    titulo: "Celular",
    categoria: "Eletrônicos",
    local: "Bloco A",
    dataAchado: "2026-10-01",
    dataRegistro: "2026-10-01 10:00:00",
    dataDevolucao: "2026-10-03 10:00:00",
    diasAteDevolucao: 2,
    ...alteracoes,
  };
}

function guardado(status: StatusItem, alteracoes: Partial<ItemSobCustodia> = {}): ItemSobCustodia {
  return {
    id: 2,
    titulo: "Mochila",
    categoria: "Roupas",
    local: "Biblioteca",
    dataAchado: "2026-10-02",
    dataRegistro: "2026-10-02 10:00:00",
    status,
    ...alteracoes,
  };
}

function relatorio(devolvidos: ItemDevolvido[], guardados: ItemSobCustodia[] = []): RelatorioDevolucoes {
  return new RelatorioDevolucoes(new PeriodoDeDatas(), devolvidos, guardados);
}

/** Linhas do CSV sem o BOM do começo. */
function linhas(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n");
}

describe("RelatorioDevolucoes.tempoMedioDias (RF05.4)", () => {
  test("null quando nada foi devolvido", () => {
    assert.equal(relatorio([]).tempoMedioDias(), null);
  });

  test("média com uma casa decimal", () => {
    const r = relatorio([devolvido({ diasAteDevolucao: 1 }), devolvido({ diasAteDevolucao: 2 }), devolvido({ diasAteDevolucao: 2 })]);
    assert.equal(r.tempoMedioDias(), 1.7);
  });
});

describe("RelatorioDevolucoes.paraCsv (RF05.5)", () => {
  test("começa com BOM e usa ; e \\r\\n, para abrir certo no Excel", () => {
    const csv = relatorio([devolvido()]).paraCsv();
    assert.ok(csv.startsWith("﻿"));
    assert.equal(linhas(csv)[0].split(";").length, 9);
  });

  test("devolvidos e guardados aparecem com a situação certa", () => {
    const csv = relatorio(
      [devolvido()],
      [guardado(StatusItem.DISPONIVEL), guardado(StatusItem.EM_REIVINDICACAO, { id: 3 })]
    ).paraCsv();
    const [, l1, l2, l3] = linhas(csv);
    assert.ok(l1.startsWith("Devolvido;1;"));
    assert.ok(l2.startsWith("Disponível;2;"));
    assert.ok(l3.startsWith("Em reivindicação;3;"));
  });

  test("números com vírgula decimal e média no final", () => {
    const csv = relatorio([devolvido({ diasAteDevolucao: 1.5 })]).paraCsv();
    assert.ok(linhas(csv)[1].endsWith(";1,5"));
    assert.ok(csv.includes("Tempo médio até a devolução (dias);1,5"));
  });

  test("média vazia quando nada foi devolvido", () => {
    assert.ok(relatorio([]).paraCsv().includes("Tempo médio até a devolução (dias);\r\n"));
  });

  test("texto com ; ou aspas vai entre aspas, com aspas dobradas", () => {
    const csv = relatorio([devolvido({ titulo: 'Caneta "azul"; nova' })]).paraCsv();
    assert.ok(csv.includes('"Caneta ""azul""; nova"'));
  });

  test("texto com quebra de linha vai entre aspas", () => {
    const csv = relatorio([devolvido({ titulo: "linha 1\nlinha 2" })]).paraCsv();
    assert.ok(csv.includes('"linha 1\nlinha 2"'));
  });

  // CT18: o Excel executa células que começam com estes caracteres
  for (const inicio of ["=", "+", "-", "@", "\t"]) {
    test(`célula começando com ${JSON.stringify(inicio)} ganha apóstrofo (CT18)`, () => {
      const csv = relatorio([devolvido({ titulo: `${inicio}SOMA(1)` })]).paraCsv();
      assert.ok(csv.includes(`'${inicio}SOMA(1)`));
    });
  }

  test("número negativo também é protegido, por começar com -", () => {
    const csv = relatorio([devolvido({ diasAteDevolucao: -1 })]).paraCsv();
    assert.ok(linhas(csv)[1].endsWith(";'-1"));
  });

  test("nome do arquivo usa o período", () => {
    const r = new RelatorioDevolucoes(new PeriodoDeDatas("2026-10-01"), [], []);
    assert.equal(r.nomeDoArquivoCsv(), "relatorio-devolucoes_2026-10-01_hoje.csv");
  });

  test("toJSON traz período, listas e média", () => {
    const json = relatorio([devolvido()], [guardado(StatusItem.DISPONIVEL)]).toJSON();
    assert.equal(json.devolvidos.length, 1);
    assert.equal(json.disponiveis.length, 1);
    assert.equal(json.tempoMedioDias, 2);
  });
});
