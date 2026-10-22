// Cria as tabelas (schema.sql) e os dados iniciais (seed.sql) na primeira execução.
// Também pode ser rodado à mão com: npm run db:init
const fs = require('fs');
const path = require('path');
const db = require('./connection');

function lerSql(nomeDoArquivo) {
  return fs.readFileSync(path.join(__dirname, nomeDoArquivo), 'utf8');
}

function inicializarBanco() {
  const jaExiste = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usuario'")
    .get();

  if (!jaExiste) {
    db.exec(lerSql('schema.sql'));
    db.exec(lerSql('seed.sql'));
    console.log('Banco criado com as tabelas e os dados iniciais.');
  }
}

if (require.main === module) {
  inicializarBanco();
  console.log('Banco pronto.');
}

module.exports = { inicializarBanco };
