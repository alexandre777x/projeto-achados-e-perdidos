// Ajusta o menu conforme quem está logado. Incluir em todas as páginas, depois do api.js.
// Páginas com <body data-exige-login> mandam para o login quem não entrou.
(async () => {
  const nav = document.querySelector('header nav');
  const linkEntrar = nav.querySelector('a[href="/login.html"]');
  const linkAdmin = nav.querySelector('a[href="/admin.html"]');

  for (const link of nav.querySelectorAll('a')) {
    if (link.pathname === location.pathname) link.setAttribute('aria-current', 'page');
  }

  let usuario = null;
  try {
    usuario = await api('/auth/eu');
  } catch {
    // não está logado
  }

  if (!usuario) {
    linkAdmin?.remove();
    if (document.body.hasAttribute('data-exige-login')) {
      location.href = '/login.html?voltar=' + encodeURIComponent(location.pathname + location.search);
    }
    return;
  }

  if (usuario.perfil !== 'ADMINISTRADOR') linkAdmin?.remove();

  linkEntrar.textContent = `Sair (${usuario.nome.split(' ')[0]})`;
  linkEntrar.href = '#';
  linkEntrar.addEventListener('click', async (evento) => {
    evento.preventDefault();
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/';
  });
})();
