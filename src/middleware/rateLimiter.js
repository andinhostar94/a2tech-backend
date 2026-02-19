import rateLimit from 'express-rate-limit';

// Rate limiter para rotas de autenticação
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo de 5 tentativas
  message: {
    error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.'
  },
  standardHeaders: true, // Retorna info de rate limit nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  handler: (req, res) => {
    console.log(`Rate limit excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.'
    });
  }
});

// Rate limiter para rotas de registro
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo de 3 registros por hora
  message: {
    error: 'Muitas tentativas de registro. Por favor, tente novamente em 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`Rate limit de registro excedido para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Muitas tentativas de registro. Por favor, tente novamente em 1 hora.'
    });
  }
});

// Rate limiter geral para API (proteção contra DDoS)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo de 100 requisições
  message: {
    error: 'Muitas requisições. Por favor, tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});


