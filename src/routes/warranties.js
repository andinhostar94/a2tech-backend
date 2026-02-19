import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Listar garantias
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { status, tipo } = req.query;

    let query = `
      SELECT g.*, c.nome as cliente_nome, os.numero_os
      FROM garantias g
      LEFT JOIN clientes c ON g.cliente_id = c.id
      LEFT JOIN ordens_servico os ON g.ordem_servico_id = os.id
      WHERE g.usuario_id = ?
    `;
    const params = [usuario_id];

    if (status) {
      query += ' AND g.status = ?';
      params.push(status);
    }

    if (tipo) {
      query += ' AND g.tipo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY g.data_fim ASC';

    const garantias = db.prepare(query).all(...params);

    res.json(garantias);
  } catch (error) {
    console.error('Erro ao listar garantias:', error);
    res.status(500).json({ error: 'Erro ao listar garantias' });
  }
});

// Criar garantia
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { 
      ordem_servico_id, venda_id, cliente_id, tipo, descricao,
      dias_garantia, data_inicio, observacoes
    } = req.body;

    if (!tipo || !descricao || !dias_garantia) {
      return res.status(400).json({ error: 'Tipo, descrição e dias de garantia são obrigatórios' });
    }

    const tiposValidos = ['servico', 'produto'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: servico ou produto' });
    }

    const dataInicio = data_inicio ? new Date(data_inicio) : new Date();
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + dias_garantia);

    const result = db.prepare(`
      INSERT INTO garantias (
        usuario_id, ordem_servico_id, venda_id, cliente_id, tipo, descricao,
        dias_garantia, data_inicio, data_fim, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, ordem_servico_id || null, venda_id || null, cliente_id || null,
      tipo, descricao, dias_garantia, 
      dataInicio.toISOString().split('T')[0],
      dataFim.toISOString().split('T')[0],
      observacoes || null
    );

    res.status(201).json({
      message: 'Garantia criada com sucesso',
      garantiaId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar garantia:', error);
    res.status(500).json({ error: 'Erro ao criar garantia' });
  }
});

// Buscar garantia específica
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const garantia = db.prepare(`
      SELECT g.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
             os.numero_os, os.equipamento as os_equipamento
      FROM garantias g
      LEFT JOIN clientes c ON g.cliente_id = c.id
      LEFT JOIN ordens_servico os ON g.ordem_servico_id = os.id
      WHERE g.id = ? AND g.usuario_id = ?
    `).get(id, usuario_id);

    if (!garantia) {
      return res.status(404).json({ error: 'Garantia não encontrada' });
    }

    res.json(garantia);
  } catch (error) {
    console.error('Erro ao buscar garantia:', error);
    res.status(500).json({ error: 'Erro ao buscar garantia' });
  }
});

// Atualizar garantia
router.put('/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { descricao, status, observacoes } = req.body;

    const garantia = db.prepare('SELECT id FROM garantias WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!garantia) {
      return res.status(404).json({ error: 'Garantia não encontrada' });
    }

    const updates = [];
    const values = [];

    if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
    if (status !== undefined) {
      const statusValidos = ['ativa', 'expirada', 'utilizada', 'cancelada'];
      if (!statusValidos.includes(status)) {
        return res.status(400).json({ error: 'Status inválido. Use: ' + statusValidos.join(', ') });
      }
      updates.push('status = ?');
      values.push(status);
    }
    if (observacoes !== undefined) { updates.push('observacoes = ?'); values.push(observacoes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);

    db.prepare(`UPDATE garantias SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Garantia atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar garantia:', error);
    res.status(500).json({ error: 'Erro ao atualizar garantia' });
  }
});

// Verificar garantia de venda ou OS
router.get('/check/:type/:id', authenticateToken, (req, res) => {
  try {
    const { type, id } = req.params;
    const usuario_id = req.user.ownerId;

    let query;
    const params = [usuario_id];

    if (type === 'venda') {
      query = `
        SELECT g.*, c.nome as cliente_nome
        FROM garantias g
        LEFT JOIN clientes c ON g.cliente_id = c.id
        WHERE g.usuario_id = ? AND g.venda_id = ?
      `;
      params.push(id);
    } else if (type === 'os') {
      query = `
        SELECT g.*, c.nome as cliente_nome, os.numero_os
        FROM garantias g
        LEFT JOIN clientes c ON g.cliente_id = c.id
        LEFT JOIN ordens_servico os ON g.ordem_servico_id = os.id
        WHERE g.usuario_id = ? AND g.ordem_servico_id = ?
      `;
      params.push(id);
    } else {
      return res.status(400).json({ error: 'Tipo inválido. Use: venda ou os' });
    }

    const garantias = db.prepare(query).all(...params);

    // Verificar status e expiração
    const hoje = new Date().toISOString().split('T')[0];
    const garantiasFormatadas = garantias.map(g => {
      const expirada = g.data_fim < hoje;
      return {
        ...g,
        esta_expirada: expirada,
        esta_ativa: g.status === 'ativa' && !expirada
      };
    });

    res.json({
      tem_garantia: garantias.length > 0,
      garantias: garantiasFormatadas
    });
  } catch (error) {
    console.error('Erro ao verificar garantia:', error);
    res.status(500).json({ error: 'Erro ao verificar garantia' });
  }
});

export default router;
