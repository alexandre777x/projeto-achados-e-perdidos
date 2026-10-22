// RF01 – Cadastro e autenticação. Troque cada aImplementar(...) pela função de verdade.
// Dica: use o model usuario.model.js e a biblioteca bcryptjs para as senhas (RNF01).
const { aImplementar } = require('../middlewares/erros');

module.exports = {
  cadastrar: aImplementar('RF01.1, RF01.2, RF01.5'),
  entrar: aImplementar('RF01.3'),
  sair: aImplementar('RF01.4'),
  perfil: aImplementar('RF01'),
};
