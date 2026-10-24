import { Reivindicacao } from "../module/Reivindicacao";
import { Mensagem } from "../module/Mensagem";
import { ProvaPosse } from "../module/ProvaPosse";
import { StatusItem } from "../module/StatusItem";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { LadoConversa } from "../module/LadoConversa";
import { StatusReivindicacao } from "../module/StatusReivindicacao";
import { Configuracao } from "../config/Configuracao";
import { ItemRepository } from "../repositories/ItemRepository";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { DevolucaoRepository } from "../repositories/DevolucaoRepository";
import {
  ArquivoDeProva,
  NaoLidasDaReivindicacao,
  ReivindicacaoRepository,
  ReivindicacaoResumo,
} from "../repositories/ReivindicacaoRepository";
import { EmailService } from "./EmailService";

/** Quem está fazendo a requisição (vem da sessão). */
export interface Solicitante {
  id: number;
  perfil: PerfilUsuario;
}

/** Mensagens não lidas: o total e quantas em cada reivindicação. */
export interface ContagemNaoLidas {
  total: number;
  porReivindicacao: Record<number, number>;
}

/**
 * Reivindicação de posse (RF04) e o efeito dela no status do item (RF04.5, RN02, RN05).
 * Mais de uma pessoa pode reivindicar o mesmo item; cada uma só uma vez por vez (RF04.6).
 */
export class ReivindicacaoService {
  private static readonly MOTIVO_OUTRA_APROVADA = "Outra reivindicação deste item foi aprovada.";

  private readonly reivindicacaoRepo = new ReivindicacaoRepository();
  private readonly itemRepo = new ItemRepository();
  private readonly usuarioRepo = new UsuarioRepository();
  private readonly devolucaoRepo = new DevolucaoRepository();
  private readonly emailService = new EmailService();

  /** RF04.1, RF04.2, RF04.5 e RF04.6. As provas já foram gravadas pelo UploadMiddleware. */
  public abrir(itemId: number, respostas: unknown, provas: ArquivoDeProva[], quem: Solicitante): Reivindicacao {
    const reivindicacao = new Reivindicacao({
      itemId,
      reivindicanteId: quem.id,
      respostasValidacao: String(respostas ?? ""),
    });

    return this.reivindicacaoRepo.emTransacao(() => {
      const item = this.itemRepo.buscarPorId(itemId);
      const reivindicavel = item && [StatusItem.DISPONIVEL, StatusItem.EM_REIVINDICACAO].includes(item.getStatus());
      if (!item || !reivindicavel) {
        throw new ErroDeNegocio("Este item não está disponível para reivindicação.", 409);
      }
      if (this.reivindicacaoRepo.existeAprovada(itemId)) {
        throw new ErroDeNegocio("Este item já teve a posse confirmada para outra pessoa.", 409);
      }
      if (this.reivindicacaoRepo.existeAberta(itemId, quem.id)) {
        throw new ErroDeNegocio("Você já tem uma reivindicação aberta para este item.", 409);
      }

      const salva = this.reivindicacaoRepo.salvar(reivindicacao, provas);
      if (item.estaDisponivel()) {
        const anterior = item.mudarStatus(StatusItem.EM_REIVINDICACAO);
        this.itemRepo.mudarStatus(item, anterior, quem.id);
      }
      return salva;
    });
  }

  /** Detalhe da reivindicação: só para quem a abriu e para a administração. */
  public detalhar(id: number, quem: Solicitante) {
    const reivindicacao = this.buscarComAcesso(id, quem);
    const item = this.itemRepo.buscarPorId(reivindicacao.getItemId());
    const devolucao = this.devolucaoRepo.buscarPorReivindicacao(id);
    return {
      ...reivindicacao.toJSON(),
      reivindicante: this.usuarioRepo.buscarPorId(reivindicacao.getReivindicanteId())?.getNome(),
      item: {
        id: item?.getId(),
        titulo: item?.getTitulo(),
        status: item?.getStatus(),
        foto: this.itemRepo.listarFotos(reivindicacao.getItemId())[0]?.toJSON().url ?? null,
      },
      provas: this.reivindicacaoRepo.listarProvas(id),
      // RF05.2: só o tipo do documento conferido, nunca o número (RNF10)
      devolucao: devolucao
        ? { dataHora: devolucao.getDataHora(), tipoDocumento: devolucao.getTipoDocumento() }
        : null,
    };
  }

  public listarMinhas(usuarioId: number): ReivindicacaoResumo[] {
    return this.reivindicacaoRepo.listarDoUsuario(usuarioId);
  }

  public listarAbertas(): ReivindicacaoResumo[] {
    return this.reivindicacaoRepo.listarAbertas();
  }

  /**
   * RF04.3: para o reivindicante, as mensagens da administração aparecem só como
   * "Administração", sem o nome de quem escreveu.
   * Quem abre a conversa a lê: o lado dele fica marcado como lido até a última mensagem.
   */
  public listarMensagens(id: number, quem: Solicitante) {
    const reivindicacao = this.buscarComAcesso(id, quem);
    const mensagens = this.reivindicacaoRepo.listarMensagens(id);
    if (mensagens.length > 0) {
      const ultima = Math.max(...mensagens.map((m) => m.id));
      this.reivindicacaoRepo.marcarLida(id, ReivindicacaoService.ladoDe(reivindicacao, quem), ultima);
    }
    return mensagens.map((m) => {
      const daAdministracao = m.autorPerfil === PerfilUsuario.ADMINISTRADOR;
      return {
        id: m.id,
        texto: m.texto,
        dataEnvio: m.dataEnvio,
        daAdministracao,
        minha: m.autorId === quem.id,
        autor: daAdministracao && quem.perfil !== PerfilUsuario.ADMINISTRADOR ? "Administração" : m.autorNome,
      };
    });
  }

  /** RF04.3. Quem escreve já viu a conversa até a própria mensagem. */
  public enviarMensagem(id: number, texto: unknown, quem: Solicitante): void {
    const reivindicacao = this.buscarComAcesso(id, quem);
    const mensagemId = this.reivindicacaoRepo.salvarMensagem(new Mensagem(String(texto ?? ""), id, quem.id));
    this.reivindicacaoRepo.marcarLida(id, ReivindicacaoService.ladoDe(reivindicacao, quem), mensagemId);
  }

  /**
   * Contador de mensagens não lidas: nas próprias reivindicações e, para a administração,
   * também nas reivindicações dos outros.
   */
  public contarNaoLidas(quem: Solicitante): { minhas: ContagemNaoLidas; administracao: ContagemNaoLidas | null } {
    return {
      minhas: ReivindicacaoService.somar(this.reivindicacaoRepo.contarNaoLidas(LadoConversa.REIVINDICANTE, quem.id)),
      administracao:
        quem.perfil === PerfilUsuario.ADMINISTRADOR
          ? ReivindicacaoService.somar(this.reivindicacaoRepo.contarNaoLidas(LadoConversa.ADMINISTRACAO, quem.id))
          : null,
    };
  }

  /**
   * RF04.4. Com uma aprovada, as outras abertas do mesmo item são rejeitadas (RN02).
   * O item continua "Em reivindicação" até a devolução (RF05).
   */
  public aprovar(id: number, administradorId: number): Reivindicacao {
    const { aprovada, rejeitadas } = this.reivindicacaoRepo.emTransacao(() => {
      const reivindicacao = this.buscarParaDecidir(id, administradorId);
      reivindicacao.aprovar(administradorId);
      this.reivindicacaoRepo.atualizarDecisao(reivindicacao);

      const outras = this.reivindicacaoRepo.listarAbertasDoItem(reivindicacao.getItemId());
      for (const outra of outras) {
        outra.rejeitar(administradorId, ReivindicacaoService.MOTIVO_OUTRA_APROVADA);
        this.reivindicacaoRepo.atualizarDecisao(outra);
      }
      return { aprovada: this.reivindicacaoRepo.buscarPorId(id) as Reivindicacao, rejeitadas: outras };
    });
    // Os e-mails saem só depois que a decisão foi gravada
    for (const decidida of [aprovada, ...rejeitadas]) this.avisarDecisao(decidida);
    return aprovada;
  }

  /** RF04.4 e RF04.5: sem outra reivindicação aberta, o item volta a ficar disponível. */
  public rejeitar(id: number, administradorId: number, motivo: unknown): Reivindicacao {
    const rejeitada = this.reivindicacaoRepo.emTransacao(() => {
      const reivindicacao = this.buscarParaDecidir(id, administradorId);
      reivindicacao.rejeitar(administradorId, String(motivo ?? ""));
      this.reivindicacaoRepo.atualizarDecisao(reivindicacao);

      const item = this.itemRepo.buscarPorId(reivindicacao.getItemId());
      const restamAbertas = this.reivindicacaoRepo.listarAbertasDoItem(reivindicacao.getItemId()).length > 0;
      if (item && item.getStatus() === StatusItem.EM_REIVINDICACAO && !restamAbertas) {
        const anterior = item.mudarStatus(StatusItem.DISPONIVEL);
        this.itemRepo.mudarStatus(item, anterior, administradorId);
      }
      return this.reivindicacaoRepo.buscarPorId(id) as Reivindicacao;
    });
    this.avisarDecisao(rejeitada);
    return rejeitada;
  }

  /**
   * Avisa por e-mail quem reivindicou que o pedido foi aprovado ou rejeitado.
   * O envio não segura a resposta: se falhar, a decisão continua valendo e o erro vai para o log.
   */
  private avisarDecisao(reivindicacao: Reivindicacao): void {
    const pessoa = this.usuarioRepo.buscarPorId(reivindicacao.getReivindicanteId());
    const item = this.itemRepo.buscarPorId(reivindicacao.getItemId());
    if (!pessoa || !item) {
      return;
    }
    const link = `${Configuracao.urlBase}/reivindicacao.html?id=${reivindicacao.getId()}`;
    const aprovada = reivindicacao.getStatus() === StatusReivindicacao.APROVADA;
    const texto = aprovada
      ? `Olá, ${pessoa.getNome()}!\n\n` +
        `Sua reivindicação nº ${reivindicacao.getId()} do item "${item.getTitulo()}" foi aprovada.\n` +
        "Retire o objeto na segurança do campus levando um documento com foto.\n\n" +
        `Acompanhe o pedido: ${link}`
      : `Olá, ${pessoa.getNome()}!\n\n` +
        `Sua reivindicação nº ${reivindicacao.getId()} do item "${item.getTitulo()}" foi rejeitada.\n` +
        `Motivo: ${reivindicacao.getMotivoRejeicao()}\n\n` +
        `Se achar que houve engano, explique na conversa do pedido: ${link}`;

    this.emailService
      .enviar({
        para: pessoa.getEmail(),
        assunto: `CampusLost: sua reivindicação foi ${aprovada ? "aprovada" : "rejeitada"}`,
        texto,
      })
      .catch((erro) => console.error("Falha ao enviar e-mail da decisão:", (erro as Error).message));
  }

  /** RF04.2 e RNF09: só o reivindicante e a administração baixam as provas. */
  public buscarProva(id: number, provaId: number, quem: Solicitante): ProvaPosse {
    this.buscarComAcesso(id, quem);
    const prova = this.reivindicacaoRepo.listarProvas(id).find((p) => p.getId() === provaId);
    if (!prova) {
      throw new ErroDeNegocio("Arquivo não encontrado.", 404);
    }
    return prova;
  }

  /**
   * Quem não é o dono nem administrador recebe "não encontrada", e não "proibido",
   * para não confirmar que a reivindicação existe.
   */
  private buscarComAcesso(id: number, quem: Solicitante): Reivindicacao {
    const reivindicacao = this.reivindicacaoRepo.buscarPorId(id);
    const podeVer =
      reivindicacao &&
      (reivindicacao.getReivindicanteId() === quem.id || quem.perfil === PerfilUsuario.ADMINISTRADOR);
    if (!reivindicacao || !podeVer) {
      throw new ErroDeNegocio("Reivindicação não encontrada.", 404);
    }
    return reivindicacao;
  }

  /** De que lado da conversa a pessoa está: quem reivindicou ou a administração. */
  private static ladoDe(reivindicacao: Reivindicacao, quem: Solicitante): LadoConversa {
    return reivindicacao.getReivindicanteId() === quem.id ? LadoConversa.REIVINDICANTE : LadoConversa.ADMINISTRACAO;
  }

  private static somar(lista: NaoLidasDaReivindicacao[]): ContagemNaoLidas {
    return {
      total: lista.reduce((soma, r) => soma + r.naoLidas, 0),
      porReivindicacao: Object.fromEntries(lista.map((r) => [r.reivindicacaoId, r.naoLidas])),
    };
  }

  /** Um administrador não decide a própria reivindicação. */
  private buscarParaDecidir(id: number, administradorId: number): Reivindicacao {
    const reivindicacao = this.reivindicacaoRepo.buscarPorId(id);
    if (!reivindicacao) {
      throw new ErroDeNegocio("Reivindicação não encontrada.", 404);
    }
    if (reivindicacao.getReivindicanteId() === administradorId) {
      throw new ErroDeNegocio("Outro administrador precisa decidir a sua própria reivindicação.", 403);
    }
    return reivindicacao;
  }
}
