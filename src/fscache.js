'use strict'

const fs = require('fs').promises
const fso = require('fs')
const path = require('path')

async function bg (d) {
  try {
    await d()
  } catch (err) {
    console.error(err.stack)
    // ignore
  }
}

module.exports = (config) => {
  const p = (d) => path.join(config.path, d)

  // TODO: cleanup old entries

  return {
    get: async (id, create, isStream) => {
      // check if exists
      // if hash perm 700, use that file
      // else create write stream perm 200, pass stream, later set perm 600

      const pt = p(id)

      try {
        const stat = await fs.stat(pt)
        if (stat.mode !== 0o100600) {
          throw false // eslint-disable-line
        }

        if (isStream) {
          return fs.createReadStream(pt)
        } else {
          return fs.readFile(pt)
        }
      } catch (err) {
        if (isStream) {
          const out = fs.createWriteStream(pt, { mode: 0o200 })
          const stream = await create()

          stream.on('error', (err) => {
            console.error(err.stack)
          })

          stream.on('close', () => bg(async () => {
            await fs.chmod(pt, 0o600)
          }))

          stream.pipe(out)

          return stream
        } else {
          const res = await create()
          bg(async () => {
            await fs.writeFile(pt, res, { mode: 0o600 })
          })
          return res
        }
      }
    }
  }
}
