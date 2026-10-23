import { Repositorio } from "./Repositorio";
import { Item } from "../module/Item";
import { Foto } from "../module/Foto";
import { StatusItem } from "../module/StatusItem";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";

interface LinhaItem {
  id: number;
  titulo: string;
  descricao: string;
  data_achado: string;
  status: StatusItem;
  data_registro: string;
  categoria_id: number;
  local_id: number;
  registrado_por: number;
}

interface LinhaResumo {
  id: number;
  titulo: string;
  data_achado: string;
  status: StatusItem;
  categoria: string;
  local: string;
  foto: string | null;
}

interface LinhaFoto {
  id: number;
  caminho: string;
  item_id: number;
}

/** Filtros da busca (RF03.2 e RF03.3). Os que vierem vazios não restringem nada. */
export interface FiltrosBusca {
  categoriaId: number | null;
  localId: number | null;
  periodo: PeriodoDeDatas;
  palavras: string[];
  limite: number;
}

/** Um item na lista de resultados: nomes no lugar dos ids e a primeira foto. */
export interface ItemResumo {
  id: number;
  titulo: string;
  dataAchado: string;
  status: StatusItem;
  categoria: string;
  local: string;
  foto: string | null;
}

/** Tabelas item, foto e historico_status (RF02, RF03 e RN05). */
export class ItemRepository extends Repositorio {
  /**
   * RF03.1 a RF03.3: só itens disponíveis, dos registrados mais recentemente para os
   * mais antigos. O período é da data do achado. Cada palavra precisa aparecer no
   * título ou na descrição.
   */
  public buscar(filtros: FiltrosBusca): ItemResumo[] {
    const condicoes = ["i.status = ?", "i.data_achado BETWEEN ? AND ?"];
    const valores: (string | number)[] = [StatusItem.DISPONIVEL, filtros.periodo.getDe(), filtros.periodo.getAte()];

    if (filtros.categoriaId !== null) {
      condicoes.push("i.categoria_id = ?");
      valores.push(filtros.categoriaId);
    }
    if (filtros.localId !== null) {
      condicoes.push("i.local_id = ?");
      valores.push(filtros.localId);
    }
    for (const palavra of filtros.palavras) {
      // % e _ digitados pelo usuário valem como letra, não como curinga do LIKE
      const padrao = `%${palavra.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      condicoes.push("(i.titulo LIKE ? ESCAPE '\\' OR i.descricao LIKE ? ESCAPE '\\')");
      valores.push(padrao, padrao);
    }

    return this.db
      .prepare<(string | number)[], LinhaResumo>(
        `SELECT i.id, i.titulo, i.data_achado, i.status, c.nome AS categoria, l.nome AS local,
                (SELECT f.caminho FROM foto f WHERE f.item_id = i.id ORDER BY f.id LIMIT 1) AS foto
         FROM item i
         JOIN categoria c ON c.id = i.categoria_id
         JOIN local l ON l.id = i.local_id
         WHERE ${condicoes.join(" AND ")}
         ORDER BY i.data_registro DESC, i.id DESC
         LIMIT ?`
      )
      .all(...valores, filtros.limite)
      .map((linha) => ({
        id: linha.id,
        titulo: linha.titulo,
        dataAchado: linha.data_achado,
        status: linha.status,
        categoria: linha.categoria,
        local: linha.local,
        foto: linha.foto ? `/uploads/${linha.foto}` : null,
      }));
  }

  /** RF02.1 e RF02.2: grava o item, as fotos e o primeiro registro do histórico (RN05). */
  public salvar(item: Item, caminhosDasFotos: string[]): Item {
    const id = this.db.transaction(() => {
      const resultado = this.db
        .prepare(
          `INSERT INTO item (titulo, descricao, data_achado, status, categoria_id, local_id, registrado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          item.getTitulo(),
          item.getDescricao(),
          item.getDataAchado(),
          item.getStatus(),
          item.getCategoriaId(),
          item.getLocalId(),
          item.getRegistradoPor()
        );
      const itemId = Number(resultado.lastInsertRowid);

      const inserirFoto = this.db.prepare("INSERT INTO foto (caminho, item_id) VALUES (?, ?)");
      for (const caminho of caminhosDasFotos) {
        inserirFoto.run(caminho, itemId);
      }
      this.registrarHistorico(itemId, null, item.getStatus(), item.getRegistradoPor());
      return itemId;
    })();
    return this.buscarPorId(id) as Item;
  }

  public buscarPorId(id: number): Item | null {
    const linha = this.db.prepare<[number], LinhaItem>("SELECT * FROM item WHERE id = ?").get(id);
    return linha ? ItemRepository.paraItem(linha) : null;
  }

  public listarFotos(itemId: number): Foto[] {
    return this.db
      .prepare<[number], LinhaFoto>("SELECT * FROM foto WHERE item_id = ? ORDER BY id")
      .all(itemId)
      .map((linha) => new Foto(linha.caminho, linha.item_id, linha.id));
  }

  /** RF02.6: itens registrados por alunos e professores que ainda não chegaram à custódia. */
  public listarAguardandoRecebimento(): Item[] {
    return this.db
      .prepare<[StatusItem], LinhaItem>("SELECT * FROM item WHERE status = ? ORDER BY data_registro, id")
      .all(StatusItem.AGUARDANDO_RECEBIMENTO)
      .map(ItemRepository.paraItem);
  }

  /**
   * Muda o status (o item já validou a transição em Item.mudarStatus) e registra
   * quem fez e quando (RN05). As duas gravações acontecem juntas ou nenhuma.
   */
  public mudarStatus(item: Item, anterior: StatusItem, usuarioId: number): void {
    this.db.transaction(() => {
      this.db.prepare("UPDATE item SET status = ? WHERE id = ?").run(item.getStatus(), item.getId());
      this.registrarHistorico(item.getId() as number, anterior, item.getStatus(), usuarioId);
    })();
  }

  /** RF02.6: altera os dados descritivos. Status e fotos não mudam por aqui. */
  public atualizar(item: Item): void {
    this.db
      .prepare(
        `UPDATE item SET titulo = ?, descricao = ?, data_achado = ?, categoria_id = ?, local_id = ?
         WHERE id = ?`
      )
      .run(
        item.getTitulo(),
        item.getDescricao(),
        item.getDataAchado(),
        item.getCategoriaId(),
        item.getLocalId(),
        item.getId()
      );
  }

  /**
   * RF02.6: apaga o item, as fotos e o histórico. Item com reivindicação não pode
   * ser apagado, para não perder o registro de quem pediu e do que foi decidido.
   * Devolve as fotos apagadas, para quem chamou remover os arquivos.
   */
  public deletar(id: number): Foto[] {
    return this.db.transaction(() => {
      const temReivindicacao = this.db.prepare("SELECT 1 FROM reivindicacao WHERE item_id = ?").get(id);
      if (temReivindicacao) {
        throw new ErroDeNegocio("Este item já tem reivindicação e não pode ser excluído.", 409);
      }
      const fotos = this.listarFotos(id);
      this.db.prepare("DELETE FROM historico_status WHERE item_id = ?").run(id);
      this.db.prepare("DELETE FROM item WHERE id = ?").run(id); // as fotos saem junto (ON DELETE CASCADE)
      return fotos;
    })();
  }

  private registrarHistorico(itemId: number, anterior: StatusItem | null, novo: StatusItem, usuarioId: number): void {
    this.db
      .prepare("INSERT INTO historico_status (item_id, status_anterior, status_novo, usuario_id) VALUES (?, ?, ?, ?)")
      .run(itemId, anterior, novo, usuarioId);
  }

  private static paraItem(linha: LinhaItem): Item {
    return new Item({
      id: linha.id,
      titulo: linha.titulo,
      descricao: linha.descricao,
      dataAchado: linha.data_achado,
      status: linha.status,
      dataRegistro: linha.data_registro,
      categoriaId: linha.categoria_id,
      localId: linha.local_id,
      registradoPor: linha.registrado_por,
    });
  }
}
