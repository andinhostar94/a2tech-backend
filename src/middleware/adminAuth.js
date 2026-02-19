import dotenv from 'dotenv';

dotenv.config();

export const isAdmin = (req, res, next) => {
  // Verifica se o usuário está autenticado (middleware auth deve vir antes)
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  // Verifica se o email é o do admin
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
  }

  next();
};

export default isAdmin;
