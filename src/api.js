'use strict'

const kvStr = (obj) => {
  return Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('\n') + '\n'
}

const Nix = require('./nix')
const FSCache = require('./fscache')
const Boom = require('@hapi/boom')

const NARINFO_RE = /^([0-9a-z]+)\.narinfo$/
const NAR_BZ2_RE = /^nar\/([0-9a-z]+)\.nar\.bz2$/
const NAR_RE = /^nar\/([0-9a-z]+)\.nar$/

module.exports = async (server, config) => {
  const nix = Nix(config.nix)
  const cache = FSCache(config.cache)

  server.route({
    method: 'GET',
    path: '/nix-cache-info',
    handler: (request, h) => {
      return h.response(kvStr({
        StoreDir: nix.storeDir,
        WantMassQuery: 1,
        Priority: 30
      })).headers('Content-Type', 'text/plain')
    }
  })

  server.route({
    method: 'GET',
    path: '{nar}',
    handler: async (request, h) => {
      const req = request.params.nar

      let m
      let hashPart

      if ((m = NARINFO_RE.match(req))) {
        hashPart = m[1]

        const res = await cache.get(req, async () => {
          const StorePath = await nix.queryPathFromHashPart(hashPart)

          if (!StorePath) { // TODO: maybe also cache 404s?
            throw Boom.notFound('No such path.')
          }

          const { narHash, narSize, time, deriver, refs } = await nix.queryPathInfo(StorePath)

          return kvStr({
            StorePath,
            URL: `nar/${hashPart}.nar`,
            Compression: 'none', // TODO: bz2
            NarHash: narHash,
            NarSize: narSize
            // References:  TODO: add
            // Deriver: // TODO: add
            // Sig: // TODO: add
          })
        })

        return h.response(res).headers('Content-Type', 'text/x-nix-narinfo')
      } else if ((m = NAR_RE.match(req))) {
        hashPart = m[1]

        const stream = await cache.get(req, async () => {
          const StorePath = await nix.queryPathFromHashPart(hashPart)

          if (!StorePath) { // TODO: maybe also cache 404s?
            throw Boom.notFound('No such path.')
          }

          // TODO: pipe .dump() + .compressBz2()
        })
      }
    }
  })
}
