"use strict";
/**
 * This file is derived from prior work.
 *
 * See NOTICE.md for full license text.
 *
 * Derived from: ltx, Copyright © 2010 Stephan Maka
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const Definitions_1 = require("./Definitions");
const Element_1 = tslib_1.__importDefault(require("./Element"));
const Error_1 = tslib_1.__importDefault(require("./Error"));
function isPrintable(c) {
    return c >= 32 /* Space */;
}
function isWhitespace(c) {
    return (c === 32 /* Space */ ||
        c === 10 /* NewLine */ ||
        c === 13 /* CarriageReturn */ ||
        c === 9 /* Tab */);
}
function parse(data, opts = {}) {
    const p = new Parser(opts);
    let result;
    let element;
    let error = null;
    p.on('text', (text) => {
        if (element) {
            element.children.push(text);
        }
    });
    p.on('startElement', (name, attrs) => {
        const child = new Element_1.default(name, attrs);
        if (!result) {
            result = child;
        }
        if (!element) {
            element = child;
        }
        else {
            element = element.appendChild(child);
        }
    });
    p.on('endElement', (name) => {
        if (!element) {
            p.emit('error', Error_1.default.notWellFormed());
        }
        else if (name === element.name) {
            if (element.parent) {
                element = element.parent;
            }
            else if (!result) {
                result = element;
                element = undefined;
            }
        }
        else {
            p.emit('error', Error_1.default.notWellFormed());
        }
    });
    p.on('error', (e) => {
        error = e;
    });
    p.write(data);
    p.end();
    if (error) {
        throw error;
    }
    else {
        return result;
    }
}
exports.parse = parse;
class Parser extends events_1.EventEmitter {
    constructor(opts = {}) {
        super();
        this.allowComments = true;
        this.endTag = false;
        this.recordStart = 0;
        this.state = 9 /* TEXT */;
        this.haveDeclaration = false;
        if (opts.allowComments !== undefined) {
            this.allowComments = opts.allowComments;
        }
    }
    write(data) {
        let pos = 0;
        if (this.remainder) {
            data = this.remainder + data;
            if (this.remainderPos !== undefined) {
                pos = this.remainderPos;
            }
            else {
                pos = this.remainder.length;
            }
            this.remainderPos = undefined;
            this.remainder = undefined;
        }
        for (; pos < data.length; pos++) {
            const c = data.charCodeAt(pos);
            switch (this.state) {
                case 9 /* TEXT */: {
                    if (c === 60 /* LessThan */) {
                        const text = this.endRecording(data, pos);
                        if (text) {
                            let unescaped;
                            try {
                                unescaped = Definitions_1.unescapeXML(text);
                            }
                            catch (err) {
                                this.emit('error', err);
                                return;
                            }
                            this.emit('text', unescaped);
                        }
                        this.state = 8 /* TAG_NAME */;
                        this.recordStart = pos + 1;
                        this.attributes = {};
                    }
                    break;
                }
                case 4 /* CDATA */: {
                    if (c === 62 /* GreaterThan */ && this.lookBehindMatch(data, pos, ']]')) {
                        const text = this.endRecording(data, pos - 2);
                        if (text) {
                            this.emit('text', text);
                        }
                        this.state = 9 /* TEXT */;
                    }
                    break;
                }
                case 8 /* TAG_NAME */: {
                    if (c === 47 /* Slash */ && this.recordStart === pos) {
                        this.recordStart = pos + 1;
                        this.endTag = true;
                    }
                    else if (c === 33 /* Exclamation */) {
                        if (this.allowComments) {
                            const commentLookAhead = this.lookAheadMatch(data, pos, '--');
                            if (commentLookAhead === 1) {
                                this.recordStart = undefined;
                                this.state = 5 /* IGNORE_COMMENT */;
                                break;
                            }
                            else if (commentLookAhead === 0) {
                                this.waitForData(data, pos);
                                return;
                            }
                        }
                        const cdataLookAhead = this.lookAheadMatch(data, pos, '[CDATA[');
                        if (cdataLookAhead === 1) {
                            this.recordStart = pos + 8;
                            this.state = 4 /* CDATA */;
                            break;
                        }
                        else if (cdataLookAhead === 0) {
                            this.waitForData(data, pos);
                            return;
                        }
                        this.emit('error', Error_1.default.restrictedXML());
                        return;
                    }
                    else if (c === 63 /* Question */) {
                        this.recordStart = undefined;
                        if (!this.haveDeclaration) {
                            const xmlLookAhead = this.lookAheadMatch(data, pos, 'xml', true);
                            if (xmlLookAhead === 1) {
                                this.recordStart = pos + 4;
                                this.state = 10 /* XML_DECLARATION */;
                                break;
                            }
                            else if (xmlLookAhead === 0) {
                                this.waitForData(data, pos);
                                return;
                            }
                        }
                        this.emit('error', Error_1.default.restrictedXML());
                        return;
                    }
                    else if (!isPrintable(c) ||
                        isWhitespace(c) ||
                        c === 47 /* Slash */ ||
                        c === 62 /* GreaterThan */ ||
                        c === 60 /* LessThan */) {
                        this.tagName = this.endRecording(data, pos);
                        pos--;
                        this.state = 7 /* TAG */;
                    }
                    break;
                }
                case 5 /* IGNORE_COMMENT */: {
                    if (c === 62 /* GreaterThan */ &&
                        (this.lookBehindMatch(data, pos, '--') ||
                            this.lookBehindMatch(data, pos, ']]'))) {
                        this.state = 9 /* TEXT */;
                    }
                    break;
                }
                case 10 /* XML_DECLARATION */: {
                    if ((c === 120 /* x */ || c === 88 /* X */) &&
                        this.lookBehindMatch(data, pos, '?', true)) {
                        break;
                    }
                    else if ((c === 109 /* m */ || c === 77 /* M */) &&
                        this.lookBehindMatch(data, pos, '?x', true)) {
                        break;
                    }
                    else if ((c === 108 /* l */ || c === 78 /* L */) &&
                        this.lookBehindMatch(data, pos, '?xm', true)) {
                        break;
                    }
                    else if (isWhitespace(c)) {
                        this.haveDeclaration = true;
                        this.state = 6 /* IGNORE_INSTRUCTION */;
                        break;
                    }
                    this.emit('error', Error_1.default.restrictedXML());
                    return;
                }
                case 6 /* IGNORE_INSTRUCTION */: {
                    if (c === 62 /* GreaterThan */ && this.lookBehindMatch(data, pos, '?')) {
                        this.state = 9 /* TEXT */;
                    }
                    break;
                }
                case 7 /* TAG */: {
                    if (c === 62 /* GreaterThan */ || c === 60 /* LessThan */) {
                        this.handleTagOpening(this.endTag, this.tagName, this.attributes);
                        this.tagName = undefined;
                        this.attributes = undefined;
                        this.endTag = false;
                        this.selfClosing = false;
                        this.state = 9 /* TEXT */;
                        this.recordStart = pos + 1;
                    }
                    else if (c === 47 /* Slash */) {
                        this.selfClosing = true;
                    }
                    else if (isPrintable(c) && c !== 32 /* Space */) {
                        this.recordStart = pos;
                        this.state = 1 /* ATTR_NAME */;
                    }
                    break;
                }
                case 1 /* ATTR_NAME */: {
                    if (!isPrintable(c) || isWhitespace(c) || c === 61 /* Equal */) {
                        this.attributeName = this.endRecording(data, pos);
                        if (c === 61 /* Equal */) {
                            this.state = 2 /* ATTR_QUOTE */;
                        }
                        else {
                            pos--;
                            this.state = 0 /* ATTR_EQ */;
                        }
                    }
                    break;
                }
                case 0 /* ATTR_EQ */: {
                    if (isWhitespace(c)) {
                        break;
                    }
                    if (c === 61 /* Equal */) {
                        this.state = 2 /* ATTR_QUOTE */;
                        break;
                    }
                    this.emit('error', Error_1.default.notWellFormed());
                    return;
                }
                case 2 /* ATTR_QUOTE */: {
                    if (isWhitespace(c)) {
                        break;
                    }
                    if (c === 34 /* DoubleQuote */ || c === 39 /* SingleQuote */) {
                        this.attributeQuote = c;
                        this.state = 3 /* ATTR_VALUE */;
                        this.recordStart = pos + 1;
                        break;
                    }
                    this.emit('error', Error_1.default.notWellFormed());
                    return;
                }
                case 3 /* ATTR_VALUE */: {
                    if (c === this.attributeQuote) {
                        let value;
                        try {
                            value = Definitions_1.unescapeXML(this.endRecording(data, pos));
                        }
                        catch (err) {
                            this.emit('error', err);
                            return;
                        }
                        if (this.attributes[this.attributeName] !== undefined) {
                            this.emit('error', Error_1.default.notWellFormed());
                            return;
                        }
                        this.attributes[this.attributeName] = value;
                        this.attributeName = undefined;
                        this.state = 7 /* TAG */;
                    }
                }
            }
        }
        if (this.recordStart !== undefined && this.recordStart <= data.length) {
            this.remainder = data.slice(this.recordStart);
            this.recordStart = 0;
        }
    }
    end(data) {
        if (data) {
            this.write(data);
        }
        this.write = () => undefined;
    }
    endRecording(data, pos) {
        if (this.recordStart !== undefined) {
            const recorded = data.slice(this.recordStart, pos);
            this.recordStart = undefined;
            return recorded;
        }
        return '';
    }
    handleTagOpening(endTag, tagName, attrs) {
        if (!endTag) {
            this.emit('startElement', tagName, attrs);
            if (this.selfClosing) {
                this.emit('endElement', tagName);
            }
        }
        else {
            this.emit('endElement', tagName);
        }
    }
    waitForData(data, pos) {
        this.remainder = data.substr(pos);
        this.remainderPos = pos;
    }
    lookAheadMatch(data, pos, search, lowercase = false) {
        const needed = search.length;
        let lookahead = data.substr(pos + 1, needed);
        if (lowercase) {
            lookahead = lookahead.toLowerCase();
        }
        if (lookahead.length === needed && lookahead === search) {
            return 1;
        }
        if (lookahead.length < needed && search.startsWith(lookahead)) {
            return 0;
        }
        return -1;
    }
    lookBehindMatch(data, pos, search, lowercase = false) {
        if (pos - search.length < 0) {
            return false;
        }
        if (lowercase) {
            return data.substr(pos - search.length, search.length).toLowerCase() === search;
        }
        return data.substr(pos - search.length, search.length) === search;
    }
}
exports.default = Parser;
