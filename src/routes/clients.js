import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createClientSchema, updateClientSchema } from '../validators/clientValidators.js';

const router = express.Router();

// Criar cliente (com validação)
router.post('/', authenticateToken, validateRequest(createClientSchema), (req, res) => {
  try {
    const { nome, email, telefone, cpf, endereco, cidade, estado, cep, data_nascimento, observacoes } = req.body;
    const usuario_id = req.user.ownerId;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO clientes (usuario_id, nome, email, telefone, cpf, endereco, cidade, estado, cep, data_nascimento, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(usuario_id, nome, email || null, telefone || null, cpf || null, endereco || null, cidade || null, estado || null, cep || null, data_nascimento || null, observacoes || null);

    res.status(201).json({
      message: 'Cliente cadastrado com sucesso',
      clienteId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro ao cadastrar cliente' });
  }
});

// Listar clientes do usuário logado (com paginação)
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Buscar total de clientes
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM clientes
      WHERE usuario_id = ?
    `).get(usuario_id).count;

    // Buscar clientes com paginação
    const clientes = db.prepare(`
      SELECT * FROM clientes 
      WHERE usuario_id = ?
      ORDER BY nome
      LIMIT ? OFFSET ?
    `).all(usuario_id, limit, offset);

    res.json({
      clientes,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// Buscar cliente específico
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const cliente = db.prepare(`
      SELECT * FROM clientes 
      WHERE id = ? AND usuario_id = ?
    `).get(id, usuario_id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Buscar histórico de vendas do cliente (filtrado pelo usuario_id para segurança)
    const vendas = db.prepare(`
      SELECT * FROM vendas 
      WHERE cliente_id = ? AND usuario_id = ?
      ORDER BY data_venda DESC
    `).all(id, usuario_id);

    cliente.historico_vendas = vendas;

    res.json(cliente);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// Atualizar cliente
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { nome, email, telefone, cpf, endereco, cidade, estado, cep, data_nascimento, observacoes } = req.body;

    // Verificar se o cliente pertence ao usuário
    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const updates = [];
    const values = [];

    if (nome) {
      updates.push('nome = ?');
      values.push(nome);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (telefone !== undefined) {
      updates.push('telefone = ?');
      values.push(telefone);
    }
    if (cpf !== undefined) {
      updates.push('cpf = ?');
      values.push(cpf);
    }
    if (endereco !== undefined) {
      updates.push('endereco = ?');
      values.push(endereco);
    }
    if (cidade !== undefined) {
      updates.push('cidade = ?');
      values.push(cidade);
    }
    if (estado !== undefined) {
      updates.push('estado = ?');
      values.push(estado);
    }
    if (cep !== undefined) {
      updates.push('cep = ?');
      values.push(cep);
    }
    if (data_nascimento !== undefined) {
      updates.push('data_nascimento = ?');
      values.push(data_nascimento);
    }
    if (observacoes !== undefined) {
      updates.push('observacoes = ?');
      values.push(observacoes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const query = `UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    res.json({ message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// Deletar cliente
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    // Verificar se o cliente pertence ao usuário
    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
    res.json({ message: 'Cliente deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    res.status(500).json({ error: 'Erro ao deletar cliente' });
  }
});

// Estatísticas do cliente
router.get('/:id/stats', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    // Verificar se o cliente pertence ao usuário
    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_compras,
        COALESCE(SUM(valor_total), 0) as valor_total_gasto,
        COALESCE(AVG(valor_total), 0) as ticket_medio
      FROM vendas
      WHERE cliente_id = ? AND usuario_id = ?
    `).get(id, usuario_id);

    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export default router;

