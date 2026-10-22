// Tabela: devolucao (RF05).
// A implementar (RF05.1 a RF05.3): registrar(reivindicacaoId, adminId, tipoDocumento).
const db = require('../database/connection');

module.exports = {
  // RF05.4: itens devolvidos no período e itens registrados no período que ainda estão sob custódia.
  // O tempo até a devolução conta da data de registro do item até a devolução.
  // Não traz dados pessoais do dono (RNF09).
  relatorio({ de, ate }) {
    const devolvidos = db
      .prepare(
        `SELECT i.id, i.titulo, c.nome AS categoria, l.nome AS local, i.data_achado, i.data_registro,
                d.data_hora AS data_devolucao, d.tipo_documento,
                ROUND(julianday(d.data_hora) - julianday(i.data_registro), 1) AS dias_ate_devolucao
         FROM devolucao d
         JOIN reivindicacao r ON r.id = d.reivindicacao_id
         JOIN item i ON i.id = r.item_id
         JOIN categoria c ON c.id = i.categoria_id
         JOIN local l ON l.id = i.local_id
         WHERE date(d.data_hora) BETWEEN ? AND ?
         ORDER BY d.data_hora DESC`
      )
      .all(de, ate);

    const disponiveis = db
      .prepare(
        `SELECT i.id, i.titulo, c.nome AS categoria, l.nome AS local, i.data_achado, i.data_registro, i.status
         FROM item i
         JOIN categoria c ON c.id = i.categoria_id
         JOIN local l ON l.id = i.local_id
         WHERE i.status IN ('DISPONIVEL', 'EM_REIVINDICACAO') AND date(i.data_registro) BETWEEN ? AND ?
         ORDER BY i.data_registro DESC`
      )
      .all(de, ate);

    const soma = devolvidos.reduce((total, d) => total + d.dias_ate_devolucao, 0);
    const tempoMedioDias = devolvidos.length ? Math.round((soma / devolvidos.length) * 10) / 10 : null;

    return { periodo: { de, ate }, devolvidos, disponiveis, tempoMedioDias };
  },
};
