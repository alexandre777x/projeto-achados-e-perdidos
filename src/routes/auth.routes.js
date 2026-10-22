// RF01 – Cadastro e autenticação de usuários
const { Router } = require('express');
const { exigirLogin } = require('../middlewares/autenticacao');
const controller = require('../controllers/autenticacao.controller');

const router = Router();

router.post('/cadastro', controller.cadastrar); // RF01.1, RF01.2, RF01.5
router.post('/login', controller.entrar); // RF01.3
router.post('/logout', controller.sair); // RF01.4
router.get('/eu', exigirLogin, controller.perfil); // dados de quem está logado

module.exports = router;
