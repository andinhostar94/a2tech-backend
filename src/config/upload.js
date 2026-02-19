import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsBaseDir = path.join(__dirname, '../../uploads');
const productsDir = path.join(uploadsBaseDir, 'products');
const logosDir = path.join(uploadsBaseDir, 'logos');

if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const createStorage = (destinationDir) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, destinationDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
    }
  });
};

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Use apenas: JPG, PNG, GIF ou WEBP'), false);
  }
};

export const upload = multer({
  storage: createStorage(productsDir),
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

export const uploadLogo = multer({
  storage: createStorage(logosDir),
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo permitido excedido' });
    }
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

export const deleteFile = (filename, type = 'products') => {
  const dir = type === 'logos' ? logosDir : productsDir;
  const filepath = path.join(dir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
};

export { productsDir, logosDir };
