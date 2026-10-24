import "../ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { StatusItem } from "../../src/module/StatusItem";
import { StatusReivindicacao } from "../../src/module/StatusReivindicacao";
import { TipoDocumento } from "../../src/module/TipoDocumento";
import { ReivindicacaoService } from "../../src/services/ReivindicacaoService";
import { DevolucaoService } from "../../src/services/DevolucaoService";
import { contar, criarItem, criarUsuario, prepararBanco, sql, statusDoItem } from "../fabrica";
import { erroDeNegocio } from "../verificar";
import { Email } from "../../src/services/EmailService";

prepararBanco();
const servico = new ReivindicacaoService();
const adminUsuario = criarUsuario(PerfilUsuario.ADMINISTRADOR);
const admin = { id: adminUsuario.id, perfil: adminUsuario.perfil };
const outroAdminUsuario = criarUsuario(PerfilUsuario.ADMINISTRADOR);
const outroAdmin = { id: outroAdminUsuario.id, perfil: outroAdminUsuario.perfil };

// Os e-mails da decisão ficam guardados aqui em vez de irem para o terminal
const emails: Email[] = [];
(servico as unknown as { emailService: { enviar: (e: Email) => Promise<void> } }).emailService.enviar = async (e) => {
  emails.push(e);
};

function aluno() {
  const u = criarUsuario(PerfilUsuario.ALUNO);
  return { id: u.id, perfil: u.perfil };
}

function item(status = StatusItem.DISPONIVEL): number {
  return criarItem({ registradoPor: admin.id, status });
}

describe("abrir (RF04.1, RF04.2, RF04.5, RF04.6)", () => {
  test("item DISPONIVEL passa para EM_REIVINDICACAO", () => {
    const id = item();
    const r = servico.abrir(id, "respostas", [], aluno());
    assert.equal(r.getStatus(), StatusReivindicacao.ABERTA);
    assert.equal(statusDoItem(id), StatusItem.EM_REIVINDICACAO);
  });

  test("item já EM_REIVINDICACAO aceita outra pessoa e continua igual", () => {
    const id = item();
    servico.abrir(id, "respostas", [], aluno());
    assert.doesNotThrow(() => servico.abrir(id, "respostas", [], aluno()));
    assert.equal(statusDoItem(id), StatusItem.EM_REIVINDICACAO);
  });

  test("mesma pessoa, mesmo item, enquanto a primeira está aberta: recusa (RF04.6)", () => {
    const id = item();
    const quem = aluno();
    servico.abrir(id, "respostas", [], quem);
    assert.throws(() => servico.abrir(id, "respostas", [], quem), erroDeNegocio(409, "já tem"));
  });

  test("depois de rejeitada, a mesma pessoa pode tentar de novo", () => {
    const id = item();
    const quem = aluno();
    const r = servico.abrir(id, "respostas", [], quem);
    servico.rejeitar(r.getId() as number, admin.id, "faltou detalhe");
    assert.doesNotThrow(() => servico.abrir(id, "agora com detalhes", [], quem));
  });

  for (const status of [StatusItem.AGUARDANDO_RECEBIMENTO, StatusItem.DEVOLVIDO]) {
    test(`item ${status} não pode ser reivindicado`, () => {
      assert.throws(() => servico.abrir(item(status), "respostas", [], aluno()), erroDeNegocio(409, "não está disponível"));
    });
  }

  test("item inexistente: recusa", () => {
    assert.throws(() => servico.abrir(99999, "respostas", [], aluno()), erroDeNegocio(409));
  });

  test("respostas vazias: recusa antes de tocar no item", () => {
    const id = item();
    assert.throws(() => servico.abrir(id, "", [], aluno()), erroDeNegocio(400));
    assert.throws(() => servico.abrir(id, undefined, [], aluno()), erroDeNegocio(400));
    assert.equal(statusDoItem(id), StatusItem.DISPONIVEL);
  });

  test("grava as provas de posse e o detalhe lista só o nome original", () => {
    const r = servico.abrir(item(), "respostas", [{ caminho: "abc.pdf", nomeOriginal: "nota fiscal.pdf" }], aluno());
    const detalhe = servico.detalhar(r.getId() as number, admin);
    assert.deepEqual(JSON.parse(JSON.stringify(detalhe.provas)), [{ id: detalhe.provas[0].getId(), nomeOriginal: "nota fiscal.pdf" }]);
  });
});

describe("detalhar e listas (RF04.7, RF04.4)", () => {
  test("detalhe traz item, nome de quem pediu e devolução vazia", () => {
    const quem = aluno();
    const id = item();
    const r = servico.abrir(id, "respostas", [], quem);
    const d = servico.detalhar(r.getId() as number, quem);
    assert.equal(d.item.id, id);
    assert.equal(d.item.status, StatusItem.EM_REIVINDICACAO);
    assert.match(d.reivindicante as string, /^Pessoa/);
    assert.equal(d.devolucao, null);
    assert.equal(d.item.foto, null, "item sem foto");
  });

  test("detalhe traz a primeira foto do item", () => {
    const quem = aluno();
    const id = item();
    sql("INSERT INTO foto (caminho, item_id) VALUES ('c.png', ?), ('d.png', ?)", id, id);
    const r = servico.abrir(id, "respostas", [], quem);
    assert.equal(servico.detalhar(r.getId() as number, quem).item.foto, "/uploads/c.png");
  });

  test("depois da entrega, o detalhe mostra data e tipo do documento, nunca número", () => {
    const quem = aluno();
    const r = servico.abrir(item(), "respostas", [], quem);
    servico.aprovar(r.getId() as number, admin.id);
    new DevolucaoService().registrar(r.getId() as number, TipoDocumento.CARTEIRA_ESTUDANTIL, admin.id);
    const d = servico.detalhar(r.getId() as number, quem);
    assert.equal(d.devolucao?.tipoDocumento, TipoDocumento.CARTEIRA_ESTUDANTIL);
    assert.ok(d.devolucao?.dataHora);
    assert.deepEqual(Object.keys(d.devolucao ?? {}).sort(), ["dataHora", "tipoDocumento"]);
  });

  test("inexistente: 404 até para o administrador", () => {
    assert.throws(() => servico.detalhar(99999, admin), erroDeNegocio(404));
  });

  test("minhas: só as do usuário, mais novas primeiro", () => {
    const quem = aluno();
    const r1 = servico.abrir(item(), "respostas", [], quem);
    const r2 = servico.abrir(item(), "respostas", [], quem);
    servico.abrir(item(), "respostas", [], aluno());
    assert.deepEqual(servico.listarMinhas(quem.id).map((r) => r.id), [r2.getId(), r1.getId()]);
  });

  test("minhas: traz a primeira foto do item, ou null", () => {
    const quem = aluno();
    const comFoto = item();
    sql("INSERT INTO foto (caminho, item_id) VALUES ('a.png', ?), ('b.png', ?)", comFoto, comFoto);
    servico.abrir(comFoto, "respostas", [], quem);
    servico.abrir(item(), "respostas", [], quem);
    assert.deepEqual(servico.listarMinhas(quem.id).map((r) => r.itemFoto), [null, "/uploads/a.png"]);
  });

  test("fila do administrador: só abertas, mais antigas primeiro", () => {
    const aberta = servico.abrir(item(), "respostas", [], aluno());
    const decidida = servico.abrir(item(), "respostas", [], aluno());
    servico.rejeitar(decidida.getId() as number, admin.id, "não");
    const fila = servico.listarAbertas();
    assert.ok(fila.every((r) => r.status === StatusReivindicacao.ABERTA));
    assert.ok(fila.some((r) => r.id === aberta.getId()));
    assert.ok(!fila.some((r) => r.id === decidida.getId()));
    const ids = fila.map((r) => r.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  });
});

describe("rejeitar (RF04.4, RF04.5)", () => {
  test("sem outras abertas: item volta para DISPONIVEL", () => {
    const id = item();
    const r = servico.abrir(id, "respostas", [], aluno());
    servico.rejeitar(r.getId() as number, admin.id, "não confere");
    assert.equal(statusDoItem(id), StatusItem.DISPONIVEL);
  });

  test("com outra aberta: item continua EM_REIVINDICACAO", () => {
    const id = item();
    const r1 = servico.abrir(id, "respostas", [], aluno());
    servico.abrir(id, "respostas", [], aluno());
    servico.rejeitar(r1.getId() as number, admin.id, "não confere");
    assert.equal(statusDoItem(id), StatusItem.EM_REIVINDICACAO);
  });

  test("rejeitar a última depois de outra rejeitada: volta para DISPONIVEL", () => {
    const id = item();
    const r1 = servico.abrir(id, "respostas", [], aluno());
    const r2 = servico.abrir(id, "respostas", [], aluno());
    servico.rejeitar(r1.getId() as number, admin.id, "não");
    servico.rejeitar(r2.getId() as number, admin.id, "não");
    assert.equal(statusDoItem(id), StatusItem.DISPONIVEL);
  });

  test("motivo vazio: recusa e não grava nada (CT09)", () => {
    const id = item();
    const r = servico.abrir(id, "respostas", [], aluno());
    assert.throws(() => servico.rejeitar(r.getId() as number, admin.id, ""), erroDeNegocio(400, "motivo"));
    assert.throws(() => servico.rejeitar(r.getId() as number, admin.id, undefined), erroDeNegocio(400, "motivo"));
    assert.equal(servico.detalhar(r.getId() as number, admin).status, StatusReivindicacao.ABERTA);
    assert.equal(statusDoItem(id), StatusItem.EM_REIVINDICACAO);
  });

  test("grava quem decidiu e quando", () => {
    const r = servico.abrir(item(), "respostas", [], aluno());
    servico.rejeitar(r.getId() as number, admin.id, "não");
    assert.equal(
      contar("SELECT COUNT(*) AS n FROM reivindicacao WHERE id = ? AND decidido_por = ? AND data_decisao IS NOT NULL", r.getId(), admin.id),
      1
    );
  });
});

describe("decisão: quem pode decidir", () => {
  test("administrador não decide a própria reivindicação; outro pode", () => {
    const r = servico.abrir(item(), "respostas", [], admin);
    assert.throws(() => servico.aprovar(r.getId() as number, admin.id), erroDeNegocio(403, "outro administrador"));
    assert.throws(() => servico.rejeitar(r.getId() as number, admin.id, "x"), erroDeNegocio(403));
    assert.equal(servico.aprovar(r.getId() as number, outroAdmin.id).getStatus(), StatusReivindicacao.APROVADA);
  });

  test("inexistente: 404", () => {
    assert.throws(() => servico.aprovar(99999, admin.id), erroDeNegocio(404));
    assert.throws(() => servico.rejeitar(99999, admin.id, "x"), erroDeNegocio(404));
  });

  test("já decidida: 409", () => {
    const r = servico.abrir(item(), "respostas", [], aluno());
    servico.aprovar(r.getId() as number, admin.id);
    assert.throws(() => servico.aprovar(r.getId() as number, admin.id), erroDeNegocio(409));
    assert.throws(() => servico.rejeitar(r.getId() as number, admin.id, "x"), erroDeNegocio(409));
  });
});

describe("mensagens (RF04.3)", () => {
  test("conversa: ordem de envio, autor e 'minha'", () => {
    const quem = aluno();
    const r = servico.abrir(item(), "respostas", [], quem);
    const id = r.getId() as number;
    servico.enviarMensagem(id, "Olá", quem);
    servico.enviarMensagem(id, "Pode descrever?", admin);

    const vistoPeloAluno = servico.listarMensagens(id, quem);
    assert.deepEqual(vistoPeloAluno.map((m) => m.texto), ["Olá", "Pode descrever?"]);
    assert.deepEqual(vistoPeloAluno.map((m) => m.minha), [true, false]);
    assert.deepEqual(vistoPeloAluno.map((m) => m.daAdministracao), [false, true]);
    assert.equal(vistoPeloAluno[1].autor, "Administração", "o aluno não vê o nome do funcionário");

    const vistoPeloAdmin = servico.listarMensagens(id, admin);
    assert.match(vistoPeloAdmin[1].autor, /^Pessoa/, "a administração vê o nome");
    assert.deepEqual(vistoPeloAdmin.map((m) => m.minha), [false, true]);
  });

  test("mensagem vazia é recusada", () => {
    const quem = aluno();
    const r = servico.abrir(item(), "respostas", [], quem);
    assert.throws(() => servico.enviarMensagem(r.getId() as number, "  ", quem), erroDeNegocio(400));
    assert.throws(() => servico.enviarMensagem(r.getId() as number, undefined, quem), erroDeNegocio(400));
  });
});

describe("mensagens não lidas", () => {
  const naoLidasDoAdmin = (id: number, quem = admin) => servico.contarNaoLidas(quem).administracao?.porReivindicacao[id] ?? 0;

  test("mensagem da administração conta para quem reivindicou até ele abrir a conversa", () => {
    const quem = aluno();
    const id = servico.abrir(item(), "respostas", [], quem).getId() as number;
    assert.deepEqual(servico.contarNaoLidas(quem).minhas, { total: 0, porReivindicacao: {} });

    servico.enviarMensagem(id, "Pode descrever?", admin);
    servico.enviarMensagem(id, "Tem algum adesivo?", outroAdmin);
    assert.deepEqual(servico.contarNaoLidas(quem).minhas, { total: 2, porReivindicacao: { [id]: 2 } });

    servico.listarMensagens(id, quem);
    assert.equal(servico.contarNaoLidas(quem).minhas.total, 0);
  });

  test("mensagem de quem reivindicou conta para a administração; qualquer administrador marca como lida", () => {
    const quem = aluno();
    const id = servico.abrir(item(), "respostas", [], quem).getId() as number;
    servico.enviarMensagem(id, "É meu!", quem);
    assert.equal(naoLidasDoAdmin(id), 1);
    assert.equal(naoLidasDoAdmin(id, outroAdmin), 1);

    servico.listarMensagens(id, outroAdmin);
    assert.equal(naoLidasDoAdmin(id), 0, "lida por um administrador, lida para a administração");
  });

  test("a própria mensagem nunca conta, e responder marca a conversa como lida", () => {
    const quem = aluno();
    const id = servico.abrir(item(), "respostas", [], quem).getId() as number;
    servico.enviarMensagem(id, "Oi?", admin);
    servico.enviarMensagem(id, "Oi, é meu", quem);
    assert.equal(servico.contarNaoLidas(quem).minhas.total, 0, "quem responde já leu");
    assert.equal(naoLidasDoAdmin(id), 1, "só a resposta do aluno é nova para a administração");
  });

  test("aluno não recebe contagem da administração", () => {
    assert.equal(servico.contarNaoLidas(aluno()).administracao, null);
  });

  test("a reivindicação do próprio administrador conta no lado dele como reivindicante", () => {
    const id = servico.abrir(item(), "respostas", [], admin).getId() as number;
    servico.enviarMensagem(id, "Sobre o seu pedido", outroAdmin);
    assert.equal(servico.contarNaoLidas(admin).minhas.porReivindicacao[id], 1);
    servico.enviarMensagem(id, "Respondendo", admin);
    assert.equal(naoLidasDoAdmin(id, admin), 0, "não conta a própria mensagem como da administração");
    assert.equal(naoLidasDoAdmin(id, outroAdmin), 1, "para o outro administrador é nova");
  });
});

describe("e-mail da decisão", () => {
  test("aprovar avisa quem pediu e quem teve a reivindicação rejeitada junto", () => {
    const id = item();
    const dono = criarUsuario();
    const outro = criarUsuario();
    const aprovada = servico.abrir(id, "respostas", [], { id: dono.id, perfil: dono.perfil });
    const rejeitada = servico.abrir(id, "respostas", [], { id: outro.id, perfil: outro.perfil });
    emails.length = 0;

    servico.aprovar(aprovada.getId() as number, admin.id);
    assert.deepEqual(emails.map((e) => e.para), [dono.email, outro.email]);
    assert.match(emails[0].assunto, /aprovada/);
    assert.match(emails[0].texto, /documento com foto/);
    assert.match(emails[0].texto, new RegExp(`reivindicacao\\.html\\?id=${aprovada.getId()}`));
    assert.match(emails[1].assunto, /rejeitada/);
    assert.match(emails[1].texto, /Outra reivindicação deste item foi aprovada/);
    assert.match(emails[1].texto, new RegExp(`id=${rejeitada.getId()}`));
  });

  test("rejeitar avisa com o motivo", () => {
    const dono = criarUsuario();
    const r = servico.abrir(item(), "respostas", [], { id: dono.id, perfil: dono.perfil });
    emails.length = 0;
    servico.rejeitar(r.getId() as number, admin.id, "As respostas não conferem");
    assert.equal(emails.length, 1);
    assert.equal(emails[0].para, dono.email);
    assert.match(emails[0].texto, /Motivo: As respostas não conferem/);
  });

  test("decisão recusada não manda e-mail", () => {
    const r = servico.abrir(item(), "respostas", [], aluno());
    servico.rejeitar(r.getId() as number, admin.id, "não");
    emails.length = 0;
    assert.throws(() => servico.aprovar(r.getId() as number, admin.id), erroDeNegocio(409));
    assert.equal(emails.length, 0);
  });

  test("falha no envio não desfaz a decisão", async () => {
    const envio = (servico as unknown as { emailService: { enviar: (e: Email) => Promise<void> } }).emailService;
    const enviarOriginal = envio.enviar;
    const erros: string[] = [];
    const erroOriginal = console.error;
    envio.enviar = () => Promise.reject(new Error("SMTP fora do ar"));
    console.error = (...partes: unknown[]) => erros.push(partes.join(" "));
    try {
      const r = servico.abrir(item(), "respostas", [], aluno());
      const decidida = servico.rejeitar(r.getId() as number, admin.id, "não");
      assert.equal(decidida.getStatus(), StatusReivindicacao.REJEITADA);
      await new Promise((resolver) => setImmediate(resolver));
      assert.match(erros.join("\n"), /SMTP fora do ar/);
    } finally {
      envio.enviar = enviarOriginal;
      console.error = erroOriginal;
    }
  });
});

describe("provas de posse (RF04.2, RNF09)", () => {
  test("o dono e o administrador acessam; outra pessoa recebe 404 (CT16)", () => {
    const quem = aluno();
    const r = servico.abrir(item(), "respostas", [{ caminho: "p.pdf", nomeOriginal: "nota.pdf" }], quem);
    const id = r.getId() as number;
    const provaId = servico.detalhar(id, quem).provas[0].getId() as number;

    assert.equal(servico.buscarProva(id, provaId, quem).getNomeOriginal(), "nota.pdf");
    assert.equal(servico.buscarProva(id, provaId, admin).getCaminho(), "p.pdf");
    assert.throws(() => servico.buscarProva(id, provaId, aluno()), erroDeNegocio(404));
  });

  test("prova de outra reivindicação não abre pelo endereço desta", () => {
    const quem = aluno();
    const minha = servico.abrir(item(), "respostas", [], quem);
    const alheia = servico.abrir(item(), "respostas", [{ caminho: "q.pdf", nomeOriginal: "q.pdf" }], aluno());
    const provaAlheia = servico.detalhar(alheia.getId() as number, admin).provas[0].getId() as number;
    assert.throws(() => servico.buscarProva(minha.getId() as number, provaAlheia, quem), erroDeNegocio(404, "arquivo"));
  });
});
