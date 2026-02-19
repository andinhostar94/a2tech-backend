import Joi from 'joi';

export const createClientSchema = Joi.object({
  nome: Joi.string().min(3).max(100).required().messages({
    'string.empty': 'Nome é obrigatório',
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 100 caracteres',
    'any.required': 'Nome é obrigatório'
  }),
  email: Joi.string().email().allow(null, '').messages({
    'string.email': 'Email inválido'
  }),
  telefone: Joi.string().allow(null, '').messages({
    'string.base': 'Telefone inválido'
  }),
  cpf: Joi.string().pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/).allow(null, '').messages({
    'string.pattern.base': 'CPF inválido. Use formato 000.000.000-00 ou 00000000000'
  }),
  endereco: Joi.string().allow(null, ''),
  cidade: Joi.string().allow(null, ''),
  estado: Joi.string().length(2).uppercase().allow(null, '').messages({
    'string.length': 'Estado deve ter 2 caracteres (ex: RN)'
  }),
  cep: Joi.string().pattern(/^\d{5}-?\d{3}$/).allow(null, '').messages({
    'string.pattern.base': 'CEP inválido. Use formato 00000-000'
  }),
  data_nascimento: Joi.date().max('now').allow(null, '').messages({
    'date.max': 'Data de nascimento não pode ser futura'
  }),
  observacoes: Joi.string().max(500).allow(null, '').messages({
    'string.max': 'Observações devem ter no máximo 500 caracteres'
  })
});

export const updateClientSchema = createClientSchema;


