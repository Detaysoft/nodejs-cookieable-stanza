"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Hashes = tslib_1.__importStar(require("../crypto"));
class SimpleMech {
    constructor(name) {
        this.authenticated = false;
        this.mutuallyAuthenticated = false;
        this.name = name;
    }
    getCacheableCredentials() {
        return null;
    }
    processChallenge(challenge) {
        return;
    }
    processSuccess(success) {
        this.authenticated = true;
        if (success) {
            this.processChallenge(success);
        }
    }
    finalize() {
        return {
            authenticated: this.authenticated,
            mutuallyAuthenticated: this.mutuallyAuthenticated
        };
    }
}
exports.SimpleMech = SimpleMech;
class Factory {
    constructor() {
        this.mechanisms = [];
    }
    register(name, constructor, priority) {
        this.mechanisms.push({
            constructor,
            name: name.toUpperCase(),
            priority: priority || this.mechanisms.length
        });
        // We want mechanisms with highest priority at the start of the list
        this.mechanisms.sort((a, b) => b.priority - a.priority);
    }
    disable(name) {
        const mechName = name.toUpperCase();
        this.mechanisms = this.mechanisms.filter(mech => mech.name !== mechName);
    }
    createMechanism(names) {
        const availableNames = names.map(name => name.toUpperCase());
        for (const knownMech of this.mechanisms) {
            for (const availableMechName of availableNames) {
                if (availableMechName === knownMech.name) {
                    return new knownMech.constructor(knownMech.name);
                }
            }
        }
        return null;
    }
}
exports.Factory = Factory;
// ====================================================================
// Utility helpers
// ====================================================================
// tslint:disable no-bitwise
function XOR(a, b) {
    const res = [];
    if (a.length > b.length) {
        for (let i = 0; i < b.length; i++) {
            res.push(a[i] ^ b[i]);
        }
    }
    else {
        for (let i = 0; i < a.length; i++) {
            res.push(a[i] ^ b[i]);
        }
    }
    return Buffer.from(res);
}
// tslint:enable no-bitwise
function H(text, alg = 'sha-1') {
    return Hashes.createHash(alg)
        .update(text)
        .digest();
}
function HMAC(key, msg, alg = 'sha-1') {
    return Hashes.createHmac(alg, key)
        .update(msg)
        .digest();
}
function Hi(text, salt, iterations, alg = 'sha-1') {
    let ui1 = HMAC(text, Buffer.concat([salt, Buffer.from('00000001', 'hex')]), alg);
    let ui = ui1;
    for (let i = 0; i < iterations - 1; i++) {
        ui1 = HMAC(text, ui1, alg);
        ui = XOR(ui, ui1);
    }
    return ui;
}
function createClientNonce(length = 32) {
    return Hashes.randomBytes(length).toString('hex');
}
function parse(challenge) {
    const directives = {};
    const tokens = challenge.toString().split(/,(?=(?:[^"]|"[^"]*")*$)/);
    for (let i = 0, len = tokens.length; i < len; i++) {
        const directive = /(\w+)=["]?([^"]+)["]?$/.exec(tokens[i]);
        if (directive) {
            directives[directive[1]] = directive[2];
        }
    }
    return directives;
}
// ====================================================================
// ANONYMOUS
// ====================================================================
class ANONYMOUS extends SimpleMech {
    getExpectedCredentials() {
        return { optional: ['trace'], required: [] };
    }
    createResponse(credentials) {
        return Buffer.from(credentials.trace || '');
    }
}
exports.ANONYMOUS = ANONYMOUS;
// ====================================================================
// EXTERNAL
// ====================================================================
class EXTERNAL extends SimpleMech {
    getExpectedCredentials() {
        return { optional: ['authzid'], required: [] };
    }
    createResponse(credentials) {
        return Buffer.from(credentials.authzid || '');
    }
}
exports.EXTERNAL = EXTERNAL;
// ====================================================================
// PLAIN
// ====================================================================
class PLAIN extends SimpleMech {
    getExpectedCredentials() {
        return {
            optional: ['authzid'],
            required: ['username', 'password']
        };
    }
    createResponse(credentials) {
        return Buffer.from((credentials.authzid || '') +
            '\x00' +
            credentials.username +
            '\x00' +
            credentials.password);
    }
}
exports.PLAIN = PLAIN;
// ====================================================================
// OAUTHBEARER
// ====================================================================
class OAUTH extends SimpleMech {
    constructor(name) {
        super(name);
        this.name = name;
    }
    getExpectedCredentials() {
        return {
            optional: [],
            required: ['token']
        };
    }
    createResponse(credentials) {
        return Buffer.from(credentials.token);
    }
}
exports.OAUTH = OAUTH;
// ====================================================================
// DIGEST-MD5
// ====================================================================
class DIGEST extends SimpleMech {
    constructor(name) {
        super(name);
        this.providesMutualAuthentication = false;
        this.name = name;
    }
    processChallenge(challenge) {
        const values = parse(challenge);
        this.authenticated = !!values.rspauth;
        this.realm = values.realm;
        this.nonce = values.nonce;
        this.charset = values.charset;
    }
    getExpectedCredentials() {
        return {
            optional: ['authzid', 'realm', 'clientNonce'],
            required: ['host', 'password', 'serviceName', 'serviceType', 'username']
        };
    }
    createResponse(credentials) {
        if (this.authenticated) {
            return null;
        }
        let uri = credentials.serviceType + '/' + credentials.host;
        if (credentials.serviceName && credentials.host !== credentials.serviceName) {
            uri += '/' + credentials.serviceName;
        }
        const realm = credentials.realm || this.realm || '';
        const cnonce = credentials.clientNonce || createClientNonce(16);
        const nc = '00000001';
        const qop = 'auth';
        let str = '';
        str += 'username="' + credentials.username + '"';
        if (realm) {
            str += ',realm="' + realm + '"';
        }
        str += ',nonce="' + this.nonce + '"';
        str += ',cnonce="' + cnonce + '"';
        str += ',nc=' + nc;
        str += ',qop=' + qop;
        str += ',digest-uri="' + uri + '"';
        const base = Hashes.createHash('md5')
            .update(credentials.username)
            .update(':')
            .update(realm)
            .update(':')
            .update(credentials.password)
            .digest();
        const ha1 = Hashes.createHash('md5')
            .update(base)
            .update(':')
            .update(this.nonce)
            .update(':')
            .update(cnonce);
        if (credentials.authzid) {
            ha1.update(':').update(credentials.authzid);
        }
        const dha1 = ha1.digest('hex');
        const ha2 = Hashes.createHash('md5')
            .update('AUTHENTICATE:')
            .update(uri);
        const dha2 = ha2.digest('hex');
        const digest = Hashes.createHash('md5')
            .update(dha1)
            .update(':')
            .update(this.nonce)
            .update(':')
            .update(nc)
            .update(':')
            .update(cnonce)
            .update(':')
            .update(qop)
            .update(':')
            .update(dha2)
            .digest('hex');
        str += ',response=' + digest;
        if (this.charset === 'utf-8') {
            str += ',charset=utf-8';
        }
        if (credentials.authzid) {
            str += 'authzid="' + credentials.authzid + '"';
        }
        return Buffer.from(str);
    }
}
exports.DIGEST = DIGEST;
// ====================================================================
// SCRAM-SHA-1(-PLUS)
// ====================================================================
class SCRAM {
    constructor(name) {
        this.providesMutualAuthentication = true;
        this.name = name;
        this.state = 'INITIAL';
        this.useChannelBinding = this.name.toLowerCase().endsWith('-plus');
        this.algorithm = this.name
            .toLowerCase()
            .split('scram-')[1]
            .split('-plus')[0];
    }
    getExpectedCredentials() {
        const optional = ['authzid'];
        const required = ['username', 'password'];
        if (this.useChannelBinding) {
            required.push('tlsUnique');
        }
        return {
            optional,
            required
        };
    }
    getCacheableCredentials() {
        return this.cache;
    }
    createResponse(credentials) {
        switch (this.state) {
            case 'INITIAL':
                return this.initialResponse(credentials);
            case 'CHALLENGE':
                return this.challengeResponse(credentials);
        }
        return null;
    }
    processChallenge(challenge) {
        const values = parse(challenge);
        this.salt = Buffer.from(values.s || '', 'base64');
        this.iterationCount = parseInt(values.i, 10);
        this.nonce = values.r;
        this.verifier = values.v;
        this.error = values.e;
        this.challenge = challenge;
    }
    processSuccess(success) {
        this.processChallenge(success);
    }
    finalize(credentials) {
        if (!this.verifier) {
            return {
                authenticated: false,
                error: this.error,
                mutuallyAuthenticated: false
            };
        }
        if (this.serverSignature.toString('base64') !== this.verifier) {
            return {
                authenticated: false,
                error: 'Mutual authentication failed',
                mutuallyAuthenticated: false
            };
        }
        return {
            authenticated: true,
            mutuallyAuthenticated: true
        };
    }
    initialResponse(credentials) {
        const authzid = this.escapeUsername(credentials.authzid);
        const username = this.escapeUsername(credentials.username);
        this.clientNonce = credentials.clientNonce || createClientNonce();
        let cbindHeader = 'n';
        if (credentials.tlsUnique) {
            if (!this.useChannelBinding) {
                cbindHeader = 'y';
            }
            else {
                cbindHeader = 'p=tls-unique';
            }
        }
        this.gs2Header = Buffer.from(authzid ? `${cbindHeader},a=${authzid},` : `${cbindHeader},,`);
        this.clientFirstMessageBare = Buffer.from(`n=${username},r=${this.clientNonce}`);
        const result = Buffer.concat([this.gs2Header, this.clientFirstMessageBare]);
        this.state = 'CHALLENGE';
        return result;
    }
    challengeResponse(credentials) {
        const CLIENT_KEY = Buffer.from('Client Key');
        const SERVER_KEY = Buffer.from('Server Key');
        const cbindData = Buffer.concat([
            this.gs2Header,
            credentials.tlsUnique || Buffer.from('')
        ]).toString('base64');
        const clientFinalMessageWithoutProof = Buffer.from(`c=${cbindData},r=${this.nonce}`);
        let saltedPassword;
        let clientKey;
        let serverKey;
        // If our cached salt is the same, we can reuse cached credentials to speed
        // up the hashing process.
        const cached = credentials.salt && Buffer.compare(credentials.salt, this.salt) === 0;
        if (cached && credentials.clientKey && credentials.serverKey) {
            clientKey = Buffer.from(credentials.clientKey);
            serverKey = Buffer.from(credentials.serverKey);
        }
        else if (cached && credentials.saltedPassword) {
            saltedPassword = Buffer.from(credentials.saltedPassword);
            clientKey = HMAC(saltedPassword, CLIENT_KEY, this.algorithm);
            serverKey = HMAC(saltedPassword, SERVER_KEY, this.algorithm);
        }
        else {
            saltedPassword = Hi(Buffer.from(credentials.password || ''), this.salt, this.iterationCount, this.algorithm);
            clientKey = HMAC(saltedPassword, CLIENT_KEY, this.algorithm);
            serverKey = HMAC(saltedPassword, SERVER_KEY, this.algorithm);
        }
        const storedKey = H(clientKey, this.algorithm);
        const separator = Buffer.from(',');
        const authMessage = Buffer.concat([
            this.clientFirstMessageBare,
            separator,
            this.challenge,
            separator,
            clientFinalMessageWithoutProof
        ]);
        const clientSignature = HMAC(storedKey, authMessage, this.algorithm);
        const clientProof = XOR(clientKey, clientSignature).toString('base64');
        this.serverSignature = HMAC(serverKey, authMessage, this.algorithm);
        const result = Buffer.concat([
            clientFinalMessageWithoutProof,
            Buffer.from(`,p=${clientProof}`)
        ]);
        this.state = 'FINAL';
        this.cache = {
            clientKey,
            salt: this.salt,
            saltedPassword,
            serverKey
        };
        return result;
    }
    escapeUsername(name = '') {
        const escaped = [];
        for (const curr of name) {
            if (curr === ',') {
                escaped.push('=2C');
            }
            else if (curr === '=') {
                escaped.push('=3D');
            }
            else {
                escaped.push(curr);
            }
        }
        return escaped.join('');
    }
}
exports.SCRAM = SCRAM;
