'use strict'

const kvStr = (obj) => {
  return Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('\n') + '\n'
}

const Nix = require('./nix')
const FSCache = require('./fscache')
const Boom = require('@hapi/boom')

const NARINFO_RE = /^([0-9a-z]+)\.narinfo$/
const NAR_BZ2_RE = /^([0-9a-z]+)\.nar\.bz2$/
const NAR_RE = /^([0-9a-z]+)\.nar$/

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
      })).header('Content-Type', 'text/plain')
    }
  })

  server.route({
    method: 'GET',
    path: '/nar/{nar}',
    handler: async (request, h) => {
      const req = request.params.nar

      let m
      let hashPart

      if ((m = req.match(NARINFO_RE))) {
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
            Compression: 'none', // TODO: bz2 as standard
            NarHash: narHash,
            NarSize: narSize
            // References:  TODO: add
            // Deriver: // TODO: add
            // Sig: // TODO: add
          })
        })

        return h.response(res).header('Content-Type', 'text/x-nix-narinfo')
      } else if ((m = req.match(NAR_RE))) {
        hashPart = m[1]

        const stream = await cache.get(req, async () => {
          const StorePath = await nix.queryPathFromHashPart(hashPart)

          if (!StorePath) { // TODO: maybe also cache 404s?
            throw Boom.notFound('No such path.')
          }

          const stream = nix.dumpStoreStream(StorePath)

          if (false /* compression TODO */) {
            // TODO
          }

          return stream
        })

        return h.response(stream)
      } else {
        throw Boom.notFound('Not a valid nix path.')
      }
    }
  })
}
