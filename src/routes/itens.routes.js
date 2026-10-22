// RF02 – Registro de item encontrado | RF03 – Busca de itens
const { Router } = require('express');
const { exigirLogin, exigirAdmin } = require('../middlewares/autenticacao');
const controller = require('../controllers/itens.controller');

const router = Router();

router.get('/', controller.buscar); // RF03.1 a RF03.4 (filtros: categoria, local, de, ate, q)
router.get('/:id', controller.detalhar); // RF03.5
router.post('/', exigirLogin, controller.registrar); // RF02.1 a RF02.5 (com upload de fotos)
router.patch('/:id/recebimento', exigirAdmin, controller.confirmarRecebimento); // RF02.6
router.put('/:id', exigirAdmin, controller.editar); // RF02.6
router.delete('/:id', exigirAdmin, controller.excluir); // RF02.6

module.exports = router;
