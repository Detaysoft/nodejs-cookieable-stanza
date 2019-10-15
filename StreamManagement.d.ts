import { Agent } from './';
import { IQ, Message, Presence, StreamManagementAck, StreamManagementEnabled, StreamManagementFailed, StreamManagementResume } from './protocol';
declare type Unacked = ['message', Message] | ['presence', Presence] | ['iq', IQ];
interface SMState {
    handled: number;
    id?: string;
    jid?: string;
    lastAck: number;
    unacked: Unacked[];
}
export default class StreamManagement {
    id?: string;
    allowResume: boolean;
    lastAck: number;
    handled: number;
    windowSize: number;
    unacked: Unacked[];
    private pendingAck;
    private inboundStarted;
    private outboundStarted;
    private client;
    private cacheHandler;
    constructor(client: Agent);
    started: boolean;
    load(opts: SMState): void;
    cache(handler: (data: SMState) => void): void;
    enable(): void;
    resume(): void;
    enabled(resp: StreamManagementEnabled): void;
    resumed(resp: StreamManagementResume): void;
    failed(resp: StreamManagementFailed): void;
    ack(): void;
    request(): void;
    process(ack: StreamManagementAck | StreamManagementResume | StreamManagementFailed, resend?: boolean): void;
    track(kind: string, stanza: Message | Presence | IQ): void;
    handle(): void;
    needAck(): boolean;
    private _cache;
    private _reset;
}
export {};
