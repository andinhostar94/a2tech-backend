import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Analytics de vendas
router.get('/sales', authenticateToken, (req, res) => {
  try {
    const { period } = req.query; // daily, weekly, monthly
    const usuario_id = req.user.ownerId;

    let dateFilter = '';
    let groupBy = '';
    
    switch (period) {
      case 'daily':
        dateFilter = "date(data_venda) = date('now')";
        groupBy = "strftime('%H', data_venda)";
        break;
      case 'weekly':
        dateFilter = "date(data_venda) >= date('now', '-7 days')";
        groupBy = "date(data_venda)";
        break;
      case 'monthly':
        dateFilter = "date(data_venda) >= date('now', '-30 days')";
        groupBy = "date(data_venda)";
        break;
      default:
        dateFilter = '1=1';
        groupBy = "strftime('%Y-%m', data_venda)";
    }

    // Vendas por período
    const vendasPorPeriodo = db.prepare(`
      SELECT 
        ${groupBy} as periodo,
        COUNT(*) as quantidade,
        SUM(valor_total) as total
      FROM vendas
      WHERE usuario_id = ? AND ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY periodo
    `).all(usuario_id);

    // Total de vendas
    const totalVendas = db.prepare(`
      SELECT 
        COUNT(*) as total_vendas,
        SUM(valor_total) as receita_total,
        AVG(valor_total) as ticket_medio
      FROM vendas
      WHERE usuario_id = ? AND ${dateFilter}
    `).get(usuario_id);

    res.json({
      periodo: period || 'all',
      vendas_por_periodo: vendasPorPeriodo,
      resumo: totalVendas
    });
  } catch (error) {
    console.error('Erro ao buscar analytics de vendas:', error);
    res.status(500).json({ error: 'Erro ao buscar analytics de vendas' });
  }
});

// Analytics de estoque
router.get('/stock', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    
    // Produtos em estoque
    const produtos = db.prepare(`
      SELECT 
        produto,
        quantidade,
        preco_unitario,
        (quantidade * preco_unitario) as valor_total
      FROM estoque
      WHERE usuario_id = ?
      ORDER BY quantidade DESC
    `).all(usuario_id);

    // Produtos com estoque baixo (< 5)
    const estoqueBaixo = db.prepare(`
      SELECT produto, quantidade
      FROM estoque
      WHERE usuario_id = ? AND quantidade < 5
    `).all(usuario_id);

    // Estatísticas gerais
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_produtos,
        SUM(quantidade) as total_itens,
        SUM(quantidade * preco_unitario) as valor_total_estoque
      FROM estoque
      WHERE usuario_id = ?
    `).get(usuario_id);

    res.json({
      produtos,
      estoque_baixo: estoqueBaixo,
      estatisticas: stats
    });
  } catch (error) {
    console.error('Erro ao buscar analytics de estoque:', error);
    res.status(500).json({ error: 'Erro ao buscar analytics de estoque' });
  }
});

// Analytics financeiro
router.get('/financial', authenticateToken, (req, res) => {
  try {
    const { period } = req.query;
    const usuario_id = req.user.ownerId;

    let dateFilter = '';
    
    switch (period) {
      case 'daily':
        dateFilter = "date(data_pagamento) = date('now')";
        break;
      case 'weekly':
        dateFilter = "date(data_pagamento) >= date('now', '-7 days')";
        break;
      case 'monthly':
        dateFilter = "date(data_pagamento) >= date('now', '-30 days')";
        break;
      default:
        dateFilter = '1=1';
    }

    // Pagamentos por status
    const pagamentosPorStatus = db.prepare(`
      SELECT 
        status,
        COUNT(*) as quantidade,
        SUM(valor) as total
      FROM pagamentos
      WHERE usuario_id = ? AND ${dateFilter}
      GROUP BY status
    `).all(usuario_id);

    // Evolução financeira
    const evolucao = db.prepare(`
      SELECT 
        date(data_pagamento) as data,
        SUM(CASE WHEN status = 'Pago' THEN valor ELSE 0 END) as receitas,
        SUM(CASE WHEN status = 'Pendente' THEN valor ELSE 0 END) as pendente
      FROM pagamentos
      WHERE usuario_id = ? AND ${dateFilter}
      GROUP BY date(data_pagamento)
      ORDER BY data
    `).all(usuario_id);

    res.json({
      periodo: period || 'all',
      pagamentos_por_status: pagamentosPorStatus,
      evolucao_financeira: evolucao
    });
  } catch (error) {
    console.error('Erro ao buscar analytics financeiro:', error);
    res.status(500).json({ error: 'Erro ao buscar analytics financeiro' });
  }
});

export default router;
