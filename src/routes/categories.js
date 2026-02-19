import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Criar categoria
router.post('/', authenticateToken, (req, res) => {
  try {
    const { nome, descricao, categoria_pai_id } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO categorias (nome, descricao, categoria_pai_id)
      VALUES (?, ?, ?)
    `).run(nome, descricao || null, categoria_pai_id || null);

    res.status(201).json({
      message: 'Categoria criada com sucesso',
      categoriaId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({ error: 'Categoria pai não encontrada' });
    }
    res.status(500).json({ error: 'Erro ao criar categoria: ' + error.message });
  }
});

// Listar todas as categorias
router.get('/', authenticateToken, (req, res) => {
  try {
    const categorias = db.prepare(`
      SELECT c.*, 
             cp.nome as categoria_pai_nome,
             (SELECT COUNT(*) FROM categorias WHERE categoria_pai_id = c.id) as subcategorias_count,
             (SELECT COUNT(*) FROM estoque WHERE categoria_id = c.id) as produtos_count
      FROM categorias c
      LEFT JOIN categorias cp ON c.categoria_pai_id = cp.id
      ORDER BY c.nome
    `).all();

    res.json(categorias);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro ao listar categorias: ' + error.message });
  }
});

// Buscar categoria específica
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    const categoria = db.prepare(`
      SELECT c.*, 
             cp.nome as categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias cp ON c.categoria_pai_id = cp.id
      WHERE c.id = ?
    `).get(id);

    if (!categoria) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Buscar subcategorias
    const subcategorias = db.prepare(`
      SELECT * FROM categorias WHERE categoria_pai_id = ?
    `).all(id);

    categoria.subcategorias = subcategorias;

    res.json(categoria);
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({ error: 'Erro ao buscar categoria' });
  }
});

// Atualizar categoria
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, categoria_pai_id } = req.body;

    const updates = [];
    const values = [];

    if (nome) {
      updates.push('nome = ?');
      values.push(nome);
    }
    if (descricao !== undefined) {
      updates.push('descricao = ?');
      values.push(descricao);
    }
    if (categoria_pai_id !== undefined) {
      updates.push('categoria_pai_id = ?');
      values.push(categoria_pai_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const query = `UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    res.json({ message: 'Categoria atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// Deletar categoria
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se há subcategorias
    const subcategorias = db.prepare('SELECT COUNT(*) as count FROM categorias WHERE categoria_pai_id = ?').get(id);
    if (subcategorias.count > 0) {
      return res.status(400).json({ error: 'Não é possível deletar categoria com subcategorias' });
    }

    // Verificar se há produtos
    const produtos = db.prepare('SELECT COUNT(*) as count FROM estoque WHERE categoria_id = ?').get(id);
    if (produtos.count > 0) {
      return res.status(400).json({ error: 'Não é possível deletar categoria com produtos associados' });
    }

    db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
    res.json({ message: 'Categoria deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar categoria:', error);
    res.status(500).json({ error: 'Erro ao deletar categoria' });
  }
});

export default router;


