// RF05 – Devolução e relatório. Usa o model devolucao.model.js.
const { aImplementar } = require('../middlewares/erros');

module.exports = {
  registrar: aImplementar('RF05.1 a RF05.3'),
  relatorio: aImplementar('RF05.4'),
  relatorioCsv: aImplementar('RF05.5'),
};
