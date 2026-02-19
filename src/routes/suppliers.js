import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Listar todos fornecedores do usuário
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const fornecedores = db.prepare(`
      SELECT * FROM fornecedores 
      WHERE usuario_id = ? 
      ORDER BY nome
    `).all(usuario_id);

    res.json(fornecedores);
  } catch (error) {
    console.error('Erro ao listar fornecedores:', error);
    res.status(500).json({ error: 'Erro ao listar fornecedores' });
  }
});

// Criar fornecedor
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { 
      nome, cnpj, email, telefone, endereco, cidade, estado, cep,
      contato_nome, contato_telefone, observacoes 
    } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome do fornecedor é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO fornecedores (
        usuario_id, nome, cnpj, email, telefone, endereco, cidade, estado, cep,
        contato_nome, contato_telefone, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, nome, cnpj || null, email || null, telefone || null,
      endereco || null, cidade || null, estado || null, cep || null,
      contato_nome || null, contato_telefone || null, observacoes || null
    );

    res.status(201).json({
      message: 'Fornecedor criado com sucesso',
      fornecedorId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

// Buscar fornecedor específico
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const fornecedor = db.prepare(`
      SELECT * FROM fornecedores WHERE id = ? AND usuario_id = ?
    `).get(id, usuario_id);

    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    res.json(fornecedor);
  } catch (error) {
    console.error('Erro ao buscar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao buscar fornecedor' });
  }
});

// Atualizar fornecedor
router.put('/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { 
      nome, cnpj, email, telefone, endereco, cidade, estado, cep,
      contato_nome, contato_telefone, observacoes, ativo 
    } = req.body;

    const fornecedor = db.prepare('SELECT id FROM fornecedores WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (cnpj !== undefined) { updates.push('cnpj = ?'); values.push(cnpj); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (telefone !== undefined) { updates.push('telefone = ?'); values.push(telefone); }
    if (endereco !== undefined) { updates.push('endereco = ?'); values.push(endereco); }
    if (cidade !== undefined) { updates.push('cidade = ?'); values.push(cidade); }
    if (estado !== undefined) { updates.push('estado = ?'); values.push(estado); }
    if (cep !== undefined) { updates.push('cep = ?'); values.push(cep); }
    if (contato_nome !== undefined) { updates.push('contato_nome = ?'); values.push(contato_nome); }
    if (contato_telefone !== undefined) { updates.push('contato_telefone = ?'); values.push(contato_telefone); }
    if (observacoes !== undefined) { updates.push('observacoes = ?'); values.push(observacoes); }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE fornecedores SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Fornecedor atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

// Deletar fornecedor
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const fornecedor = db.prepare('SELECT id FROM fornecedores WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    db.prepare('DELETE FROM fornecedores WHERE id = ?').run(id);
    res.json({ message: 'Fornecedor deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao deletar fornecedor' });
  }
});

export default router;
