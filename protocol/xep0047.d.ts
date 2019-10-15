/// <reference types="node" />
import { DefinitionOptions } from '../jxt';
declare module './' {
    interface Message {
        ibb?: IBBData;
    }
    interface IQPayload {
        ibb?: IBB;
    }
}
export interface IBBRequest {
    type: 'open' | 'close';
    sid: string;
    blockSize?: number;
    ack?: boolean;
}
export interface IBBData {
    type: 'data';
    sid: string;
    seq: number;
    data: Buffer;
}
export declare type IBB = IBBRequest | IBBData;
declare const Protocol: DefinitionOptions[];
export default Protocol;
