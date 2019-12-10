'use strict'

const fs = require('fs').promises

module.exports = (config) => {
  let hashCache = {}

  return {
    storeDir: null,
    queryPathFromHashPart: async (part) => {
      if (!hashCache[part]) {
        const fl = await fs.readdir(config.store)
        const hc = {}
        fl.forEach(f => {
          const [hash, ...rest] = f.split('-')
          hc[hash] = rest.join('-')
        })
        hashCache = hc
      }

      return hashCache[part]
    },
    dumpStoreStream: (path) => {}
  }
}
