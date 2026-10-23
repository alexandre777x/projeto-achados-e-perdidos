import "../ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { StatusItem } from "../../src/module/StatusItem";
import { ItemService } from "../../src/services/ItemService";
import { ReivindicacaoService } from "../../src/services/ReivindicacaoService";
import { CategoriaRepository } from "../../src/repositories/CategoriaRepository";
import { Categoria } from "../../src/module/Categoria";
import { contar, criarItem, criarUsuario, historicoDoItem, prepararBanco, sql, statusDoItem } from "../fabrica";
import { erroDeNegocio } from "../verificar";

prepararBanco();
const servico = new ItemService();
const admin = criarUsuario(PerfilUsuario.ADMINISTRADOR);
const aluno = criarUsuario(PerfilUsuario.ALUNO);
const professor = criarUsuario(PerfilUsuario.PROFESSOR);

const FORMULARIO = { titulo: "Garrafa azul", descricao: "Garrafa térmica", dataAchado: "2026-10-01", categoriaId: "6", local: "Biblioteca, perto da janela" };

describe("ItemService.registrar (RF02.1 a RF02.5)", () => {
  test("sem foto é recusado (RF02.2)", () => {
    assert.throws(() => servico.registrar(FORMULARIO, [], aluno), erroDeNegocio(400, "foto"));
  });

  test("status inicial depende do perfil (RF02.5)", () => {
    assert.equal(servico.registrar(FORMULARIO, ["a.png"], admin).getStatus(), StatusItem.DISPONIVEL);
    assert.equal(servico.registrar(FORMULARIO, ["a.png"], aluno).getStatus(), StatusItem.AGUARDANDO_RECEBIMENTO);
    assert.equal(servico.registrar(FORMULARIO, ["a.png"], professor).getStatus(), StatusItem.AGUARDANDO_RECEBIMENTO);
  });

  test("grava as fotos na ordem e o primeiro registro do histórico", () => {
    const item = servico.registrar(FORMULARIO, ["1.png", "2.jpg", "3.png"], aluno);
    const id = item.getId() as number;
    assert.deepEqual(servico.listarFotos(id).map((f) => f.getCaminho()), ["1.png", "2.jpg", "3.png"]);
    assert.deepEqual(historicoDoItem(id), [{ status_anterior: null, status_novo: StatusItem.AGUARDANDO_RECEBIMENTO, usuario_id: aluno.id }]);
  });

  test("categoria: precisa ser um id existente (RF02.3)", () => {
    const casos: [Record<string, unknown>, string][] = [
      [{ categoriaId: "999" }, "categoria"],
      [{ categoriaId: "abc" }, "categoria"],
      [{ categoriaId: "0" }, "categoria"],
      [{ categoriaId: "1.5" }, "categoria"],
      [{ categoriaId: undefined }, "categoria"],
    ];
    for (const [alteracao, campo] of casos) {
      assert.throws(() => servico.registrar({ ...FORMULARIO, ...alteracao }, ["a.png"], aluno), erroDeNegocio(400, campo), JSON.stringify(alteracao));
    }
  });

  test("campos ausentes viram texto vazio e são recusados pelo Item", () => {
    assert.throws(() => servico.registrar({ categoriaId: "1" }, ["a.png"], aluno), erroDeNegocio(400, "título"));
  });

  test("local: texto livre, obrigatório, guardado sem espaços nas pontas", () => {
    const item = servico.registrar({ ...FORMULARIO, local: "  Cantina, mesa do canto  " }, ["a.png"], aluno);
    assert.equal(servico.buscarPorId(item.getId() as number).getLocal(), "Cantina, mesa do canto");
    for (const local of [undefined, "", "ab", "a".repeat(151)]) {
      assert.throws(() => servico.registrar({ ...FORMULARIO, local }, ["a.png"], aluno), erroDeNegocio(400, "onde"), String(local));
    }
  });

  test("falha no registro não deixa item gravado", () => {
    const antes = contar("SELECT COUNT(*) AS n FROM item");
    assert.throws(() => servico.registrar({ ...FORMULARIO, dataAchado: "2999-01-01" }, ["a.png"], aluno));
    assert.equal(contar("SELECT COUNT(*) AS n FROM item"), antes);
  });
});

describe("ItemService: manutenção pelo administrador (RF02.6)", () => {
  test("fila de aguardando recebimento: só esse status, mais antigos primeiro", () => {
    const antigo = criarItem({ registradoPor: aluno.id, status: StatusItem.AGUARDANDO_RECEBIMENTO, dataRegistro: "2026-01-01 08:00:00" });
    criarItem({ registradoPor: aluno.id, status: StatusItem.DISPONIVEL });
    const fila = servico.listarAguardandoRecebimento();
    assert.ok(fila.every((i) => i.getStatus() === StatusItem.AGUARDANDO_RECEBIMENTO));
    assert.equal(fila[0].getId(), antigo);
  });

  test("confirmar recebimento: AGUARDANDO -> DISPONIVEL, com histórico", () => {
    const id = criarItem({ registradoPor: aluno.id, status: StatusItem.AGUARDANDO_RECEBIMENTO });
    assert.equal(servico.confirmarRecebimento(id, admin.id).getStatus(), StatusItem.DISPONIVEL);
    assert.equal(statusDoItem(id), StatusItem.DISPONIVEL);
    assert.equal(historicoDoItem(id).at(-1)?.usuario_id, admin.id);
  });

  test("confirmar item inexistente: 404", () => {
    assert.throws(() => servico.confirmarRecebimento(99999, admin.id), erroDeNegocio(404));
  });

  test("editar troca os dados mas mantém status, autor e data de registro", () => {
    const id = criarItem({ registradoPor: aluno.id, status: StatusItem.EM_REIVINDICACAO, dataRegistro: "2026-01-01 08:00:00" });
    const editado = servico.editar(id, { ...FORMULARIO, titulo: "Garrafa verde", categoriaId: 2, local: "Portaria" });
    assert.equal(editado.getTitulo(), "Garrafa verde");
    const lido = servico.buscarPorId(id);
    assert.equal(lido.getTitulo(), "Garrafa verde");
    assert.equal(lido.getCategoriaId(), 2);
    assert.equal(lido.getLocal(), "Portaria");
    assert.equal(lido.getStatus(), StatusItem.EM_REIVINDICACAO);
    assert.equal(lido.getRegistradoPor(), aluno.id);
    assert.equal(lido.getDataRegistro(), "2026-01-01 08:00:00");
  });

  test("editar com dado inválido não altera nada", () => {
    const id = criarItem({ registradoPor: aluno.id, titulo: "Original" });
    assert.throws(() => servico.editar(id, { ...FORMULARIO, titulo: "ab" }), erroDeNegocio(400));
    assert.equal(servico.buscarPorId(id).getTitulo(), "Original");
  });

  test("editar inexistente: 404 antes de validar os dados", () => {
    assert.throws(() => servico.editar(99999, {}), erroDeNegocio(404));
  });

  test("excluir apaga item, fotos e histórico e devolve as fotos", () => {
    const item = servico.registrar(FORMULARIO, ["x.png", "y.png"], admin);
    const id = item.getId() as number;
    const fotos = servico.excluir(id);
    assert.deepEqual(fotos.map((f) => f.getCaminho()), ["x.png", "y.png"]);
    assert.equal(contar("SELECT COUNT(*) AS n FROM item WHERE id = ?", id), 0);
    assert.equal(contar("SELECT COUNT(*) AS n FROM foto WHERE item_id = ?", id), 0);
    assert.equal(contar("SELECT COUNT(*) AS n FROM historico_status WHERE item_id = ?", id), 0);
  });

  test("excluir item com reivindicação é recusado e não apaga nada", () => {
    const id = criarItem({ registradoPor: admin.id });
    new ReivindicacaoService().abrir(id, "respostas", [], aluno);
    assert.throws(() => servico.excluir(id), erroDeNegocio(409, "reivindicação"));
    assert.equal(contar("SELECT COUNT(*) AS n FROM item WHERE id = ?", id), 1);
  });

  test("excluir inexistente: 404", () => {
    assert.throws(() => servico.excluir(99999), erroDeNegocio(404));
  });
});

describe("ItemService.buscar (RF03.1 a RF03.3)", () => {
  // Cenário próprio, com títulos que só existem aqui
  const marca = "Zq";
  const ids = {
    mochila: criarItem({ registradoPor: admin.id, titulo: `${marca} Mochila preta`, categoriaId: 3, local: "Bloco A, sala 104", dataAchado: "2026-09-01", dataRegistro: "2026-09-01 10:00:00" }),
    fone: criarItem({ registradoPor: admin.id, titulo: `${marca} Fone`, descricao: "Fone PRETO sem fio", categoriaId: 1, local: "Bloco A, corredor", dataAchado: "2026-09-10", dataRegistro: "2026-09-10 10:00:00" }),
    chave: criarItem({ registradoPor: admin.id, titulo: `${marca} Chave 100%`, categoriaId: 5, local: "Banco em frente à cantina", dataAchado: "2026-09-20", dataRegistro: "2026-09-20 10:00:00" }),
  };
  const buscar = (consulta: Record<string, unknown>) =>
    servico.buscar({ ...consulta, q: `${marca} ${consulta.q ?? ""}`.trim() }).map((i) => i.id);

  test("mais recentes primeiro (RF03.1)", () => {
    assert.deepEqual(buscar({}), [ids.chave, ids.fone, ids.mochila]);
  });

  test("filtros isolados e combinados (RF03.2)", () => {
    assert.deepEqual(buscar({ categoria: "1" }), [ids.fone]);
    assert.deepEqual(buscar({ categoria: "3", q: "bloco" }), [ids.mochila]);
    assert.deepEqual(buscar({ categoria: "3", q: "cantina" }), []);
    assert.deepEqual(buscar({ de: "2026-09-05", ate: "2026-09-15" }), [ids.fone]);
    assert.deepEqual(buscar({ de: "2026-09-10" }), [ids.chave, ids.fone]);
    assert.deepEqual(buscar({ ate: "2026-09-10" }), [ids.fone, ids.mochila]);
  });

  test("filtro vazio não filtra", () => {
    assert.deepEqual(buscar({ categoria: "" }), [ids.chave, ids.fone, ids.mochila]);
  });

  test("palavras: no título, na descrição ou no local, sem diferenciar maiúsculas, todas precisam aparecer (RF03.3)", () => {
    assert.deepEqual(buscar({ q: "preta" }), [ids.mochila]);
    assert.deepEqual(buscar({ q: "cantina" }), [ids.chave], "acha pelo local");
    assert.deepEqual(buscar({ q: "BLOCO A" }), [ids.fone, ids.mochila], "local, sem diferenciar maiúsculas");
    assert.deepEqual(buscar({ q: "fone corredor" }), [ids.fone], "uma palavra no título e outra no local");
    assert.deepEqual(buscar({ q: "preto" }), [ids.fone]);
    assert.deepEqual(buscar({ q: "FONE   preto" }), [ids.fone]);
    assert.deepEqual(buscar({ q: "fone mochila" }), []);
  });

  test("% e _ digitados são texto, não curinga", () => {
    assert.deepEqual(buscar({ q: "%" }), [ids.chave]);
    assert.deepEqual(buscar({ q: "_" }), []);
    assert.deepEqual(buscar({ q: "\\" }), []);
  });

  test("resultado traz o nome da categoria, o local e a primeira foto", () => {
    sql("INSERT INTO foto (caminho, item_id) VALUES ('primeira.png', ?), ('segunda.png', ?)", ids.fone, ids.fone);
    const fone = servico.buscar({ q: `${marca} fone` })[0];
    assert.equal(fone.categoria, "Eletrônicos");
    assert.equal(fone.local, "Bloco A, corredor");
    assert.equal(fone.foto, "/uploads/primeira.png");
    assert.equal(servico.buscar({ q: `${marca} mochila` })[0].foto, null);
  });

  test("limite: padrão e máximo de 60; valor inválido usa o padrão", () => {
    assert.deepEqual(buscar({ limite: "1" }), [ids.chave]);
    for (let i = 0; i < 61; i++) criarItem({ registradoPor: admin.id, titulo: `Lote ${i}` });
    assert.equal(servico.buscar({}).length, 60);
    assert.equal(servico.buscar({ limite: "500" }).length, 60);
    assert.equal(servico.buscar({ limite: "abc" }).length, 60);
  });

  test("entradas inválidas", () => {
    assert.throws(() => servico.buscar({ categoria: "abc" }), erroDeNegocio(400, "categoria"));
    assert.throws(() => servico.buscar({ q: "a".repeat(101) }), erroDeNegocio(400, "100"));
    assert.throws(() => servico.buscar({ de: "2026-10-10", ate: "2026-10-01" }), erroDeNegocio(400, "inicial"));
  });
});

describe("ItemService.detalhar (RF03.5)", () => {
  test("público vê DISPONIVEL e EM_REIVINDICACAO, com categoria, local e fotos", () => {
    for (const status of [StatusItem.DISPONIVEL, StatusItem.EM_REIVINDICACAO]) {
      const id = criarItem({ registradoPor: aluno.id, status, categoriaId: 2, local: "Biblioteca, 2º andar" });
      const d = servico.detalhar(id, null);
      assert.equal(d.status, status);
      assert.equal(d.categoria, "Documentos");
      assert.equal(d.local, "Biblioteca, 2º andar");
      assert.deepEqual(d.fotos, []);
    }
  });

  test("AGUARDANDO_RECEBIMENTO e DEVOLVIDO: 404 para o público, visível para o administrador", () => {
    for (const status of [StatusItem.AGUARDANDO_RECEBIMENTO, StatusItem.DEVOLVIDO]) {
      const id = criarItem({ registradoPor: aluno.id, status });
      assert.throws(() => servico.detalhar(id, null), erroDeNegocio(404));
      assert.throws(() => servico.detalhar(id, PerfilUsuario.PROFESSOR), erroDeNegocio(404));
      assert.equal(servico.detalhar(id, PerfilUsuario.ADMINISTRADOR).status, status);
    }
  });

  test("inexistente: 404", () => {
    assert.throws(() => servico.detalhar(99999, PerfilUsuario.ADMINISTRADOR), erroDeNegocio(404));
  });
});

describe("ItemService.lerId", () => {
  test("só inteiros positivos", () => {
    assert.equal(ItemService.lerId("7"), 7);
    assert.equal(ItemService.lerId(7), 7);
    for (const valor of ["0", "-1", "1.5", "abc", "", undefined, null]) {
      assert.equal(ItemService.lerId(valor), null, String(valor));
    }
  });
});

describe("Categorias (RF02.3)", () => {
  const categorias = new CategoriaRepository();

  test("lista em ordem alfabética", () => {
    const nomes = categorias.listarTodas().map((c) => c.getNome());
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  test("criar e recusar nome repetido, sem diferenciar maiúsculas", () => {
    const nova = categorias.salvar(new Categoria("Livros"));
    assert.ok(nova.getId());
    assert.equal(categorias.buscarPorId(nova.getId() as number)?.getNome(), "Livros");
    assert.throws(() => categorias.salvar(new Categoria("LIVROS")), erroDeNegocio(409));
  });

  test("buscarPorId de inexistente devolve null", () => {
    assert.equal(categorias.buscarPorId(99999), null);
  });
});
