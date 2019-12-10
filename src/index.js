'use strict'

const Hapi = require('@hapi/hapi')
const Joi = require('@hapi/joi')

const pino = require('pino')
const log = pino({ name: 'nix-binary-cache' })

const api = require('./api')

const Relish = require('relish')({
  messages: {}
})

const init = async (config) => {
  config.hapi.routes = {
    validate: {
      failAction: Relish.failAction
    }
  }

  const server = Hapi.server(config.hapi)

  await server.register({
    plugin: require('hapi-pino'),
    options: { name: 'nix-binary-cache' }
  })

  if (global.SENTRY) {
    await server.register({
      plugin: require('hapi-sentry'),
      options: { client: global.SENTRY }
    })
  }

  await server.register({
    plugin: require('@hapi/inert'),
    options: { }
  })

  await api(server, config)

  await server.start()
}

module.exports = init
