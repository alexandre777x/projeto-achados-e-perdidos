// Listas de categorias e locais usadas no registro e na busca (RF02.3)
const { Router } = require('express');
const { exigirAdmin } = require('../middlewares/autenticacao');
const controller = require('../controllers/referencias.controller');

const router = Router();

router.get('/categorias', controller.listarCategorias);
router.get('/locais', controller.listarLocais);
router.post('/categorias', exigirAdmin, controller.criarCategoria);
router.post('/locais', exigirAdmin, controller.criarLocal);

module.exports = router;
