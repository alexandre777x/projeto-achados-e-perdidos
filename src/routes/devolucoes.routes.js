// RF05 – Relatório de devolução (somente administração)
const { Router } = require('express');
const { exigirAdmin } = require('../middlewares/autenticacao');
const controller = require('../controllers/devolucoes.controller');

const router = Router();

router.post('/', exigirAdmin, controller.registrar); // RF05.1 a RF05.3
router.get('/relatorio', exigirAdmin, controller.relatorio); // RF05.4
router.get('/relatorio.csv', exigirAdmin, controller.relatorioCsv); // RF05.5

module.exports = router;
