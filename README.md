# A2 Tech - Backend

Backend do sistema A2 Tech para lojas e assistências de celular.

## 🚀 Tecnologias

- Node.js + Express
- SQLite (better-sqlite3)
- JWT (jsonwebtoken)
- bcryptjs
- PDFKit
- Helmet

## 📦 Instalação

```bash
npm install
```

## ⚙️ Configuração

1. Copie o arquivo `.env.example` para `.env`:
```bash
copy .env.example .env
```

2. Configure as variáveis de ambiente no arquivo `.env`

## 🏃 Executar

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

O servidor estará rodando em `http://localhost:3001`

## 📚 API Endpoints

### Autenticação
- `POST /api/auth/register` - Cadastro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verificar token

### Usuários
- `GET /api/users` - Listar usuários (admin)
- `GET /api/users/:id` - Buscar usuário
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário (admin)

### Vendas
- `POST /api/sales` - Criar venda
- `GET /api/sales` - Listar vendas
- `GET /api/sales/:id` - Buscar venda
- `PUT /api/sales/:id` - Atualizar venda (admin)
- `DELETE /api/sales/:id` - Deletar venda (admin)
- `GET /api/sales/receipt/:id` - Gerar recibo PDF

### Estoque
- `POST /api/stock` - Adicionar produto
- `GET /api/stock` - Listar produtos
- `GET /api/stock/:id` - Buscar produto
- `PUT /api/stock/:id` - Atualizar produto
- `DELETE /api/stock/:id` - Remover produto

### Funcionários
- `POST /api/employees` - Cadastrar funcionário (admin)
- `GET /api/employees` - Listar funcionários (admin)
- `GET /api/employees/:id` - Buscar funcionário (admin)
- `PUT /api/employees/:id` - Atualizar funcionário (admin)
- `DELETE /api/employees/:id` - Remover funcionário (admin)

### Financeiro
- `POST /api/financial/transactions` - Registrar transação
- `GET /api/financial/transactions` - Listar transações
- `GET /api/financial/reports` - Gerar relatórios

### Analytics
- `GET /api/analytics/sales` - Analytics de vendas
- `GET /api/analytics/stock` - Analytics de estoque
- `GET /api/analytics/financial` - Analytics financeiro

## 👤 Credenciais Admin

- Email: TesteAdmin@gmail.com
- Senha: Admin@0303

## 📝 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   ├── middleware/
│   │   ├── auth.js
│   │   └── adminAuth.js
│   ├── models/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── sales.js
│   │   ├── stock.js
│   │   ├── employees.js
│   │   ├── financial.js
│   │   └── analytics.js
│   └── utils/
│       └── pdfGenerator.js
├── database/
│   └── a2tech.db
└── server.js
```


