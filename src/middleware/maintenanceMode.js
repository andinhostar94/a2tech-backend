import jwt from 'jsonwebtoken';
import db from '../config/database.js';

export const checkMaintenanceMode = (req, res, next) => {
  try {
    const setting = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').get('maintenance_mode');
    const isMaintenanceMode = setting && setting.setting_value === 'true';
    
    if (!isMaintenanceMode) {
      return next();
    }
    
    const fullPath = req.baseUrl + req.path;
    
    const publicPaths = [
      '/api/health',
      '/api/system',
      '/api/auth/login',
      '/api/auth/verify',
      '/api/auth/register'
    ];
    
    if (publicPaths.some(path => fullPath.startsWith(path))) {
      return next();
    }
    
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.email === process.env.ADMIN_EMAIL) {
            return next();
          }
        } catch (e) {
        }
      }
    }
    
    const announcement = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').get('system_announcement');
    
    return res.status(503).json({
      error: 'Sistema em manutenção',
      maintenance: true,
      message: announcement?.setting_value || 'O sistema está temporariamente indisponível para manutenção. Tente novamente mais tarde.'
    });
  } catch (error) {
    console.error('Erro ao verificar modo de manutenção:', error);
    next();
  }
};

export default checkMaintenanceMode;
