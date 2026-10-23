import { PeriodoDeDatas } from "./PeriodoDeDatas";
import { StatusItem } from "./StatusItem";

export interface ItemDevolvido {
  id: number;
  titulo: string;
  categoria: string;
  local: string;
  dataAchado: string;
  dataRegistro: string;
  dataDevolucao: string;
  diasAteDevolucao: number;
}

export interface ItemSobCustodia {
  id: number;
  titulo: string;
  categoria: string;
  local: string;
  dataAchado: string;
  dataRegistro: string;
  status: StatusItem;
}

/**
 * Relatório de devoluções de um período (RF05.4) e sua exportação em CSV (RF05.5).
 * O tempo até a devolução conta da data de registro do item até a devolução.
 * Não traz dados pessoais do dono (RNF09).
 */
export class RelatorioDevolucoes {
  private static readonly SITUACAO: Record<string, string> = {
    [StatusItem.DISPONIVEL]: "Disponível",
    [StatusItem.EM_REIVINDICACAO]: "Em reivindicação",
  };

  constructor(
    private readonly periodo: PeriodoDeDatas,
    private readonly devolvidos: ItemDevolvido[],
    private readonly sobCustodia: ItemSobCustodia[]
  ) {}

  /** Média em dias com uma casa decimal; null se nada foi devolvido no período. */
  public tempoMedioDias(): number | null {
    if (this.devolvidos.length === 0) {
      return null;
    }
    const soma = this.devolvidos.reduce((total, item) => total + item.diasAteDevolucao, 0);
    return Math.round((soma / this.devolvidos.length) * 10) / 10;
  }

  /** Separado por ponto e vírgula e com BOM, para abrir certo no Excel em português. */
  public paraCsv(): string {
    const linhas: unknown[][] = [
      ["Situação", "ID", "Título", "Categoria", "Local", "Data do achado", "Data do registro", "Data da devolução", "Dias até a devolução"],
      ...this.devolvidos.map((i) => ["Devolvido", i.id, i.titulo, i.categoria, i.local, i.dataAchado, i.dataRegistro, i.dataDevolucao, i.diasAteDevolucao]),
      ...this.sobCustodia.map((i) => [RelatorioDevolucoes.SITUACAO[i.status], i.id, i.titulo, i.categoria, i.local, i.dataAchado, i.dataRegistro, "", ""]),
      [],
      ["Tempo médio até a devolução (dias)", this.tempoMedioDias()],
    ];
    const corpo = linhas.map((linha) => linha.map(RelatorioDevolucoes.celula).join(";")).join("\r\n");
    return "﻿" + corpo + "\r\n";
  }

  public nomeDoArquivoCsv(): string {
    return `relatorio-devolucoes_${this.periodo.descricaoCurta()}.csv`;
  }

  /** Uma célula de CSV: aspas quando precisa e proteção contra fórmulas do Excel (=, +, -, @). */
  private static celula(valor: unknown): string {
    if (valor === null || valor === undefined) {
      return "";
    }
    let texto = typeof valor === "number" ? String(valor).replace(".", ",") : String(valor);
    if (/^[=+\-@\t\r]/.test(texto)) {
      texto = `'${texto}`;
    }
    return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  }

  public toJSON() {
    return {
      periodo: this.periodo,
      devolvidos: this.devolvidos,
      disponiveis: this.sobCustodia,
      tempoMedioDias: this.tempoMedioDias(),
    };
  }
}
