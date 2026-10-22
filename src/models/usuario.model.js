// Tabela: usuario. Consultas SQL do cadastro, do login (RF01) e da troca de senha (RF01.6).
const db = require('../database/connection');

module.exports = {
  // O e-mail é comparado sem diferenciar maiúsculas de minúsculas.
  buscarPorEmail(email) {
    return db.prepare('SELECT * FROM usuario WHERE email = ? COLLATE NOCASE').get(email);
  },

  // A implementar (RF01.1): criar({ nome, email, senhaHash, perfil }).
};
