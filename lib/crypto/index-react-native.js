"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const RNRandomBytes = tslib_1.__importStar(require("react-native-randombytes"));
const index_browser_1 = require("./index-browser");
exports.createHash = index_browser_1.createHash;
exports.createHmac = index_browser_1.createHmac;
exports.getHashes = index_browser_1.getHashes;
exports.Hash = index_browser_1.Hash;
exports.Hmac = index_browser_1.Hmac;
/* istanbul ignore next */
function randomBytes(size) {
    return RNRandomBytes.randomBytes(size);
}
exports.randomBytes = randomBytes;
