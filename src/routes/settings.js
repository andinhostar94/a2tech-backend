import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Buscar configurações da loja
router.get('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    
    if (!usuario_id) {
      console.error('Erro ao buscar configurações: ownerId não encontrado', req.user);
      return res.status(400).json({ error: 'Erro de autenticação. Por favor, faça login novamente.' });
    }
    
    let settings = db.prepare(`
      SELECT * FROM configuracoes_loja WHERE usuario_id = ?
    `).get(usuario_id);
    
    if (!settings) {
      const user = db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(usuario_id);
      settings = {
        usuario_id,
        nome_loja: user?.nome || 'Minha Loja',
        logo_url: null,
        endereco: '',
        telefone: '',
        email_contato: '',
        cor_primaria: '#0066cc',
        cor_secundaria: '#004499',
        mensagem_recibo: 'Obrigado pela preferência!',
        cnpj: '',
        inscricao_estadual: '',
        horario_funcionamento: '',
        redes_sociais: '{}'
      };
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Atualizar configurações da loja
router.put('/', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    
    if (!usuario_id) {
      console.error('Erro ao atualizar configurações: ownerId não encontrado', req.user);
      return res.status(400).json({ error: 'Erro de autenticação. Por favor, faça login novamente.' });
    }
    
    const {
      nome_loja,
      logo_url,
      endereco,
      telefone,
      email_contato,
      cor_primaria,
      cor_secundaria,
      mensagem_recibo,
      cnpj,
      inscricao_estadual,
      horario_funcionamento,
      redes_sociais
    } = req.body;
    
    const existing = db.prepare('SELECT id FROM configuracoes_loja WHERE usuario_id = ?').get(usuario_id);
    
    if (existing) {
      db.prepare(`
        UPDATE configuracoes_loja SET
          nome_loja = COALESCE(?, nome_loja),
          logo_url = COALESCE(?, logo_url),
          endereco = COALESCE(?, endereco),
          telefone = COALESCE(?, telefone),
          email_contato = COALESCE(?, email_contato),
          cor_primaria = COALESCE(?, cor_primaria),
          cor_secundaria = COALESCE(?, cor_secundaria),
          mensagem_recibo = COALESCE(?, mensagem_recibo),
          cnpj = COALESCE(?, cnpj),
          inscricao_estadual = COALESCE(?, inscricao_estadual),
          horario_funcionamento = COALESCE(?, horario_funcionamento),
          redes_sociais = COALESCE(?, redes_sociais),
          updated_at = CURRENT_TIMESTAMP
        WHERE usuario_id = ?
      `).run(
        nome_loja, logo_url, endereco, telefone, email_contato,
        cor_primaria, cor_secundaria, mensagem_recibo,
        cnpj, inscricao_estadual, horario_funcionamento,
        typeof redes_sociais === 'object' ? JSON.stringify(redes_sociais) : redes_sociais,
        usuario_id
      );
    } else {
      db.prepare(`
        INSERT INTO configuracoes_loja (
          usuario_id, nome_loja, logo_url, endereco, telefone, email_contato,
          cor_primaria, cor_secundaria, mensagem_recibo, cnpj, inscricao_estadual,
          horario_funcionamento, redes_sociais
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        usuario_id,
        nome_loja || 'Minha Loja',
        logo_url || null,
        endereco || '',
        telefone || '',
        email_contato || '',
        cor_primaria || '#0066cc',
        cor_secundaria || '#004499',
        mensagem_recibo || 'Obrigado pela preferência!',
        cnpj || '',
        inscricao_estadual || '',
        horario_funcionamento || '',
        typeof redes_sociais === 'object' ? JSON.stringify(redes_sociais) : (redes_sociais || '{}')
      );
    }
    
    const updatedSettings = db.prepare('SELECT * FROM configuracoes_loja WHERE usuario_id = ?').get(usuario_id);
    
    res.json({
      message: 'Configurações atualizadas com sucesso',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({ error: 'Usuário associado não encontrado' });
    }
    res.status(500).json({ error: 'Erro ao atualizar configurações: ' + error.message });
  }
});

// Upload de logo (rota separada para upload de arquivo)
router.post('/logo', authenticateToken, (req, res) => {
  try {
    const usuario_id = req.user.ownerId;
    const { logo_url } = req.body;
    
    if (!logo_url) {
      return res.status(400).json({ error: 'URL da logo é obrigatória' });
    }
    
    const existing = db.prepare('SELECT id FROM configuracoes_loja WHERE usuario_id = ?').get(usuario_id);
    
    if (existing) {
      db.prepare('UPDATE configuracoes_loja SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE usuario_id = ?')
        .run(logo_url, usuario_id);
    } else {
      db.prepare('INSERT INTO configuracoes_loja (usuario_id, logo_url) VALUES (?, ?)')
        .run(usuario_id, logo_url);
    }
    
    res.json({ message: 'Logo atualizada com sucesso', logo_url });
  } catch (error) {
    console.error('Erro ao atualizar logo:', error);
    res.status(500).json({ error: 'Erro ao atualizar logo' });
  }
});

export default router;
