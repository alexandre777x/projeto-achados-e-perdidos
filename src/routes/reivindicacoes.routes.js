// RF04 – Reivindicação de posse
const { Router } = require('express');
const { exigirLogin, exigirAdmin } = require('../middlewares/autenticacao');
const controller = require('../controllers/reivindicacoes.controller');

const router = Router();

router.post('/', exigirLogin, controller.abrir); // RF04.1, RF04.2, RF04.6
router.get('/minhas', exigirLogin, controller.listarMinhas); // RF04.7
router.get('/', exigirAdmin, controller.listarAbertas); // fila da administração
router.get('/:id/mensagens', exigirLogin, controller.listarMensagens); // RF04.3
router.post('/:id/mensagens', exigirLogin, controller.enviarMensagem); // RF04.3
router.patch('/:id/aprovar', exigirAdmin, controller.aprovar); // RF04.4, RF04.5
router.patch('/:id/rejeitar', exigirAdmin, controller.rejeitar); // RF04.4, RF04.5

module.exports = router;
