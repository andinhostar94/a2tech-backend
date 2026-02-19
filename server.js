import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase } from './src/config/database.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';

// Importar rotas
import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import salesRoutes from './src/routes/sales.js';
import stockRoutes from './src/routes/stock.js';
import employeesRoutes from './src/routes/employees.js';
import financialRoutes from './src/routes/financial.js';
import analyticsRoutes from './src/routes/analytics.js';
import categoriesRoutes from './src/routes/categories.js';
import clientsRoutes from './src/routes/clients.js';
import uploadRoutes from './src/routes/upload.js';
import settingsRoutes from './src/routes/settings.js';
import adminRoutes from './src/routes/admin.js';
import suppliersRoutes from './src/routes/suppliers.js';
import machinesRoutes from './src/routes/machines.js';
import paymentMethodsRoutes from './src/routes/paymentMethods.js';
import billsRoutes from './src/routes/bills.js';
import serviceOrdersRoutes from './src/routes/serviceOrders.js';
import warrantiesRoutes from './src/routes/warranties.js';
import loyaltyRoutes from './src/routes/loyalty.js';
import systemRoutes from './src/routes/system.js';
import { checkMaintenanceMode } from './src/middleware/maintenanceMode.js';

// Configurações
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar trust proxy para funcionar corretamente atrás de proxies (Replit, Nginx, etc)
app.set('trust proxy', 1);

// Inicializar banco de dados
initDatabase();

// Middlewares
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting global para API
app.use('/api/', apiLimiter);

// Rota de status do sistema (antes do middleware de manutenção)
app.use('/api/system', systemRoutes);

// Middleware de modo de manutenção
app.use('/api/', checkMaintenanceMode);

// Servir arquivos estáticos (uploads)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/service-orders', serviceOrdersRoutes);
app.use('/api/warranties', warrantiesRoutes);
app.use('/api/loyalty', loyaltyRoutes);

// Servir frontend React
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'A2-PDV Backend está rodando!' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor A2-PDV rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
