// Menu das páginas internas. Incluir em todas elas, depois do api.js.
// O servidor já só entrega estas páginas a quem entrou; aqui o menu é ajustado ao perfil
// e, se a sessão expirar com a página aberta, a pessoa volta para o login.

// Bolinha com um número (ex.: mensagens não lidas). O texto escondido é para leitores de tela.
function contadorNaoLidas(quantas) {
  const contador = document.createElement('span');
  contador.className = 'contador';
  contador.textContent = quantas > 99 ? '99+' : String(quantas);
  const explicacao = document.createElement('span');
  explicacao.className = 'so-leitor';
  explicacao.textContent = quantas === 1 ? ' mensagem não lida' : ' mensagens não lidas';
  contador.append(explicacao);
  return contador;
}

// Mensagens não lidas no menu: em "Minhas reivindicações" e, para a administração, em "Administração".
// As páginas chamam de novo depois de abrir uma conversa, para o número baixar na hora.
async function atualizarContadorDeMensagens() {
  const nav = document.querySelector('header nav');
  let contagem;
  try {
    contagem = await api('/reivindicacoes/nao-lidas');
  } catch {
    return; // sem o contador o menu continua funcionando
  }
  const alvos = [
    [nav.querySelector('a[href="/minhas-reivindicacoes.html"]'), contagem.minhas.total],
    [nav.querySelector('a[href="/admin.html"]'), contagem.administracao?.total ?? 0],
  ];
  for (const [link, total] of alvos) {
    if (!link) continue;
    link.querySelector('.contador')?.remove();
    if (total > 0) link.append(contadorNaoLidas(total));
  }
}

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

  // Confere de novo a cada minuto, só com a aba visível
  atualizarContadorDeMensagens();
  setInterval(() => {
    if (document.visibilityState === 'visible') atualizarContadorDeMensagens();
  }, 60000);
})();
