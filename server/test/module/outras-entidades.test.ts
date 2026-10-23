import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Usuario } from "../../src/module/Usuario";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { Devolucao } from "../../src/module/Devolucao";
import { TipoDocumento } from "../../src/module/TipoDocumento";
import { Categoria } from "../../src/module/Categoria";
import { Mensagem } from "../../src/module/Mensagem";
import { Foto } from "../../src/module/Foto";
import { ProvaPosse } from "../../src/module/ProvaPosse";
import { HistoricoStatus } from "../../src/module/HistoricoStatus";
import { StatusItem } from "../../src/module/StatusItem";
import { ErroDeNegocio } from "../../src/module/ErroDeNegocio";
import { erroDeNegocio } from "../verificar";

describe("Usuario (RF01)", () => {
  test("normaliza o e-mail para minúsculas e tira espaços", () => {
    const u = new Usuario("  Ana Silva ", " Ana@UNDB.edu.br ", "hash", PerfilUsuario.ALUNO);
    assert.equal(u.getNome(), "Ana Silva");
    assert.equal(u.getEmail(), "ana@undb.edu.br");
    assert.equal(u.estaAtivo(), true, "ativo por padrão");
  });

  test("nome de 3 a 100 caracteres", () => {
    assert.throws(() => new Usuario("Al", "a@b.com", "h", PerfilUsuario.ALUNO), erroDeNegocio(400, "nome"));
    assert.throws(() => new Usuario("a".repeat(101), "a@b.com", "h", PerfilUsuario.ALUNO), erroDeNegocio(400, "nome"));
  });

  test("e-mail precisa ter formato válido", () => {
    for (const email of ["sem-arroba", "a@b", "a b@c.com", ""]) {
      assert.throws(() => new Usuario("Ana Silva", email, "h", PerfilUsuario.ALUNO), erroDeNegocio(400, "e-mail"), email);
    }
  });

  test("perfil fora da lista é recusado", () => {
    assert.throws(
      () => new Usuario("Ana Silva", "a@b.com", "h", "REITOR" as PerfilUsuario),
      erroDeNegocio(400, "perfil")
    );
  });

  test("ehAdministrador só para ADMINISTRADOR", () => {
    for (const perfil of Object.values(PerfilUsuario)) {
      const u = new Usuario("Ana Silva", "a@b.com", "h", perfil);
      assert.equal(u.ehAdministrador(), perfil === PerfilUsuario.ADMINISTRADOR);
    }
  });

  test("senha: mínimo de 8 caracteres e precisa ser texto", () => {
    assert.throws(() => Usuario.validarSenha("1234567"), erroDeNegocio(400, "8"));
    assert.throws(() => Usuario.validarSenha(12345678 as unknown as string), erroDeNegocio(400));
    assert.doesNotThrow(() => Usuario.validarSenha("12345678"));
  });

  test("comSenha guarda só o hash, e senhaConfere compara (RNF01)", async () => {
    const u = await Usuario.comSenha("Ana Silva", "a@b.com", "minhasenha", PerfilUsuario.ALUNO);
    assert.notEqual(u.getSenhaHash(), "minhasenha");
    assert.equal(await u.senhaConfere("minhasenha"), true);
    assert.equal(await u.senhaConfere("outrasenha"), false);
    assert.equal(await u.senhaConfere(undefined as unknown as string), false);
  });

  test("toJSON nunca inclui o hash da senha", () => {
    const json = new Usuario("Ana Silva", "a@b.com", "hash-secreto", PerfilUsuario.ALUNO).toJSON();
    assert.ok(!JSON.stringify(json).includes("hash-secreto"));
  });
});

describe("Devolucao (RF05.2, RNF10)", () => {
  test("aceita os tipos de documento da lista", () => {
    for (const tipo of Object.values(TipoDocumento)) {
      assert.equal(new Devolucao(1, 2, tipo).getTipoDocumento(), tipo);
    }
  });

  test("recusa tipo fora da lista ou ausente", () => {
    assert.throws(() => new Devolucao(1, 2, "PASSAPORTE" as TipoDocumento), erroDeNegocio(400, "documento"));
    assert.throws(() => new Devolucao(1, 2, undefined as unknown as TipoDocumento), erroDeNegocio(400));
  });

  test("toJSON e getters", () => {
    const d = new Devolucao(1, 2, TipoDocumento.RG, 5, "2026-10-01 10:00:00");
    assert.deepEqual(d.toJSON(), {
      id: 5,
      reivindicacaoId: 1,
      administradorId: 2,
      tipoDocumento: "RG",
      dataHora: "2026-10-01 10:00:00",
    });
    assert.equal(d.getId(), 5);
    assert.equal(d.getDataHora(), "2026-10-01 10:00:00");
  });
});

describe("Categoria (RF02.3)", () => {
  test("nome de 2 a 80 caracteres, sem espaços nas pontas", () => {
    assert.equal(new Categoria("  Livros  ").getNome(), "Livros");
    assert.throws(() => new Categoria("A"), erroDeNegocio(400));
    assert.throws(() => new Categoria("a".repeat(81)), erroDeNegocio(400));
    assert.throws(() => new Categoria(undefined as unknown as string), erroDeNegocio(400));
    assert.deepEqual(new Categoria("Livros", 3).toJSON(), { id: 3, nome: "Livros" });
  });
});

describe("Mensagem (RF04.3)", () => {
  test("texto de 1 a 1000 caracteres", () => {
    assert.equal(new Mensagem("  oi  ", 1, 2).getTexto(), "oi");
    assert.throws(() => new Mensagem("   ", 1, 2), erroDeNegocio(400));
    assert.throws(() => new Mensagem(undefined as unknown as string, 1, 2), erroDeNegocio(400));
    assert.throws(() => new Mensagem("a".repeat(1001), 1, 2), erroDeNegocio(400));
  });
});

describe("Arquivos: Foto é pública, ProvaPosse não expõe o caminho", () => {
  test("Foto.toJSON aponta para /uploads", () => {
    assert.deepEqual(new Foto("abc.png", 1, 4).toJSON(), { id: 4, url: "/uploads/abc.png" });
  });

  test("ProvaPosse.toJSON mostra só o nome original (RNF09)", () => {
    const json = new ProvaPosse("segredo.pdf", "nota fiscal.pdf", 1, 4).toJSON();
    assert.deepEqual(json, { id: 4, nomeOriginal: "nota fiscal.pdf" });
  });

  test("os caminhos no disco ficam em pastas diferentes", () => {
    assert.notEqual(
      new Foto("a.png", 1).getCaminhoNoDisco().replace("a.png", ""),
      new ProvaPosse("a.png", "a.png", 1).getCaminhoNoDisco().replace("a.png", "")
    );
  });
});

describe("HistoricoStatus (RN05) e ErroDeNegocio", () => {
  test("HistoricoStatus guarda de onde, para onde e quem", () => {
    const h = new HistoricoStatus(1, 2, null, StatusItem.DISPONIVEL);
    assert.equal(h.getStatusAnterior(), null);
    assert.equal(h.getStatusNovo(), StatusItem.DISPONIVEL);
    assert.equal(h.getUsuarioId(), 2);
    assert.equal(h.toJSON().itemId, 1);
  });

  test("ErroDeNegocio: status 400 por padrão; naoImplementado responde 501", () => {
    assert.equal(new ErroDeNegocio("x").status, 400);
    const erro = ErroDeNegocio.naoImplementado("RF99");
    assert.equal(erro.status, 501);
    assert.match(erro.message, /RF99/);
  });
});
