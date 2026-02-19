import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      console.error('Token inválido - ID do usuário não encontrado:', decoded);
      return res.status(403).json({ error: 'Token inválido - informações do usuário não encontradas' });
    }
    
    req.user = decoded;
    
    // For employees, set ownerId to the owner's usuario_id for querying data
    // For owners, ownerId is their own id
    if (decoded.isEmployee) {
      if (!decoded.usuario_id) {
        console.error('Token de funcionário inválido - usuario_id não encontrado:', decoded);
        return res.status(403).json({ error: 'Token de funcionário inválido' });
      }
      req.user.ownerId = decoded.usuario_id;
      req.user.employeeId = decoded.id;
    } else {
      req.user.ownerId = decoded.id;
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error.message);
    return res.status(403).json({ error: 'Token inválido ou expirado' });
  }
};

export default authenticateToken;
