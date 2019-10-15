"use strict";
/**
 * This file is derived from prior work.
 *
 * See NOTICE.md for full license text.
 *
 * Derived from:
 * - hash-base, Copyright (c) 2016 Kirill Fomichev
 * - cipher-base, Copyright (c) 2017 crypto-browserify contributors
 * - create-hash, Copyright (c) 2017 crypto-browserify contributors
 * - create-hmac, Copyright (c) 2017 crypto-browserify contributors
 * - randombytes, Copyright (c) 2017 crypto-browserify
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// tslint:disable no-bitwise
const readable_stream_1 = require("readable-stream");
const Hash_1 = tslib_1.__importDefault(require("./Hash"));
exports.Hash = Hash_1.default;
const MD5_1 = tslib_1.__importDefault(require("./MD5"));
const SHA_1_1 = tslib_1.__importDefault(require("./SHA-1"));
const SHA_256_1 = tslib_1.__importDefault(require("./SHA-256"));
const SHA_512_1 = tslib_1.__importDefault(require("./SHA-512"));
let root;
if (typeof window !== 'undefined') {
    root = window;
}
else if (typeof global !== 'undefined') {
    root = global;
}
// ====================================================================
const ZEROS = Buffer.alloc(128);
class Hmac extends readable_stream_1.Transform {
    constructor(alg, key) {
        super();
        if (typeof key === 'string') {
            key = Buffer.from(key);
        }
        const blocksize = alg === 'sha512' ? 128 : 64;
        this._alg = alg;
        if (key.length > blocksize) {
            key = createHash(alg)
                .update(key)
                .digest();
        }
        else if (key.length < blocksize) {
            key = Buffer.concat([key, ZEROS], blocksize);
        }
        this._ipad = Buffer.alloc(blocksize);
        this._opad = Buffer.alloc(blocksize);
        for (let i = 0; i < blocksize; i++) {
            this._ipad[i] = key[i] ^ 0x36;
            this._opad[i] = key[i] ^ 0x5c;
        }
        this._hash = createHash(alg).update(this._ipad);
    }
    _transform(data, enc, next) {
        let err;
        try {
            this.update(data, enc);
        }
        catch (e) {
            err = e;
        }
        finally {
            next(err);
        }
    }
    _flush(done) {
        let err;
        try {
            this.push(this._final());
        }
        catch (e) {
            err = e;
        }
        done(err);
    }
    _final() {
        const h = this._hash.digest();
        return createHash(this._alg)
            .update(this._opad)
            .update(h)
            .digest();
    }
    update(data, inputEnc) {
        this._hash.update(data, inputEnc);
        return this;
    }
    digest(outputEnc) {
        const outData = this._final() || Buffer.alloc(0);
        if (outputEnc) {
            return outData.toString(outputEnc);
        }
        return outData;
    }
}
exports.Hmac = Hmac;
// ====================================================================
const HASH_IMPLEMENTATIONS = new Map([
    ['md5', MD5_1.default],
    ['sha-1', SHA_1_1.default],
    ['sha-256', SHA_256_1.default],
    ['sha-512', SHA_512_1.default],
    ['sha1', SHA_1_1.default],
    ['sha256', SHA_256_1.default],
    ['sha512', SHA_512_1.default]
]);
function randomBytes(size) {
    const rawBytes = new Uint8Array(size);
    if (size > 0) {
        root.crypto.getRandomValues(rawBytes);
    }
    return Buffer.from(rawBytes.buffer);
}
exports.randomBytes = randomBytes;
function getHashes() {
    return ['sha-1', 'sha-256', 'sha-512', 'md5'];
}
exports.getHashes = getHashes;
function createHash(alg) {
    alg = alg.toLowerCase();
    const HashImp = HASH_IMPLEMENTATIONS.get(alg);
    if (HashImp) {
        return new HashImp();
    }
    else {
        throw new Error('Unsupported hash algorithm: ' + alg);
    }
}
exports.createHash = createHash;
function createHmac(alg, key) {
    return new Hmac(alg.toLowerCase(), key);
}
exports.createHmac = createHmac;
