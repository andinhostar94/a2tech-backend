import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "../../database/a2tech.db");
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma("foreign_keys = ON");

// Criar índices para melhor performance
function createIndexes() {
  try {
    // Índices para tabela usuarios
    db.exec("CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)");
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_usuarios_status ON usuarios(status_pagamento)",
    );

    // Índices para tabela clientes
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes(usuario_id)",
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf)");

    // Índices para tabela vendas (apenas colunas que existem)
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id)",
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda)");

    // Índices para tabela estoque
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_estoque_usuario_id ON estoque(usuario_id)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_estoque_categoria_id ON estoque(categoria_id)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque(produto)",
    );

    // Índices para tabela funcionarios
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_funcionarios_usuario_id ON funcionarios(usuario_id)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_funcionarios_email ON funcionarios(email)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_funcionarios_funcao ON funcionarios(funcao)",
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_funcionarios_senha ON funcionarios(senha)");

    // Índices para tabela categorias (usando categoria_pai_id que é o nome real da coluna)
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_categorias_categoria_pai_id ON categorias(categoria_pai_id)",
    );

    // Índices para tabela pagamentos
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_pagamentos_usuario_id ON pagamentos(usuario_id)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status)",
    );

    // Índices para tabela suporte
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_suporte_usuario_id ON suporte(usuario_id)",
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_suporte_status ON suporte(status)");

    console.log("✅ Índices criados com sucesso!");
  } catch (error) {
    console.error(
      "⚠️ Erro ao criar índices (alguns podem já existir):",
      error.message,
    );
  }
}

// Criar tabelas
export function initDatabase() {
  // Tabela de Usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      telefone TEXT,
      endereco TEXT,
      status_pagamento TEXT DEFAULT 'Pendente' CHECK(status_pagamento IN ('Teste', 'Pendente', 'Pago', 'Cancelado')),
      trial_ends_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de Clientes (clientes das lojas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      cpf TEXT,
      endereco TEXT,
      cidade TEXT,
      estado TEXT,
      cep TEXT,
      data_nascimento TEXT,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Funcionários (com suporte a login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT,
      funcao TEXT NOT NULL CHECK(funcao IN ('vendedor', 'estoque', 'suporte', 'gerente', 'admin')),
      permissoes TEXT DEFAULT '[]',
      ativo INTEGER DEFAULT 1,
      ultimo_acesso DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Configurações da Loja
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes_loja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      nome_loja TEXT,
      logo_url TEXT,
      endereco TEXT,
      telefone TEXT,
      email_contato TEXT,
      cor_primaria TEXT DEFAULT '#0066cc',
      cor_secundaria TEXT DEFAULT '#004499',
      mensagem_recibo TEXT,
      cnpj TEXT,
      inscricao_estadual TEXT,
      horario_funcionamento TEXT,
      redes_sociais TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Categorias
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      categoria_pai_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_pai_id) REFERENCES categorias(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Estoque
  db.exec(`
    CREATE TABLE IF NOT EXISTS estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      produto TEXT NOT NULL,
      descricao TEXT,
      categoria_id INTEGER,
      quantidade INTEGER NOT NULL DEFAULT 0,
      preco_unitario REAL NOT NULL,
      preco_venda REAL,
      codigo_barras TEXT,
      imagem_url TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Vendas
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      cliente_id INTEGER,
      valor_total REAL NOT NULL,
      produtos TEXT NOT NULL,
      data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add usuario_id column if it doesn't exist (for existing databases)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(vendas)").all();
    const hasUsuarioId = tableInfo.some((col) => col.name === "usuario_id");
    if (!hasUsuarioId) {
      db.exec("ALTER TABLE vendas ADD COLUMN usuario_id INTEGER");
    }
  } catch (e) {
    console.log("Migration check skipped:", e.message);
  }

  // Tabela de Pagamentos
  db.exec(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'Pendente' CHECK(status IN ('Pendente', 'Pago')),
      data_pagamento DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Suporte
  db.exec(`
    CREATE TABLE IF NOT EXISTS suporte (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      mensagem TEXT NOT NULL,
      status TEXT DEFAULT 'Aberto' CHECK(status IN ('Aberto', 'Em Andamento', 'Fechado')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Fornecedores
  db.exec(`
    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      cnpj TEXT,
      email TEXT,
      telefone TEXT,
      endereco TEXT,
      cidade TEXT,
      estado TEXT,
      cep TEXT,
      contato_nome TEXT,
      contato_telefone TEXT,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Maquininhas
  db.exec(`
    CREATE TABLE IF NOT EXISTS maquininhas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      taxa_debito REAL DEFAULT 0,
      taxa_credito_vista REAL DEFAULT 0,
      taxa_credito_2x REAL DEFAULT 0,
      taxa_credito_3x REAL DEFAULT 0,
      taxa_credito_4x REAL DEFAULT 0,
      taxa_credito_5x REAL DEFAULT 0,
      taxa_credito_6x REAL DEFAULT 0,
      taxa_credito_7x REAL DEFAULT 0,
      taxa_credito_8x REAL DEFAULT 0,
      taxa_credito_9x REAL DEFAULT 0,
      taxa_credito_10x REAL DEFAULT 0,
      taxa_credito_11x REAL DEFAULT 0,
      taxa_credito_12x REAL DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Formas de Pagamento
  db.exec(`
    CREATE TABLE IF NOT EXISTS formas_pagamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outros')),
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Contas a Pagar
  db.exec(`
    CREATE TABLE IF NOT EXISTS contas_pagar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      fornecedor_id INTEGER,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      data_vencimento DATE NOT NULL,
      data_pagamento DATE,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
      categoria TEXT,
      forma_pagamento TEXT,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Ordens de Serviço
  db.exec(`
    CREATE TABLE IF NOT EXISTS ordens_servico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      cliente_id INTEGER,
      funcionario_id INTEGER,
      numero_os TEXT,
      equipamento TEXT NOT NULL,
      marca TEXT,
      modelo TEXT,
      numero_serie TEXT,
      cor TEXT,
      acessorios TEXT,
      defeito_relatado TEXT NOT NULL,
      laudo_tecnico TEXT,
      servico_realizado TEXT,
      pecas_utilizadas TEXT,
      valor_pecas REAL DEFAULT 0,
      valor_servico REAL DEFAULT 0,
      valor_total REAL DEFAULT 0,
      valor_pago REAL DEFAULT 0,
      forma_pagamento_id INTEGER,
      status TEXT DEFAULT 'aguardando' CHECK(status IN ('aguardando', 'em_analise', 'aprovado', 'em_andamento', 'concluido', 'entregue', 'cancelado')),
      prioridade TEXT DEFAULT 'normal' CHECK(prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
      data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
      data_previsao DATE,
      data_conclusao DATE,
      data_entrega DATE,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
      FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL,
      FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Garantias
  db.exec(`
    CREATE TABLE IF NOT EXISTS garantias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      ordem_servico_id INTEGER,
      venda_id INTEGER,
      cliente_id INTEGER,
      tipo TEXT NOT NULL CHECK(tipo IN ('servico', 'produto')),
      descricao TEXT NOT NULL,
      dias_garantia INTEGER NOT NULL DEFAULT 90,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      status TEXT DEFAULT 'ativa' CHECK(status IN ('ativa', 'expirada', 'utilizada', 'cancelada')),
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE SET NULL,
      FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE SET NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Prêmios de Fidelidade
  db.exec(`
    CREATE TABLE IF NOT EXISTS premios_fidelidade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      pontos_necessarios INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('desconto_percentual', 'desconto_fixo', 'produto', 'servico')),
      valor_desconto REAL,
      produto_id INTEGER,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES estoque(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Fidelidade de Clientes (pontos acumulados)
  db.exec(`
    CREATE TABLE IF NOT EXISTS fidelidade_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      pontos_acumulados INTEGER DEFAULT 0,
      pontos_utilizados INTEGER DEFAULT 0,
      nivel TEXT DEFAULT 'bronze' CHECK(nivel IN ('bronze', 'prata', 'ouro', 'diamante')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    )
  `);

  // Tabela de Histórico de Pontos de Fidelidade
  db.exec(`
    CREATE TABLE IF NOT EXISTS historico_fidelidade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('ganho', 'resgate', 'expiracao', 'ajuste')),
      pontos INTEGER NOT NULL,
      descricao TEXT,
      venda_id INTEGER,
      ordem_servico_id INTEGER,
      premio_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE SET NULL,
      FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE SET NULL,
      FOREIGN KEY (premio_id) REFERENCES premios_fidelidade(id) ON DELETE SET NULL
    )
  `);

  // Tabela de Configurações de Fidelidade
  db.exec(`
    CREATE TABLE IF NOT EXISTS config_fidelidade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      ativo INTEGER DEFAULT 0,
      pontos_por_real REAL DEFAULT 1,
      minimo_resgate INTEGER DEFAULT 100,
      validade_pontos_dias INTEGER DEFAULT 365,
      bonus_aniversario INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Migrations para tabela de vendas (adicionar novos campos)
  try {
    const vendasInfo = db.prepare("PRAGMA table_info(vendas)").all();
    const vendasColumns = vendasInfo.map(col => col.name);
    
    if (!vendasColumns.includes('funcionario_id')) {
      db.exec("ALTER TABLE vendas ADD COLUMN funcionario_id INTEGER");
    }
    if (!vendasColumns.includes('forma_pagamento_id')) {
      db.exec("ALTER TABLE vendas ADD COLUMN forma_pagamento_id INTEGER");
    }
    if (!vendasColumns.includes('maquininha_id')) {
      db.exec("ALTER TABLE vendas ADD COLUMN maquininha_id INTEGER");
    }
    if (!vendasColumns.includes('parcelas')) {
      db.exec("ALTER TABLE vendas ADD COLUMN parcelas INTEGER DEFAULT 1");
    }
    if (!vendasColumns.includes('taxa_aplicada')) {
      db.exec("ALTER TABLE vendas ADD COLUMN taxa_aplicada REAL DEFAULT 0");
    }
    if (!vendasColumns.includes('valor_liquido')) {
      db.exec("ALTER TABLE vendas ADD COLUMN valor_liquido REAL");
    }
    if (!vendasColumns.includes('desconto')) {
      db.exec("ALTER TABLE vendas ADD COLUMN desconto REAL DEFAULT 0");
    }
    if (!vendasColumns.includes('observacoes')) {
      db.exec("ALTER TABLE vendas ADD COLUMN observacoes TEXT");
    }
  } catch (e) {
    console.log("Migration vendas check:", e.message);
  }

  // Criar índices
  createIndexes();

  // Criar usuário admin se não existir
  const adminExists = db
    .prepare("SELECT id FROM usuarios WHERE email = ?")
    .get("TesteAdmin@gmail.com");

  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync("Admin@0303", 10);
    const trialEndsAt = new Date();
    trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 10); // Admin tem acesso permanente

    db.prepare(
      `
      INSERT INTO usuarios (nome, email, senha, telefone, endereco, status_pagamento, trial_ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      "Administrador",
      "TesteAdmin@gmail.com",
      hashedPassword,
      "8487049879",
      "A2-PDV",
      "Pago",
      trialEndsAt.toISOString(),
    );

    console.log("✅ Usuário admin criado com sucesso!");
  }

  console.log("✅ Database inicializada com sucesso!");
}

export default db;
