import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/status', (req, res) => {
  try {
    const maintenanceSetting = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').get('maintenance_mode');
    const announcementSetting = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').get('system_announcement');
    
    const isMaintenanceMode = maintenanceSetting && maintenanceSetting.setting_value === 'true';
    
    res.json({
      maintenance: isMaintenanceMode,
      message: isMaintenanceMode ? (announcementSetting?.setting_value || 'Sistema em manutenção') : null,
      status: isMaintenanceMode ? 'maintenance' : 'online'
    });
  } catch (error) {
    console.error('Erro ao verificar status do sistema:', error);
    res.json({ maintenance: false, status: 'online' });
  }
});

router.get('/notifications', (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT id, title, message, type, created_at 
      FROM system_notifications 
      WHERE active = 1 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all();
    res.json(notifications);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.json([]);
  }
});

router.post('/notifications/:id/dismiss', (req, res) => {
  res.json({ success: true });
});

export default router;
