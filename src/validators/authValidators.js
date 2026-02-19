import Joi from 'joi';

export const registerSchema = Joi.object({
  nome: Joi.string().min(3).max(100).required().messages({
    'string.empty': 'Nome é obrigatório',
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 100 caracteres',
    'any.required': 'Nome é obrigatório'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email é obrigatório',
    'string.email': 'Email inválido',
    'any.required': 'Email é obrigatório'
  }),
  senha: Joi.string().min(6).max(100).required().messages({
    'string.empty': 'Senha é obrigatória',
    'string.min': 'Senha deve ter no mínimo 6 caracteres',
    'string.max': 'Senha deve ter no máximo 100 caracteres',
    'any.required': 'Senha é obrigatória'
  }),
  telefone: Joi.string().allow(null, '').messages({
    'string.base': 'Telefone inválido'
  }),
  endereco: Joi.string().allow(null, '').messages({
    'string.base': 'Endereço inválido'
  })
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email é obrigatório',
    'string.email': 'Email inválido',
    'any.required': 'Email é obrigatório'
  }),
  senha: Joi.string().required().messages({
    'string.empty': 'Senha é obrigatória',
    'any.required': 'Senha é obrigatória'
  })
});


