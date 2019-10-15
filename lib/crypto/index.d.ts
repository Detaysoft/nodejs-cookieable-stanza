/// <reference types="node" />
export interface Hash {
    update(data: Buffer | Uint8Array | string, inputEncoding?: string): Hash;
    digest(encoding: string): string;
    digest(encoding?: 'buffer'): Buffer;
}
export interface Hmac {
    update(data: Buffer | Uint8Array | string, inputEncoding?: string): Hash;
    digest(encoding: string): string;
    digest(encoding?: 'buffer'): Buffer;
}
export declare function getHashes(): string[];
export declare function createHash(alg: string): import("crypto").Hash;
export declare function createHmac(alg: string, key: string | Buffer): import("crypto").Hmac;
export declare function randomBytes(size: number): Buffer;
