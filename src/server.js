// Ponto de entrada: prepara o banco e sobe o servidor. Rode com: npm run dev
const { porta } = require('./config/env');
const { inicializarBanco } = require('./database/init');
const app = require('./app');

inicializarBanco();

app.listen(porta, () => {
  console.log(`CampusLost rodando em http://localhost:${porta}`);
});
