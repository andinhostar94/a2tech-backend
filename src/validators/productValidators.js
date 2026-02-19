import Joi from 'joi';

export const createProductSchema = Joi.object({
  produto: Joi.string().min(3).max(200).required().messages({
    'string.empty': 'Nome do produto é obrigatório',
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 200 caracteres',
    'any.required': 'Nome do produto é obrigatório'
  }),
  descricao: Joi.string().max(1000).allow(null, '').messages({
    'string.max': 'Descrição deve ter no máximo 1000 caracteres'
  }),
  categoria_id: Joi.number().integer().positive().allow(null).messages({
    'number.base': 'Categoria inválida',
    'number.integer': 'Categoria inválida',
    'number.positive': 'Categoria inválida'
  }),
  quantidade: Joi.number().integer().min(0).required().messages({
    'number.base': 'Quantidade deve ser um número',
    'number.integer': 'Quantidade deve ser um número inteiro',
    'number.min': 'Quantidade não pode ser negativa',
    'any.required': 'Quantidade é obrigatória'
  }),
  preco_unitario: Joi.number().positive().required().messages({
    'number.base': 'Preço unitário deve ser um número',
    'number.positive': 'Preço unitário deve ser maior que zero',
    'any.required': 'Preço unitário é obrigatório'
  }),
  preco_venda: Joi.number().positive().allow(null).messages({
    'number.base': 'Preço de venda deve ser um número',
    'number.positive': 'Preço de venda deve ser maior que zero'
  }),
  codigo_barras: Joi.string().max(50).allow(null, '').messages({
    'string.max': 'Código de barras deve ter no máximo 50 caracteres'
  })
});

export const updateProductSchema = Joi.object({
  produto: Joi.string().min(3).max(200).messages({
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 200 caracteres'
  }),
  descricao: Joi.string().max(1000).allow(null, '').messages({
    'string.max': 'Descrição deve ter no máximo 1000 caracteres'
  }),
  categoria_id: Joi.number().integer().positive().allow(null).messages({
    'number.base': 'Categoria inválida',
    'number.integer': 'Categoria inválida',
    'number.positive': 'Categoria inválida'
  }),
  quantidade: Joi.number().integer().min(0).messages({
    'number.base': 'Quantidade deve ser um número',
    'number.integer': 'Quantidade deve ser um número inteiro',
    'number.min': 'Quantidade não pode ser negativa'
  }),
  preco_unitario: Joi.number().positive().messages({
    'number.base': 'Preço unitário deve ser um número',
    'number.positive': 'Preço unitário deve ser maior que zero'
  }),
  preco_venda: Joi.number().positive().allow(null).messages({
    'number.base': 'Preço de venda deve ser um número',
    'number.positive': 'Preço de venda deve ser maior que zero'
  }),
  codigo_barras: Joi.string().max(50).allow(null, '').messages({
    'string.max': 'Código de barras deve ter no máximo 50 caracteres'
  })
});


