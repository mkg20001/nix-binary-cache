'use strict'

const Joi = require('@hapi/joi')

require('mkg-bin-gen')(
  'nix-binary-cache',
  {
    validator: Joi.object({
      hapi: Joi.object({
        host: Joi.string().required(),
        port: Joi.number().integer().required()
      }).required(),
      nix: Joi.object({
        store: Joi.string().required(),
        remote: Joi.string()
      }).required(),
      cache: Joi.object({
        path: Joi.string().required()
      }).required(),
      sign: Joi.string(),
      compress: Joi.string()
    }).required()
  },
  require('./src')
)
