// Controle de acesso por sessão. Os dados do usuário logado ficam em req.session.usuario.

// Qualquer usuário autenticado (aluno, professor ou administrador)
function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  next();
}

// Só o perfil ADMINISTRADOR (RNF01.1: as demais pessoas recebem 403)
function exigirAdmin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  if (req.session.usuario.perfil !== 'ADMINISTRADOR') {
    return res.status(403).json({ erro: 'Acesso restrito à administração.' });
  }
  next();
}

module.exports = { exigirLogin, exigirAdmin };
