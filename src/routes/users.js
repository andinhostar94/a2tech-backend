import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Listar todos os usuários (apenas admin)
router.get('/', authenticateToken, isAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, nome, email, telefone, endereco, status_pagamento, created_at FROM usuarios').all();
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Buscar usuário específico
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Usuário comum só pode ver seus próprios dados, admin pode ver todos
    if (req.user.ownerId !== parseInt(id) && req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const user = db.prepare('SELECT id, nome, email, telefone, endereco, status_pagamento, created_at FROM usuarios WHERE id = ?').get(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Atualizar usuário
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone, endereco, status_pagamento } = req.body;

    // Apenas admin pode alterar status de pagamento
    if (status_pagamento && req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Apenas administradores podem alterar o status de pagamento' });
    }

    // Usuário comum só pode editar seus próprios dados
    if (req.user.ownerId !== parseInt(id) && req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Construir query de atualização dinamicamente
    const updates = [];
    const values = [];

    if (nome) {
      updates.push('nome = ?');
      values.push(nome);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (telefone !== undefined) {
      updates.push('telefone = ?');
      values.push(telefone);
    }
    if (endereco !== undefined) {
      updates.push('endereco = ?');
      values.push(endereco);
    }
    if (status_pagamento && req.user.email === process.env.ADMIN_EMAIL) {
      updates.push('status_pagamento = ?');
      values.push(status_pagamento);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const query = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`;
    
    db.prepare(query).run(...values);

    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Deletar usuário (apenas admin)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir deletar o admin
    const user = db.prepare('SELECT email FROM usuarios WHERE id = ?').get(id);
    if (user && user.email === process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Não é possível deletar o usuário administrador' });
    }

    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

export default router;
