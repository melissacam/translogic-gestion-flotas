import Joi from 'joi';

// Si falta una variable o tiene formato inválido, la app no arranca
export const esquemaEntorno = Joi.object({
  PORT: Joi.number().port().required(),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().required(),
  IVA_TASA: Joi.number().min(0).max(1).required(),
  ZONA_HORARIA: Joi.string().required(),
  CORS_ORIGIN: Joi.string().required(),
});
