import { Request, Response } from "express";
import { Item } from "../module/Item";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { ItemService } from "../services/ItemService";
import { SessaoDaRequisicao, UsuarioDaSessao } from "../middlewares/SessaoDaRequisicao";
import { UploadMiddleware } from "../middlewares/UploadMiddleware";

/** RF02 (registro) e RF03 (busca) de itens. */
export class ItemController {
  private readonly servico = new ItemService();

  /** RF03.1 a RF03.3 (filtros: categoria, local, de, ate, q, limite). Lista vazia = RF03.4 na tela. */
  public buscar(req: Request, res: Response): void {
    res.json(this.servico.buscar(req.query));
  }

  /** RF03.5 */
  public detalhar(req: Request, res: Response): void {
    const perfil = SessaoDaRequisicao.usuario(req)?.perfil ?? null;
    res.json(this.servico.detalhar(ItemController.id(req), perfil));
  }

  /**
   * RF02.1 a RF02.5. Chega como formulário multipart: os campos do item e as fotos
   * no campo "fotos". Se o registro falhar, as fotos já gravadas são apagadas.
   */
  public registrar(req: Request, res: Response): void {
    const fotos = UploadMiddleware.arquivos(req);
    const usuario = SessaoDaRequisicao.usuario(req) as UsuarioDaSessao;
    try {
      const item = this.servico.registrar(req.body ?? {}, fotos.map(UploadMiddleware.nome), usuario);
      res.status(201).json(this.comFotos(item));
    } catch (erro) {
      UploadMiddleware.apagar(fotos);
      throw erro;
    }
  }

  /** RF02.6: fila de itens que alunos e professores registraram e ainda não foram entregues. */
  public listarAguardandoRecebimento(req: Request, res: Response): void {
    res.json(this.servico.listarAguardandoRecebimento().map((item) => this.comFotos(item)));
  }

  /** RF02.6 */
  public confirmarRecebimento(req: Request, res: Response): void {
    const item = this.servico.confirmarRecebimento(ItemController.id(req), SessaoDaRequisicao.usuarioId(req));
    res.json(this.comFotos(item));
  }

  /** RF02.6 */
  public editar(req: Request, res: Response): void {
    const item = this.servico.editar(ItemController.id(req), req.body ?? {});
    res.json(this.comFotos(item));
  }

  /** RF02.6 */
  public excluir(req: Request, res: Response): void {
    const fotos = this.servico.excluir(ItemController.id(req));
    UploadMiddleware.apagar(fotos.map((f) => ({ path: f.getCaminhoNoDisco() })));
    res.json({ mensagem: "Item excluído." });
  }

  private comFotos(item: Item) {
    return { ...item.toJSON(), fotos: this.servico.listarFotos(item.getId() as number) };
  }

  /** Id da URL; um id que não é número responde como item inexistente. */
  private static id(req: Request): number {
    const id = ItemService.lerId(req.params.id);
    if (id === null) {
      throw new ErroDeNegocio("Item não encontrado.", 404);
    }
    return id;
  }
}
