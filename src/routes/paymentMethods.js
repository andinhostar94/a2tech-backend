import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Listar formas de pagamento
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const formas = db.prepare(`
      SELECT * FROM formas_pagamento 
      WHERE usuario_id = ? 
      ORDER BY nome
    `).all(usuario_id);

    res.json(formas);
  } catch (error) {
    console.error('Erro ao listar formas de pagamento:', error);
    res.status(500).json({ error: 'Erro ao listar formas de pagamento' });
  }
});

// Criar forma de pagamento
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { nome, tipo } = req.body;

    if (!nome || !tipo) {
      return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
    }

    const tiposValidos = ['dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outros'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: ' + tiposValidos.join(', ') });
    }

    const result = db.prepare(`
      INSERT INTO formas_pagamento (usuario_id, nome, tipo)
      VALUES (?, ?, ?)
    `).run(usuario_id, nome, tipo);

    res.status(201).json({
      message: 'Forma de pagamento criada com sucesso',
      formaPagamentoId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar forma de pagamento:', error);
    res.status(500).json({ error: 'Erro ao criar forma de pagamento' });
  }
});

// Atualizar forma de pagamento
router.put('/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { nome, tipo, ativo } = req.body;

    const forma = db.prepare('SELECT id FROM formas_pagamento WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!forma) {
      return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
    }

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (tipo !== undefined) {
      const tiposValidos = ['dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outros'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido. Use: ' + tiposValidos.join(', ') });
      }
      updates.push('tipo = ?'); 
      values.push(tipo);
    }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);

    db.prepare(`UPDATE formas_pagamento SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Forma de pagamento atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar forma de pagamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar forma de pagamento' });
  }
});

// Deletar forma de pagamento
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const forma = db.prepare('SELECT id FROM formas_pagamento WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!forma) {
      return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
    }

    db.prepare('DELETE FROM formas_pagamento WHERE id = ?').run(id);
    res.json({ message: 'Forma de pagamento deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar forma de pagamento:', error);
    res.status(500).json({ error: 'Erro ao deletar forma de pagamento' });
  }
});

export default router;
