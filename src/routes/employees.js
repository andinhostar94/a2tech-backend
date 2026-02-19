import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Login de funcionário
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const funcionario = db.prepare(`
      SELECT f.*, u.nome as empresa_nome, u.status_pagamento, u.trial_ends_at
      FROM funcionarios f
      JOIN usuarios u ON f.usuario_id = u.id
      WHERE f.email = ? AND f.ativo = 1
    `).get(email);

    if (!funcionario) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    if (!funcionario.senha) {
      return res.status(401).json({ error: 'Conta de funcionário não configurada. Solicite uma senha ao administrador.' });
    }

    const validPassword = await bcrypt.compare(senha, funcionario.senha);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Verificar status do usuário principal
    if (funcionario.status_pagamento === 'Pendente' || funcionario.status_pagamento === 'Cancelado') {
      return res.status(403).json({ error: 'Conta da empresa bloqueada. Entre em contato com o administrador.' });
    }

    // Atualizar último acesso
    db.prepare('UPDATE funcionarios SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = ?').run(funcionario.id);

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: funcionario.id, 
        email: funcionario.email, 
        nome: funcionario.nome,
        funcao: funcionario.funcao,
        usuario_id: funcionario.usuario_id,
        isEmployee: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Retornar dados (sem a senha)
    const { senha: _, ...funcionarioData } = funcionario;

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        ...funcionarioData,
        isEmployee: true
      }
    });
  } catch (error) {
    console.error('Erro no login de funcionário:', error);
    res.status(500).json({ error: 'Erro ao realizar login' });
  }
});

// Cadastrar funcionário (apenas donos podem criar funcionários)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Verificar se não é funcionário (apenas donos podem criar funcionários)
    if (req.user.isEmployee) {
      return res.status(403).json({ error: 'Apenas o proprietário pode cadastrar funcionários' });
    }

    const { nome, email, funcao, senha, permissoes } = req.body;

    if (!nome || !email || !funcao) {
      return res.status(400).json({ error: 'Nome, email e função são obrigatórios' });
    }

    const validFuncoes = ['vendedor', 'estoque', 'suporte', 'gerente', 'admin'];
    if (!validFuncoes.includes(funcao)) {
      return res.status(400).json({ error: 'Função inválida. Use: vendedor, estoque, suporte, gerente ou admin' });
    }

    // Validar senha se fornecida
    if (senha && senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    // Verificar se email já existe
    const existingEmployee = db.prepare('SELECT id FROM funcionarios WHERE email = ?').get(email);
    if (existingEmployee) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const usuario_id = req.user.ownerId;
    
    // Validar que o ownerId existe
    if (!usuario_id) {
      console.error('Erro ao cadastrar funcionário: ownerId não encontrado no token', req.user);
      return res.status(400).json({ error: 'Erro de autenticação. Por favor, faça login novamente.' });
    }
    
    // Hash da senha se fornecida
    let hashedPassword = null;
    if (senha) {
      hashedPassword = await bcrypt.hash(senha, 10);
    }

    let permissoesJson = '[]';
    if (permissoes) {
      try {
        permissoesJson = typeof permissoes === 'string' ? permissoes : JSON.stringify(permissoes);
      } catch (e) {
        console.error('Erro ao serializar permissões:', e);
        permissoesJson = '[]';
      }
    }
    
    const result = db.prepare(`
      INSERT INTO funcionarios (usuario_id, nome, email, funcao, senha, permissoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(usuario_id, nome, email, funcao, hashedPassword, permissoesJson);

    res.status(201).json({
      message: 'Funcionário cadastrado com sucesso',
      funcionarioId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Erro ao cadastrar funcionário:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Email já cadastrado para outro funcionário' });
    }
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({ error: 'Usuário associado não encontrado' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar funcionário: ' + error.message });
  }
});

// Definir/atualizar senha de funcionário (apenas donos)
router.put('/:id/password', authenticateToken, async (req, res) => {
  try {
    // Verificar se não é funcionário (apenas donos podem alterar senhas)
    if (req.user.isEmployee) {
      return res.status(403).json({ error: 'Apenas o proprietário pode alterar senhas de funcionários' });
    }

    const { id } = req.params;
    const { senha } = req.body;
    const usuario_id = req.user.ownerId;

    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Verificar se o funcionário pertence ao usuário
    const funcionario = db.prepare('SELECT id FROM funcionarios WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!funcionario) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    db.prepare('UPDATE funcionarios SET senha = ? WHERE id = ?').run(hashedPassword, id);

    res.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ error: 'Erro ao atualizar senha do funcionário' });
  }
});

// Listar funcionários do usuário logado (com paginação)
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Buscar total de funcionários
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM funcionarios
      WHERE usuario_id = ?
    `).get(usuario_id).count;

    // Buscar funcionários com paginação
    const funcionarios = db.prepare(`
      SELECT *
      FROM funcionarios
      WHERE usuario_id = ?
      ORDER BY nome
      LIMIT ? OFFSET ?
    `).all(usuario_id, limit, offset);

    res.json({
      funcionarios,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar funcionários:', error);
    res.status(500).json({ error: 'Erro ao listar funcionários' });
  }
});

// Buscar funcionário específico
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ? AND usuario_id = ?').get(id, usuario_id);

    if (!funcionario) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    res.json(funcionario);
  } catch (error) {
    console.error('Erro ao buscar funcionário:', error);
    res.status(500).json({ error: 'Erro ao buscar funcionário' });
  }
});

// Atualizar funcionário
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    const { nome, email, funcao, ativo } = req.body;
    
    // Verificar se o funcionário pertence ao usuário
    const funcionario = db.prepare('SELECT id FROM funcionarios WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!funcionario) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

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
    if (funcao) {
      const validFuncoes = ['vendedor', 'estoque', 'suporte', 'gerente', 'admin'];
      if (!validFuncoes.includes(funcao)) {
        return res.status(400).json({ error: 'Função inválida' });
      }
      updates.push('funcao = ?');
      values.push(funcao);
    }
    if (ativo !== undefined) {
      updates.push('ativo = ?');
      values.push(ativo ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const query = `UPDATE funcionarios SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    res.json({ message: 'Funcionário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});

// Deletar funcionário
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.ownerId;
    
    // Verificar se o funcionário pertence ao usuário
    const funcionario = db.prepare('SELECT id FROM funcionarios WHERE id = ? AND usuario_id = ?').get(id, usuario_id);
    if (!funcionario) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }
    
    db.prepare('DELETE FROM funcionarios WHERE id = ?').run(id);
    res.json({ message: 'Funcionário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar funcionário:', error);
    res.status(500).json({ error: 'Erro ao deletar funcionário' });
  }
});

export default router;
