import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkTrialStatus } from '../middleware/checkTrialStatus.js';

const router = express.Router();

// Obter configurações de fidelidade
router.get('/config', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;

    let config = db.prepare('SELECT * FROM config_fidelidade WHERE usuario_id = ?').get(usuario_id);

    if (!config) {
      db.prepare(`
        INSERT INTO config_fidelidade (usuario_id) VALUES (?)
      `).run(usuario_id);
      config = db.prepare('SELECT * FROM config_fidelidade WHERE usuario_id = ?').get(usuario_id);
    }

    res.json(config);
  } catch (error) {
    console.error('Erro ao obter configurações de fidelidade:', error);
    res.status(500).json({ error: 'Erro ao obter configurações' });
  }
});

// Atualizar configurações de fidelidade
router.put('/config', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { ativo, pontos_por_real, minimo_resgate, validade_pontos_dias, bonus_aniversario } = req.body;

    let config = db.prepare('SELECT id FROM config_fidelidade WHERE usuario_id = ?').get(usuario_id);

    if (!config) {
      db.prepare('INSERT INTO config_fidelidade (usuario_id) VALUES (?)').run(usuario_id);
    }

    const updates = [];
    const values = [];

    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo ? 1 : 0); }
    if (pontos_por_real !== undefined) { updates.push('pontos_por_real = ?'); values.push(pontos_por_real); }
    if (minimo_resgate !== undefined) { updates.push('minimo_resgate = ?'); values.push(minimo_resgate); }
    if (validade_pontos_dias !== undefined) { updates.push('validade_pontos_dias = ?'); values.push(validade_pontos_dias); }
    if (bonus_aniversario !== undefined) { updates.push('bonus_aniversario = ?'); values.push(bonus_aniversario); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(usuario_id);

    db.prepare(`UPDATE config_fidelidade SET ${updates.join(', ')} WHERE usuario_id = ?`).run(...values);

    res.json({ message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

// Listar prêmios
router.get('/rewards', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const premios = db.prepare(`
      SELECT p.*, e.produto as produto_nome
      FROM premios_fidelidade p
      LEFT JOIN estoque e ON p.produto_id = e.id
      WHERE p.usuario_id = ?
      ORDER BY p.pontos_necessarios ASC
    `).all(usuario_id);

    res.json(premios);
  } catch (error) {
    console.error('Erro ao listar prêmios:', error);
    res.status(500).json({ error: 'Erro ao listar prêmios' });
  }
});

// Criar prêmio
router.post('/rewards', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { nome, descricao, pontos_necessarios, tipo, valor_desconto, produto_id } = req.body;

    if (!nome || !pontos_necessarios || !tipo) {
      return res.status(400).json({ error: 'Nome, pontos necessários e tipo são obrigatórios' });
    }

    const tiposValidos = ['desconto_percentual', 'desconto_fixo', 'produto', 'servico'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: ' + tiposValidos.join(', ') });
    }

    const result = db.prepare(`
      INSERT INTO premios_fidelidade (
        usuario_id, nome, descricao, pontos_necessarios, tipo, valor_desconto, produto_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, nome, descricao || null, pontos_necessarios, tipo,
      valor_desconto || null, produto_id || null
    );

    res.status(201).json({
      message: 'Prêmio criado com sucesso',
      premioId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao criar prêmio:', error);
    res.status(500).json({ error: 'Erro ao criar prêmio' });
  }
});

// Atualizar prêmio
router.put('/rewards/:id', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { nome, descricao, pontos_necessarios, tipo, valor_desconto, produto_id, ativo } = req.body;

    const premio = db.prepare('SELECT id FROM premios_fidelidade WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!premio) {
      return res.status(404).json({ error: 'Prêmio não encontrado' });
    }

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
    if (pontos_necessarios !== undefined) { updates.push('pontos_necessarios = ?'); values.push(pontos_necessarios); }
    if (tipo !== undefined) { updates.push('tipo = ?'); values.push(tipo); }
    if (valor_desconto !== undefined) { updates.push('valor_desconto = ?'); values.push(valor_desconto); }
    if (produto_id !== undefined) { updates.push('produto_id = ?'); values.push(produto_id); }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);

    db.prepare(`UPDATE premios_fidelidade SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Prêmio atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar prêmio:', error);
    res.status(500).json({ error: 'Erro ao atualizar prêmio' });
  }
});

// Deletar prêmio
router.delete('/rewards/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const premio = db.prepare('SELECT id FROM premios_fidelidade WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!premio) {
      return res.status(404).json({ error: 'Prêmio não encontrado' });
    }

    db.prepare('DELETE FROM premios_fidelidade WHERE id = ?').run(id);
    res.json({ message: 'Prêmio deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar prêmio:', error);
    res.status(500).json({ error: 'Erro ao deletar prêmio' });
  }
});

// Listar clientes com pontos
router.get('/customers', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const clientes = db.prepare(`
      SELECT c.id, c.nome, c.email, c.telefone,
             COALESCE(fc.pontos_acumulados, 0) as pontos_acumulados,
             COALESCE(fc.pontos_utilizados, 0) as pontos_utilizados,
             COALESCE(fc.pontos_acumulados, 0) - COALESCE(fc.pontos_utilizados, 0) as pontos_disponiveis,
             COALESCE(fc.nivel, 'bronze') as nivel
      FROM clientes c
      LEFT JOIN fidelidade_clientes fc ON c.id = fc.cliente_id AND fc.usuario_id = ?
      WHERE c.usuario_id = ?
      ORDER BY pontos_disponiveis DESC
    `).all(usuario_id, usuario_id);

    res.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes com pontos:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// Obter pontos de um cliente específico
router.get('/customers/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;

    const cliente = db.prepare(`
      SELECT c.id, c.nome, c.email, c.telefone,
             COALESCE(fc.pontos_acumulados, 0) as pontos_acumulados,
             COALESCE(fc.pontos_utilizados, 0) as pontos_utilizados,
             COALESCE(fc.pontos_acumulados, 0) - COALESCE(fc.pontos_utilizados, 0) as pontos_disponiveis,
             COALESCE(fc.nivel, 'bronze') as nivel
      FROM clientes c
      LEFT JOIN fidelidade_clientes fc ON c.id = fc.cliente_id AND fc.usuario_id = ?
      WHERE c.id = ? AND c.usuario_id = ?
    `).get(usuario_id, id, usuario_id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const historico = db.prepare(`
      SELECT * FROM historico_fidelidade
      WHERE cliente_id = ? AND usuario_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(id, usuario_id);

    res.json({ ...cliente, historico });
  } catch (error) {
    console.error('Erro ao buscar pontos do cliente:', error);
    res.status(500).json({ error: 'Erro ao buscar pontos do cliente' });
  }
});

// Adicionar ou remover pontos
router.post('/customers/:id/points', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { pontos, tipo, descricao, venda_id, ordem_servico_id } = req.body;

    if (pontos === undefined || !tipo) {
      return res.status(400).json({ error: 'Pontos e tipo são obrigatórios' });
    }

    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    let fidelidade = db.prepare('SELECT * FROM fidelidade_clientes WHERE cliente_id = ? AND usuario_id = ?').get(id, usuario_id);

    if (!fidelidade) {
      db.prepare(`
        INSERT INTO fidelidade_clientes (usuario_id, cliente_id)
        VALUES (?, ?)
      `).run(usuario_id, id);
      fidelidade = { pontos_acumulados: 0, pontos_utilizados: 0 };
    }

    if (tipo === 'ganho' || tipo === 'ajuste') {
      db.prepare(`
        UPDATE fidelidade_clientes 
        SET pontos_acumulados = pontos_acumulados + ?, updated_at = CURRENT_TIMESTAMP
        WHERE cliente_id = ? AND usuario_id = ?
      `).run(Math.abs(pontos), id, usuario_id);
    } else if (tipo === 'resgate' || tipo === 'expiracao') {
      const disponiveis = fidelidade.pontos_acumulados - fidelidade.pontos_utilizados;
      if (Math.abs(pontos) > disponiveis) {
        return res.status(400).json({ error: 'Pontos insuficientes' });
      }
      db.prepare(`
        UPDATE fidelidade_clientes 
        SET pontos_utilizados = pontos_utilizados + ?, updated_at = CURRENT_TIMESTAMP
        WHERE cliente_id = ? AND usuario_id = ?
      `).run(Math.abs(pontos), id, usuario_id);
    }

    db.prepare(`
      INSERT INTO historico_fidelidade (
        usuario_id, cliente_id, tipo, pontos, descricao, venda_id, ordem_servico_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(usuario_id, id, tipo, pontos, descricao || null, venda_id || null, ordem_servico_id || null);

    // Atualizar nível do cliente
    const fidelidadeAtualizada = db.prepare('SELECT pontos_acumulados FROM fidelidade_clientes WHERE cliente_id = ? AND usuario_id = ?').get(id, usuario_id);
    let novoNivel = 'bronze';
    if (fidelidadeAtualizada.pontos_acumulados >= 10000) novoNivel = 'diamante';
    else if (fidelidadeAtualizada.pontos_acumulados >= 5000) novoNivel = 'ouro';
    else if (fidelidadeAtualizada.pontos_acumulados >= 1000) novoNivel = 'prata';

    db.prepare('UPDATE fidelidade_clientes SET nivel = ? WHERE cliente_id = ? AND usuario_id = ?').run(novoNivel, id, usuario_id);

    res.json({ message: 'Pontos atualizados com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar pontos:', error);
    res.status(500).json({ error: 'Erro ao atualizar pontos' });
  }
});

// Resgatar prêmio
router.post('/customers/:id/redeem', authenticateToken, checkTrialStatus, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { premio_id } = req.body;

    if (!premio_id) {
      return res.status(400).json({ error: 'ID do prêmio é obrigatório' });
    }

    const cliente = db.prepare('SELECT id, nome FROM clientes WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const premio = db.prepare('SELECT * FROM premios_fidelidade WHERE id = ? AND usuario_id = ? AND ativo = 1').get(premio_id, usuario_id);
    if (!premio) {
      return res.status(404).json({ error: 'Prêmio não encontrado ou inativo' });
    }

    const fidelidade = db.prepare('SELECT * FROM fidelidade_clientes WHERE cliente_id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!fidelidade) {
      return res.status(400).json({ error: 'Cliente não possui programa de fidelidade' });
    }

    const pontosDisponiveis = fidelidade.pontos_acumulados - fidelidade.pontos_utilizados;
    if (pontosDisponiveis < premio.pontos_necessarios) {
      return res.status(400).json({ 
        error: 'Pontos insuficientes',
        pontos_disponiveis: pontosDisponiveis,
        pontos_necessarios: premio.pontos_necessarios
      });
    }

    db.prepare(`
      UPDATE fidelidade_clientes 
      SET pontos_utilizados = pontos_utilizados + ?, updated_at = CURRENT_TIMESTAMP
      WHERE cliente_id = ? AND usuario_id = ?
    `).run(premio.pontos_necessarios, id, usuario_id);

    db.prepare(`
      INSERT INTO historico_fidelidade (
        usuario_id, cliente_id, tipo, pontos, descricao, premio_id
      ) VALUES (?, ?, 'resgate', ?, ?, ?)
    `).run(usuario_id, id, -premio.pontos_necessarios, `Resgate: ${premio.nome}`, premio_id);

    res.json({ 
      message: 'Prêmio resgatado com sucesso',
      premio: premio.nome,
      pontos_utilizados: premio.pontos_necessarios
    });
  } catch (error) {
    console.error('Erro ao resgatar prêmio:', error);
    res.status(500).json({ error: 'Erro ao resgatar prêmio' });
  }
});

export default router;
