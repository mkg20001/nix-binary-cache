'use strict'

const kvStr = (obj) => {
  return Object.keys(obj).filter(key => Boolean(obj[key])).map(key => `${key}: ${obj[key]}`).join('\n') + '\n'
}

const Nix = require('./nix')
const FSCache = require('./fscache')
const Boom = require('@hapi/boom')
const fs = require('fs')

const NARINFO_RE = /^([0-9a-z]+)\.narinfo$/
const NAR_BZ2_RE = /^([0-9a-z]+)\.nar\.bz2$/
const NAR_RE = /^([0-9a-z]+)\.nar(\.([a-z0-9]+))?$/

const compMap = {
  xz: ['lzma', ['-z', '-c']],
  bz2: ['pbzip2', ['-c']]
}

const compEnd = {
  lzma: 'xz',
  bzip2: 'bz2'
}

module.exports = async (server, config) => {
  const nix = Nix(config.nix)
  const cache = FSCache(config.cache)
  const key = config.sign && String(fs.readFileSync(config.sign))

  server.route({
    method: 'GET',
    path: '/nix-cache-info',
    handler: (request, h) => {
      return h.response(kvStr({
        StoreDir: nix.storeDir,
        WantMassQuery: 1,
        Priority: 30
      })).header('Content-Type', 'text/plain')
    }
  })

  server.route({
    method: 'GET',
    path: '/{hashPart}.narinfo',
    handler: async (request, h) => {
      const hashPart = request.params.hashPart

      const res = await cache.get(`${hashPart}.narinfo`, async () => {
        const StorePath = await nix.queryPathFromHashPart(hashPart)

        if (!StorePath) { // TODO: maybe also cache 404s?
          throw Boom.notFound('No such path.')
        }

        const { narHash, narSize, deriver, refs } = await nix.queryPathInfo(StorePath)

        return kvStr({
          StorePath,
          URL: `nar/${hashPart}.nar${config.compress ? '.' + compEnd[config.compress] : ''}`,
          Compression: config.compress || 'none',
          NarHash: narHash,
          NarSize: narSize,
          References: refs.length && refs.join(', '),
          Deriver: deriver && deriver.replace(/.*\//, ''),
          Sig: key && await nix.signString(key, await nix.fingerprintPath(StorePath, narHash, narSize, refs))
        })
      })

      return h.response(res).header('Content-Type', 'text/x-nix-narinfo')
    }
  })

  server.route({
    method: 'GET',
    path: '/nar/{nar}',
    handler: async (request, h) => {
      const req = request.params.nar

      const m = req.match(NAR_RE)
      if (!m) {
        throw Boom.notFound('Not a valid nix path.')
      }

      const hashPart = m[1]
      const comp = m[3]

      const stream = await cache.get(req, async () => {
        const StorePath = await nix.queryPathFromHashPart(hashPart)

        if (!StorePath) { // TODO: maybe also cache 404s?
          throw Boom.notFound('No such path.')
        }

        const tool = compMap[comp]

        if (!comp || tool) {
          return nix.dumpStoreStream(StorePath, tool)
        } else {
          throw Boom.notFound('No such compression.')
        }
      })

      return h.response(stream)
    }
  })
}
