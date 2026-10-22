// Junta todas as rotas da API sob o prefixo /api.
const { Router } = require('express');
const db = require('../database/connection');

const router = Router();

// Teste rápido: abra http://localhost:3000/api/saude
router.get('/saude', (req, res) => {
  const { total } = db
    .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get();
  res.json({ status: 'ok', tabelas: total });
});

router.use('/auth', require('./auth.routes'));
router.use('/itens', require('./itens.routes'));
router.use('/reivindicacoes', require('./reivindicacoes.routes'));
router.use('/devolucoes', require('./devolucoes.routes'));
router.use('/referencias', require('./referencias.routes'));

module.exports = router;
