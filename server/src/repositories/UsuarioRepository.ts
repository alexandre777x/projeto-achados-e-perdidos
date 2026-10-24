import { Repositorio } from "./Repositorio";
import { Usuario } from "../module/Usuario";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { Database } from "../database/Database";

interface LinhaUsuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: PerfilUsuario;
  data_cadastro: string;
  ativo: number;
}

/** Tabela usuario (RF01). */
export class UsuarioRepository extends Repositorio {
  public static readonly LIMITE_LISTA = 200;

  public salvar(usuario: Usuario): Usuario {
    const resultado = this.db
      .prepare("INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)")
      .run(usuario.getNome(), usuario.getEmail(), usuario.getSenhaHash(), usuario.getPerfil());
    return this.buscarPorId(Number(resultado.lastInsertRowid)) as Usuario;
  }

  public buscarPorId(id: number): Usuario | null {
    const linha = this.db.prepare<[number], LinhaUsuario>("SELECT * FROM usuario WHERE id = ?").get(id);
    return linha ? this.paraUsuario(linha) : null;
  }

  /** O e-mail é comparado sem diferenciar maiúsculas de minúsculas. */
  public buscarPorEmail(email: string): Usuario | null {
    const linha = this.db
      .prepare<[string], LinhaUsuario>("SELECT * FROM usuario WHERE email = ? COLLATE NOCASE")
      .get(String(email ?? "").trim());
    return linha ? this.paraUsuario(linha) : null;
  }

  /**
   * Contas para a administração, em ordem de nome. A busca procura no nome (sem ligar
   * para acentos) e no e-mail; vazia, traz todas. No máximo LIMITE_LISTA contas.
   */
  public listar(busca: string): Usuario[] {
    const padrao = `%${Database.semAcento(busca).replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    return this.db
      .prepare<[string, string, number], LinhaUsuario>(
        `SELECT * FROM usuario
         WHERE sem_acento(nome) LIKE ? ESCAPE '\\' OR lower(email) LIKE ? ESCAPE '\\'
         ORDER BY nome COLLATE NOCASE, id
         LIMIT ?`
      )
      .all(padrao, padrao, UsuarioRepository.LIMITE_LISTA)
      .map((linha) => this.paraUsuario(linha));
  }

  public atualizarNome(id: number, nome: string): void {
    this.db.prepare("UPDATE usuario SET nome = ? WHERE id = ?").run(nome, id);
  }

  public atualizarPerfil(id: number, perfil: PerfilUsuario): void {
    this.db.prepare("UPDATE usuario SET perfil = ? WHERE id = ?").run(perfil, id);
  }

  public atualizarAtivo(id: number, ativo: boolean): void {
    this.db.prepare("UPDATE usuario SET ativo = ? WHERE id = ?").run(ativo ? 1 : 0, id);
  }

  public contarAdministradoresAtivos(): number {
    const linha = this.db
      .prepare<[PerfilUsuario], { total: number }>("SELECT COUNT(*) AS total FROM usuario WHERE perfil = ? AND ativo = 1")
      .get(PerfilUsuario.ADMINISTRADOR);
    return linha?.total ?? 0;
  }

  private paraUsuario(linha: LinhaUsuario): Usuario {
    return new Usuario(
      linha.nome,
      linha.email,
      linha.senha_hash,
      linha.perfil,
      linha.id,
      linha.ativo === 1,
      linha.data_cadastro
    );
  }
}
