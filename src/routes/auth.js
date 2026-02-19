import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';

const router = express.Router();

const logActivity = (userId, actionType, description, ipAddress = null) => {
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='activity_logs'").get();
    if (tableExists) {
      db.prepare(`
        INSERT INTO activity_logs (usuario_id, action_type, description, ip_address)
        VALUES (?, ?, ?, ?)
      `).run(userId, actionType, description, ipAddress);
    }
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
  }
};

// Registro de usuário (com rate limiting e validação)
router.post('/register', registerLimiter, validateRequest(registerSchema), async (req, res) => {
  try {
    const { nome, email, senha, telefone, endereco } = req.body;

    // Validações
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Verificar se email já existe
    const existingUser = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Calcular data de fim do período de teste (14 dias)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Inserir usuário com status Teste e período de trial de 14 dias
    const result = db.prepare(`
      INSERT INTO usuarios (nome, email, senha, telefone, endereco, status_pagamento, trial_ends_at)
      VALUES (?, ?, ?, ?, ?, 'Teste', ?)
    `).run(nome, email, hashedPassword, telefone || null, endereco || null, trialEndsAt.toISOString());

    logActivity(result.lastInsertRowid, 'REGISTER', `Novo usuário registrado: ${email}`);

    res.status(201).json({
      message: 'Cadastro realizado com sucesso! Você tem 14 dias de teste grátis.',
      userId: result.lastInsertRowid,
      trialEndsAt: trialEndsAt.toISOString()
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// Login (com rate limiting e validação)
router.post('/login', authLimiter, validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Validações
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(senha, user.senha);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        nome: user.nome,
        status_pagamento: user.status_pagamento
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logActivity(user.id, 'LOGIN', `Login realizado: ${email}`, req.ip);

    // Retornar dados (sem a senha)
    const { senha: _, ...userData } = user;

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao realizar login' });
  }
});

// Verificar token
router.get('/verify', authenticateToken, (req, res) => {
  try {
    if (req.user.isEmployee) {
      // Employee token - fetch from funcionarios table
      const funcionario = db.prepare(`
        SELECT f.*, u.nome as empresa_nome, u.status_pagamento 
        FROM funcionarios f
        JOIN usuarios u ON f.usuario_id = u.id
        WHERE f.id = ?
      `).get(req.user.employeeId);
      
      if (!funcionario) {
        return res.status(404).json({ error: 'Funcionário não encontrado' });
      }
      const { senha: _, ...funcionarioData } = funcionario;
      return res.json({ valid: true, user: { ...funcionarioData, isEmployee: true } });
    }
    
    // Owner token - fetch from usuarios table
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.ownerId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const { senha: _, ...userData } = user;
    res.json({ valid: true, user: userData });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(500).json({ error: 'Erro ao verificar token' });
  }
});

// Verificar status do trial
router.get('/trial-status', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT status_pagamento, trial_ends_at FROM usuarios WHERE id = ?').get(req.user.ownerId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const response = {
      status: user.status_pagamento,
      isPaid: user.status_pagamento === 'Pago',
      isBlocked: user.status_pagamento === 'Pendente' || user.status_pagamento === 'Cancelado'
    };

    // Se está em período de teste, calcular dias restantes
    if (user.status_pagamento === 'Teste' && user.trial_ends_at) {
      const trialEndsAt = new Date(user.trial_ends_at);
      const now = new Date();
      const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));
      
      response.trial = {
        isActive: true,
        daysLeft: Math.max(0, daysLeft),
        endsAt: trialEndsAt.toISOString(),
        isExpired: daysLeft <= 0
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Erro ao verificar status do trial:', error);
    res.status(500).json({ error: 'Erro ao verificar status da conta' });
  }
});

export default router;
