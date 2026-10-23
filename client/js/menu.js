// Menu das páginas internas. Incluir em todas elas, depois do api.js.
// O servidor já só entrega estas páginas a quem entrou; aqui o menu é ajustado ao perfil
// e, se a sessão expirar com a página aberta, a pessoa volta para o login.
(async () => {
  const nav = document.querySelector('header nav');
  const linkSair = document.getElementById('sair');
  const linkAdmin = nav.querySelector('a[href="/admin.html"]');

  for (const link of nav.querySelectorAll('a')) {
    if (link.pathname === location.pathname) link.setAttribute('aria-current', 'page');
  }

  let usuario = null;
  try {
    usuario = await api('/auth/eu');
  } catch {
    location.href = '/login.html?voltar=' + encodeURIComponent(location.pathname + location.search);
    return;
  }

  if (usuario.perfil !== 'ADMINISTRADOR') linkAdmin?.remove();

  linkSair.textContent = `Sair (${usuario.nome.split(' ')[0]})`;
  linkSair.addEventListener('click', async (evento) => {
    evento.preventDefault();
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login.html';
  });
})();
