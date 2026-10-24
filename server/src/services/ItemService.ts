import { Item } from "../module/Item";
import { Foto } from "../module/Foto";
import { StatusItem } from "../module/StatusItem";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { PeriodoDeDatas } from "../module/PeriodoDeDatas";
import { ItemParado, ItemRepository, ItemResumo } from "../repositories/ItemRepository";
import { CategoriaRepository } from "../repositories/CategoriaRepository";

/** O que vem do formulário: o id da categoria chega como texto. */
export interface DadosFormularioItem {
  titulo?: unknown;
  descricao?: unknown;
  dataAchado?: unknown;
  categoriaId?: unknown;
  local?: unknown;
}

export interface QuemRegistra {
  id: number;
  perfil: PerfilUsuario;
}

/** Parâmetros da URL da busca, como chegam do Express. */
export interface ConsultaBusca {
  categoria?: unknown;
  de?: unknown;
  ate?: unknown;
  q?: unknown;
  local?: unknown;
  ordem?: unknown;
  limite?: unknown;
  inicio?: unknown;
}

/** Registro (RF02), manutenção pelo administrador (RF02.6) e busca (RF03) dos itens. */
export class ItemService {
  public static readonly LIMITE_BUSCA = 60;
  /** A partir de quantos dias disponível sem ninguém buscar um item conta como parado. */
  public static readonly DIAS_PARADO = 30;

  private readonly itemRepo = new ItemRepository();
  private readonly categoriaRepo = new CategoriaRepository();

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
   * RF03.1 a RF03.3, a partir da URL: ?categoria=&de=&ate=&q=&local=&ordem=&limite=&inicio=.
   * O local é texto livre (MR01): o filtro de local procura as palavras digitadas só nele,
   * e a palavra-chave (q) procura no título, na descrição e no local, sem ligar para acentos.
   * ordem: "recentes" (padrão) ou "antigos", pela data de registro.
   * Devolve no máximo LIMITE_BUSCA itens por vez; inicio pula os já mostrados ("Carregar mais").
   */
  public buscar(consulta: ConsultaBusca): ItemResumo[] {
    const ordem = String(consulta.ordem ?? "recentes");
    if (ordem !== "recentes" && ordem !== "antigos") {
      throw new ErroDeNegocio("Ordem inválida: use recentes ou antigos.");
    }
    const limite = consulta.limite === undefined ? ItemService.LIMITE_BUSCA : ItemService.lerId(consulta.limite);
    return this.itemRepo.buscar({
      categoriaId: ItemService.lerFiltroId(consulta.categoria, "Categoria inválida."),
      periodo: new PeriodoDeDatas(consulta.de, consulta.ate),
      palavras: ItemService.lerPalavras(consulta.q, "A busca pode ter no máximo 100 caracteres."),
      palavrasDoLocal: ItemService.lerPalavras(consulta.local, "O filtro de local pode ter no máximo 100 caracteres."),
      maisAntigosPrimeiro: ordem === "antigos",
      limite: Math.min(limite ?? ItemService.LIMITE_BUSCA, ItemService.LIMITE_BUSCA),
      inicio: ItemService.lerInteiro(consulta.inicio, 0, 100000, "Início da lista inválido.") ?? 0,
    });
  }

  /**
   * Itens disponíveis há pelo menos `dias` dias (padrão: DIAS_PARADO) sem ninguém buscar,
   * para a administração decidir doação ou descarte.
   */
  public listarParados(dias: unknown): ItemParado[] {
    const minimo =
      ItemService.lerInteiro(dias, 1, 3650, "Informe os dias como um número de 1 a 3650.") ?? ItemService.DIAS_PARADO;
    return this.itemRepo.listarParados(minimo);
  }

  /** Inteiro de um parâmetro da URL entre min e max; vazio vira null. */
  private static lerInteiro(valor: unknown, min: number, max: number, mensagem: string): number | null {
    if (valor === undefined || valor === "") {
      return null;
    }
    const texto = String(valor);
    const numero = Number(texto);
    if (!/^\d+$/.test(texto) || numero < min || numero > max) {
      throw new ErroDeNegocio(mensagem);
    }
    return numero;
  }

  /** Separa o texto de um filtro em palavras; vazio vira lista vazia. */
  private static lerPalavras(valor: unknown, mensagemSeLongo: string): string[] {
    const texto = String(valor ?? "").trim();
    if (texto.length > 100) {
      throw new ErroDeNegocio(mensagemSeLongo);
    }
    return texto ? texto.split(/\s+/) : [];
  }

  /**
   * RF03.5: detalhes com o nome da categoria, o local e as fotos, sem quem registrou.
   * Alunos e professores veem itens disponíveis ou em reivindicação; os que aguardam recebimento
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

  /** Confere a categoria; título, descrição, local e data são validados pelo Item. */
  private validarDados(dados: DadosFormularioItem) {
    const categoriaId = ItemService.lerId(dados.categoriaId);
    if (categoriaId === null || !this.categoriaRepo.buscarPorId(categoriaId)) {
      throw new ErroDeNegocio("Escolha uma categoria da lista.");
    }
    return {
      titulo: String(dados.titulo ?? ""),
      descricao: String(dados.descricao ?? ""),
      dataAchado: String(dados.dataAchado ?? ""),
      categoriaId,
      local: String(dados.local ?? ""),
    };
  }

  /** Filtro de categoria: vazio não filtra; qualquer coisa que não seja id é erro. */
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
