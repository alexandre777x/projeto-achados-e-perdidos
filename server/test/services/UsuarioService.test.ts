import "../ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { UsuarioService } from "../../src/services/UsuarioService";
import { SENHA, contar, criarUsuario, prepararBanco, sql } from "../fabrica";
import { UsuarioRepository } from "../../src/repositories/UsuarioRepository";
import { erroDeNegocio } from "../verificar";

prepararBanco();
const servico = new UsuarioService();
const admin = criarUsuario(PerfilUsuario.ADMINISTRADOR);

describe("UsuarioService.listar", () => {
  test("busca no nome sem ligar para acentos e no e-mail; vazio traz todas", () => {
    sql("INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES ('José Antônio', 'jose.antonio@undb.edu.br', 'h', 'ALUNO')");
    assert.deepEqual(servico.listar("jose antonio").map((u) => u.getNome()), ["José Antônio"]);
    assert.deepEqual(servico.listar("antonio jose").map((u) => u.getNome()), [], "procura o trecho inteiro, na ordem");
    assert.deepEqual(servico.listar("antonio").map((u) => u.getNome()), ["José Antônio"]);
    assert.deepEqual(servico.listar("JOSÉ").map((u) => u.getNome()), ["José Antônio"]);
    assert.deepEqual(servico.listar("jose.antonio@").map((u) => u.getNome()), ["José Antônio"]);
    assert.ok(servico.listar("").length >= 2);
    assert.ok(servico.listar(undefined).length >= 2);
  });

  test("% digitado é texto, não curinga; busca longa é recusada", () => {
    assert.deepEqual(servico.listar("%"), []);
    assert.throws(() => servico.listar("a".repeat(101)), erroDeNegocio(400, "100"));
  });

  test("a lista nunca traz o hash da senha", () => {
    const json = JSON.parse(JSON.stringify(servico.listar("")));
    assert.ok(json.every((u: Record<string, unknown>) => !("senhaHash" in u)));
  });
});

describe("UsuarioService.mudarPerfil (RF01.5)", () => {
  test("administrador transforma aluno em administrador e depois em professor", () => {
    const aluno = criarUsuario();
    assert.equal(servico.mudarPerfil(aluno.id, "ADMINISTRADOR", admin.id).getPerfil(), PerfilUsuario.ADMINISTRADOR);
    assert.equal(servico.mudarPerfil(aluno.id, "PROFESSOR", admin.id).getPerfil(), PerfilUsuario.PROFESSOR);
  });

  test("perfil inválido, conta inexistente e a própria conta são recusados", () => {
    const aluno = criarUsuario();
    assert.throws(() => servico.mudarPerfil(aluno.id, "REITOR", admin.id), erroDeNegocio(400, "Perfil"));
    assert.throws(() => servico.mudarPerfil(99999, "ALUNO", admin.id), erroDeNegocio(404));
    assert.throws(() => servico.mudarPerfil(admin.id, "ALUNO", admin.id), erroDeNegocio(409, "próprio perfil"));
  });

  test("não deixa o sistema sem administrador ativo", () => {
    // Deixa só um administrador ativo: o "unico"
    sql("UPDATE usuario SET ativo = 0 WHERE perfil = 'ADMINISTRADOR'");
    const unico = criarUsuario(PerfilUsuario.ADMINISTRADOR);
    const outro = criarUsuario(PerfilUsuario.ADMINISTRADOR, false); // desativado: não conta
    assert.throws(() => servico.mudarPerfil(unico.id, "ALUNO", outro.id), erroDeNegocio(409, "pelo menos um"));
    assert.throws(() => servico.mudarAtivo(unico.id, false, outro.id), erroDeNegocio(409, "pelo menos um"));
    // Com um segundo administrador ativo, já pode
    const segundo = criarUsuario(PerfilUsuario.ADMINISTRADOR);
    assert.equal(servico.mudarPerfil(unico.id, "ALUNO", segundo.id).getPerfil(), PerfilUsuario.ALUNO);
    sql("UPDATE usuario SET ativo = 1 WHERE id = ?", admin.id);
  });

  test("administrador desativado pode perder o perfil sem a trava", () => {
    const desativado = criarUsuario(PerfilUsuario.ADMINISTRADOR, false);
    assert.equal(servico.mudarPerfil(desativado.id, "PROFESSOR", admin.id).getPerfil(), PerfilUsuario.PROFESSOR);
  });
});

describe("UsuarioService.mudarAtivo", () => {
  test("desativa e reativa uma conta", () => {
    const aluno = criarUsuario();
    assert.equal(servico.mudarAtivo(aluno.id, false, admin.id).estaAtivo(), false);
    assert.equal(servico.mudarAtivo(aluno.id, true, admin.id).estaAtivo(), true);
  });

  test("valor que não é true/false e a própria conta são recusados", () => {
    const aluno = criarUsuario();
    assert.throws(() => servico.mudarAtivo(aluno.id, "false", admin.id), erroDeNegocio(400));
    assert.throws(() => servico.mudarAtivo(admin.id, false, admin.id), erroDeNegocio(409, "própria conta"));
  });
});

describe("Meu perfil: nome e senha da própria conta", () => {
  test("troca o nome, sem espaços nas pontas", () => {
    const aluno = criarUsuario();
    assert.equal(servico.atualizarMeuNome(aluno.id, "  Maria Clara  ").getNome(), "Maria Clara");
  });

  test("nome curto ou longo demais é recusado", () => {
    const aluno = criarUsuario();
    assert.throws(() => servico.atualizarMeuNome(aluno.id, "Al"), erroDeNegocio(400, "nome"));
    assert.throws(() => servico.atualizarMeuNome(aluno.id, "a".repeat(101)), erroDeNegocio(400, "nome"));
    assert.throws(() => servico.atualizarMeuNome(99999, "Nome Válido"), erroDeNegocio(404));
  });

  test("troca a senha conferindo a atual", async () => {
    const aluno = criarUsuario();
    await servico.trocarMinhaSenha(aluno.id, SENHA, "senhanova123");
    const conta = new UsuarioRepository().buscarPorId(aluno.id);
    assert.ok(await conta?.senhaConfere("senhanova123"));
    assert.equal(await conta?.senhaConfere(SENHA), false);
  });

  test("senha atual errada, senha nova curta ou igual à atual: recusa e não troca", async () => {
    const aluno = criarUsuario();
    await assert.rejects(servico.trocarMinhaSenha(aluno.id, "errada123", "senhanova123"), erroDeNegocio(400, "atual"));
    await assert.rejects(servico.trocarMinhaSenha(aluno.id, SENHA, "curta"), erroDeNegocio(400, "8"));
    await assert.rejects(servico.trocarMinhaSenha(aluno.id, SENHA, SENHA), erroDeNegocio(400, "diferente"));
    assert.ok(await new UsuarioRepository().buscarPorId(aluno.id)?.senhaConfere(SENHA), "a senha continua a mesma");
  });

  test("a senha nova invalida links de recuperação pendentes", async () => {
    const aluno = criarUsuario();
    sql("INSERT INTO recuperacao_senha (token_hash, usuario_id, expira_em) VALUES ('abc', ?, datetime('now', '+1 hour'))", aluno.id);
    await servico.trocarMinhaSenha(aluno.id, SENHA, "senhanova123");
    assert.equal(contar("SELECT COUNT(*) AS n FROM recuperacao_senha WHERE usuario_id = ? AND usado = 0", aluno.id), 0);
  });
});
