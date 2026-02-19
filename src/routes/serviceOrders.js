import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Gerar número de OS automático
function gerarNumeroOS(usuario_id) {
  const ano = new Date().getFullYear();
  const ultimaOS = db.prepare(`
    SELECT numero_os FROM ordens_servico 
    WHERE usuario_id = ? AND numero_os LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(usuario_id, `OS${ano}%`);

  let sequencial = 1;
  if (ultimaOS) {
    const match = ultimaOS.numero_os.match(/OS\d{4}(\d+)/);
    if (match) {
      sequencial = parseInt(match[1]) + 1;
    }
  }

  return `OS${ano}${String(sequencial).padStart(5, '0')}`;
}

// Listar ordens de serviço com filtros
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { status, cliente_id, data_inicio, data_fim } = req.query;

    let query = `
      SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
             f.nome as funcionario_nome
      FROM ordens_servico os
      LEFT JOIN clientes c ON os.cliente_id = c.id
      LEFT JOIN funcionarios f ON os.funcionario_id = f.id
      WHERE os.usuario_id = ?
    `;
    const params = [usuario_id];

    if (status) {
      query += ' AND os.status = ?';
      params.push(status);
    }

    if (cliente_id) {
      query += ' AND os.cliente_id = ?';
      params.push(cliente_id);
    }

    if (data_inicio) {
      query += ' AND DATE(os.data_entrada) >= ?';
      params.push(data_inicio);
    }

    if (data_fim) {
      query += ' AND DATE(os.data_entrada) <= ?';
      params.push(data_fim);
    }

    query += ' ORDER BY os.data_entrada DESC';

    const ordens = db.prepare(query).all(...params);

    res.json(ordens);
  } catch (error) {
    console.error('Erro ao listar ordens de serviço:', error);
    res.status(500).json({ error: 'Erro ao listar ordens de serviço' });
  }
});

// Criar ordem de serviço
router.post('/', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { 
      cliente_id, funcionario_id, equipamento, marca, modelo, numero_serie, cor,
      acessorios, defeito_relatado, prioridade, data_previsao, observacoes,
      valor_servico, valor_pecas
    } = req.body;

    if (!equipamento || !defeito_relatado) {
      return res.status(400).json({ error: 'Equipamento e defeito relatado são obrigatórios' });
    }

    const numero_os = gerarNumeroOS(usuario_id);
    const valor_total = (valor_servico || 0) + (valor_pecas || 0);

    const result = db.prepare(`
      INSERT INTO ordens_servico (
        usuario_id, cliente_id, funcionario_id, numero_os, equipamento, marca, modelo,
        numero_serie, cor, acessorios, defeito_relatado, prioridade, data_previsao,
        observacoes, valor_servico, valor_pecas, valor_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, cliente_id || null, funcionario_id || null, numero_os,
      equipamento, marca || null, modelo || null, numero_serie || null, cor || null,
      acessorios || null, defeito_relatado, prioridade || 'normal', data_previsao || null,
      observacoes || null, valor_servico || 0, valor_pecas || 0, valor_total
    );

    res.status(201).json({
      message: 'Ordem de serviço criada com sucesso',
      ordemId: result.lastInsertRowid,
      numero_os
    });
  } catch (error) {
    console.error('Erro ao criar ordem de serviço:', error);
    res.status(500).json({ error: 'Erro ao criar ordem de serviço' });
  }
});

// Buscar ordem de serviço específica
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const ordem = db.prepare(`
      SELECT os.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email,
             f.nome as funcionario_nome, fp.nome as forma_pagamento_nome
      FROM ordens_servico os
      LEFT JOIN clientes c ON os.cliente_id = c.id
      LEFT JOIN funcionarios f ON os.funcionario_id = f.id
      LEFT JOIN formas_pagamento fp ON os.forma_pagamento_id = fp.id
      WHERE os.id = ? AND os.usuario_id = ?
    `).get(id, usuario_id);

    if (!ordem) {
      return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    }

    res.json(ordem);
  } catch (error) {
    console.error('Erro ao buscar ordem de serviço:', error);
    res.status(500).json({ error: 'Erro ao buscar ordem de serviço' });
  }
});

// Atualizar ordem de serviço
router.put('/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { 
      cliente_id, funcionario_id, equipamento, marca, modelo, numero_serie, cor,
      acessorios, defeito_relatado, laudo_tecnico, servico_realizado, pecas_utilizadas,
      valor_pecas, valor_servico, valor_pago, forma_pagamento_id, status, prioridade,
      data_previsao, data_conclusao, data_entrega, observacoes
    } = req.body;

    const ordem = db.prepare('SELECT id FROM ordens_servico WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!ordem) {
      return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    }

    const updates = [];
    const values = [];

    if (cliente_id !== undefined) { updates.push('cliente_id = ?'); values.push(cliente_id); }
    if (funcionario_id !== undefined) { updates.push('funcionario_id = ?'); values.push(funcionario_id); }
    if (equipamento !== undefined) { updates.push('equipamento = ?'); values.push(equipamento); }
    if (marca !== undefined) { updates.push('marca = ?'); values.push(marca); }
    if (modelo !== undefined) { updates.push('modelo = ?'); values.push(modelo); }
    if (numero_serie !== undefined) { updates.push('numero_serie = ?'); values.push(numero_serie); }
    if (cor !== undefined) { updates.push('cor = ?'); values.push(cor); }
    if (acessorios !== undefined) { updates.push('acessorios = ?'); values.push(acessorios); }
    if (defeito_relatado !== undefined) { updates.push('defeito_relatado = ?'); values.push(defeito_relatado); }
    if (laudo_tecnico !== undefined) { updates.push('laudo_tecnico = ?'); values.push(laudo_tecnico); }
    if (servico_realizado !== undefined) { updates.push('servico_realizado = ?'); values.push(servico_realizado); }
    if (pecas_utilizadas !== undefined) { updates.push('pecas_utilizadas = ?'); values.push(pecas_utilizadas); }
    if (valor_pecas !== undefined) { updates.push('valor_pecas = ?'); values.push(valor_pecas); }
    if (valor_servico !== undefined) { updates.push('valor_servico = ?'); values.push(valor_servico); }
    if (valor_pago !== undefined) { updates.push('valor_pago = ?'); values.push(valor_pago); }
    if (forma_pagamento_id !== undefined) { updates.push('forma_pagamento_id = ?'); values.push(forma_pagamento_id); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (prioridade !== undefined) { updates.push('prioridade = ?'); values.push(prioridade); }
    if (data_previsao !== undefined) { updates.push('data_previsao = ?'); values.push(data_previsao); }
    if (data_conclusao !== undefined) { updates.push('data_conclusao = ?'); values.push(data_conclusao); }
    if (data_entrega !== undefined) { updates.push('data_entrega = ?'); values.push(data_entrega); }
    if (observacoes !== undefined) { updates.push('observacoes = ?'); values.push(observacoes); }

    // Recalcular valor total se pecas ou servico foram atualizados
    if (valor_pecas !== undefined || valor_servico !== undefined) {
      const ordemAtual = db.prepare('SELECT valor_pecas, valor_servico FROM ordens_servico WHERE id = ?').get(id);
      const novoPecas = valor_pecas !== undefined ? valor_pecas : ordemAtual.valor_pecas;
      const novoServico = valor_servico !== undefined ? valor_servico : ordemAtual.valor_servico;
      updates.push('valor_total = ?');
      values.push(novoPecas + novoServico);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE ordens_servico SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Ordem de serviço atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar ordem de serviço:', error);
    res.status(500).json({ error: 'Erro ao atualizar ordem de serviço' });
  }
});

// Atualizar status da ordem de serviço
router.put('/:id/status', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    const statusValidos = ['aguardando', 'em_analise', 'aprovado', 'em_andamento', 'concluido', 'entregue', 'cancelado'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ error: 'Status inválido. Use: ' + statusValidos.join(', ') });
    }

    const ordem = db.prepare('SELECT id FROM ordens_servico WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!ordem) {
      return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    }

    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];

    // Atualizar datas automaticamente baseado no status
    if (status === 'concluido') {
      updates.push('data_conclusao = ?');
      values.push(new Date().toISOString().split('T')[0]);
    } else if (status === 'entregue') {
      updates.push('data_entrega = ?');
      values.push(new Date().toISOString().split('T')[0]);
    }

    values.push(id);

    db.prepare(`UPDATE ordens_servico SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Status atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Deletar ordem de serviço
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const ordem = db.prepare('SELECT id FROM ordens_servico WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!ordem) {
      return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    }

    db.prepare('DELETE FROM ordens_servico WHERE id = ?').run(id);
    res.json({ message: 'Ordem de serviço deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar ordem de serviço:', error);
    res.status(500).json({ error: 'Erro ao deletar ordem de serviço' });
  }
});

export default router;
