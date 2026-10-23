import { Repositorio } from "./Repositorio";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { ItemDevolvido, ItemSobCustodia } from "../module/RelatorioDevolucoes";

/**
 * Tabela devolucao (RF05).
 * A implementar (RF05.1 a RF05.3): salvar(devolucao), que também muda o item para DEVOLVIDO.
 */
export class DevolucaoRepository extends Repositorio {
  /** RF05.4: itens devolvidos no período. */
  public listarDevolvidos(periodo: PeriodoDeDatas): ItemDevolvido[] {
    return this.db
      .prepare<[string, string], ItemDevolvido>(
        `SELECT i.id, i.titulo, c.nome AS categoria, l.nome AS local,
                i.data_achado AS dataAchado, i.data_registro AS dataRegistro,
                d.data_hora AS dataDevolucao,
                ROUND(julianday(d.data_hora) - julianday(i.data_registro), 1) AS diasAteDevolucao
         FROM devolucao d
         JOIN reivindicacao r ON r.id = d.reivindicacao_id
         JOIN item i ON i.id = r.item_id
         JOIN categoria c ON c.id = i.categoria_id
         JOIN local l ON l.id = i.local_id
         WHERE date(d.data_hora) BETWEEN ? AND ?
         ORDER BY d.data_hora DESC`
      )
      .all(periodo.getDe(), periodo.getAte());
  }

  /** RF05.4: itens registrados no período que ainda estão guardados. */
  public listarSobCustodia(periodo: PeriodoDeDatas): ItemSobCustodia[] {
    return this.db
      .prepare<[string, string], ItemSobCustodia>(
        `SELECT i.id, i.titulo, c.nome AS categoria, l.nome AS local,
                i.data_achado AS dataAchado, i.data_registro AS dataRegistro, i.status
         FROM item i
         JOIN categoria c ON c.id = i.categoria_id
         JOIN local l ON l.id = i.local_id
         WHERE i.status IN ('DISPONIVEL', 'EM_REIVINDICACAO') AND date(i.data_registro) BETWEEN ? AND ?
         ORDER BY i.data_registro DESC`
      )
      .all(periodo.getDe(), periodo.getAte());
  }
}
