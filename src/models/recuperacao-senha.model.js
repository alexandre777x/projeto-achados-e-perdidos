// Tabela: recuperacao_senha (RF01.6). Guarda só o hash do token enviado por e-mail.
const db = require('../database/connection');

// Troca a senha e invalida todos os links pendentes do usuário, tudo de uma vez.
const trocarSenha = db.transaction((usuarioId, senhaHash) => {
  db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(senhaHash, usuarioId);
  db.prepare('UPDATE recuperacao_senha SET usado = 1 WHERE usuario_id = ? AND usado = 0').run(usuarioId);
});

module.exports = {
  criar(usuarioId, tokenHash, minutosValidade) {
    db.prepare(
      `INSERT INTO recuperacao_senha (usuario_id, token_hash, expira_em)
       VALUES (?, ?, datetime('now', ?))`
    ).run(usuarioId, tokenHash, `+${minutosValidade} minutes`);
  },

  // Devolve o pedido se o token existe, não foi usado e não expirou.
  buscarValido(tokenHash) {
    return db
      .prepare(
        `SELECT r.id, r.usuario_id
         FROM recuperacao_senha r
         JOIN usuario u ON u.id = r.usuario_id
         WHERE r.token_hash = ? AND r.usado = 0 AND r.expira_em > datetime('now') AND u.ativo = 1`
      )
      .get(tokenHash);
  },

  trocarSenha,
};
