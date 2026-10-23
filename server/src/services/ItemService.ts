import { Item } from "../module/Item";
import { Foto } from "../module/Foto";
import { StatusItem } from "../module/StatusItem";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { ItemRepository, ItemResumo } from "../repositories/ItemRepository";
import { CategoriaRepository } from "../repositories/CategoriaRepository";
import { LocalRepository } from "../repositories/LocalRepository";

/** O que vem do formulário: os ids chegam como texto. */
export interface DadosFormularioItem {
  titulo?: unknown;
  descricao?: unknown;
  dataAchado?: unknown;
  categoriaId?: unknown;
  localId?: unknown;
}

export interface QuemRegistra {
  id: number;
  perfil: PerfilUsuario;
}

/** Parâmetros da URL da busca, como chegam do Express. */
export interface ConsultaBusca {
  categoria?: unknown;
  local?: unknown;
  de?: unknown;
  ate?: unknown;
  q?: unknown;
  limite?: unknown;
}

/** Registro (RF02), manutenção pelo administrador (RF02.6) e busca (RF03) dos itens. */
export class ItemService {
  public static readonly LIMITE_BUSCA = 60;

  private readonly itemRepo = new ItemRepository();
  private readonly categoriaRepo = new CategoriaRepository();
  private readonly localRepo = new LocalRepository();

  /** RF02.1 a RF02.5. As fotos já foram gravadas em disco pelo UploadMiddleware. */
  public registrar(dados: DadosFormularioItem, caminhosDasFotos: string[], quem: QuemRegistra): Item {
    if (caminhosDasFotos.length === 0) {
      throw new ErroDeNegocio(`Anexe de 1 a ${Item.MAX_FOTOS} fotos do item.`);
    }
    const item = new Item({
      ...this.validarDados(dados),
      registradoPor: quem.id,
      status: Item.statusInicial(quem.perfil),
    });
    return this.itemRepo.salvar(item, caminhosDasFotos);
  }

  /**
   * RF03.1 a RF03.3, a partir da URL: ?categoria=&local=&de=&ate=&q=&limite=.
   * Devolve no máximo LIMITE_BUSCA itens; quem quiser ver mais refina os filtros.
   */
  public buscar(consulta: ConsultaBusca): ItemResumo[] {
    const texto = String(consulta.q ?? "").trim();
    if (texto.length > 100) {
      throw new ErroDeNegocio("A busca pode ter no máximo 100 caracteres.");
    }
    const limite = consulta.limite === undefined ? ItemService.LIMITE_BUSCA : ItemService.lerId(consulta.limite);
    return this.itemRepo.buscar({
      categoriaId: ItemService.lerFiltroId(consulta.categoria, "Categoria inválida."),
      localId: ItemService.lerFiltroId(consulta.local, "Local inválido."),
      periodo: new PeriodoDeDatas(consulta.de, consulta.ate),
      palavras: texto ? texto.split(/\s+/) : [],
      limite: Math.min(limite ?? ItemService.LIMITE_BUSCA, ItemService.LIMITE_BUSCA),
    });
  }

  /**
   * RF03.5: detalhes com nomes da categoria e do local e as fotos, sem quem registrou.
   * O público vê itens disponíveis ou em reivindicação; os que aguardam recebimento
   * ou já foram devolvidos (RN03) só a administração vê.
   */
  public detalhar(id: number, perfil: PerfilUsuario | null) {
    const item = this.buscarPorId(id);
    const publico = [StatusItem.DISPONIVEL, StatusItem.EM_REIVINDICACAO].includes(item.getStatus());
    if (!publico && perfil !== PerfilUsuario.ADMINISTRADOR) {
      throw new ErroDeNegocio("Item não encontrado.", 404);
    }
    return {
      ...item.toJSON(),
      categoria: this.categoriaRepo.buscarPorId(item.getCategoriaId())?.getNome(),
      local: this.localRepo.buscarPorId(item.getLocalId())?.getNome(),
      fotos: this.listarFotos(id),
    };
  }

  public buscarPorId(id: number): Item {
    const item = this.itemRepo.buscarPorId(id);
    if (!item) {
      throw new ErroDeNegocio("Item não encontrado.", 404);
    }
    return item;
  }

  public listarFotos(itemId: number): Foto[] {
    return this.itemRepo.listarFotos(itemId);
  }

  public listarAguardandoRecebimento(): Item[] {
    return this.itemRepo.listarAguardandoRecebimento();
  }

  /** RF02.6: a administração recebeu o objeto; ele passa a aparecer na busca. */
  public confirmarRecebimento(id: number, administradorId: number): Item {
    const item = this.buscarPorId(id);
    const anterior = item.mudarStatus(StatusItem.DISPONIVEL);
    this.itemRepo.mudarStatus(item, anterior, administradorId);
    return item;
  }

  /** RF02.6: troca título, descrição, data, categoria e local, mantendo status e fotos. */
  public editar(id: number, dados: DadosFormularioItem): Item {
    const atual = this.buscarPorId(id);
    const editado = new Item({
      ...this.validarDados(dados),
      id: atual.getId(),
      status: atual.getStatus(),
      registradoPor: atual.getRegistradoPor(),
      dataRegistro: atual.getDataRegistro(),
    });
    this.itemRepo.atualizar(editado);
    return editado;
  }

  /** RF02.6. Devolve as fotos do item, para o controller apagar os arquivos. */
  public excluir(id: number): Foto[] {
    this.buscarPorId(id);
    return this.itemRepo.deletar(id);
  }

  /** Confere os campos do formulário; título, descrição e data são validados pelo Item. */
  private validarDados(dados: DadosFormularioItem) {
    const categoriaId = ItemService.lerId(dados.categoriaId);
    if (categoriaId === null || !this.categoriaRepo.buscarPorId(categoriaId)) {
      throw new ErroDeNegocio("Escolha uma categoria da lista.");
    }
    const localId = ItemService.lerId(dados.localId);
    if (localId === null || !this.localRepo.buscarPorId(localId)) {
      throw new ErroDeNegocio("Escolha um local da lista.");
    }
    return {
      titulo: String(dados.titulo ?? ""),
      descricao: String(dados.descricao ?? ""),
      dataAchado: String(dados.dataAchado ?? ""),
      categoriaId,
      localId,
    };
  }

  /** Filtro de categoria ou local: vazio não filtra; qualquer coisa que não seja id é erro. */
  private static lerFiltroId(valor: unknown, mensagem: string): number | null {
    if (valor === undefined || valor === "") {
      return null;
    }
    const id = ItemService.lerId(valor);
    if (id === null) {
      throw new ErroDeNegocio(mensagem);
    }
    return id;
  }

  /** Inteiro positivo vindo do formulário ou da URL; null se não for. */
  public static lerId(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  }
}
