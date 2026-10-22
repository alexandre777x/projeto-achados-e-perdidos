// RF05 – Devolução e relatório. Usa o model devolucao.model.js.
const { aImplementar } = require('../middlewares/erros');
const devolucaoModel = require('../models/devolucao.model');

const SITUACAO = {
  DISPONIVEL: 'Disponível',
  EM_REIVINDICACAO: 'Em reivindicação',
};

// Lê ?de=AAAA-MM-DD&ate=AAAA-MM-DD. Sem um dos dois, o período fica aberto daquele lado.
function lerPeriodo(query) {
  const de = query.de || '0001-01-01';
  const ate = query.ate || '9999-12-31';
  const valida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

  if (!valida(de) || !valida(ate)) {
    const erro = new Error('Use datas no formato AAAA-MM-DD.');
    erro.status = 400;
    throw erro;
  }
  if (de > ate) {
    const erro = new Error('A data inicial não pode ser depois da data final.');
    erro.status = 400;
    throw erro;
  }
  return { de, ate };
}

// RF05.4
function relatorio(req, res) {
  res.json(devolucaoModel.relatorio(lerPeriodo(req.query)));
}

// Uma célula de CSV. Aspas quando precisa e proteção contra fórmulas do Excel (=, +, -, @).
function celula(valor) {
  if (valor === null || valor === undefined) return '';
  let texto = typeof valor === 'number' ? String(valor).replace('.', ',') : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// RF05.5: separado por ponto e vírgula e com BOM, para abrir certo no Excel em português.
function relatorioCsv(req, res) {
  const periodo = lerPeriodo(req.query);
  const { devolvidos, disponiveis, tempoMedioDias } = devolucaoModel.relatorio(periodo);

  const linhas = [
    ['Situação', 'ID', 'Título', 'Categoria', 'Local', 'Data do achado', 'Data do registro', 'Data da devolução', 'Dias até a devolução'],
    ...devolvidos.map((i) => ['Devolvido', i.id, i.titulo, i.categoria, i.local, i.data_achado, i.data_registro, i.data_devolucao, i.dias_ate_devolucao]),
    ...disponiveis.map((i) => [SITUACAO[i.status], i.id, i.titulo, i.categoria, i.local, i.data_achado, i.data_registro, '', '']),
    [],
    ['Tempo médio até a devolução (dias)', tempoMedioDias],
  ];
  const csv = '\uFEFF' + linhas.map((linha) => linha.map(celula).join(';')).join('\r\n') + '\r\n';

  const nome = `relatorio-devolucoes_${req.query.de || 'inicio'}_${req.query.ate || 'hoje'}.csv`;
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${nome}"`);
  res.send(csv);
}

module.exports = {
  registrar: aImplementar('RF05.1 a RF05.3'),
  relatorio,
  relatorioCsv,
};
