import { ErroDeNegocio } from "./ErroDeNegocio";
import { PerfilUsuario } from "./PerfilUsuario";
import { StatusItem } from "./StatusItem";

export interface DadosItem {
  titulo: string;
  descricao: string;
  dataAchado: string; // AAAA-MM-DD
  categoriaId: number;
  localId: number;
  registradoPor: number;
  status?: StatusItem;
  id?: number;
  dataRegistro?: string;
}

/** Objeto encontrado no campus (RF02). */
export class Item {
  public static readonly MAX_FOTOS = 3;

  /** Mudanças de status permitidas pelo ciclo de vida do SRS. */
  private static readonly TRANSICOES: Record<StatusItem, StatusItem[]> = {
    [StatusItem.AGUARDANDO_RECEBIMENTO]: [StatusItem.DISPONIVEL],
    [StatusItem.DISPONIVEL]: [StatusItem.EM_REIVINDICACAO],
    [StatusItem.EM_REIVINDICACAO]: [StatusItem.DISPONIVEL, StatusItem.DEVOLVIDO],
    [StatusItem.DEVOLVIDO]: [],
  };

  private id?: number;
  private titulo: string;
  private descricao: string;
  private dataAchado: string;
  private status: StatusItem;
  private categoriaId: number;
  private localId: number;
  private registradoPor: number;
  private dataRegistro?: string;

  constructor(dados: DadosItem) {
    const titulo = String(dados.titulo ?? "").trim();
    const descricao = String(dados.descricao ?? "").trim();

    if (titulo.length < 3 || titulo.length > 80) {
      throw new ErroDeNegocio("O título precisa ter entre 3 e 80 caracteres.");
    }
    if (descricao.length === 0 || descricao.length > 1000) {
      throw new ErroDeNegocio("A descrição precisa ter entre 1 e 1000 caracteres.");
    }
    Item.validarDataAchado(dados.dataAchado);

    this.titulo = titulo;
    this.descricao = descricao;
    this.dataAchado = dados.dataAchado;
    this.categoriaId = dados.categoriaId;
    this.localId = dados.localId;
    this.registradoPor = dados.registradoPor;
    this.status = dados.status ?? StatusItem.AGUARDANDO_RECEBIMENTO;
    this.id = dados.id;
    this.dataRegistro = dados.dataRegistro;
  }

  /** RF02.5: "Disponível" se o administrador registrou; senão "Aguardando recebimento". */
  public static statusInicial(perfil: PerfilUsuario): StatusItem {
    return perfil === PerfilUsuario.ADMINISTRADOR
      ? StatusItem.DISPONIVEL
      : StatusItem.AGUARDANDO_RECEBIMENTO;
  }

  /** RF02.4: data válida e que não seja futura. */
  private static validarDataAchado(data: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data)) || Number.isNaN(Date.parse(data))) {
      throw new ErroDeNegocio("Informe a data do achado no formato AAAA-MM-DD.");
    }
    const agora = new Date();
    const hoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    if (data > hoje) {
      throw new ErroDeNegocio("A data do achado não pode ser futura.");
    }
  }

  /**
   * Muda o status respeitando o ciclo de vida e devolve o status anterior,
   * para o histórico (RN05).
   */
  public mudarStatus(novo: StatusItem): StatusItem {
    if (!Item.TRANSICOES[this.status].includes(novo)) {
      throw new ErroDeNegocio(`O item não pode passar de ${this.status} para ${novo}.`, 409);
    }
    const anterior = this.status;
    this.status = novo;
    return anterior;
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getTitulo(): string {
    return this.titulo;
  }

  public getDescricao(): string {
    return this.descricao;
  }

  public getDataAchado(): string {
    return this.dataAchado;
  }

  public getStatus(): StatusItem {
    return this.status;
  }

  public getCategoriaId(): number {
    return this.categoriaId;
  }

  public getLocalId(): number {
    return this.localId;
  }

  public getRegistradoPor(): number {
    return this.registradoPor;
  }

  public estaDisponivel(): boolean {
    return this.status === StatusItem.DISPONIVEL;
  }

  /** Visão pública: não revela quem registrou o item (RF03.5, RNF09). */
  public toJSON() {
    return {
      id: this.id,
      titulo: this.titulo,
      descricao: this.descricao,
      dataAchado: this.dataAchado,
      status: this.status,
      categoriaId: this.categoriaId,
      localId: this.localId,
      dataRegistro: this.dataRegistro,
    };
  }
}
