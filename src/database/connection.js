// Abre o banco SQLite. Todos os models usam esta mesma conexão.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { caminhoBanco } = require('../config/env');

fs.mkdirSync(path.dirname(caminhoBanco), { recursive: true });

const db = new Database(caminhoBanco);
db.pragma('foreign_keys = ON');

module.exports = db;
