import { Repositorio } from "./Repositorio";
import { Reivindicacao } from "../module/Reivindicacao";
import { ProvaPosse } from "../module/ProvaPosse";
import { Mensagem } from "../module/Mensagem";
import { StatusItem } from "../module/StatusItem";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { StatusReivindicacao } from "../module/StatusReivindicacao";
import { LadoConversa } from "../module/LadoConversa";

interface LinhaReivindicacao {
  id: number;
  status: StatusReivindicacao;
  respostas_validacao: string;
  motivo_rejeicao: string | null;
  data_abertura: string;
  data_decisao: string | null;
  item_id: number;
  reivindicante_id: number;
  decidido_por: number | null;
}

interface LinhaProva {
  id: number;
  caminho: string;
  nome_original: string;
  reivindicacao_id: number;
}

/** Uma reivindicação nas listas: com o título do item e o nome de quem pediu. */
export interface ReivindicacaoResumo {
  id: number;
  status: StatusReivindicacao;
  dataAbertura: string;
  dataDecisao: string | null;
  motivoRejeicao: string | null;
  itemId: number;
  itemTitulo: string;
  itemStatus: StatusItem;
  /** Primeira foto do item, ou null se ele não tiver foto. */
  itemFoto: string | null;
  reivindicante: string;
}

/** Mensagem com o nome e o perfil de quem escreveu, para a conversa na tela. */
export interface MensagemComAutor {
  id: number;
  texto: string;
  dataEnvio: string;
  autorId: number;
  autorNome: string;
  autorPerfil: PerfilUsuario;
}

export interface ArquivoDeProva {
  caminho: string;
  nomeOriginal: string;
}

/** Quantas mensagens de uma reivindicação um lado da conversa ainda não leu. */
export interface NaoLidasDaReivindicacao {
  reivindicacaoId: number;
  naoLidas: number;
}

/** Tabelas reivindicacao, prova_posse, mensagem e leitura_conversa (RF04). */
export class ReivindicacaoRepository extends Repositorio {
  private static readonly SELECT_RESUMO = `
    SELECT r.id, r.status, r.data_abertura AS dataAbertura, r.data_decisao AS dataDecisao,
           r.motivo_rejeicao AS motivoRejeicao, i.id AS itemId, i.titulo AS itemTitulo,
           i.status AS itemStatus, u.nome AS reivindicante,
           (SELECT '/uploads/' || f.caminho FROM foto f WHERE f.item_id = i.id ORDER BY f.id LIMIT 1) AS itemFoto
    FROM reivindicacao r
    JOIN item i ON i.id = r.item_id
    JOIN usuario u ON u.id = r.reivindicante_id`;

  /** RF04.1 e RF04.2: grava a reivindicação com as provas de posse. */
  public salvar(reivindicacao: Reivindicacao, provas: ArquivoDeProva[]): Reivindicacao {
    return this.emTransacao(() => {
      const resultado = this.db
        .prepare("INSERT INTO reivindicacao (item_id, reivindicante_id, respostas_validacao) VALUES (?, ?, ?)")
        .run(reivindicacao.getItemId(), reivindicacao.getReivindicanteId(), reivindicacao.getRespostasValidacao());
      const id = Number(resultado.lastInsertRowid);

      const inserirProva = this.db.prepare(
        "INSERT INTO prova_posse (caminho, nome_original, reivindicacao_id) VALUES (?, ?, ?)"
      );
      for (const prova of provas) {
        inserirProva.run(prova.caminho, prova.nomeOriginal, id);
      }
      return this.buscarPorId(id) as Reivindicacao;
    });
  }

  public buscarPorId(id: number): Reivindicacao | null {
    const linha = this.db
      .prepare<[number], LinhaReivindicacao>("SELECT * FROM reivindicacao WHERE id = ?")
      .get(id);
    return linha ? ReivindicacaoRepository.paraReivindicacao(linha) : null;
  }

  /** RF04.7: as do usuário, das mais novas para as mais antigas. */
  public listarDoUsuario(usuarioId: number): ReivindicacaoResumo[] {
    return this.db
      .prepare<[number], ReivindicacaoResumo>(
        `${ReivindicacaoRepository.SELECT_RESUMO} WHERE r.reivindicante_id = ? ORDER BY r.data_abertura DESC, r.id DESC`
      )
      .all(usuarioId);
  }

  /** RF04.4: fila da administração, das mais antigas para as mais novas. */
  public listarAbertas(): ReivindicacaoResumo[] {
    return this.db
      .prepare<[StatusReivindicacao], ReivindicacaoResumo>(
        `${ReivindicacaoRepository.SELECT_RESUMO} WHERE r.status = ? ORDER BY r.data_abertura, r.id`
      )
      .all(StatusReivindicacao.ABERTA);
  }

  /** RF05.1: aprovadas cujo item ainda não foi entregue ao dono. */
  public listarAguardandoDevolucao(): ReivindicacaoResumo[] {
    return this.db
      .prepare<[StatusReivindicacao, StatusItem], ReivindicacaoResumo>(
        `${ReivindicacaoRepository.SELECT_RESUMO}
         WHERE r.status = ? AND i.status = ? AND NOT EXISTS (SELECT 1 FROM devolucao d WHERE d.reivindicacao_id = r.id)
         ORDER BY r.data_decisao, r.id`
      )
      .all(StatusReivindicacao.APROVADA, StatusItem.EM_REIVINDICACAO);
  }

  public listarAbertasDoItem(itemId: number): Reivindicacao[] {
    return this.db
      .prepare<[number, StatusReivindicacao], LinhaReivindicacao>(
        "SELECT * FROM reivindicacao WHERE item_id = ? AND status = ? ORDER BY id"
      )
      .all(itemId, StatusReivindicacao.ABERTA)
      .map(ReivindicacaoRepository.paraReivindicacao);
  }

  /** RF04.6: o usuário já tem uma reivindicação aberta para este item? */
  public existeAberta(itemId: number, usuarioId: number): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM reivindicacao WHERE item_id = ? AND reivindicante_id = ? AND status = ?")
      .get(itemId, usuarioId, StatusReivindicacao.ABERTA);
  }

  /** RN02: o item já tem uma reivindicação aprovada? */
  public existeAprovada(itemId: number): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM reivindicacao WHERE item_id = ? AND status = ?")
      .get(itemId, StatusReivindicacao.APROVADA);
  }

  /** RF04.4: grava a decisão, com a data e a hora em que foi tomada. */
  public atualizarDecisao(reivindicacao: Reivindicacao): void {
    this.db
      .prepare(
        `UPDATE reivindicacao SET status = ?, motivo_rejeicao = ?, decidido_por = ?, data_decisao = datetime('now')
         WHERE id = ?`
      )
      .run(
        reivindicacao.getStatus(),
        reivindicacao.getMotivoRejeicao(),
        reivindicacao.getDecididoPor(),
        reivindicacao.getId()
      );
  }

  public listarProvas(reivindicacaoId: number): ProvaPosse[] {
    return this.db
      .prepare<[number], LinhaProva>("SELECT * FROM prova_posse WHERE reivindicacao_id = ? ORDER BY id")
      .all(reivindicacaoId)
      .map((l) => new ProvaPosse(l.caminho, l.nome_original, l.reivindicacao_id, l.id));
  }

  /** RF04.3 */
  public listarMensagens(reivindicacaoId: number): MensagemComAutor[] {
    return this.db
      .prepare<[number], MensagemComAutor>(
        `SELECT m.id, m.texto, m.data_envio AS dataEnvio, m.autor_id AS autorId,
                u.nome AS autorNome, u.perfil AS autorPerfil
         FROM mensagem m
         JOIN usuario u ON u.id = m.autor_id
         WHERE m.reivindicacao_id = ?
         ORDER BY m.data_envio, m.id`
      )
      .all(reivindicacaoId);
  }

  /** RF04.3. Devolve o id da mensagem gravada. */
  public salvarMensagem(mensagem: Mensagem): number {
    const resultado = this.db
      .prepare("INSERT INTO mensagem (texto, reivindicacao_id, autor_id) VALUES (?, ?, ?)")
      .run(mensagem.getTexto(), mensagem.getReivindicacaoId(), mensagem.getAutorId());
    return Number(resultado.lastInsertRowid);
  }

  /** Marca a conversa como lida por um lado até a mensagem informada (nunca volta atrás). */
  public marcarLida(reivindicacaoId: number, lado: LadoConversa, ultimaMensagemId: number): void {
    this.db
      .prepare(
        `INSERT INTO leitura_conversa (reivindicacao_id, lado, ultima_mensagem_id) VALUES (?, ?, ?)
         ON CONFLICT (reivindicacao_id, lado)
         DO UPDATE SET ultima_mensagem_id = MAX(ultima_mensagem_id, excluded.ultima_mensagem_id)`
      )
      .run(reivindicacaoId, lado, ultimaMensagemId);
  }

  /**
   * Mensagens não lidas por reivindicação, só das que têm alguma.
   * - Quem reivindicou: nas suas reivindicações, as mensagens escritas pela administração.
   * - Administração: nas reivindicações dos outros, as mensagens de quem reivindicou.
   *   A do próprio administrador fica de fora, porque ali ele é quem reivindicou.
   */
  public contarNaoLidas(lado: LadoConversa, usuarioId: number): NaoLidasDaReivindicacao[] {
    const condicao =
      lado === LadoConversa.REIVINDICANTE
        ? "r.reivindicante_id = ? AND m.autor_id <> r.reivindicante_id"
        : "r.reivindicante_id <> ? AND m.autor_id = r.reivindicante_id";
    return this.db
      .prepare<[LadoConversa, number], NaoLidasDaReivindicacao>(
        `SELECT r.id AS reivindicacaoId, COUNT(m.id) AS naoLidas
         FROM reivindicacao r
         JOIN mensagem m ON m.reivindicacao_id = r.id
         LEFT JOIN leitura_conversa l ON l.reivindicacao_id = r.id AND l.lado = ?
         WHERE m.id > COALESCE(l.ultima_mensagem_id, 0) AND ${condicao}
         GROUP BY r.id
         ORDER BY r.id`
      )
      .all(lado, usuarioId);
  }

  private static paraReivindicacao(linha: LinhaReivindicacao): Reivindicacao {
    return new Reivindicacao({
      id: linha.id,
      itemId: linha.item_id,
      reivindicanteId: linha.reivindicante_id,
      respostasValidacao: linha.respostas_validacao,
      status: linha.status,
      motivoRejeicao: linha.motivo_rejeicao,
      decididoPor: linha.decidido_por,
      dataAbertura: linha.data_abertura,
      dataDecisao: linha.data_decisao,
    });
  }
}
