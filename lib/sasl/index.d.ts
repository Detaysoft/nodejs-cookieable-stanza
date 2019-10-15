/// <reference types="node" />
export interface Credentials {
    username?: string;
    password?: string;
    token?: string;
    authzid?: string;
    realm?: string;
    host?: string;
    serviceType?: string;
    serviceName?: string;
    trace?: string;
    tlsUnique?: Buffer;
    clientNonce?: string;
}
export interface CacheableCredentials extends Credentials {
    salt?: Buffer;
    saltedPassword?: Buffer;
    serverKey?: Buffer;
    clientKey?: Buffer;
}
export interface ExpectedCredentials {
    required: string[];
    optional: string[];
}
export interface MechanismResult {
    authenticated?: boolean;
    mutuallyAuthenticated?: boolean;
    error?: string;
}
export interface Mechanism {
    name: string;
    providesMutualAuthentication?: boolean;
    getExpectedCredentials(): ExpectedCredentials;
    getCacheableCredentials(): CacheableCredentials | null;
    processChallenge(challenge: Buffer): void;
    processSuccess(challenge: Buffer): void;
    createResponse(credentials: Credentials): Buffer | null;
    finalize(credentials: Credentials): MechanismResult;
}
export declare type MechanismConstructor = new (name: string) => Mechanism;
export declare abstract class SimpleMech {
    name: string;
    protected authenticated: boolean;
    protected mutuallyAuthenticated: boolean;
    constructor(name: string);
    getCacheableCredentials(): CacheableCredentials | null;
    processChallenge(challenge: Buffer): void;
    processSuccess(success?: Buffer): void;
    finalize(): MechanismResult;
}
export declare class Factory {
    private mechanisms;
    constructor();
    register(name: string, constructor: MechanismConstructor, priority: number): void;
    disable(name: string): void;
    createMechanism(names: string[]): Mechanism | null;
}
export declare class ANONYMOUS extends SimpleMech implements Mechanism {
    getExpectedCredentials(): ExpectedCredentials;
    createResponse(credentials: Credentials): Buffer;
}
export declare class EXTERNAL extends SimpleMech implements Mechanism {
    getExpectedCredentials(): ExpectedCredentials;
    createResponse(credentials: Credentials): Buffer;
}
export declare class PLAIN extends SimpleMech implements Mechanism {
    getExpectedCredentials(): ExpectedCredentials;
    createResponse(credentials: Credentials): Buffer;
}
export declare class OAUTH extends SimpleMech implements Mechanism {
    constructor(name: string);
    getExpectedCredentials(): ExpectedCredentials;
    createResponse(credentials: Credentials): Buffer;
}
export declare class DIGEST extends SimpleMech implements Mechanism {
    name: string;
    providesMutualAuthentication: boolean;
    private nonce?;
    private realm?;
    private charset?;
    constructor(name: string);
    processChallenge(challenge: Buffer): void;
    getExpectedCredentials(): ExpectedCredentials;
    createResponse(credentials: Credentials): Buffer | null;
}
export declare class SCRAM implements Mechanism {
    name: string;
    providesMutualAuthentication: boolean;
    private useChannelBinding;
    private algorithm;
    private challenge;
    private salt;
    private iterationCount;
    private nonce;
    private clientNonce;
    private verifier;
    private error;
    private gs2Header;
    private clientFirstMessageBare;
    private serverSignature;
    private cache;
    private state;
    constructor(name: string);
    getExpectedCredentials(): ExpectedCredentials;
    getCacheableCredentials(): CacheableCredentials;
    createResponse(credentials: Credentials): Buffer | null;
    processChallenge(challenge: Buffer): void;
    processSuccess(success: Buffer): void;
    finalize(credentials: Credentials): MechanismResult;
    private initialResponse;
    private challengeResponse;
    private escapeUsername;
}
