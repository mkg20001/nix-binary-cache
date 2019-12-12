'use strict'

// Original source from https://gist.github.com/jbboehr/6fa20f57a031e8dd2c2b23234e6582e4
// ported from typescript to javascript
// ref https://github.com/svanderburg/node2nix/issues/93

/* A note on licensing: the original code is licensed under the LGPL-2.1+, so presumably,
 * since this is a simple port, you may use it under those terms. If it is legal for me
 * to do so, I release this code under the MPL-2.0, as it is more appropriate for
 * JavaScript in my opinion.
 */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Code in this file ported from:
// https://github.com/NixOS/nix/blob/27d1c052ae4e53328c2909b040e204bb7f57ff96/src/libutil/hash.cc

const base64js = require('base64-js')

const BASE32 = '0123456789abcdfghijklmnpqrsvwxyz'

/* export interface Sha1Hash {
    hashType: "sha1";
    sha1: string;
}

export interface Sha256Hash {
    hashType: "sha256";
    sha256: string;
}

export interface Sha512Hash {
    hashType: "sha512";
    sha512: string;
}

export type Hash = Sha1Hash | Sha256Hash | Sha512Hash;

export type OutputHashType = "sha1" | "sha256" | "sha512";

export interface OutputHash {
    algo: OutputHashType;
    hash: string;
} */

function base32Len (hashSize) {
  return Math.floor((hashSize * 8 - 1) / 5) + 1
}

function byteArrayToBase32 (arr) {
  const hashSize = arr.length
  const len = base32Len(hashSize)
  let hash = ''

  for (let n = len - 1; n >= 0; n--) {
    const b = n * 5
    const i = b >> 3
    const j = b % 8
    const c = (arr[i] >> j) |
            (i >= hashSize ? 0 : arr[i + 1] << (8 - j))
    hash += BASE32[c & 0x1f]
  }

  return hash
}

module.exports = function convertIntegrityStringToNixHash (integrity) {
  const [algo, b64hash] = integrity.split('-', 2)

  if (algo !== 'sha1' && algo !== 'sha256' && algo !== 'sha512') {
    throw new Error('Invalid SSRI: ' + integrity)
  }

  const hashArray = base64js.toByteArray(b64hash)
  const hash = byteArrayToBase32(hashArray)

  return {
    algo,
    hash
  }
}

module.exports.just32 = (str) => {
  const hashArray = base64js.toByteArray(str)
  const hash = byteArrayToBase32(hashArray)

  return hash
}
