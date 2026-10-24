import "../ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { UsuarioRepository } from "../../src/repositories/UsuarioRepository";
import { criarOuPromoverAdmin } from "../../src/scripts/criarAdmin";
import { SENHA, criarUsuario, prepararBanco } from "../fabrica";
import { erroDeNegocio } from "../verificar";

prepararBanco();
const usuarios = new UsuarioRepository();

/** Responde às perguntas na ordem e guarda o que foi perguntado. */
function respostas(...lista: string[]) {
  const perguntas: string[] = [];
  const perguntar = async (texto: string) => {
    perguntas.push(texto);
    const resposta = lista.shift();
    assert.notEqual(resposta, undefined, `pergunta sem resposta: ${texto}`);
    return resposta as string;
  };
  return { perguntar, perguntas };
}

describe("npm run criar-admin", () => {
  test("e-mail novo: pergunta nome e senha e cria o administrador", async () => {
    const { perguntar } = respostas("nova.admin@undb.edu.br", "Nova Admin", "senha1234");
    assert.match(await criarOuPromoverAdmin(perguntar), /Administrador criado/);
    const criada = usuarios.buscarPorEmail("nova.admin@undb.edu.br");
    assert.equal(criada?.getPerfil(), PerfilUsuario.ADMINISTRADOR);
    assert.ok(await criada?.senhaConfere("senha1234"));
  });

  test("e-mail novo com dados inválidos: recusa e não grava", async () => {
    const { perguntar } = respostas("curta@undb.edu.br", "Pessoa", "123");
    await assert.rejects(criarOuPromoverAdmin(perguntar), erroDeNegocio(400, "senha"));
    assert.equal(usuarios.buscarPorEmail("curta@undb.edu.br"), null);
  });

  test("conta que já existe: com 's', vira administradora e mantém a senha", async () => {
    const aluno = criarUsuario(PerfilUsuario.ALUNO);
    const { perguntar, perguntas } = respostas(aluno.email.toUpperCase(), "s");
    assert.match(await criarOuPromoverAdmin(perguntar), /agora é administrador/);
    assert.match(perguntas[1], /como aluno/);
    const promovida = usuarios.buscarPorEmail(aluno.email);
    assert.equal(promovida?.getPerfil(), PerfilUsuario.ADMINISTRADOR);
    assert.ok(await promovida?.senhaConfere(SENHA), "a senha continua a mesma");
  });

  test("conta desativada: avisa e reativa junto", async () => {
    const desativado = criarUsuario(PerfilUsuario.PROFESSOR, false);
    const { perguntar, perguntas } = respostas(desativado.email, "sim");
    await criarOuPromoverAdmin(perguntar);
    assert.match(perguntas[1], /desativada/);
    assert.equal(usuarios.buscarPorId(desativado.id)?.estaAtivo(), true);
  });

  test("conta que já existe: com 'n', nada muda", async () => {
    const professor = criarUsuario(PerfilUsuario.PROFESSOR);
    const { perguntar } = respostas(professor.email, "n");
    assert.equal(await criarOuPromoverAdmin(perguntar), "Nada foi alterado.");
    assert.equal(usuarios.buscarPorId(professor.id)?.getPerfil(), PerfilUsuario.PROFESSOR);
  });

  test("quem já é administrador ativo: só avisa, sem perguntar mais nada", async () => {
    const admin = criarUsuario(PerfilUsuario.ADMINISTRADOR);
    const { perguntar, perguntas } = respostas(admin.email);
    assert.match(await criarOuPromoverAdmin(perguntar), /já é administrador/);
    assert.equal(perguntas.length, 1);
  });
});
