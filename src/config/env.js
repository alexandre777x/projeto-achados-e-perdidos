// Lê o arquivo .env e expõe as configurações do sistema em um só lugar.
require('dotenv').config();
const path = require('path');

const raiz = path.resolve(__dirname, '..', '..');

module.exports = {
  raiz,
  porta: Number(process.env.PORT) || 3000,
  segredoSessao: process.env.SESSION_SECRET || 'chave-apenas-para-desenvolvimento',
  caminhoBanco: path.resolve(raiz, process.env.DB_PATH || 'data/campuslost.db'),
  pastaUploads: path.resolve(raiz, process.env.UPLOAD_DIR || 'uploads'),
  dominioEmail: process.env.EMAIL_DOMINIO || '',
  // RNF01.2: a sessão expira após 30 minutos sem uso
  minutosSessao: 30,
};
