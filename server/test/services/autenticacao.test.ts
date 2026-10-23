import "../ambiente";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { AutenticacaoService } from "../../src/services/AutenticacaoService";
import { RecuperacaoSenhaService } from "../../src/services/RecuperacaoSenhaService";
import { UsuarioRepository } from "../../src/repositories/UsuarioRepository";
import { SENHA, contar, criarUsuario, prepararBanco, sql } from "../fabrica";
import { erroDeNegocio } from "../verificar";

prepararBanco();
const servico = new AutenticacaoService();
const usuarios = new UsuarioRepository();

let numero = 0;
function dados(perfil = PerfilUsuario.ALUNO) {
  return { nome: "Maria Silva", email: `maria${++numero}@undb.edu.br`, senha: "12345678", perfil };
}

describe("cadastrar (RF01.1, RF01.2, RF01.5)", () => {
  test("auto cadastro de aluno e professor", async () => {
    for (const perfil of [PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR]) {
      const u = await servico.cadastrar(dados(perfil), null);
      assert.equal(u.getPerfil(), perfil);
      assert.ok(u.getId());
    }
  });

  test("auto cadastro como administrador: 403 (RF01.5)", async () => {
    await assert.rejects(servico.cadastrar(dados(PerfilUsuario.ADMINISTRADOR), null), erroDeNegocio(403));
  });

  test("aluno ou professor logado não cria administrador: 403", async () => {
    for (const quem of [PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR]) {
      await assert.rejects(servico.cadastrar(dados(PerfilUsuario.ADMINISTRADOR), quem), erroDeNegocio(403));
    }
  });

  test("administrador logado cria administrador", async () => {
    const u = await servico.cadastrar(dados(PerfilUsuario.ADMINISTRADOR), PerfilUsuario.ADMINISTRADOR);
    assert.equal(u.getPerfil(), PerfilUsuario.ADMINISTRADOR);
  });

  test("e-mail repetido, com maiúsculas diferentes: 409 (CT01)", async () => {
    const primeiro = dados();
    await servico.cadastrar(primeiro, null);
    await assert.rejects(servico.cadastrar({ ...dados(), email: primeiro.email.toUpperCase() }, null), erroDeNegocio(409));
  });

  test("domínio institucional (EMAIL_DOMINIO=undb.edu.br nos testes)", async () => {
    await assert.rejects(servico.cadastrar({ ...dados(), email: "maria@gmail.com" }, null), erroDeNegocio(400, "@undb.edu.br"));
    await assert.rejects(servico.cadastrar({ ...dados(), email: "maria@falso-undb.edu.br" }, null), erroDeNegocio(400));
    await assert.rejects(servico.cadastrar({ ...dados(), email: "maria@undb.edu.br.com" }, null), erroDeNegocio(400));
  });

  test("dados inválidos: recusados antes de gravar", async () => {
    const antes = contar("SELECT COUNT(*) AS n FROM usuario");
    await assert.rejects(servico.cadastrar({ ...dados(), senha: "123" }, null), erroDeNegocio(400, "senha"));
    await assert.rejects(servico.cadastrar({ ...dados(), nome: "Al" }, null), erroDeNegocio(400, "nome"));
    await assert.rejects(servico.cadastrar({ ...dados(), perfil: "REITOR" as PerfilUsuario }, null), erroDeNegocio(400, "perfil"));
    assert.equal(contar("SELECT COUNT(*) AS n FROM usuario"), antes);
  });

  test("senha guardada só como hash (RNF01)", async () => {
    const d = dados();
    await servico.cadastrar(d, null);
    assert.equal(contar("SELECT COUNT(*) AS n FROM usuario WHERE senha_hash = ?", d.senha), 0);
  });

  test("erro do banco que não é e-mail repetido é repassado", async () => {
    const original = UsuarioRepository.prototype.salvar;
    UsuarioRepository.prototype.salvar = () => {
      throw Object.assign(new Error("disco cheio"), { code: "SQLITE_FULL" });
    };
    try {
      await assert.rejects(servico.cadastrar(dados(), null), /disco cheio/);
    } finally {
      UsuarioRepository.prototype.salvar = original;
    }
  });

  test("cadastro simultâneo: o UNIQUE do banco vira 409", async () => {
    const original = UsuarioRepository.prototype.buscarPorEmail;
    UsuarioRepository.prototype.buscarPorEmail = () => null; // simula o outro cadastro chegando entre a checagem e o INSERT
    try {
      const repetido = dados();
      await servico.cadastrar(repetido, null);
      await assert.rejects(servico.cadastrar(repetido, null), erroDeNegocio(409));
    } finally {
      UsuarioRepository.prototype.buscarPorEmail = original;
    }
  });
});

describe("entrar (RF01.3)", () => {
  test("senha certa devolve o usuário (CT02), com e-mail em maiúsculas e espaços", async () => {
    const u = criarUsuario();
    assert.equal((await servico.entrar(`  ${u.email.toUpperCase()} `, SENHA)).getId(), u.id);
  });

  test("senha errada e e-mail inexistente dão a mesma resposta (CT03)", async () => {
    const u = criarUsuario();
    await assert.rejects(servico.entrar(u.email, "senhaerrada"), erroDeNegocio(401, "inválidos"));
    await assert.rejects(servico.entrar("ninguem@undb.edu.br", "senhaerrada"), erroDeNegocio(401, "inválidos"));
  });

  test("e-mail ou senha vazios: 400", async () => {
    await assert.rejects(servico.entrar("", SENHA), erroDeNegocio(400));
    await assert.rejects(servico.entrar("a@undb.edu.br", ""), erroDeNegocio(400));
  });

  test("conta desativada: 403, mas só depois de conferir a senha", async () => {
    const u = criarUsuario(PerfilUsuario.ALUNO, false);
    await assert.rejects(servico.entrar(u.email, "senhaerrada"), erroDeNegocio(401));
    await assert.rejects(servico.entrar(u.email, SENHA), erroDeNegocio(403, "desativada"));
  });

  test("usuarioLogado: null para inexistente ou desativado", () => {
    const ativo = criarUsuario();
    const inativo = criarUsuario(PerfilUsuario.ALUNO, false);
    assert.equal(servico.usuarioLogado(ativo.id)?.getId(), ativo.id);
    assert.equal(servico.usuarioLogado(inativo.id), null);
    assert.equal(servico.usuarioLogado(99999), null);
  });
});

describe("recuperação de senha (RF01.6)", () => {
  const recuperacao = new RecuperacaoSenhaService();
  const logOriginal = console.log;
  let emails: string[] = [];

  // Sem SMTP, o EmailService escreve no console: capturamos para ler o link
  before(() => {
    console.log = (...partes: unknown[]) => emails.push(partes.join(" "));
  });
  after(() => {
    console.log = logOriginal;
  });

  async function pedirToken(email: string): Promise<string> {
    emails = [];
    recuperacao.solicitar(email);
    await new Promise((r) => setImmediate(r)); // o envio é assíncrono
    const token = emails.join("\n").match(/token=([0-9a-f]+)/)?.[1];
    assert.ok(token, "o link deveria ter sido gerado");
    return token;
  }

  test("e-mail vazio: 400", () => {
    assert.throws(() => recuperacao.solicitar(""), erroDeNegocio(400));
  });

  test("e-mail não cadastrado ou conta desativada: não gera link (CT12)", async () => {
    const inativo = criarUsuario(PerfilUsuario.ALUNO, false);
    emails = [];
    recuperacao.solicitar("ninguem@undb.edu.br");
    recuperacao.solicitar(inativo.email);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(emails, []);
  });

  test("o banco guarda só o hash do token", async () => {
    const u = criarUsuario();
    const token = await pedirToken(u.email);
    assert.equal(contar("SELECT COUNT(*) AS n FROM recuperacao_senha WHERE token_hash = ?", token), 0);
    assert.equal(contar("SELECT COUNT(*) AS n FROM recuperacao_senha WHERE usuario_id = ?", u.id), 1);
  });

  test("troca a senha com o link e o link não vale de novo (CT13)", async () => {
    const u = criarUsuario();
    const token = await pedirToken(u.email);
    await recuperacao.redefinir(token, "senhanova1");
    assert.equal((await servico.entrar(u.email, "senhanova1")).getId(), u.id);
    await assert.rejects(servico.entrar(u.email, SENHA), erroDeNegocio(401));
    await assert.rejects(recuperacao.redefinir(token, "outrasenha1"), erroDeNegocio(400, "inválido ou expirado"));
  });

  test("usar um link invalida os outros pendentes do mesmo usuário", async () => {
    const u = criarUsuario();
    const primeiro = await pedirToken(u.email);
    const segundo = await pedirToken(u.email);
    await recuperacao.redefinir(segundo, "senhanova1");
    await assert.rejects(recuperacao.redefinir(primeiro, "senhanova2"), erroDeNegocio(400));
  });

  test("link vencido é recusado (CT13)", async () => {
    const u = criarUsuario();
    const token = await pedirToken(u.email);
    sql("UPDATE recuperacao_senha SET expira_em = datetime('now', '-1 minute') WHERE usuario_id = ?", u.id);
    await assert.rejects(recuperacao.redefinir(token, "senhanova1"), erroDeNegocio(400));
  });

  test("link de conta desativada depois do pedido é recusado", async () => {
    const u = criarUsuario();
    const token = await pedirToken(u.email);
    sql("UPDATE usuario SET ativo = 0 WHERE id = ?", u.id);
    await assert.rejects(recuperacao.redefinir(token, "senhanova1"), erroDeNegocio(400));
  });

  test("senha nova curta é recusada antes de olhar o link (CT14)", async () => {
    const u = criarUsuario();
    const token = await pedirToken(u.email);
    await assert.rejects(recuperacao.redefinir(token, "curta"), erroDeNegocio(400, "8"));
    await assert.doesNotReject(recuperacao.redefinir(token, "senhanova1"), "o link continua válido");
  });

  test("token vazio ou inventado: recusa", async () => {
    await assert.rejects(recuperacao.redefinir("", "senhanova1"), erroDeNegocio(400));
    await assert.rejects(recuperacao.redefinir("abc123", "senhanova1"), erroDeNegocio(400));
  });

  test("falha no envio do e-mail não derruba o pedido", async () => {
    const u = criarUsuario();
    const erros: unknown[] = [];
    const erroOriginal = console.error;
    console.error = (...partes: unknown[]) => erros.push(partes.join(" "));
    // Troca o envio por um que falha; emailService é privado, por isso o cast
    const envio = (recuperacao as unknown as { emailService: { enviar: () => Promise<void> } }).emailService;
    const enviarOriginal = envio.enviar;
    envio.enviar = () => Promise.reject(new Error("SMTP fora do ar"));
    try {
      assert.doesNotThrow(() => recuperacao.solicitar(u.email));
      await new Promise((r) => setImmediate(r));
      assert.match(String(erros[0]), /SMTP fora do ar/);
    } finally {
      envio.enviar = enviarOriginal;
      console.error = erroOriginal;
    }
  });
});

describe("UsuarioRepository", () => {
  test("buscarPorEmail com valor ausente devolve null", () => {
    assert.equal(usuarios.buscarPorEmail(undefined as unknown as string), null);
  });
});
