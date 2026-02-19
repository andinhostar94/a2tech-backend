import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Listar contas a pagar com filtros
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { status, data_inicio, data_fim } = req.query;

    let query = `
      SELECT cp.*, f.nome as fornecedor_nome
      FROM contas_pagar cp
      LEFT JOIN fornecedores f ON cp.fornecedor_id = f.id
      WHERE cp.usuario_id = ?
    `;
    const params = [usuario_id];

    if (status) {
      query += ' AND cp.status = ?';
      params.push(status);
    }

    if (data_inicio) {
      query += ' AND cp.data_vencimento >= ?';
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ' AND cp.data_vencimento <= ?';
      params.push(data_fim);
    }

    query += ' ORDER BY cp.data_vencimento ASC';

    const contas = db.prepare(query).all(...params);

    res.json(contas);
  } catch (error) {
    console.error('Erro ao listar contas a pagar:', error);
    res.status(500).json({ error: 'Erro ao listar contas a pagar' });
  }
});

// Criar conta a pagar
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { 
      fornecedor_id, descricao, valor, data_vencimento, 
      categoria, forma_pagamento, observacoes 
    } = req.body;

    if (!descricao || !valor || !data_vencimento) {
      return res.status(400).json({ error: 'Descrição, valor e data de vencimento são obrigatórios' });
    }

    const result = db.prepare(`
      INSERT INTO contas_pagar (
        usuario_id, fornecedor_id, descricao, valor, data_vencimento,
        categoria, forma_pagamento, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, fornecedor_id || null, descricao, valor, data_vencimento,
      categoria || null, forma_pagamento || null, observacoes || null
    );

    res.status(201).json({
      message: 'Conta a pagar criada com sucesso',
      contaId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar conta a pagar:', error);
    res.status(500).json({ error: 'Erro ao criar conta a pagar' });
  }
});

// Atualizar conta a pagar
router.put('/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { 
      fornecedor_id, descricao, valor, data_vencimento, status,
      categoria, forma_pagamento, observacoes 
    } = req.body;

    const conta = db.prepare('SELECT id FROM contas_pagar WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!conta) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const updates = [];
    const values = [];

    if (fornecedor_id !== undefined) { updates.push('fornecedor_id = ?'); values.push(fornecedor_id); }
    if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
    if (valor !== undefined) { updates.push('valor = ?'); values.push(valor); }
    if (data_vencimento !== undefined) { updates.push('data_vencimento = ?'); values.push(data_vencimento); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (categoria !== undefined) { updates.push('categoria = ?'); values.push(categoria); }
    if (forma_pagamento !== undefined) { updates.push('forma_pagamento = ?'); values.push(forma_pagamento); }
    if (observacoes !== undefined) { updates.push('observacoes = ?'); values.push(observacoes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE contas_pagar SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Conta atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

// Marcar conta como paga
router.put('/:id/pay', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { data_pagamento } = req.body;

    const conta = db.prepare('SELECT id FROM contas_pagar WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!conta) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    db.prepare(`
      UPDATE contas_pagar 
      SET status = 'pago', data_pagamento = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(data_pagamento || new Date().toISOString().split('T')[0], id);

    res.json({ message: 'Conta marcada como paga' });
  } catch (error) {
    console.error('Erro ao marcar conta como paga:', error);
    res.status(500).json({ error: 'Erro ao marcar conta como paga' });
  }
});

// Deletar conta a pagar
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const conta = db.prepare('SELECT id FROM contas_pagar WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!conta) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    db.prepare('DELETE FROM contas_pagar WHERE id = ?').run(id);
    res.json({ message: 'Conta deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar conta:', error);
    res.status(500).json({ error: 'Erro ao deletar conta' });
  }
});

export default router;
