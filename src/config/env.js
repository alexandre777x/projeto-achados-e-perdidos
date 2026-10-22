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
  // Provas de posse (RF04.2): pasta privada, fora de /uploads, para não ficar pública
  pastaProvas: path.resolve(raiz, process.env.PROVAS_DIR || 'provas'),
  // Endereço do site, usado no link de recuperação de senha (RF01.6)
  urlBase: process.env.URL_BASE || `http://localhost:${Number(process.env.PORT) || 3000}`,
  // E-mail (RF01.6). Sem SMTP_HOST, o link aparece no terminal em vez de ser enviado.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    remetente: process.env.EMAIL_REMETENTE || 'CampusLost <nao-responda@campuslost.local>',
  },
  dominioEmail: process.env.EMAIL_DOMINIO || '',
  // RNF01.2: a sessão expira após 30 minutos sem uso
  minutosSessao: 30,
};
