// RF04 – Reivindicação de posse. Usa o model reivindicacao.model.js.
const { aImplementar } = require('../middlewares/erros');

module.exports = {
  abrir: aImplementar('RF04.1, RF04.2, RF04.6'),
  listarMinhas: aImplementar('RF04.7'),
  listarAbertas: aImplementar('RF04.4'),
  listarMensagens: aImplementar('RF04.3'),
  enviarMensagem: aImplementar('RF04.3'),
  aprovar: aImplementar('RF04.4, RF04.5'),
  rejeitar: aImplementar('RF04.4, RF04.5'),
};
