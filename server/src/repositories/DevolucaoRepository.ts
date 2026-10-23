import { Repositorio } from "./Repositorio";
import { Devolucao } from "../module/Devolucao";
import { TipoDocumento } from "../module/TipoDocumento";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { ItemDevolvido, ItemSobCustodia } from "../module/RelatorioDevolucoes";

interface LinhaDevolucao {
  id: number;
  data_hora: string;
  tipo_documento: TipoDocumento;
  reivindicacao_id: number;
  administrador_id: number;
}

/** Tabela devolucao (RF05). A mudança do item para DEVOLVIDO fica no DevolucaoService. */
export class DevolucaoRepository extends Repositorio {
  /** RF05.2: o dono e o item vêm da reivindicação aprovada; a data e a hora, do banco. */
  public salvar(devolucao: Devolucao): Devolucao {
    const resultado = this.db
      .prepare("INSERT INTO devolucao (reivindicacao_id, administrador_id, tipo_documento) VALUES (?, ?, ?)")
      .run(devolucao.getReivindicacaoId(), devolucao.getAdministradorId(), devolucao.getTipoDocumento());
    return this.buscarPorId(Number(resultado.lastInsertRowid)) as Devolucao;
  }

  public buscarPorId(id: number): Devolucao | null {
    const linha = this.db.prepare<[number], LinhaDevolucao>("SELECT * FROM devolucao WHERE id = ?").get(id);
    return linha ? DevolucaoRepository.paraDevolucao(linha) : null;
  }

  public buscarPorReivindicacao(reivindicacaoId: number): Devolucao | null {
    const linha = this.db
      .prepare<[number], LinhaDevolucao>("SELECT * FROM devolucao WHERE reivindicacao_id = ?")
      .get(reivindicacaoId);
    return linha ? DevolucaoRepository.paraDevolucao(linha) : null;
  }

  private static paraDevolucao(linha: LinhaDevolucao): Devolucao {
    return new Devolucao(linha.reivindicacao_id, linha.administrador_id, linha.tipo_documento, linha.id, linha.data_hora);
  }

  /** RF05.4: itens devolvidos no período. */
  public listarDevolvidos(periodo: PeriodoDeDatas): ItemDevolvido[] {
    return this.db
      .prepare<[string, string], ItemDevolvido>(
        `SELECT i.id, i.titulo, c.nome AS categoria, i.local_encontrado AS local,
                i.data_achado AS dataAchado, i.data_registro AS dataRegistro,
                d.data_hora AS dataDevolucao,
                ROUND(julianday(d.data_hora) - julianday(i.data_registro), 1) AS diasAteDevolucao
         FROM devolucao d
         JOIN reivindicacao r ON r.id = d.reivindicacao_id
         JOIN item i ON i.id = r.item_id
         JOIN categoria c ON c.id = i.categoria_id
         WHERE date(d.data_hora) BETWEEN ? AND ?
         ORDER BY d.data_hora DESC`
      )
      .all(periodo.getDe(), periodo.getAte());
  }

  /** RF05.4: itens registrados no período que ainda estão guardados. */
  public listarSobCustodia(periodo: PeriodoDeDatas): ItemSobCustodia[] {
    return this.db
      .prepare<[string, string], ItemSobCustodia>(
        `SELECT i.id, i.titulo, c.nome AS categoria, i.local_encontrado AS local,
                i.data_achado AS dataAchado, i.data_registro AS dataRegistro, i.status
         FROM item i
         JOIN categoria c ON c.id = i.categoria_id
         WHERE i.status IN ('DISPONIVEL', 'EM_REIVINDICACAO') AND date(i.data_registro) BETWEEN ? AND ?
         ORDER BY i.data_registro DESC`
      )
      .all(periodo.getDe(), periodo.getAte());
  }
}
