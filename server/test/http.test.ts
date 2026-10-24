import "./ambiente";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { Server } from "http";
import { AddressInfo } from "net";
import { App } from "../src/App";
import { Configuracao } from "../src/config/Configuracao";
import { PerfilUsuario } from "../src/module/PerfilUsuario";
import { StatusItem } from "../src/module/StatusItem";
import { ItemController } from "../src/controllers/ItemController";
import { SENHA, criarItem, criarUsuario, prepararBanco, sql } from "./fabrica";

/**
 * Testes pela HTTP, com o servidor de verdade: cobrem os middlewares (login, perfil,
 * upload e tratamento de erros) e a ligação entre rotas e controllers.
 */
prepararBanco();
/** Quem registrou os itens criados direto no banco pelos testes. */
const autor = criarUsuario(PerfilUsuario.ADMINISTRADOR);
let servidor: Server;
let base = "";

before(async () => {
  servidor = new App().getExpressApp().listen(0);
  await new Promise((r) => servidor.once("listening", r));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor.close());

/** Cliente com cookie de sessão próprio, como um navegador. */
class Navegador {
  private cookie = "";

  /** Não segue redirecionamentos: os testes precisam ver o 302 para o login, não a página de login. */
  async pedir(caminho: string, opcoes: RequestInit = {}) {
    const resposta = await fetch(base + caminho, {
      ...opcoes,
      redirect: "manual",
      headers: { ...(opcoes.headers as Record<string, string>), cookie: this.cookie },
    });
    const novo = resposta.headers.get("set-cookie");
    if (novo) this.cookie = novo.split(";")[0];
    const texto = await resposta.text();
    let corpo: unknown = texto;
    try {
      corpo = JSON.parse(texto);
    } catch {
      // não é JSON (arquivo, HTML)
    }
    return { status: resposta.status, corpo: corpo as Record<string, unknown> & unknown[], resposta };
  }

  json(caminho: string, metodo: string, corpo: unknown) {
    return this.pedir(caminho, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  }

  async entrar(email: string, senha = SENHA) {
    return this.json("/api/auth/login", "POST", { email, senha });
  }
}

async function logado(perfil: PerfilUsuario) {
  const u = criarUsuario(perfil);
  const n = new Navegador();
  assert.equal((await n.entrar(u.email)).status, 200);
  return { n, u };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]);
const PDF = Buffer.from("%PDF-1.4 teste");

function arquivo(conteudo: Buffer, tipo: string) {
  return new Blob([new Uint8Array(conteudo)], { type: tipo });
}

function formularioItem(fotos: [Buffer, string, string][]) {
  const f = new FormData();
  f.set("titulo", "Garrafa azul");
  f.set("descricao", "Garrafa térmica");
  f.set("dataAchado", "2026-10-01");
  f.set("categoriaId", "1");
  f.set("local", "Bloco A, perto da escada");
  for (const [conteudo, tipo, nome] of fotos) f.append("fotos", arquivo(conteudo, tipo), nome);
  return f;
}

const arquivosEm = (pasta: string) => (fs.existsSync(pasta) ? fs.readdirSync(pasta).length : 0);

describe("rotas básicas e tratamento de erros", () => {
  test("/api/saude responde com as tabelas", async () => {
    const r = await new Navegador().pedir("/api/saude");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.status, "ok");
    assert.ok((r.corpo.tabelas as number) >= 10); // 10 desde que a tabela local saiu
  });

  test("rota /api inexistente: 404 em JSON", async () => {
    const r = await new Navegador().pedir("/api/nao-existe");
    assert.equal(r.status, 404);
    assert.equal(r.corpo.erro, "Rota não encontrada.");
  });

  test("JSON malformado: 400 sem detalhes internos", async () => {
    const r = await new Navegador().pedir("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ isso não é json",
    });
    assert.equal(r.status, 400);
    assert.equal(r.corpo.erro, "Requisição inválida.");
  });

  test("erro inesperado: 500 genérico, sem vazar a mensagem", async () => {
    const original = ItemController.prototype.buscar;
    const erroOriginal = console.error;
    console.error = () => {};
    ItemController.prototype.buscar = () => {
      throw new Error("detalhe interno secreto");
    };
    try {
      const { n } = await logado(PerfilUsuario.ALUNO);
      const r = await n.pedir("/api/itens");
      assert.equal(r.status, 500);
      assert.equal(r.corpo.erro, "Erro interno do servidor.");
      assert.ok(!JSON.stringify(r.corpo).includes("secreto"));
    } finally {
      ItemController.prototype.buscar = original;
      console.error = erroOriginal;
    }
  });

  test("leituras: busca, detalhe e listas, para quem entrou", async () => {
    const id = criarItem({ registradoPor: autor.id, titulo: "Guarda-chuva listrado" });
    const { n } = await logado(PerfilUsuario.ALUNO);
    const busca = await n.pedir("/api/itens?q=listrado&limite=5");
    assert.equal(busca.status, 200);
    assert.deepEqual((busca.corpo as { id: number }[]).map((i) => i.id), [id]);
    assert.equal((await n.pedir("/api/itens?categoria=abc")).status, 400);
    assert.equal((await n.pedir(`/api/itens/${id}`)).corpo.titulo, "Guarda-chuva listrado");
    assert.ok(((await n.pedir("/api/referencias/categorias")).corpo as unknown[]).length >= 6);
  });

  test("o banco não é recriado quando já existe", async () => {
    const { Database } = await import("../src/database/Database");
    assert.equal(Database.getInstancia().inicializar(), false);
  });

  test("o front-end é servido pelo próprio servidor", async () => {
    const r = await new Navegador().pedir("/login.html");
    assert.equal(r.status, 200);
    assert.match(String(r.corpo), /<title>Entrar/);
  });
});

describe("AutenticacaoMiddleware (RNF01.1)", () => {
  test("rota de login sem sessão: 401", async () => {
    assert.equal((await new Navegador().pedir("/api/reivindicacoes/minhas")).status, 401);
  });

  test("rota de administrador: 401 sem sessão, 403 para aluno e professor, 200 para admin (CT11)", async () => {
    assert.equal((await new Navegador().pedir("/api/devolucoes/relatorio")).status, 401);
    for (const perfil of [PerfilUsuario.ALUNO, PerfilUsuario.PROFESSOR]) {
      const { n } = await logado(perfil);
      const r = await n.pedir("/api/devolucoes/relatorio");
      assert.equal(r.status, 403, perfil);
      assert.equal(r.corpo.erro, "Acesso restrito à administração.");
    }
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    assert.equal((await n.pedir("/api/devolucoes/relatorio")).status, 200);
  });
});

describe("sessão (RF01.1, RF01.3, RF01.4)", () => {
  test("login, /auth/eu e logout", async () => {
    const { n, u } = await logado(PerfilUsuario.ALUNO);
    assert.equal((await n.pedir("/api/auth/eu")).corpo.id, u.id);
    const saida = await n.pedir("/api/auth/logout", { method: "POST" });
    assert.equal(saida.status, 200);
    assert.equal((await n.pedir("/api/auth/eu")).status, 401);
  });

  test("login errado não inicia sessão", async () => {
    const u = criarUsuario();
    const n = new Navegador();
    assert.equal((await n.entrar(u.email, "senhaerrada")).status, 401);
    assert.equal((await n.pedir("/api/auth/eu")).status, 401);
  });

  test("conta desativada depois do login: /auth/eu encerra a sessão", async () => {
    const { n, u } = await logado(PerfilUsuario.ALUNO);
    sql("UPDATE usuario SET ativo = 0 WHERE id = ?", u.id);
    assert.equal((await n.pedir("/api/auth/eu")).status, 401);
    sql("UPDATE usuario SET ativo = 1 WHERE id = ?", u.id);
    assert.equal((await n.pedir("/api/auth/eu")).status, 401, "a sessão foi destruída, não volta sozinha");
  });

  test("auto cadastro já entra logado", async () => {
    const n = new Navegador();
    const r = await n.json("/api/auth/cadastro", "POST", { nome: "Nova Pessoa", email: "nova@undb.edu.br", senha: "12345678", perfil: "ALUNO" });
    assert.equal(r.status, 201);
    assert.equal((await n.pedir("/api/auth/eu")).corpo.email, "nova@undb.edu.br");
  });

  test("administrador cria conta e continua logado como ele mesmo", async () => {
    const { n, u } = await logado(PerfilUsuario.ADMINISTRADOR);
    const r = await n.json("/api/auth/cadastro", "POST", { nome: "Outro Admin", email: "outro.admin@undb.edu.br", senha: "12345678", perfil: "ADMINISTRADOR" });
    assert.equal(r.status, 201);
    assert.equal((await n.pedir("/api/auth/eu")).corpo.id, u.id);
  });

  test("corpo vazio no cadastro e no login: 400, não 500", async () => {
    for (const rota of ["/api/auth/cadastro", "/api/auth/login", "/api/auth/recuperar-senha", "/api/auth/redefinir-senha"]) {
      const r = await new Navegador().pedir(rota, { method: "POST" });
      assert.equal(r.status, 400, rota);
    }
  });
});

describe("UploadMiddleware: fotos dos itens (RF02.2)", () => {
  test("sem login: 401 e nenhum arquivo gravado", async () => {
    const antes = arquivosEm(Configuracao.pastaUploads);
    const r = await new Navegador().pedir("/api/itens", { method: "POST", body: formularioItem([[PNG, "image/png", "a.png"]]) });
    assert.equal(r.status, 401);
    assert.equal(arquivosEm(Configuracao.pastaUploads), antes);
  });

  test("foto válida: grava com nome aleatório; só quem entrou consegue abrir", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const r = await n.pedir("/api/itens", { method: "POST", body: formularioItem([[PNG, "image/png", "minha foto.png"]]) });
    assert.equal(r.status, 201);
    const url = (r.corpo.fotos as { url: string }[])[0].url;
    assert.match(url, /^\/uploads\/[0-9a-f]{32}\.png$/);
    assert.equal((await n.pedir(url)).status, 200);
    const anonimo = await new Navegador().pedir(url);
    assert.equal(anonimo.status, 302);
    assert.match(anonimo.resposta.headers.get("location") ?? "", /^\/login\.html/);
  });

  const recusas: [string, [Buffer, string, string][], RegExp][] = [
    ["4 fotos (CT04)", Array(4).fill([PNG, "image/png", "a.png"]), /no máximo 3/],
    ["tipo GIF", [[Buffer.from("GIF89a"), "image/gif", "a.gif"]], /não aceito/],
    ["PNG falso (conteúdo de texto)", [[Buffer.from("não sou imagem"), "image/png", "falso.png"]], /não é do tipo/],
    ["acima de 5 MB", [[Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), "image/png", "grande.png"]], /5 MB/],
  ];
  for (const [caso, fotos, mensagem] of recusas) {
    test(`${caso}: 400 e nenhum arquivo sobra`, async () => {
      const { n } = await logado(PerfilUsuario.ALUNO);
      const antes = arquivosEm(Configuracao.pastaUploads);
      const r = await n.pedir("/api/itens", { method: "POST", body: formularioItem(fotos) });
      assert.equal(r.status, 400);
      assert.match(String(r.corpo.erro), mensagem);
      await new Promise((ok) => setTimeout(ok, 50)); // a remoção é assíncrona
      assert.equal(arquivosEm(Configuracao.pastaUploads), antes);
    });
  }

  test("registro recusado depois do upload (data futura): a foto é apagada", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const antes = arquivosEm(Configuracao.pastaUploads);
    const f = formularioItem([[PNG, "image/png", "a.png"]]);
    f.set("dataAchado", "2999-01-01");
    const r = await n.pedir("/api/itens", { method: "POST", body: f });
    assert.equal(r.status, 400);
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(arquivosEm(Configuracao.pastaUploads), antes);
  });

  test("campo de arquivo com outro nome: 400", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const f = formularioItem([]);
    f.append("outro", arquivo(PNG, "image/png"), "a.png");
    const r = await n.pedir("/api/itens", { method: "POST", body: f });
    assert.equal(r.status, 400);
  });

  test("excluir o item apaga as fotos do disco", async () => {
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    const r = await n.pedir("/api/itens", { method: "POST", body: formularioItem([[PNG, "image/png", "a.png"]]) });
    const arquivoFoto = path.join(Configuracao.pastaUploads, path.basename((r.corpo.fotos as { url: string }[])[0].url));
    assert.ok(fs.existsSync(arquivoFoto));
    assert.equal((await n.pedir(`/api/itens/${r.corpo.id}`, { method: "DELETE" })).status, 200);
    await new Promise((ok) => setTimeout(ok, 50));
    assert.ok(!fs.existsSync(arquivoFoto));
  });
});

describe("rotas de itens: ids e ordem das rotas", () => {
  test("id não numérico: 404", async () => {
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    assert.equal((await n.pedir("/api/itens/abc")).status, 404);
    assert.equal((await n.pedir("/api/itens/abc", { method: "DELETE" })).status, 404);
  });

  test("/itens/aguardando-recebimento não é confundida com /itens/:id", async () => {
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    criarItem({ registradoPor: autor.id, status: StatusItem.AGUARDANDO_RECEBIMENTO });
    const r = await n.pedir("/api/itens/aguardando-recebimento");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.corpo));
  });

  test("/itens/parados: só administrador, e não é confundida com /itens/:id", async () => {
    const id = criarItem({ registradoPor: autor.id, dataRegistro: "2020-01-01 10:00:00" });
    const { n: aluno } = await logado(PerfilUsuario.ALUNO);
    assert.equal((await aluno.pedir("/api/itens/parados")).status, 403);
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    const r = await n.pedir("/api/itens/parados?dias=30");
    assert.equal(r.status, 200);
    assert.ok((r.corpo as { id: number }[]).some((i) => i.id === id));
    assert.equal((await n.pedir("/api/itens/parados?dias=zero")).status, 400);
  });

  test("confirmar recebimento e editar pela API", async () => {
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    const id = criarItem({ registradoPor: autor.id, status: StatusItem.AGUARDANDO_RECEBIMENTO });
    assert.equal((await n.pedir(`/api/itens/${id}/recebimento`, { method: "PATCH" })).corpo.status, StatusItem.DISPONIVEL);
    const editado = await n.json(`/api/itens/${id}`, "PUT", { titulo: "Novo título", descricao: "x", dataAchado: "2026-10-01", categoriaId: 2, local: "Portaria, no balcão" });
    assert.equal(editado.corpo.titulo, "Novo título");
    const detalhe = await n.pedir(`/api/itens/${id}`);
    assert.equal(detalhe.corpo.categoria, "Documentos");
    assert.equal(detalhe.corpo.local, "Portaria, no balcão");
  });

  test("categorias: listar exige login; criar, só administrador", async () => {
    assert.equal((await new Navegador().pedir("/api/referencias/categorias")).status, 401);
    const { n: aluno } = await logado(PerfilUsuario.ALUNO);
    assert.equal((await aluno.pedir("/api/referencias/categorias")).status, 200);
    assert.equal((await aluno.json("/api/referencias/categorias", "POST", { nome: "Quadra" })).status, 403);
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    assert.equal((await n.json("/api/referencias/categorias", "POST", { nome: "Livros" })).status, 201);
  });

  test("a lista de locais não existe mais: o local é texto no item", async () => {
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    assert.equal((await n.pedir("/api/referencias/locais")).status, 404);
    assert.equal((await n.json("/api/referencias/locais", "POST", { nome: "Ginásio" })).status, 404);
  });

  test("registro sem o local escrito: 400", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const f = formularioItem([[PNG, "image/png", "a.png"]]);
    f.delete("local");
    const r = await n.pedir("/api/itens", { method: "POST", body: f });
    assert.equal(r.status, 400);
    assert.match(String(r.corpo.erro), /onde o item foi encontrado/);
  });
});

describe("reivindicação pela HTTP: provas privadas (RF04.2, RNF09)", () => {
  async function abrirComProva() {
    const { n, u } = await logado(PerfilUsuario.ALUNO);
    const itemId = criarItem({ registradoPor: autor.id });
    const f = new FormData();
    f.set("itemId", String(itemId));
    f.set("respostasValidacao", "Capinha azul");
    f.append("provas", arquivo(PDF, "application/pdf"), "nota-fiscal-ação.pdf");
    const r = await n.pedir("/api/reivindicacoes", { method: "POST", body: f });
    assert.equal(r.status, 201);
    const detalhe = await n.pedir(`/api/reivindicacoes/${r.corpo.id}`);
    const prova = (detalhe.corpo.provas as { id: number; nomeOriginal: string }[])[0];
    return { n, u, id: r.corpo.id as number, prova };
  }

  test("nome com acento é preservado e o download sai como anexo", async () => {
    const { n, id, prova } = await abrirComProva();
    assert.equal(prova.nomeOriginal, "nota-fiscal-ação.pdf");
    const r = await n.pedir(`/api/reivindicacoes/${id}/provas/${prova.id}`);
    assert.equal(r.status, 200);
    assert.match(r.resposta.headers.get("content-disposition") ?? "", /^attachment;.*filename\*=UTF-8''nota-fiscal-a%C3%A7%C3%A3o\.pdf/);
    assert.equal(r.resposta.headers.get("x-content-type-options"), "nosniff");
    assert.equal(String(r.corpo), PDF.toString());
  });

  test("outra pessoa: 404; sem login: 401 (CT16)", async () => {
    const { id, prova } = await abrirComProva();
    const { n: outro } = await logado(PerfilUsuario.ALUNO);
    assert.equal((await outro.pedir(`/api/reivindicacoes/${id}/provas/${prova.id}`)).status, 404);
    assert.equal((await new Navegador().pedir(`/api/reivindicacoes/${id}/provas/${prova.id}`)).status, 401);
  });

  test("o arquivo não é acessível por /uploads nem por /provas, nem para quem entrou", async () => {
    const { n } = await abrirComProva();
    for (const nome of fs.readdirSync(Configuracao.pastaProvas)) {
      assert.equal((await n.pedir(`/uploads/${nome}`)).status, 404);
      assert.equal((await n.pedir(`/provas/${nome}`)).status, 404);
      assert.equal((await new Navegador().pedir(`/uploads/${nome}`)).status, 302, "sem login, vai para o login");
    }
  });

  test("ids inválidos na rota da prova: 404", async () => {
    const { n, id } = await abrirComProva();
    assert.equal((await n.pedir(`/api/reivindicacoes/${id}/provas/abc`)).status, 404);
    assert.equal((await n.pedir(`/api/reivindicacoes/abc/provas/1`)).status, 404);
  });

  test("4 provas: 400 e nada fica na pasta (CT15)", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const antes = arquivosEm(Configuracao.pastaProvas);
    const f = new FormData();
    f.set("itemId", String(criarItem({ registradoPor: autor.id })));
    f.set("respostasValidacao", "x");
    for (let i = 0; i < 4; i++) f.append("provas", arquivo(PDF, "application/pdf"), `p${i}.pdf`);
    assert.equal((await n.pedir("/api/reivindicacoes", { method: "POST", body: f })).status, 400);
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(arquivosEm(Configuracao.pastaProvas), antes);
  });

  test("abertura recusada (sem itemId): a prova enviada é apagada", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const antes = arquivosEm(Configuracao.pastaProvas);
    const f = new FormData();
    f.set("respostasValidacao", "x");
    f.append("provas", arquivo(PDF, "application/pdf"), "p.pdf");
    const r = await n.pedir("/api/reivindicacoes", { method: "POST", body: f });
    assert.equal(r.status, 400);
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(arquivosEm(Configuracao.pastaProvas), antes);
  });
});

describe("fluxo completo pela HTTP: reivindicar, conversar, decidir, devolver e relatório", () => {
  test("do pedido ao CSV", async () => {
    const { n: dono } = await logado(PerfilUsuario.ALUNO);
    const { n: admin } = await logado(PerfilUsuario.ADMINISTRADOR);
    const itemId = criarItem({ registradoPor: autor.id, titulo: "=Celular" });

    const f = new FormData();
    f.set("itemId", String(itemId));
    f.set("respostasValidacao", "Capinha azul");
    const id = (await dono.pedir("/api/reivindicacoes", { method: "POST", body: f })).corpo.id;

    assert.equal((await dono.json(`/api/reivindicacoes/${id}/mensagens`, "POST", { texto: "É meu" })).status, 201);
    // Rota de não lidas: antes de /:id, senão "nao-lidas" seria lido como um id
    const naoLidas = async () => (await admin.pedir("/api/reivindicacoes/nao-lidas")).corpo.administracao.porReivindicacao[id];
    assert.equal(await naoLidas(), 1);
    assert.equal(((await admin.pedir(`/api/reivindicacoes/${id}/mensagens`)).corpo as unknown[]).length, 1);
    assert.equal(await naoLidas(), undefined, "abrir a conversa marca como lida");
    assert.equal((await dono.pedir("/api/reivindicacoes/nao-lidas")).corpo.administracao, null);
    assert.equal((await new Navegador().pedir("/api/reivindicacoes/nao-lidas")).status, 401);
    assert.ok(((await admin.pedir("/api/reivindicacoes")).corpo as { id: number }[]).some((r) => r.id === id));
    assert.ok(((await dono.pedir("/api/reivindicacoes/minhas")).corpo as { id: number }[]).some((r) => r.id === id));

    assert.equal((await admin.json(`/api/reivindicacoes/${id}/rejeitar`, "PATCH", {})).status, 400);
    assert.equal((await admin.pedir(`/api/reivindicacoes/${id}/aprovar`, { method: "PATCH" })).corpo.status, "APROVADA");
    assert.ok(((await admin.pedir("/api/devolucoes/pendentes")).corpo as { id: number }[]).some((r) => r.id === id));

    assert.equal((await admin.json("/api/devolucoes", "POST", { tipoDocumento: "RG" })).status, 400);
    assert.equal((await admin.json("/api/devolucoes", "POST", { reivindicacaoId: id, tipoDocumento: "RG" })).status, 201);

    const csv = await admin.pedir("/api/devolucoes/relatorio.csv");
    assert.match(csv.resposta.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(csv.resposta.headers.get("content-disposition") ?? "", /relatorio-devolucoes_inicio_hoje\.csv/);
    assert.ok(String(csv.corpo).includes("'=Celular"), "CT18: fórmula neutralizada");
  });

  test("rejeitar pela HTTP com motivo", async () => {
    const { n: dono } = await logado(PerfilUsuario.ALUNO);
    const { n: admin } = await logado(PerfilUsuario.ADMINISTRADOR);
    const f = new FormData();
    f.set("itemId", String(criarItem({ registradoPor: autor.id })));
    f.set("respostasValidacao", "x");
    const id = (await dono.pedir("/api/reivindicacoes", { method: "POST", body: f })).corpo.id;
    const r = await admin.json(`/api/reivindicacoes/${id}/rejeitar`, "PATCH", { motivo: "Não confere" });
    assert.equal(r.corpo.status, "REJEITADA");
    assert.equal((await dono.pedir(`/api/reivindicacoes/abc`)).status, 404);
  });
});

describe("login obrigatório: o site inteiro exige conta", () => {
  const paraLogin = (r: { status: number; resposta: Response }) => {
    assert.equal(r.status, 302);
    return r.resposta.headers.get("location") ?? "";
  };

  test("abrir o site sem login cai no login", async () => {
    assert.equal(paraLogin(await new Navegador().pedir("/")), "/login.html");
  });

  test("página interna sem login: vai para o login e guarda para onde voltar", async () => {
    for (const pagina of ["/index.html", "/itens.html", "/item.html", "/novo-item.html", "/minhas-reivindicacoes.html", "/reivindicacao.html", "/admin.html"]) {
      assert.match(paraLogin(await new Navegador().pedir(pagina)), /^\/login\.html\?voltar=/, pagina);
    }
    assert.equal(
      paraLogin(await new Navegador().pedir("/itens.html?q=chave")),
      "/login.html?voltar=%2Fitens.html%3Fq%3Dchave"
    );
  });

  test("páginas de acesso e seus arquivos abrem sem login", async () => {
    for (const caminho of ["/login.html", "/cadastro.html", "/esqueci-senha.html", "/redefinir-senha.html", "/css/style.css", "/js/api.js", "/img/undb.png"]) {
      assert.equal((await new Navegador().pedir(caminho)).status, 200, caminho);
    }
  });

  test("tentativas de contornar pelo endereço não abrem a página", async () => {
    const tentativas = [
      "/ITENS.HTML",
      "/Admin.html",
      "/itens%2Ehtml",
      "/css/..%2Fitens.html",
      "/css/..%2fadmin.html",
      "/css/%2E%2E%2Fitens.html",
      "/js/..%5Citens.html",
      "/img/../admin.html",
      "/js/%2e%2e/admin.html",
      "/api/..%2Fadmin.html",
      "/uploads/..%2F..%2Fserver%2F.env",
      "/css/%E0%A4%A",
    ];
    for (const caminho of tentativas) {
      const r = await new Navegador().pedir(caminho);
      assert.notEqual(r.status, 200, caminho);
      assert.ok(!String(r.corpo).includes("<header>"), `${caminho} não pode devolver uma página interna`);
    }
  });

  test("a API de leitura também exige login", async () => {
    const id = criarItem({ registradoPor: autor.id });
    for (const rota of ["/api/itens", `/api/itens/${id}`, "/api/referencias/categorias"]) {
      assert.equal((await new Navegador().pedir(rota)).status, 401, rota);
    }
  });

  test("continuam abertas: saúde, login, cadastro e recuperação de senha", async () => {
    assert.equal((await new Navegador().pedir("/api/saude")).status, 200);
    assert.equal((await new Navegador().json("/api/auth/login", "POST", {})).status, 400, "chega na rota (não é 401)");
    assert.equal((await new Navegador().json("/api/auth/recuperar-senha", "POST", { email: "x@undb.edu.br" })).status, 200);
  });

  test("quem entrou abre o início; se abrir o login, vai para o início", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    const inicio = await n.pedir("/");
    assert.equal(inicio.status, 200);
    assert.match(String(inicio.corpo), /<header>/);
    assert.equal(paraLogin(await n.pedir("/login.html")), "/");
  });

  test("quem entrou ainda abre o cadastro (o administrador cria contas por ali)", async () => {
    const { n } = await logado(PerfilUsuario.ADMINISTRADOR);
    assert.equal((await n.pedir("/cadastro.html")).status, 200);
  });

  test("depois de sair, as páginas voltam a pedir login", async () => {
    const { n } = await logado(PerfilUsuario.ALUNO);
    assert.equal((await n.pedir("/itens.html")).status, 200);
    await n.pedir("/api/auth/logout", { method: "POST" });
    assert.equal((await n.pedir("/itens.html")).status, 302);
  });

  test("POST para uma página, sem login: vai para o login sem 'voltar'", async () => {
    assert.equal(paraLogin(await new Navegador().pedir("/itens.html", { method: "POST" })), "/login.html");
  });
});
