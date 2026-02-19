import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { upload, uploadLogo, handleUploadError, deleteFile } from '../config/upload.js';
import db from '../config/database.js';

const router = express.Router();

router.post('/', authenticateToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return handleUploadError(err, req, res, () => {});
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const url = `/uploads/products/${req.file.filename}`;
    
    res.json({
      message: 'Arquivo enviado com sucesso',
      filename: req.file.filename,
      url: url,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

router.post('/logo', authenticateToken, (req, res) => {
  const usuario_id = req.user.ownerId;
  
  uploadLogo.single('file')(req, res, (err) => {
    if (err) {
      return handleUploadError(err, req, res, () => {});
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    try {
      const existing = db.prepare('SELECT id, logo_url FROM configuracoes_loja WHERE usuario_id = ?').get(usuario_id);
      
      if (existing) {
        if (existing.logo_url) {
          const oldFilename = existing.logo_url.split('/').pop();
          deleteFile(oldFilename, 'logos');
        }
        db.prepare('UPDATE configuracoes_loja SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE usuario_id = ?')
          .run(logoUrl, usuario_id);
      } else {
        db.prepare('INSERT INTO configuracoes_loja (usuario_id, logo_url) VALUES (?, ?)')
          .run(usuario_id, logoUrl);
      }
      
      res.json({
        message: 'Logo enviada com sucesso',
        filename: req.file.filename,
        url: logoUrl,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error('Erro ao salvar logo:', error);
      res.status(500).json({ error: 'Erro ao salvar logo no banco de dados' });
    }
  });
});

router.post('/product-image', authenticateToken, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return handleUploadError(err, req, res, () => {});
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const imageUrl = `/uploads/products/${req.file.filename}`;
    
    res.json({
      message: 'Imagem enviada com sucesso',
      filename: req.file.filename,
      imageUrl: imageUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

router.put('/product-image/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const usuario_id = req.user.ownerId;

    const produto = db.prepare('SELECT imagem_url FROM estoque WHERE id = ? AND usuario_id = ?').get(productId, usuario_id);
    
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    upload.single('image')(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, () => {});
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const imageUrl = `/uploads/products/${req.file.filename}`;

      if (produto.imagem_url) {
        const oldFilename = produto.imagem_url.split('/').pop();
        deleteFile(oldFilename);
      }

      db.prepare('UPDATE estoque SET imagem_url = ? WHERE id = ?').run(imageUrl, productId);

      res.json({
        message: 'Imagem atualizada com sucesso',
        filename: req.file.filename,
        imageUrl: imageUrl
      });
    });
  } catch (error) {
    console.error('Erro ao atualizar imagem:', error);
    res.status(500).json({ error: 'Erro ao atualizar imagem do produto' });
  }
});

router.delete('/product-image/:productId', authenticateToken, (req, res) => {
  try {
    const { productId } = req.params;
    const usuario_id = req.user.ownerId;

    const produto = db.prepare('SELECT imagem_url FROM estoque WHERE id = ? AND usuario_id = ?').get(productId, usuario_id);
    
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (!produto.imagem_url) {
      return res.status(404).json({ error: 'Produto não possui imagem' });
    }

    const filename = produto.imagem_url.split('/').pop();
    const deleted = deleteFile(filename);

    if (deleted) {
      db.prepare('UPDATE estoque SET imagem_url = NULL WHERE id = ?').run(productId);
      res.json({ message: 'Imagem deletada com sucesso' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    res.status(500).json({ error: 'Erro ao deletar imagem' });
  }
});

export default router;
