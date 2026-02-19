import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';
import { generateReceipt } from '../utils/pdfGenerator.js';

const router = express.Router();

// Criar nova venda (requer conta ativa ou trial)
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  const transaction = db.transaction((cliente_id, produtos, valor_total, usuario_id) => {
    // Parsear produtos se vier como string
    const produtosArray = typeof produtos === 'string' ? JSON.parse(produtos) : produtos;

    // Validar cliente se fornecido
    if (cliente_id) {
      const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND usuario_id = ?').get(cliente_id, usuario_id);
      if (!cliente) {
        throw new Error('Cliente não encontrado ou não pertence a você');
      }
    }

    // Verificar e atualizar estoque
    for (const item of produtosArray) {
      const produtoEstoque = db.prepare('SELECT quantidade, usuario_id FROM estoque WHERE id = ?').get(item.produto_id);
      
      if (!produtoEstoque) {
        throw new Error(`Produto ${item.produto_id} não encontrado no estoque`);
      }

      if (produtoEstoque.usuario_id !== usuario_id) {
        throw new Error(`Produto ${item.produto_id} não pertence a você`);
      }

      if (produtoEstoque.quantidade < item.quantidade) {
        throw new Error(`Quantidade insuficiente do produto ${item.produto_id}`);
      }

      // Atualizar estoque
      db.prepare('UPDATE estoque SET quantidade = quantidade - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(item.quantidade, item.produto_id);
    }

    // Inserir venda
    const result = db.prepare(`
      INSERT INTO vendas (usuario_id, cliente_id, valor_total, produtos)
      VALUES (?, ?, ?, ?)
    `).run(usuario_id, cliente_id || null, valor_total, JSON.stringify(produtosArray));

    return result.lastInsertRowid;
  });

  try {
    const { cliente_id, produtos, valor_total, garantia_tipo, garantia_valor } = req.body;
    const usuario_id = req.user.ownerId;

    if (!produtos || !valor_total) {
      return res.status(400).json({ error: 'Produtos e valor total são obrigatórios' });
    }

    const vendaId = transaction(cliente_id, produtos, valor_total, usuario_id);

    res.status(201).json({
      message: 'Venda registrada com sucesso',
      vendaId: vendaId
    });
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ error: error.message || 'Erro ao registrar venda' });
  }
});

// Listar vendas
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const vendas = db.prepare(`
      SELECT v.*, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.usuario_id = ?
      ORDER BY v.data_venda DESC
    `).all(usuario_id);

    // Parsear produtos de JSON para objeto
    const vendasFormatadas = vendas.map(venda => ({
      ...venda,
      produtos: JSON.parse(venda.produtos)
    }));

    res.json(vendasFormatadas);
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
});

// Buscar venda específica
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const venda = db.prepare(`
      SELECT v.*, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.id = ? AND v.usuario_id = ?
    `).get(id, usuario_id);

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    venda.produtos = JSON.parse(venda.produtos);
    res.json(venda);
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
});

// Atualizar venda (apenas admin)
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { cliente_id, produtos, valor_total } = req.body;
    
    // Verify sale belongs to user
    const venda = db.prepare('SELECT id FROM vendas WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const updates = [];
    const values = [];

    if (cliente_id !== undefined) {
      updates.push('cliente_id = ?');
      values.push(cliente_id);
    }
    if (produtos) {
      updates.push('produtos = ?');
      values.push(JSON.stringify(produtos));
    }
    if (valor_total) {
      updates.push('valor_total = ?');
      values.push(valor_total);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE vendas SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    res.json({ message: 'Venda atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar venda:', error);
    res.status(500).json({ error: 'Erro ao atualizar venda' });
  }
});

// Deletar venda (apenas admin)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    
    // Verify sale belongs to user
    const venda = db.prepare('SELECT id FROM vendas WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    
    db.prepare('DELETE FROM vendas WHERE id = ?').run(id);
    res.json({ message: 'Venda deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar venda:', error);
    res.status(500).json({ error: 'Erro ao deletar venda' });
  }
});

// Gerar recibo em PDF
router.get('/receipt/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    
    // Verify sale belongs to user
    const venda = db.prepare('SELECT id FROM vendas WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    
    const pdfBuffer = await generateReceipt(id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=recibo-venda-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar recibo:', error);
    res.status(500).json({ error: 'Erro ao gerar recibo em PDF' });
  }
});

export default router;
