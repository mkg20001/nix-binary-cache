'use strict'

const fs = require('fs').promises
const path = require('path')

const debug = require('debug')
const log = debug('nix-binary-cache:nix')

const cp = require('child_process')

function makeStream (cmd, args, stdin) {
  const p = cp.spawn(cmd, args, { stdio: [stdin || 'pipe', 'pipe', 'inherit'] })

  return p.stdout
}

module.exports = (config) => {
  let hashCache = {}
  const lastRebuild = 0

  function convertHash () {
    /*
    SV * convertHash(char * algo, char * s, int toBase32)
    PPCODE:
        try {
            Hash h(s, parseHashType(algo));
            string s = h.to_string(toBase32 ? Base32 : Base16, false);
            XPUSHs(sv_2mortal(newSVpv(s.c_str(), 0)));
        } catch (Error & e) {
            croak("%s", e.what());
        }
    */
  }

  return {
    storeDir: config.store,
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
    dumpStoreStream: (path, compTool) => {
      const nar = makeStream('nix-store', ['--dump', path])
      if (compTool) {
        return makeStream(compTool, ['-c'], nar)
      } else {
        return nar
      }
    },
    queryPathInfo: (path) => {
      const run = (flag) => cp.execSync('nix-store', ['--query', path, '--flag']).split('\n').map(l => l.trim()).filter(Boolean)

      return {
        narHash: run('hash')[0],
        size: parseInt(run('size')[0], 10),
        deriver: run('deriver')[0],
        refs: run('references')
      }
    },
    fingerprintPath: (storePath, narHash, narSize, references) => {
      if (!storePath.startsWith(config.store)) {
        throw new Error('die')
      }

      if (!narHash.startsWith('sha256:')) {
        throw new Error('die')
      }

      if (narHash.length === 71) {
        narHash = 'sha256:' + convertHash('sha256', narHash.substr(7), 1)
      }

      if (narHash.length !== 59) {
        throw new Error('die')
      }

      references.forEach(ref => {
        if (!ref.startsWith(config.store)) {
          throw new Error('die')
        }
      })

      return `1;${storePath};${narHash};${narSize};${references.join(',')}`

      /*
      # Return a fingerprint of a store path to be used in binary cache
      # signatures. It contains the store path, the base-32 SHA-256 hash of
      # the contents of the path, and the references.
      sub fingerprintPath {
          my ($storePath, $narHash, $narSize, $references) = @_;
          die if substr($storePath, 0, length($Nix::Config::storeDir)) ne $Nix::Config::storeDir;
          die if substr($narHash, 0, 7) ne "sha256:";
          # Convert hash from base-16 to base-32, if necessary.
          $narHash = "sha256:" . convertHash("sha256", substr($narHash, 7), 1)
              if length($narHash) == 71;
          die if length($narHash) != 59;
          foreach my $ref (@{$references}) {
              die if substr($ref, 0, length($Nix::Config::storeDir)) ne $Nix::Config::storeDir;
          }
          return "1;" . $storePath . ";" . $narHash . ";" . $narSize . ";" . join(",", @{$references});
      }
      */
    }
  }
}
