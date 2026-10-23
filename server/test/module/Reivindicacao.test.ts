import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Reivindicacao, DadosReivindicacao } from "../../src/module/Reivindicacao";
import { StatusReivindicacao } from "../../src/module/StatusReivindicacao";
import { erroDeNegocio } from "../verificar";

function nova(alteracoes: Partial<DadosReivindicacao> = {}): Reivindicacao {
  return new Reivindicacao({ itemId: 1, reivindicanteId: 2, respostasValidacao: "Capinha azul", ...alteracoes });
}

describe("Reivindicacao: construtor (RF04.2)", () => {
  test("começa ABERTA, sem decisão", () => {
    const r = nova();
    assert.equal(r.getStatus(), StatusReivindicacao.ABERTA);
    assert.equal(r.getMotivoRejeicao(), null);
    assert.equal(r.getDecididoPor(), null);
    assert.equal(r.estaAprovada(), false);
  });

  test("respostas obrigatórias, até 2000 caracteres, sem espaços nas pontas", () => {
    assert.throws(() => nova({ respostasValidacao: "   " }), erroDeNegocio(400, "perguntas"));
    assert.throws(() => nova({ respostasValidacao: undefined as unknown as string }), erroDeNegocio(400));
    assert.throws(() => nova({ respostasValidacao: "a".repeat(2001) }), erroDeNegocio(400));
    assert.equal(nova({ respostasValidacao: "  ok  " }).getRespostasValidacao(), "ok");
    assert.doesNotThrow(() => nova({ respostasValidacao: "a".repeat(2000) }));
  });
});

describe("Reivindicacao.aprovar e rejeitar (RF04.4)", () => {
  test("aprovar registra quem decidiu", () => {
    const r = nova();
    r.aprovar(9);
    assert.equal(r.getStatus(), StatusReivindicacao.APROVADA);
    assert.equal(r.getDecididoPor(), 9);
    assert.equal(r.estaAprovada(), true);
  });

  test("rejeitar exige motivo de 1 a 500 caracteres", () => {
    assert.throws(() => nova().rejeitar(9, ""), erroDeNegocio(400, "motivo"));
    assert.throws(() => nova().rejeitar(9, "   "), erroDeNegocio(400, "motivo"));
    assert.throws(() => nova().rejeitar(9, undefined as unknown as string), erroDeNegocio(400, "motivo"));
    assert.throws(() => nova().rejeitar(9, "a".repeat(501)), erroDeNegocio(400, "motivo"));

    const r = nova();
    r.rejeitar(9, "  não confere  ");
    assert.equal(r.getStatus(), StatusReivindicacao.REJEITADA);
    assert.equal(r.getMotivoRejeicao(), "não confere");
    assert.equal(r.getDecididoPor(), 9);
  });

  test("rejeição recusada por falta de motivo não altera a reivindicação", () => {
    const r = nova();
    assert.throws(() => r.rejeitar(9, ""));
    assert.equal(r.getStatus(), StatusReivindicacao.ABERTA);
  });

  for (const status of [StatusReivindicacao.APROVADA, StatusReivindicacao.REJEITADA]) {
    test(`já ${status}: não pode ser aprovada nem rejeitada de novo`, () => {
      assert.throws(() => nova({ status }).aprovar(9), erroDeNegocio(409, "já foi decidida"));
      assert.throws(() => nova({ status }).rejeitar(9, "motivo"), erroDeNegocio(409, "já foi decidida"));
    });
  }
});

describe("Reivindicacao.toJSON", () => {
  test("traz os dados da reivindicação", () => {
    const json = nova({ id: 3, dataAbertura: "2026-10-01 10:00:00" }).toJSON();
    assert.equal(json.id, 3);
    assert.equal(json.itemId, 1);
    assert.equal(json.reivindicanteId, 2);
    assert.equal(json.status, StatusReivindicacao.ABERTA);
    assert.equal(json.dataDecisao, null);
  });
});
