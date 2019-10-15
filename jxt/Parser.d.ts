/**
 * This file is derived from prior work.
 *
 * See NOTICE.md for full license text.
 *
 * Derived from: ltx, Copyright © 2010 Stephan Maka
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import XMLElement from './Element';
export interface Attributes {
    [key: string]: string | undefined;
    xmlns?: string;
}
export interface ParserOptions {
    allowComments?: boolean;
}
export declare function parse(data: string, opts?: ParserOptions): XMLElement;
export default class Parser extends EventEmitter {
    private allowComments;
    private attributeName?;
    private attributeQuote?;
    private attributes?;
    private endTag;
    private recordStart?;
    private remainder?;
    private selfClosing?;
    private state;
    private tagName?;
    private haveDeclaration;
    private remainderPos?;
    constructor(opts?: ParserOptions);
    write(data: string): void;
    end(data?: string): void;
    private endRecording;
    private handleTagOpening;
    private waitForData;
    private lookAheadMatch;
    private lookBehindMatch;
}
