"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MAX_SEQ = Math.pow(2, 32);
const mod = (v, n) => ((v % n) + n) % n;
class StreamManagement {
    constructor(client) {
        this.allowResume = true;
        this.lastAck = 0;
        this.handled = 0;
        this.windowSize = 1;
        this.unacked = [];
        this.pendingAck = false;
        this.inboundStarted = false;
        this.outboundStarted = false;
        this.client = client;
        this.id = undefined;
        this.allowResume = true;
        this.started = false;
        this.cacheHandler = () => null;
        this._reset();
    }
    get started() {
        return this.outboundStarted && this.inboundStarted;
    }
    set started(value) {
        if (!value) {
            this.outboundStarted = false;
            this.inboundStarted = false;
        }
    }
    load(opts) {
        this.id = opts.id;
        this.allowResume = true;
        this.handled = opts.handled;
        this.lastAck = opts.lastAck;
        this.unacked = opts.unacked;
        if (opts.jid) {
            this.client.jid = opts.jid;
            this.client.emit('session:bound', opts.jid);
        }
    }
    cache(handler) {
        this.cacheHandler = handler;
    }
    enable() {
        this.client.send('sm', {
            allowResumption: this.allowResume,
            type: 'enable'
        });
        this.handled = 0;
        this.pendingAck = false;
        this.outboundStarted = true;
    }
    resume() {
        this.client.send('sm', {
            handled: this.handled,
            previousSession: this.id,
            type: 'resume'
        });
        this.pendingAck = false;
        this.outboundStarted = true;
    }
    enabled(resp) {
        this.id = resp.id;
        this.handled = 0;
        this.inboundStarted = true;
        this._cache();
    }
    resumed(resp) {
        this.id = resp.previousSession;
        if (resp.handled !== undefined) {
            this.process(resp, true);
        }
        this.inboundStarted = true;
        this._cache();
    }
    failed(resp) {
        // Resumption might fail, but the server can still tell us how far
        // the old session progressed.
        if (resp.handled !== undefined) {
            this.process(resp);
        }
        // We alert that any remaining unacked stanzas failed to send. It has
        // been too long for auto-retrying these to be the right thing to do.
        for (const [kind, stanza] of this.unacked) {
            this.client.emit('stanza:failed', { kind, stanza });
        }
        this._reset();
        this._cache();
    }
    ack() {
        this.client.send('sm', {
            handled: this.handled,
            type: 'ack'
        });
    }
    request() {
        this.pendingAck = true;
        this.client.send('sm', {
            type: 'request'
        });
    }
    process(ack, resend = false) {
        if (ack.handled === undefined) {
            return;
        }
        const numAcked = mod(ack.handled - this.lastAck, MAX_SEQ);
        this.pendingAck = false;
        for (let i = 0; i < numAcked && this.unacked.length > 0; i++) {
            const [kind, stanza] = this.unacked.shift();
            this.client.emit('stanza:acked', { kind, stanza });
        }
        this.lastAck = ack.handled;
        if (resend) {
            const resendUnacked = this.unacked;
            this.unacked = [];
            for (const [kind, stanza] of resendUnacked) {
                this.client.send(kind, stanza);
            }
        }
        this._cache();
        if (this.needAck()) {
            this.request();
        }
    }
    track(kind, stanza) {
        if (kind !== 'message' && kind !== 'presence' && kind !== 'iq') {
            return;
        }
        if (this.outboundStarted) {
            this.unacked.push([kind, stanza]);
            this._cache();
            if (this.needAck()) {
                this.request();
            }
        }
    }
    handle() {
        if (this.inboundStarted) {
            this.handled = mod(this.handled + 1, MAX_SEQ);
            this._cache();
        }
    }
    needAck() {
        return !this.pendingAck && this.unacked.length >= this.windowSize;
    }
    _cache() {
        this.cacheHandler({
            handled: this.handled,
            id: this.id,
            jid: this.client.jid,
            lastAck: this.lastAck,
            unacked: this.unacked
        });
    }
    _reset() {
        this.inboundStarted = false;
        this.outboundStarted = false;
        this.lastAck = 0;
        this.handled = 0;
        this.unacked = [];
        this.pendingAck = false;
    }
}
exports.default = StreamManagement;
