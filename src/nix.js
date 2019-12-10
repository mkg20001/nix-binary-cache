'use strict'

const fs = require('fs').promises
const path = require('path')

const debug = require('debug')
const log = debug('nix-binary-cache:nix')

module.exports = (config) => {
  let hashCache = {}
  const lastRebuild = 0

  return {
    storeDir: null,
    queryPathFromHashPart: async (part) => {
      // TODO: add resonable timeout for rebuilds

      if (!hashCache[part]) {
        log('re-building hash-cache')
        const fl = await fs.readdir(config.store)
        const hc = {}
        fl.forEach(f => {
          const [hash] = f.split('-')
          hc[hash] = path.join(config.store, f)
        })
        hashCache = hc
        log('finished rebuild')
      }

      return hashCache[part]
    },
    dumpStoreStream: (path) => {}
  }
}
