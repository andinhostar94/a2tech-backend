import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Listar maquininhas
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const maquininhas = db.prepare(`
      SELECT * FROM maquininhas 
      WHERE usuario_id = ? 
      ORDER BY nome
    `).all(usuario_id);

    res.json(maquininhas);
  } catch (error) {
    console.error('Erro ao listar maquininhas:', error);
    res.status(500).json({ error: 'Erro ao listar maquininhas' });
  }
});

// Criar maquininha
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { 
      nome, taxa_debito, taxa_credito_vista,
      taxa_credito_2x, taxa_credito_3x, taxa_credito_4x, taxa_credito_5x, taxa_credito_6x,
      taxa_credito_7x, taxa_credito_8x, taxa_credito_9x, taxa_credito_10x, taxa_credito_11x, taxa_credito_12x
    } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da maquininha é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO maquininhas (
        usuario_id, nome, taxa_debito, taxa_credito_vista,
        taxa_credito_2x, taxa_credito_3x, taxa_credito_4x, taxa_credito_5x, taxa_credito_6x,
        taxa_credito_7x, taxa_credito_8x, taxa_credito_9x, taxa_credito_10x, taxa_credito_11x, taxa_credito_12x
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, nome, 
      taxa_debito || 0, taxa_credito_vista || 0,
      taxa_credito_2x || 0, taxa_credito_3x || 0, taxa_credito_4x || 0, taxa_credito_5x || 0, taxa_credito_6x || 0,
      taxa_credito_7x || 0, taxa_credito_8x || 0, taxa_credito_9x || 0, taxa_credito_10x || 0, taxa_credito_11x || 0, taxa_credito_12x || 0
    );

    res.status(201).json({
      message: 'Maquininha criada com sucesso',
      maquininhaId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar maquininha:', error);
    res.status(500).json({ error: 'Erro ao criar maquininha' });
  }
});

// Buscar maquininha específica
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const maquininha = db.prepare(`
      SELECT * FROM maquininhas WHERE id = ? AND usuario_id = ?
    `).get(id, usuario_id);

    if (!maquininha) {
      return res.status(404).json({ error: 'Maquininha não encontrada' });
    }

    res.json(maquininha);
  } catch (error) {
    console.error('Erro ao buscar maquininha:', error);
    res.status(500).json({ error: 'Erro ao buscar maquininha' });
  }
});

// Atualizar maquininha
router.put('/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { 
      nome, taxa_debito, taxa_credito_vista,
      taxa_credito_2x, taxa_credito_3x, taxa_credito_4x, taxa_credito_5x, taxa_credito_6x,
      taxa_credito_7x, taxa_credito_8x, taxa_credito_9x, taxa_credito_10x, taxa_credito_11x, taxa_credito_12x,
      ativo
    } = req.body;

    const maquininha = db.prepare('SELECT id FROM maquininhas WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!maquininha) {
      return res.status(404).json({ error: 'Maquininha não encontrada' });
    }

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (taxa_debito !== undefined) { updates.push('taxa_debito = ?'); values.push(taxa_debito); }
    if (taxa_credito_vista !== undefined) { updates.push('taxa_credito_vista = ?'); values.push(taxa_credito_vista); }
    if (taxa_credito_2x !== undefined) { updates.push('taxa_credito_2x = ?'); values.push(taxa_credito_2x); }
    if (taxa_credito_3x !== undefined) { updates.push('taxa_credito_3x = ?'); values.push(taxa_credito_3x); }
    if (taxa_credito_4x !== undefined) { updates.push('taxa_credito_4x = ?'); values.push(taxa_credito_4x); }
    if (taxa_credito_5x !== undefined) { updates.push('taxa_credito_5x = ?'); values.push(taxa_credito_5x); }
    if (taxa_credito_6x !== undefined) { updates.push('taxa_credito_6x = ?'); values.push(taxa_credito_6x); }
    if (taxa_credito_7x !== undefined) { updates.push('taxa_credito_7x = ?'); values.push(taxa_credito_7x); }
    if (taxa_credito_8x !== undefined) { updates.push('taxa_credito_8x = ?'); values.push(taxa_credito_8x); }
    if (taxa_credito_9x !== undefined) { updates.push('taxa_credito_9x = ?'); values.push(taxa_credito_9x); }
    if (taxa_credito_10x !== undefined) { updates.push('taxa_credito_10x = ?'); values.push(taxa_credito_10x); }
    if (taxa_credito_11x !== undefined) { updates.push('taxa_credito_11x = ?'); values.push(taxa_credito_11x); }
    if (taxa_credito_12x !== undefined) { updates.push('taxa_credito_12x = ?'); values.push(taxa_credito_12x); }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);

    db.prepare(`UPDATE maquininhas SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Maquininha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar maquininha:', error);
    res.status(500).json({ error: 'Erro ao atualizar maquininha' });
  }
});

// Deletar maquininha
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const maquininha = db.prepare('SELECT id FROM maquininhas WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!maquininha) {
      return res.status(404).json({ error: 'Maquininha não encontrada' });
    }

    db.prepare('DELETE FROM maquininhas WHERE id = ?').run(id);
    res.json({ message: 'Maquininha deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar maquininha:', error);
    res.status(500).json({ error: 'Erro ao deletar maquininha' });
  }
});

export default router;
