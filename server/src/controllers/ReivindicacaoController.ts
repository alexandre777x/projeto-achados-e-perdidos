import { Request, Response } from "express";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { ItemService } from "../services/ItemService";
import { ReivindicacaoService, Solicitante } from "../services/ReivindicacaoService";
import { SessaoDaRequisicao } from "../middlewares/SessaoDaRequisicao";
import { UploadMiddleware } from "../middlewares/UploadMiddleware";

/** RF04 – Reivindicação de posse. */
export class ReivindicacaoController {
  private readonly servico = new ReivindicacaoService();

  /**
   * RF04.1, RF04.2 (com provas de posse), RF04.6. Chega como formulário multipart:
   * itemId, respostasValidacao e até 3 arquivos no campo "provas".
   * Se a abertura falhar, as provas já gravadas são apagadas.
   */
  public abrir(req: Request, res: Response): void {
    const provas = UploadMiddleware.arquivos(req);
    try {
      const itemId = ItemService.lerId(req.body?.itemId);
      if (itemId === null) {
        throw new ErroDeNegocio("Informe o item que você quer reivindicar.");
      }
      const reivindicacao = this.servico.abrir(
        itemId,
        req.body?.respostasValidacao,
        provas.map((p) => ({ caminho: UploadMiddleware.nome(p), nomeOriginal: p.originalname })),
        ReivindicacaoController.solicitante(req)
      );
      res.status(201).json(reivindicacao);
    } catch (erro) {
      UploadMiddleware.apagar(provas);
      throw erro;
    }
  }

  public detalhar(req: Request, res: Response): void {
    res.json(this.servico.detalhar(ReivindicacaoController.id(req), ReivindicacaoController.solicitante(req)));
  }

  /** RF04.7 */
  public listarMinhas(req: Request, res: Response): void {
    res.json(this.servico.listarMinhas(SessaoDaRequisicao.usuarioId(req)));
  }

  /** Fila da administração (RF04.4) */
  public listarAbertas(req: Request, res: Response): void {
    res.json(this.servico.listarAbertas());
  }

  /** RF04.3 */
  public listarMensagens(req: Request, res: Response): void {
    res.json(this.servico.listarMensagens(ReivindicacaoController.id(req), ReivindicacaoController.solicitante(req)));
  }

  /** RF04.3 */
  public enviarMensagem(req: Request, res: Response): void {
    const quem = ReivindicacaoController.solicitante(req);
    const id = ReivindicacaoController.id(req);
    this.servico.enviarMensagem(id, req.body?.texto, quem);
    res.status(201).json(this.servico.listarMensagens(id, quem));
  }

  /** RF04.4, RF04.5 */
  public aprovar(req: Request, res: Response): void {
    res.json(this.servico.aprovar(ReivindicacaoController.id(req), SessaoDaRequisicao.usuarioId(req)));
  }

  /** RF04.4, RF04.5 */
  public rejeitar(req: Request, res: Response): void {
    const reivindicacao = this.servico.rejeitar(
      ReivindicacaoController.id(req),
      SessaoDaRequisicao.usuarioId(req),
      req.body?.motivo
    );
    res.json(reivindicacao);
  }

  /** RF04.2: baixa uma prova de posse. Sai como anexo, com o nome original do arquivo. */
  public baixarProva(req: Request, res: Response): void {
    const provaId = ItemService.lerId(req.params.provaId);
    if (provaId === null) {
      throw new ErroDeNegocio("Arquivo não encontrado.", 404);
    }
    const prova = this.servico.buscarProva(
      ReivindicacaoController.id(req),
      provaId,
      ReivindicacaoController.solicitante(req)
    );
    res.set("X-Content-Type-Options", "nosniff");
    res.download(prova.getCaminhoNoDisco(), prova.getNomeOriginal());
  }

  private static solicitante(req: Request): Solicitante {
    const usuario = SessaoDaRequisicao.usuario(req);
    return { id: usuario!.id, perfil: usuario!.perfil };
  }

  private static id(req: Request): number {
    const id = ItemService.lerId(req.params.id);
    if (id === null) {
      throw new ErroDeNegocio("Reivindicação não encontrada.", 404);
    }
    return id;
  }
}
