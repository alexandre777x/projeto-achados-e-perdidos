import "../ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PerfilUsuario } from "../../src/module/PerfilUsuario";
import { StatusItem } from "../../src/module/StatusItem";
import { StatusReivindicacao } from "../../src/module/StatusReivindicacao";
import { TipoDocumento } from "../../src/module/TipoDocumento";
import { ItemService } from "../../src/services/ItemService";
import { ReivindicacaoService } from "../../src/services/ReivindicacaoService";
import { DevolucaoService } from "../../src/services/DevolucaoService";
import { criarItem, criarUsuario, contar, historicoDoItem, prepararBanco, sql, statusDoItem } from "../fabrica";
import { erroDeNegocio } from "../verificar";

/**
 * As cinco regras de negócio da seção 6.2 do SRS, cada uma com os seus desvios.
 * Os testes passam pelos services (como faz a API) e conferem o que ficou no banco.
 */
prepararBanco();
const itens = new ItemService();
const reivindicacoes = new ReivindicacaoService();
const devolucoes = new DevolucaoService();

const admin = criarUsuario(PerfilUsuario.ADMINISTRADOR);
const RESPOSTAS = "Capinha azul com adesivo";

function aluno() {
  const u = criarUsuario(PerfilUsuario.ALUNO);
  return { id: u.id, perfil: u.perfil };
}

function itemDisponivel(): number {
  return criarItem({ registradoPor: admin.id, status: StatusItem.DISPONIVEL });
}

/** Item com reivindicação já aprovada: o ponto de partida da devolução. */
function itemComAprovada() {
  const itemId = itemDisponivel();
  const dono = aluno();
  const r = reivindicacoes.abrir(itemId, RESPOSTAS, [], dono);
  reivindicacoes.aprovar(r.getId() as number, admin.id);
  return { itemId, reivindicacaoId: r.getId() as number, dono };
}

describe("RN01: um item só pode ser devolvido depois de uma reivindicação aprovada", () => {
  test("reivindicação aberta: recusa", () => {
    const itemId = itemDisponivel();
    const r = reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    assert.throws(() => devolucoes.registrar(r.getId() as number, TipoDocumento.RG, admin.id), erroDeNegocio(409, "aprovada"));
    assert.equal(statusDoItem(itemId), StatusItem.EM_REIVINDICACAO);
  });

  test("reivindicação rejeitada: recusa", () => {
    const itemId = itemDisponivel();
    const r = reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    reivindicacoes.rejeitar(r.getId() as number, admin.id, "não confere");
    assert.throws(() => devolucoes.registrar(r.getId() as number, TipoDocumento.RG, admin.id), erroDeNegocio(409));
  });

  test("reivindicação inexistente: 404", () => {
    assert.throws(() => devolucoes.registrar(99999, TipoDocumento.RG, admin.id), erroDeNegocio(404));
  });

  test("tipo de documento inválido: recusa antes de mexer no banco", () => {
    const { itemId, reivindicacaoId } = itemComAprovada();
    assert.throws(() => devolucoes.registrar(reivindicacaoId, "PASSAPORTE", admin.id), erroDeNegocio(400));
    assert.equal(statusDoItem(itemId), StatusItem.EM_REIVINDICACAO);
  });

  test("reivindicação aprovada: registra e o item vira DEVOLVIDO (RF05.3)", () => {
    const { itemId, reivindicacaoId } = itemComAprovada();
    const devolucao = devolucoes.registrar(reivindicacaoId, TipoDocumento.CNH, admin.id);
    assert.equal(devolucao.getTipoDocumento(), TipoDocumento.CNH);
    assert.ok(devolucao.getDataHora(), "data e hora gravadas pelo banco");
    assert.equal(statusDoItem(itemId), StatusItem.DEVOLVIDO);
  });

  test("não registra a mesma devolução duas vezes", () => {
    const { reivindicacaoId } = itemComAprovada();
    devolucoes.registrar(reivindicacaoId, TipoDocumento.RG, admin.id);
    assert.throws(() => devolucoes.registrar(reivindicacaoId, TipoDocumento.RG, admin.id), erroDeNegocio(409, "já foi registrada"));
    assert.equal(contar("SELECT COUNT(*) AS n FROM devolucao WHERE reivindicacao_id = ?", reivindicacaoId), 1);
  });

  test("a aprovada sai da lista 'aguardando retirada' depois da devolução", () => {
    const { reivindicacaoId } = itemComAprovada();
    assert.ok(devolucoes.listarAguardandoDevolucao().some((r) => r.id === reivindicacaoId));
    devolucoes.registrar(reivindicacaoId, TipoDocumento.RG, admin.id);
    assert.ok(!devolucoes.listarAguardandoDevolucao().some((r) => r.id === reivindicacaoId));
  });
});

describe("RN02: um item tem no máximo uma reivindicação aprovada", () => {
  test("aprovar uma rejeita automaticamente as outras abertas do mesmo item", () => {
    const itemId = itemDisponivel();
    const a = reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    const b = reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    const c = reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());

    reivindicacoes.aprovar(b.getId() as number, admin.id);

    const status = (id: number) => reivindicacoes.detalhar(id, admin).status;
    assert.equal(status(b.getId() as number), StatusReivindicacao.APROVADA);
    for (const outra of [a, c]) {
      const detalhe = reivindicacoes.detalhar(outra.getId() as number, admin);
      assert.equal(detalhe.status, StatusReivindicacao.REJEITADA);
      assert.match(detalhe.motivoRejeicao as string, /outra reivindicação/i);
    }
    assert.equal(contar("SELECT COUNT(*) AS n FROM reivindicacao WHERE item_id = ? AND status = 'APROVADA'", itemId), 1);
  });

  test("aprovar não mexe nas reivindicações de outros itens", () => {
    const item1 = itemDisponivel();
    const item2 = itemDisponivel();
    const r1 = reivindicacoes.abrir(item1, RESPOSTAS, [], aluno());
    const r2 = reivindicacoes.abrir(item2, RESPOSTAS, [], aluno());
    reivindicacoes.aprovar(r1.getId() as number, admin.id);
    assert.equal(reivindicacoes.detalhar(r2.getId() as number, admin).status, StatusReivindicacao.ABERTA);
  });

  test("depois de aprovada, ninguém mais consegue reivindicar o item", () => {
    const { itemId } = itemComAprovada();
    assert.throws(() => reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno()), erroDeNegocio(409, "posse confirmada"));
  });

  test("o banco também barra uma segunda aprovada (índice único)", () => {
    const { itemId } = itemComAprovada();
    const outro = criarUsuario();
    assert.throws(
      () =>
        sql(
          "INSERT INTO reivindicacao (item_id, reivindicante_id, respostas_validacao, status) VALUES (?, ?, 'x', 'APROVADA')",
          itemId,
          outro.id
        ),
      /UNIQUE constraint failed: reivindicacao\.item_id/
    );
  });
});

describe("RN03: itens devolvidos não aparecem na busca, mas ficam no histórico e no relatório", () => {
  test("some da busca e do detalhe público; a administração ainda vê", () => {
    const { itemId, reivindicacaoId } = itemComAprovada();
    devolucoes.registrar(reivindicacaoId, TipoDocumento.RG, admin.id);

    assert.ok(!itens.buscar({}).some((i) => i.id === itemId));
    assert.throws(() => itens.detalhar(itemId, null), erroDeNegocio(404));
    assert.throws(() => itens.detalhar(itemId, PerfilUsuario.ALUNO), erroDeNegocio(404));
    assert.equal(itens.detalhar(itemId, PerfilUsuario.ADMINISTRADOR).status, StatusItem.DEVOLVIDO);
  });

  test("continua no histórico de status", () => {
    const { itemId, reivindicacaoId } = itemComAprovada();
    devolucoes.registrar(reivindicacaoId, TipoDocumento.RG, admin.id);
    assert.equal(historicoDoItem(itemId).at(-1)?.status_novo, StatusItem.DEVOLVIDO);
  });

  test("a busca só lista DISPONIVEL: os outros três status ficam de fora", () => {
    const visiveis = new Set(itens.buscar({}).map((i) => i.id));
    const porStatus = Object.fromEntries(
      Object.values(StatusItem).map((status) => [status, criarItem({ registradoPor: admin.id, status })])
    );
    const depois = new Set(itens.buscar({}).map((i) => i.id));
    assert.ok(depois.has(porStatus[StatusItem.DISPONIVEL]));
    for (const status of [StatusItem.AGUARDANDO_RECEBIMENTO, StatusItem.EM_REIVINDICACAO, StatusItem.DEVOLVIDO]) {
      assert.ok(!depois.has(porStatus[status]), status);
    }
    assert.equal(depois.size, visiveis.size + 1);
  });
});

describe("RN04: o anúncio público não mostra os detalhes usados na validação", () => {
  test("o detalhe público do item não traz reivindicações nem respostas", () => {
    const itemId = itemDisponivel();
    reivindicacoes.abrir(itemId, "SEGREDO-DA-VALIDACAO", [], aluno());
    const publico = JSON.stringify(itens.detalhar(itemId, null));
    assert.ok(!publico.includes("SEGREDO-DA-VALIDACAO"));
    assert.ok(!publico.includes("registradoPor"));
  });

  test("a busca também não traz as respostas", () => {
    const itemId = itemDisponivel();
    const r = reivindicacoes.abrir(itemId, "SEGREDO-NA-BUSCA", [], aluno());
    reivindicacoes.rejeitar(r.getId() as number, admin.id, "não confere"); // volta para a busca
    assert.ok(itens.buscar({}).some((i) => i.id === itemId));
    assert.ok(!JSON.stringify(itens.buscar({})).includes("SEGREDO-NA-BUSCA"));
  });

  test("só o reivindicante e a administração veem as respostas; os outros recebem 404", () => {
    const itemId = itemDisponivel();
    const dono = aluno();
    const r = reivindicacoes.abrir(itemId, RESPOSTAS, [], dono);
    const id = r.getId() as number;

    assert.equal(reivindicacoes.detalhar(id, dono).respostasValidacao, RESPOSTAS);
    assert.equal(reivindicacoes.detalhar(id, admin).respostasValidacao, RESPOSTAS);
    assert.throws(() => reivindicacoes.detalhar(id, aluno()), erroDeNegocio(404));
    assert.throws(() => reivindicacoes.listarMensagens(id, aluno()), erroDeNegocio(404));
    assert.throws(() => reivindicacoes.enviarMensagem(id, "oi", aluno()), erroDeNegocio(404));
  });
});

describe("RN05: toda mudança de status registra usuário, data e hora", () => {
  test("ciclo completo: registro, recebimento, reivindicação, rejeição, nova reivindicação, aprovação e devolução", () => {
    const quemAchou = aluno();
    const item = itens.registrar(
      { titulo: "Celular", descricao: "Preto", dataAchado: "2026-10-01", categoriaId: 1, local: "Cantina, mesa do canto" },
      ["foto.png"],
      quemAchou
    );
    const itemId = item.getId() as number;
    itens.confirmarRecebimento(itemId, admin.id);

    const primeiro = aluno();
    const r1 = reivindicacoes.abrir(itemId, RESPOSTAS, [], primeiro);
    reivindicacoes.rejeitar(r1.getId() as number, admin.id, "não confere");

    const dono = aluno();
    const r2 = reivindicacoes.abrir(itemId, RESPOSTAS, [], dono);
    reivindicacoes.aprovar(r2.getId() as number, admin.id);
    devolucoes.registrar(r2.getId() as number, TipoDocumento.RG, admin.id);

    const esperado = [
      [null, StatusItem.AGUARDANDO_RECEBIMENTO, quemAchou.id],
      [StatusItem.AGUARDANDO_RECEBIMENTO, StatusItem.DISPONIVEL, admin.id],
      [StatusItem.DISPONIVEL, StatusItem.EM_REIVINDICACAO, primeiro.id],
      [StatusItem.EM_REIVINDICACAO, StatusItem.DISPONIVEL, admin.id],
      [StatusItem.DISPONIVEL, StatusItem.EM_REIVINDICACAO, dono.id],
      [StatusItem.EM_REIVINDICACAO, StatusItem.DEVOLVIDO, admin.id],
    ];
    assert.deepEqual(
      historicoDoItem(itemId).map((h) => [h.status_anterior, h.status_novo, h.usuario_id]),
      esperado
    );
    assert.equal(
      contar("SELECT COUNT(*) AS n FROM historico_status WHERE item_id = ? AND data_hora IS NOT NULL", itemId),
      esperado.length
    );
  });

  test("aprovar não muda o status do item, então não gera histórico", () => {
    const itemId = itemDisponivel();
    const r = reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    const antes = historicoDoItem(itemId).length;
    reivindicacoes.aprovar(r.getId() as number, admin.id);
    assert.equal(historicoDoItem(itemId).length, antes);
  });

  test("segunda reivindicação num item já EM_REIVINDICACAO não gera histórico", () => {
    const itemId = itemDisponivel();
    reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    const antes = historicoDoItem(itemId).length;
    reivindicacoes.abrir(itemId, RESPOSTAS, [], aluno());
    assert.equal(historicoDoItem(itemId).length, antes);
  });

  test("transição recusada não grava nada", () => {
    const itemId = itemDisponivel();
    assert.throws(() => itens.confirmarRecebimento(itemId, admin.id), erroDeNegocio(409));
    assert.equal(historicoDoItem(itemId).length, 0);
    assert.equal(statusDoItem(itemId), StatusItem.DISPONIVEL);
  });
});
