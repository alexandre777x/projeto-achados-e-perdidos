import { Repositorio } from "./Repositorio";

/** Tabela recuperacao_senha (RF01.6). Guarda só o hash do token enviado por e-mail. */
export class RecuperacaoSenhaRepository extends Repositorio {
  public criar(usuarioId: number, tokenHash: string, minutosValidade: number): void {
    this.db
      .prepare(
        `INSERT INTO recuperacao_senha (usuario_id, token_hash, expira_em)
         VALUES (?, ?, datetime('now', ?))`
      )
      .run(usuarioId, tokenHash, `+${minutosValidade} minutes`);
  }

  /** Id do usuário dono do token, se o token existe, não foi usado e não expirou. */
  public usuarioDoTokenValido(tokenHash: string): number | null {
    const linha = this.db
      .prepare<[string], { usuario_id: number }>(
        `SELECT r.usuario_id
         FROM recuperacao_senha r
         JOIN usuario u ON u.id = r.usuario_id
         WHERE r.token_hash = ? AND r.usado = 0 AND r.expira_em > datetime('now') AND u.ativo = 1`
      )
      .get(tokenHash);
    return linha?.usuario_id ?? null;
  }

  /** Troca a senha e invalida todos os links pendentes do usuário, tudo de uma vez. */
  public trocarSenha(usuarioId: number, senhaHash: string): void {
    this.db.transaction(() => {
      this.db.prepare("UPDATE usuario SET senha_hash = ? WHERE id = ?").run(senhaHash, usuarioId);
      this.db
        .prepare("UPDATE recuperacao_senha SET usado = 1 WHERE usuario_id = ? AND usado = 0")
        .run(usuarioId);
    })();
  }
}
