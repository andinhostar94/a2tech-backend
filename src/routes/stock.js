import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createProductSchema, updateProductSchema } from '../validators/productValidators.js';

const router = express.Router();

// Adicionar produto ao estoque
router.post('/', authenticateToken, checkTrialStatus, validateRequest(createProductSchema), (req, res) => {
  try {
    const {
      produto, descricao, categoria_id, quantidade,
      preco_unitario, preco_venda, codigo_barras,
      imei, cor, armazenamento
    } = req.body;
    const usuario_id = req.user.ownerId;

    if (!produto || quantidade === undefined || !preco_unitario) {
      return res.status(400).json({ error: 'Produto, quantidade e preço unitário são obrigatórios' });
    }

    const result = db.prepare(`
      INSERT INTO estoque (usuario_id, produto, descricao, categoria_id, quantidade, preco_unitario, preco_venda, codigo_barras, imei, cor, armazenamento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, produto, descricao || null, categoria_id || null,
      quantidade, preco_unitario, preco_venda || preco_unitario,
      codigo_barras || null, imei || null, cor || null, armazenamento || null
    );

    res.status(201).json({
      message: 'Produto adicionado ao estoque',
      produtoId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    res.status(500).json({ error: 'Erro ao adicionar produto ao estoque' });
  }
});

// Listar produtos do estoque do usuário (com paginação)
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM estoque WHERE usuario_id = ?
    `).get(usuario_id).count;

    const produtos = db.prepare(`
      SELECT e.*, c.nome as categoria_nome
      FROM estoque e
      LEFT JOIN categorias c ON e.categoria_id = c.id
      WHERE e.usuario_id = ?
      ORDER BY e.produto
      LIMIT ? OFFSET ?
    `).all(usuario_id, limit, offset);

    res.json({
      produtos,
      pagination: {
        page, limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar estoque:', error);
    res.status(500).json({ error: 'Erro ao listar estoque' });
  }
});

// Buscar produto específico
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const produto = db.prepare('SELECT * FROM estoque WHERE id = ? AND usuario_id = ?').get(id, usuario_id);

    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json(produto);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// Atualizar produto
router.put('/:id', authenticateToken, validateRequest(updateProductSchema), (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const {
      produto, descricao, categoria_id, quantidade,
      preco_unitario, preco_venda, codigo_barras,
      imei, cor, armazenamento
    } = req.body;

    const produtoExistente = db.prepare('SELECT id FROM estoque WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!produtoExistente) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const updates = [];
    const values = [];

    if (produto) { updates.push('produto = ?'); values.push(produto); }
    if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
    if (categoria_id !== undefined) { updates.push('categoria_id = ?'); values.push(categoria_id); }
    if (quantidade !== undefined) { updates.push('quantidade = ?'); values.push(quantidade); }
    if (preco_unitario) { updates.push('preco_unitario = ?'); values.push(preco_unitario); }
    if (preco_venda) { updates.push('preco_venda = ?'); values.push(preco_venda); }
    if (codigo_barras !== undefined) { updates.push('codigo_barras = ?'); values.push(codigo_barras); }
    if (imei !== undefined) { updates.push('imei = ?'); values.push(imei); }
    if (cor !== undefined) { updates.push('cor = ?'); values.push(cor); }
    if (armazenamento !== undefined) { updates.push('armazenamento = ?'); values.push(armazenamento); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE estoque SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// Deletar produto
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const produto = db.prepare('SELECT id FROM estoque WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    db.prepare('DELETE FROM estoque WHERE id = ?').run(id);
    res.json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ error: 'Erro ao deletar produto' });
  }
});

export default router;
