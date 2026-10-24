// Barra de progresso do pedido de devolução: Enviado → Em análise → Aprovado → Entregue.
// Usada nos cartões de "Minhas reivindicações" e no detalhe da reivindicação.
// Cada etapa fica feita (verde), atual (roxa), pendente (cinza) ou recusada (X vermelho).

// pedido: { status, dataAbertura, dataDecisao, entregue, dataEntrega }
function etapasDoPedido(pedido) {
  const enviado = { titulo: 'Enviado', estado: 'feita', data: pedido.dataAbertura };
  if (pedido.status === 'REJEITADA') {
    return [
      enviado,
      { titulo: 'Analisado', estado: 'feita' },
      { titulo: 'Rejeitado', estado: 'recusada', data: pedido.dataDecisao },
    ];
  }
  if (pedido.status === 'ABERTA') {
    return [
      enviado,
      { titulo: 'Em análise', estado: 'atual' },
      { titulo: 'Aprovado', estado: 'pendente' },
      { titulo: 'Entregue', estado: 'pendente' },
    ];
  }
  return [
    enviado,
    { titulo: 'Analisado', estado: 'feita' },
    { titulo: 'Aprovado', estado: 'feita', data: pedido.dataDecisao },
    pedido.entregue
      ? { titulo: 'Entregue', estado: 'feita', data: pedido.dataEntrega }
      : { titulo: 'Retirada', estado: 'atual' },
  ];
}

// Monta a lista <ol> da barra. comDatas: mostra a data embaixo de cada etapa feita.
function barraDeProgresso(pedido, comDatas) {
  const barra = document.createElement('ol');
  barra.className = 'progresso';
  const etapas = etapasDoPedido(pedido);
  const atual = etapas.findIndex((etapa) => etapa.estado === 'atual');
  barra.setAttribute('aria-label', `Andamento: etapa ${atual === -1 ? etapas.length : atual + 1} de ${etapas.length}`);

  for (const etapa of etapas) {
    const li = document.createElement('li');
    li.className = `progresso-${etapa.estado}`;
    if (etapa.estado === 'atual') li.setAttribute('aria-current', 'step');
    const titulo = document.createElement('span');
    titulo.className = 'progresso-titulo';
    titulo.textContent = etapa.titulo;
    li.append(titulo);
    if (comDatas && etapa.data) {
      const data = document.createElement('small');
      data.textContent = new Date(etapa.data.replace(' ', 'T') + 'Z')
        .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      li.append(data);
    }
    barra.append(li);
  }
  return barra;
}
