import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

const initAdminTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      action_type TEXT NOT NULL,
      description TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const defaultSettings = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'system_announcement', value: '' },
    { key: 'trial_period_days', value: '14' },
    { key: 'default_price_monthly', value: '49.90' },
    { key: 'default_price_yearly', value: '499.00' }
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)');
  defaultSettings.forEach(s => insertSetting.run(s.key, s.value));
};

initAdminTables();

router.get('/system-stats', authenticateToken, isAdmin, (req, res) => {
  try {
    const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(valor_total), 0) as total FROM vendas
    `).get();

    const totalProducts = db.prepare(`
      SELECT COUNT(*) as total FROM estoque
    `).get();

    const totalSales = db.prepare(`
      SELECT COUNT(*) as total FROM vendas
    `).get();

    const mostActiveUsers = db.prepare(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        COUNT(v.id) as total_vendas,
        COALESCE(SUM(v.valor_total), 0) as receita_total
      FROM usuarios u
      LEFT JOIN vendas v ON u.id = v.usuario_id
      GROUP BY u.id
      ORDER BY total_vendas DESC
      LIMIT 10
    `).all();

    const revenueByMonth = db.prepare(`
      SELECT 
        strftime('%Y-%m', data_venda) as month,
        COUNT(*) as total_vendas,
        SUM(valor_total) as receita
      FROM vendas
      WHERE data_venda >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', data_venda)
      ORDER BY month DESC
    `).all();

    res.json({
      totalRevenue: totalRevenue.total || 0,
      totalProducts: totalProducts.total || 0,
      totalSales: totalSales.total || 0,
      mostActiveUsers,
      revenueByMonth
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do sistema:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas do sistema' });
  }
});

router.get('/settings', authenticateToken, isAdmin, (req, res) => {
  try {
    const settings = db.prepare('SELECT setting_key, setting_value FROM system_settings').all();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

router.put('/settings', authenticateToken, isAdmin, (req, res) => {
  try {
    const { maintenance_mode, system_announcement, trial_period_days, default_price_monthly, default_price_yearly } = req.body;
    
    const updateSetting = db.prepare('UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?');
    
    if (maintenance_mode !== undefined) updateSetting.run(String(maintenance_mode), 'maintenance_mode');
    if (system_announcement !== undefined) updateSetting.run(system_announcement, 'system_announcement');
    if (trial_period_days !== undefined) updateSetting.run(String(trial_period_days), 'trial_period_days');
    if (default_price_monthly !== undefined) updateSetting.run(String(default_price_monthly), 'default_price_monthly');
    if (default_price_yearly !== undefined) updateSetting.run(String(default_price_yearly), 'default_price_yearly');

    db.prepare(`
      INSERT INTO activity_logs (usuario_id, action_type, description)
      VALUES (?, 'SETTINGS_UPDATE', 'Configurações do sistema atualizadas')
    `).run(req.user.ownerId);

    res.json({ message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

router.get('/activity-logs', authenticateToken, isAdmin, (req, res) => {
  try {
    const { start_date, end_date, action_type, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.nome as usuario_nome,
        u.email as usuario_email
      FROM activity_logs al
      LEFT JOIN usuarios u ON al.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND date(al.created_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date(al.created_at) <= date(?)';
      params.push(end_date);
    }
    if (action_type) {
      query += ' AND al.action_type = ?';
      params.push(action_type);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs de atividade' });
  }
});

router.get('/recent-logins', authenticateToken, isAdmin, (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const logins = db.prepare(`
      SELECT 
        al.*,
        u.nome as usuario_nome,
        u.email as usuario_email
      FROM activity_logs al
      LEFT JOIN usuarios u ON al.usuario_id = u.id
      WHERE al.action_type = 'LOGIN'
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(parseInt(limit));
    res.json(logins);
  } catch (error) {
    console.error('Erro ao buscar logins recentes:', error);
    res.status(500).json({ error: 'Erro ao buscar logins recentes' });
  }
});

router.get('/recent-registrations', authenticateToken, isAdmin, (req, res) => {
  try {
    const { limit = 20, start_date, end_date } = req.query;
    
    let query = `
      SELECT id, nome, email, telefone, status_pagamento, created_at
      FROM usuarios
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND date(created_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date(created_at) <= date(?)';
      params.push(end_date);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const registrations = db.prepare(query).all(...params);
    res.json(registrations);
  } catch (error) {
    console.error('Erro ao buscar registros recentes:', error);
    res.status(500).json({ error: 'Erro ao buscar registros recentes' });
  }
});

router.get('/export/users', authenticateToken, isAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        id, nome, email, telefone, endereco, status_pagamento, 
        datetime(created_at) as created_at
      FROM usuarios
      ORDER BY created_at DESC
    `).all();

    const headers = ['ID', 'Nome', 'Email', 'Telefone', 'Endereco', 'Status Pagamento', 'Data Cadastro'];
    let csv = headers.join(',') + '\n';
    
    users.forEach(user => {
      const row = [
        user.id,
        `"${(user.nome || '').replace(/"/g, '""')}"`,
        `"${(user.email || '').replace(/"/g, '""')}"`,
        `"${(user.telefone || '').replace(/"/g, '""')}"`,
        `"${(user.endereco || '').replace(/"/g, '""')}"`,
        `"${(user.status_pagamento || '').replace(/"/g, '""')}"`,
        `"${user.created_at || ''}"`
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=usuarios.csv');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar usuários:', error);
    res.status(500).json({ error: 'Erro ao exportar usuários' });
  }
});

router.get('/export/revenue', authenticateToken, isAdmin, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        v.id,
        u.nome as usuario,
        u.email,
        v.valor_total,
        datetime(v.data_venda) as data_venda,
        v.produtos
      FROM vendas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND date(v.data_venda) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date(v.data_venda) <= date(?)';
      params.push(end_date);
    }

    query += ' ORDER BY v.data_venda DESC';

    const sales = db.prepare(query).all(...params);

    const headers = ['ID', 'Usuario', 'Email', 'Valor Total', 'Data Venda'];
    let csv = headers.join(',') + '\n';
    
    sales.forEach(sale => {
      const row = [
        sale.id,
        `"${(sale.usuario || '').replace(/"/g, '""')}"`,
        `"${(sale.email || '').replace(/"/g, '""')}"`,
        sale.valor_total,
        `"${sale.data_venda || ''}"`
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-receitas.csv');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar receitas:', error);
    res.status(500).json({ error: 'Erro ao exportar receitas' });
  }
});

router.post('/notifications/broadcast', authenticateToken, isAdmin, (req, res) => {
  try {
    const { title, message, type = 'info' } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    }

    db.prepare(`
      INSERT INTO system_notifications (title, message, type)
      VALUES (?, ?, ?)
    `).run(title, message, type);

    db.prepare(`
      INSERT INTO activity_logs (usuario_id, action_type, description)
      VALUES (?, 'NOTIFICATION_BROADCAST', ?)
    `).run(req.user.ownerId, `Notificação enviada: ${title}`);

    res.json({ message: 'Notificação enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

router.get('/notifications', authenticateToken, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM system_notifications 
      WHERE active = 1
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    res.json(notifications);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

router.get('/notifications/all', authenticateToken, isAdmin, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM system_notifications 
      ORDER BY created_at DESC
    `).all();
    res.json(notifications);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

router.delete('/notifications/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = db.prepare('SELECT id FROM system_notifications WHERE id = ?').get(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    db.prepare('DELETE FROM system_notifications WHERE id = ?').run(id);

    db.prepare(`
      INSERT INTO activity_logs (usuario_id, action_type, description)
      VALUES (?, 'NOTIFICATION_DELETE', ?)
    `).run(req.user.ownerId, `Notificação deletada (ID: ${id})`);

    res.json({ message: 'Notificação deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar notificação:', error);
    res.status(500).json({ error: 'Erro ao deletar notificação' });
  }
});

router.put('/users/bulk-status', authenticateToken, isAdmin, (req, res) => {
  try {
    const { user_ids, new_status } = req.body;
    
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'Lista de usuários é obrigatória' });
    }
    
    if (!['Pago', 'Pendente', 'Trial', 'Cancelado'].includes(new_status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const adminUser = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(process.env.ADMIN_EMAIL);
    const filteredIds = user_ids.filter(id => id !== adminUser?.id);

    if (filteredIds.length === 0) {
      return res.status(400).json({ error: 'Nenhum usuário válido para atualizar' });
    }

    const placeholders = filteredIds.map(() => '?').join(',');
    db.prepare(`UPDATE usuarios SET status_pagamento = ? WHERE id IN (${placeholders})`).run(new_status, ...filteredIds);

    db.prepare(`
      INSERT INTO activity_logs (usuario_id, action_type, description)
      VALUES (?, 'BULK_STATUS_UPDATE', ?)
    `).run(req.user.ownerId, `Status de ${filteredIds.length} usuários atualizado para ${new_status}`);

    res.json({ message: `${filteredIds.length} usuários atualizados com sucesso` });
  } catch (error) {
    console.error('Erro ao atualizar status em massa:', error);
    res.status(500).json({ error: 'Erro ao atualizar status em massa' });
  }
});

router.post('/clear-cache', authenticateToken, isAdmin, (req, res) => {
  try {
    db.prepare(`
      INSERT INTO activity_logs (usuario_id, action_type, description)
      VALUES (?, 'CACHE_CLEAR', 'Cache do sistema limpo')
    `).run(req.user.ownerId);

    res.json({ message: 'Cache do sistema limpo com sucesso' });
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({ error: 'Erro ao limpar cache' });
  }
});

export const logActivity = (userId, actionType, description, ipAddress = null) => {
  try {
    db.prepare(`
      INSERT INTO activity_logs (usuario_id, action_type, description, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(userId, actionType, description, ipAddress);
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
  }
};

export default router;
