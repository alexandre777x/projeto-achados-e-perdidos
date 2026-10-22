// Função única para falar com o back-end. Exemplo de uso nas páginas:
//   const itens = await api('/itens?local=3');
//   await api('/auth/login', { method: 'POST', body: { email, senha } });
async function api(caminho, { method = 'GET', body } = {}) {
  const opcoes = { method, headers: {} };

  if (body instanceof FormData) {
    opcoes.body = body; // upload de fotos
  } else if (body !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(body);
  }

  const resposta = await fetch('/api' + caminho, opcoes);
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro na requisição.');
  }
  return dados;
}
