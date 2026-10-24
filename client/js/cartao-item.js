// Cartão de um item na busca (itens.html) e na página inicial: foto (ou o quadro
// "Sem foto"), selo de status, título, etiquetas de categoria e local, data e o botão.
// Recebe um item como vem de GET /api/itens.
const ROTULOS_STATUS = {
  AGUARDANDO_RECEBIMENTO: 'Aguardando recebimento',
  DISPONIVEL: 'Disponível',
  EM_REIVINDICACAO: 'Em reivindicação',
  DEVOLVIDO: 'Devolvido',
};

function cartaoDeItem(item) {
  const cartao = document.createElement('a');
  cartao.className = 'cartao-item';
  cartao.href = `/item.html?id=${item.id}`;

  const midia = document.createElement('div');
  midia.className = 'cartao-item-midia';
  // Sem foto: um quadro "Sem foto" no lugar de uma imagem quebrada
  const foto = document.createElement(item.foto ? 'img' : 'div');
  foto.className = 'item-foto';
  if (item.foto) {
    foto.src = item.foto;
    foto.alt = '';
    foto.loading = 'lazy';
  }
  const selo = document.createElement('span');
  selo.className = `selo selo-${item.status.toLowerCase()}`;
  selo.textContent = ROTULOS_STATUS[item.status] ?? item.status;
  midia.append(foto, selo);

  const corpo = document.createElement('div');
  corpo.className = 'cartao-item-corpo';

  const titulo = document.createElement('h3');
  titulo.textContent = item.titulo;

  const etiquetas = document.createElement('div');
  etiquetas.className = 'etiquetas';
  const categoria = document.createElement('span');
  categoria.className = 'etiqueta';
  categoria.textContent = item.categoria;
  const local = document.createElement('span');
  local.className = 'etiqueta etiqueta-local';
  local.title = item.local; // o local é texto livre e pode ser longo: o texto completo aparece ao passar o mouse
  const textoLocal = document.createElement('span');
  textoLocal.textContent = item.local;
  local.append(textoLocal);
  etiquetas.append(categoria, local);

  const data = document.createElement('p');
  data.className = 'cartao-item-data';
  data.textContent = `Achado em ${item.dataAchado.split('-').reverse().join('/')}`;

  const acao = document.createElement('span');
  acao.className = 'cartao-item-acao';
  acao.textContent = 'Ver detalhes / Reivindicar';

  corpo.append(titulo, etiquetas, data, acao);
  cartao.append(midia, corpo);
  return cartao;
}
