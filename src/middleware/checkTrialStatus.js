import db from '../config/database.js';

// Middleware para verificar status do período de teste
export const checkTrialStatus = (req, res, next) => {
  try {
    const userId = req.user.ownerId;
    
    const user = db.prepare('SELECT status_pagamento, trial_ends_at FROM usuarios WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se está em período de teste
    if (user.status_pagamento === 'Teste') {
      const trialEndsAt = new Date(user.trial_ends_at);
      const now = new Date();
      
      // Verificar se o teste expirou
      if (now > trialEndsAt) {
        // Atualizar status para Pendente
        db.prepare('UPDATE usuarios SET status_pagamento = ? WHERE id = ?').run('Pendente', req.user.ownerId);
        
        return res.status(403).json({ 
          error: 'Seu período de teste expirou. Entre em contato com o suporte para contratar.',
          trialExpired: true
        });
      }
      
      // Calcular dias restantes
      const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));
      
      // Adicionar informação do trial ao request
      req.trial = {
        isActive: true,
        daysLeft: daysLeft,
        endsAt: trialEndsAt
      };
    }
    
    // Se status é Pendente ou Cancelado, bloquear acesso
    if (user.status_pagamento === 'Pendente' || user.status_pagamento === 'Cancelado') {
      return res.status(403).json({ 
        error: 'Acesso bloqueado. Entre em contato com o suporte para ativar sua conta.',
        status: user.status_pagamento
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar status do trial:', error);
    res.status(500).json({ error: 'Erro ao verificar status da conta' });
  }
};

