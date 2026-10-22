// Respostas de erro padronizadas e marcador para o que ainda falta implementar.

function naoEncontrado(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

function tratarErros(err, req, res, next) {
  console.error(err);
  const mensagem = err.status ? err.message : 'Erro interno do servidor.';
  res.status(err.status || 500).json({ erro: mensagem });
}

// Use enquanto uma rota ainda não foi programada: aImplementar('RF03.1')
function aImplementar(requisito) {
  return (req, res) => {
    res.status(501).json({ erro: `Ainda não implementado (${requisito}).` });
  };
}

module.exports = { naoEncontrado, tratarErros, aImplementar };
