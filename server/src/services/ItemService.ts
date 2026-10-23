import { Item } from "../module/Item";
import { Foto } from "../module/Foto";
import { StatusItem } from "../module/StatusItem";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { ItemRepository } from "../repositories/ItemRepository";
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

/** Registro (RF02.1 a RF02.5) e manutenção pelo administrador (RF02.6) dos itens. */
export class ItemService {
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

  /** Inteiro positivo vindo do formulário ou da URL; null se não for. */
  public static lerId(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  }
}
