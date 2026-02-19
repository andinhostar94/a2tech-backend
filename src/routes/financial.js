import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Registrar transação
router.post('/transactions', authenticateToken, (req, res) => {
  try {
    const { valor, status } = req.body;
    const usuario_id = req.user.ownerId;

    if (!valor) {
      return res.status(400).json({ error: 'Valor é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO pagamentos (usuario_id, valor, status)
      VALUES (?, ?, ?)
    `).run(usuario_id, valor, status || 'Pendente');

    res.status(201).json({
      message: 'Transação registrada com sucesso',
      transacaoId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao registrar transação:', error);
    res.status(500).json({ error: 'Erro ao registrar transação' });
  }
});

// Listar transações
router.get('/transactions', authenticateToken, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const usuario_id = req.user.ownerId;

    let query = `
      SELECT p.*, u.nome as usuario_nome, u.email as usuario_email
      FROM pagamentos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.usuario_id = ?
    `;

    const params = [usuario_id];

    if (start_date) {
      query += ' AND p.data_pagamento >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND p.data_pagamento <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY p.data_pagamento DESC';

    const transacoes = db.prepare(query).all(...params);
    res.json(transacoes);
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    res.status(500).json({ error: 'Erro ao listar transações' });
  }
});

// Gerar relatórios financeiros
router.get('/reports', authenticateToken, (req, res) => {
  try {
    const { period } = req.query; // daily, weekly, monthly
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
        dateFilter = '1=1'; // Todos os registros
    }

    // Receitas (vendas)
    const vendas = db.prepare(`
      SELECT 
        COALESCE(SUM(valor_total), 0) as total_vendas,
        COUNT(*) as num_vendas
      FROM vendas
      WHERE usuario_id = ? AND ${dateFilter.replace('data_pagamento', 'data_venda')}
    `).get(usuario_id);

    // Pagamentos
    const pagamentos = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'Pago' THEN valor ELSE 0 END), 0) as total_pago,
        COALESCE(SUM(CASE WHEN status = 'Pendente' THEN valor ELSE 0 END), 0) as total_pendente,
        COUNT(*) as num_transacoes
      FROM pagamentos
      WHERE usuario_id = ? AND ${dateFilter}
    `).get(usuario_id);

    // Estoque (valor total)
    const estoque = db.prepare(`
      SELECT COALESCE(SUM(quantidade * preco_unitario), 0) as valor_estoque
      FROM estoque
      WHERE usuario_id = ?
    `).get(usuario_id);

    res.json({
      periodo: period || 'all',
      vendas: {
        total: vendas.total_vendas,
        quantidade: vendas.num_vendas
      },
      pagamentos: {
        pago: pagamentos.total_pago,
        pendente: pagamentos.total_pendente,
        transacoes: pagamentos.num_transacoes
      },
      estoque: {
        valor_total: estoque.valor_estoque
      },
      saldo: vendas.total_vendas - pagamentos.total_pago
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório financeiro' });
  }
});

export default router;
