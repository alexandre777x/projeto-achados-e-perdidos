// RF01 – Cadastro e autenticação. Troque cada aImplementar(...) pela função de verdade.
// Dica: use o model usuario.model.js e a biblioteca bcryptjs para as senhas (RNF01).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { aImplementar } = require('../middlewares/erros');
const usuarioModel = require('../models/usuario.model');
const recuperacaoModel = require('../models/recuperacao-senha.model');
const { enviarEmail } = require('../services/email');
const { urlBase } = require('../config/env');

// Use a mesma regra no cadastro (RF01.1)
const SENHA_MINIMA = 8;
const MINUTOS_LINK = 60;

function hashDoToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// RF01.6: a resposta é sempre a mesma, para não revelar quais e-mails estão cadastrados.
function solicitarRecuperacao(req, res) {
  const email = String(req.body.email || '').trim();
  if (!email) {
    return res.status(400).json({ erro: 'Informe o e-mail.' });
  }

  const usuario = usuarioModel.buscarPorEmail(email);
  if (usuario && usuario.ativo) {
    const token = crypto.randomBytes(32).toString('hex');
    recuperacaoModel.criar(usuario.id, hashDoToken(token), MINUTOS_LINK);

    const link = `${urlBase}/redefinir-senha.html?token=${token}`;
    // Sem await: a resposta não pode demorar mais quando o e-mail existe.
    enviarEmail({
      para: usuario.email,
      assunto: 'CampusLost – criar nova senha',
      texto:
        `Olá, ${usuario.nome}.\n\n` +
        `Para criar uma nova senha, abra o link abaixo (vale por ${MINUTOS_LINK} minutos):\n${link}\n\n` +
        'Se você não pediu a troca, ignore este e-mail. Sua senha continua a mesma.',
    }).catch((erro) => console.error('Falha ao enviar e-mail de recuperação:', erro.message));
  }

  res.json({ mensagem: 'Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.' });
}

async function redefinirSenha(req, res) {
  const token = String(req.body.token || '');
  const senha = String(req.body.senha || '');

  if (senha.length < SENHA_MINIMA) {
    return res.status(400).json({ erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
  }

  const pedido = token && recuperacaoModel.buscarValido(hashDoToken(token));
  if (!pedido) {
    return res.status(400).json({ erro: 'Link inválido ou expirado. Peça um novo.' });
  }

  recuperacaoModel.trocarSenha(pedido.usuario_id, await bcrypt.hash(senha, 10));
  res.json({ mensagem: 'Senha alterada. Você já pode entrar com a nova senha.' });
}

module.exports = {
  cadastrar: aImplementar('RF01.1, RF01.2, RF01.5'),
  entrar: aImplementar('RF01.3'),
  sair: aImplementar('RF01.4'),
  perfil: aImplementar('RF01'),
  solicitarRecuperacao,
  redefinirSenha,
};
