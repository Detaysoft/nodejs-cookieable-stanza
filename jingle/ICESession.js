"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const SDPUtils = tslib_1.__importStar(require("sdp"));
const Constants_1 = require("../Constants");
const Namespaces_1 = require("../Namespaces");
const Intermediate_1 = require("./lib/Intermediate");
const Protocol_1 = require("./lib/Protocol");
const Session_1 = tslib_1.__importDefault(require("./Session"));
class ICESession extends Session_1.default {
    constructor(opts) {
        super(opts);
        this.transportType = Namespaces_1.NS_JINGLE_ICE_UDP_1;
        this.pc = new RTCPeerConnection({
            ...opts.config,
            iceServers: opts.iceServers
        }, opts.constraints);
        this.pc.addEventListener('iceconnectionstatechange', () => {
            this.onIceStateChange();
        });
        this.pc.addEventListener('icecandidate', e => {
            if (e.candidate) {
                this.onIceCandidate(e);
            }
            else {
                this.onIceEndOfCandidates();
            }
        });
        this.restrictRelayBandwidth();
        this.bitrateLimit = 0;
        this.maxRelayBandwidth = opts.maxRelayBandwidth;
        this.candidateBuffer = [];
        this.restartingIce = false;
    }
    end(reason = 'success', silent = false) {
        this.pc.close();
        super.end(reason, silent);
    }
    /* actually do an ice restart */
    async restartIce() {
        // only initiators do an ice-restart to avoid conflicts.
        if (!this.isInitiator) {
            return;
        }
        if (this._maybeRestartingIce !== undefined) {
            clearTimeout(this._maybeRestartingIce);
        }
        this.restartingIce = true;
        try {
            await this.processLocal('restart-ice', async () => {
                const offer = await this.pc.createOffer({ iceRestart: true });
                // extract new ufrag / pwd, send transport-info with just that.
                const json = Intermediate_1.importFromSDP(offer.sdp);
                this.send(Constants_1.JingleAction.TransportInfo, {
                    contents: json.media.map(media => ({
                        creator: Constants_1.JingleSessionRole.Initiator,
                        name: media.mid,
                        transport: Protocol_1.convertIntermediateToTransport(media, this.transportType)
                    })),
                    sid: this.sid
                });
                await this.pc.setLocalDescription(offer);
            });
        }
        catch (err) {
            this._log('error', 'Could not create WebRTC offer', err);
            this.end(Constants_1.JingleReasonCondition.FailedTransport, true);
        }
    }
    // set the maximum bitrate. Only supported in Chrome and Firefox right now.
    async setMaximumBitrate(maximumBitrate) {
        if (this.maximumBitrate) {
            // potentially take into account bandwidth restrictions due to using TURN.
            maximumBitrate = Math.min(maximumBitrate, this.maximumBitrate);
        }
        this.currentBitrate = maximumBitrate;
        if (!(window.RTCRtpSender &&
            'getParameters' in window.RTCRtpSender.prototype)) {
            return;
        }
        // changes the maximum bandwidth using RTCRtpSender.setParameters.
        const sender = this.pc.getSenders().find(s => !!s.track && s.track.kind === 'video');
        if (!sender) {
            return;
        }
        let browser = '';
        if (window.navigator && window.navigator.mozGetUserMedia) {
            browser = 'firefox';
        }
        else if (window.navigator && window.navigator.webkitGetUserMedia) {
            browser = 'chrome';
        }
        const parameters = sender.getParameters();
        if (browser === 'firefox' && !parameters.encodings) {
            parameters.encodings = [{}];
        }
        if (maximumBitrate === 0) {
            delete parameters.encodings[0].maxBitrate;
        }
        else {
            if (!parameters.encodings.length) {
                parameters.encodings[0] = {};
            }
            parameters.encodings[0].maxBitrate = maximumBitrate;
        }
        try {
            await this.processLocal('set-bitrate', async () => {
                if (browser === 'chrome') {
                    await sender.setParameters(parameters);
                }
                else if (browser === 'firefox') {
                    // Firefox needs renegotiation:
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1253499
                    // but we do not want to intefere with our queue so we
                    // just hope this gets picked up.
                    if (this.pc.signalingState !== 'stable') {
                        await sender.setParameters(parameters);
                    }
                    else if (this.pc.localDescription &&
                        this.pc.localDescription.type === 'offer') {
                        await sender.setParameters(parameters);
                        const offer = await this.pc.createOffer();
                        await this.pc.setLocalDescription(offer);
                        await this.pc.setRemoteDescription(this.pc.remoteDescription);
                        await this.processBufferedCandidates();
                    }
                    else if (this.pc.localDescription &&
                        this.pc.localDescription.type === 'answer') {
                        await sender.setParameters(parameters);
                        await this.pc.setRemoteDescription(this.pc.remoteDescription);
                        await this.processBufferedCandidates();
                        const answer = await this.pc.createAnswer();
                        await this.pc.setLocalDescription(answer);
                    }
                }
            });
        }
        catch (err) {
            this._log('error', 'setParameters failed', err);
        }
    }
    // ----------------------------------------------------------------
    // Jingle action handers
    // ----------------------------------------------------------------
    async onTransportInfo(changes, cb) {
        if (changes.contents &&
            changes.contents[0] &&
            changes.contents[0].transport.gatheringComplete) {
            try {
                if (this.pc.signalingState === 'stable') {
                    await this.pc.addIceCandidate(null);
                }
                else {
                    this.candidateBuffer.push(null);
                }
            }
            catch (err) {
                this._log('debug', 'Could not add null ICE candidate');
            }
            finally {
                cb();
            }
            return;
        }
        // detect an ice restart.
        if (this.pc.remoteDescription) {
            const remoteDescription = this.pc.remoteDescription;
            const remoteJSON = Intermediate_1.importFromSDP(remoteDescription.sdp);
            const remoteMedia = remoteJSON.media.find(m => m.mid === changes.contents[0].name);
            const currentUsernameFragment = remoteMedia.iceParameters.usernameFragment;
            const remoteUsernameFragment = changes.contents[0].transport
                .usernameFragment;
            if (remoteUsernameFragment && currentUsernameFragment !== remoteUsernameFragment) {
                changes.contents.forEach((content, idx) => {
                    const transport = content.transport;
                    remoteJSON.media[idx].iceParameters = {
                        password: transport.password,
                        usernameFragment: transport.usernameFragment
                    };
                    remoteJSON.media[idx].candidates = [];
                });
                if (remoteDescription.type === 'offer') {
                    try {
                        await this.pc.setRemoteDescription(remoteDescription);
                        await this.processBufferedCandidates();
                        const answer = await this.pc.createAnswer();
                        const json = Intermediate_1.importFromSDP(answer.sdp);
                        this.send(Constants_1.JingleAction.TransportInfo, {
                            contents: json.media.map(media => ({
                                creator: Constants_1.JingleSessionRole.Initiator,
                                name: media.mid,
                                transport: Protocol_1.convertIntermediateToTransport(media, this.transportType)
                            })),
                            sid: this.sid
                        });
                        await this.pc.setLocalDescription(answer);
                        cb();
                    }
                    catch (err) {
                        this._log('error', 'Could not do remote ICE restart', err);
                        cb(err);
                        this.end(Constants_1.JingleReasonCondition.FailedTransport);
                    }
                    return;
                }
                try {
                    await this.pc.setRemoteDescription(remoteDescription);
                    await this.processBufferedCandidates();
                    cb();
                }
                catch (err) {
                    this._log('error', 'Could not do local ICE restart', err);
                    cb(err);
                    this.end(Constants_1.JingleReasonCondition.FailedTransport);
                }
            }
        }
        const all = (changes.contents || []).map(content => {
            const sdpMid = content.name;
            const results = (content.transport.candidates || []).map(async (json) => {
                const candidate = SDPUtils.writeCandidate(Protocol_1.convertCandidateToIntermediate(json));
                let sdpMLineIndex;
                // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1456417
                const remoteSDP = this.pc.remoteDescription.sdp;
                const mediaSections = SDPUtils.getMediaSections(remoteSDP);
                for (let i = 0; i < mediaSections.length; i++) {
                    if (SDPUtils.getMid(mediaSections[i]) === sdpMid) {
                        sdpMLineIndex = i;
                        break;
                    }
                }
                if (this.pc.signalingState === 'stable') {
                    try {
                        await this.pc.addIceCandidate({ sdpMid, sdpMLineIndex, candidate });
                    }
                    catch (err) {
                        this._log('error', 'Could not add ICE candidate', err);
                    }
                }
                else {
                    this.candidateBuffer.push({ sdpMid, sdpMLineIndex, candidate });
                }
            });
            return Promise.all(results);
        });
        try {
            await Promise.all(all);
            cb();
        }
        catch (err) {
            cb(err);
        }
    }
    async onSessionAccept(changes, cb) {
        this.state = 'active';
        const json = Protocol_1.convertRequestToIntermediate(changes, this.peerRole);
        const sdp = Intermediate_1.exportToSDP(json);
        try {
            await this.pc.setRemoteDescription({ type: 'answer', sdp });
            await this.processBufferedCandidates();
            this.parent.emit('accepted', this, undefined);
            cb();
        }
        catch (err) {
            this._log('error', `Could not process WebRTC answer: ${err}`);
            cb({ condition: 'general-error' });
        }
    }
    onSessionTerminate(changes, cb) {
        this._log('info', 'Terminating session');
        this.pc.close();
        super.end(changes.reason, true);
        cb();
    }
    // ----------------------------------------------------------------
    // ICE action handers
    // ----------------------------------------------------------------
    onIceCandidate(e) {
        if (!e.candidate.candidate) {
            return;
        }
        const candidate = SDPUtils.parseCandidate(e.candidate.candidate);
        const jingle = Protocol_1.convertIntermediateToTransportInfo(e.candidate.sdpMid, candidate, this.transportType);
        /* monkeypatch ufrag in Firefox */
        jingle.contents.forEach((content, idx) => {
            const transport = content.transport;
            if (!transport.usernameFragment) {
                const json = Intermediate_1.importFromSDP(this.pc.localDescription.sdp);
                transport.usernameFragment = json.media[idx].iceParameters.usernameFragment;
            }
        });
        this._log('info', 'Discovered new ICE candidate', jingle);
        this.send(Constants_1.JingleAction.TransportInfo, jingle);
    }
    onIceEndOfCandidates() {
        this._log('info', 'ICE end of candidates');
        const json = Intermediate_1.importFromSDP(this.pc.localDescription.sdp);
        const firstMedia = json.media[0];
        // signal end-of-candidates with our first media mid/ufrag
        this.send(Constants_1.JingleAction.TransportInfo, {
            contents: [
                {
                    creator: Constants_1.JingleSessionRole.Initiator,
                    name: firstMedia.mid,
                    transport: {
                        gatheringComplete: true,
                        transportType: this.transportType,
                        usernameFragment: firstMedia.iceParameters.usernameFragment
                    }
                }
            ]
        });
    }
    onIceStateChange() {
        switch (this.pc.iceConnectionState) {
            case 'checking':
                this.connectionState = 'connecting';
                break;
            case 'completed':
            case 'connected':
                this.connectionState = 'connected';
                this.restartingIce = false;
                break;
            case 'disconnected':
                if (this.pc.signalingState === 'stable') {
                    this.connectionState = 'interrupted';
                }
                else {
                    this.connectionState = 'disconnected';
                }
                if (this.restartingIce) {
                    this.end(Constants_1.JingleReasonCondition.FailedTransport);
                    return;
                }
                this.maybeRestartIce();
                break;
            case 'failed':
                if (this.connectionState === 'failed' || this.restartingIce) {
                    this.end(Constants_1.JingleReasonCondition.FailedTransport);
                    return;
                }
                this.connectionState = 'failed';
                this.restartIce();
                break;
            case 'closed':
                this.connectionState = 'disconnected';
                if (this.restartingIce) {
                    this.end(Constants_1.JingleReasonCondition.FailedTransport);
                }
                else {
                    this.end();
                }
                break;
        }
    }
    async processBufferedCandidates() {
        for (const candidate of this.candidateBuffer) {
            try {
                await this.pc.addIceCandidate(candidate);
            }
            catch (err) {
                this._log('error', 'Could not add ICE candidate', err);
            }
        }
        this.candidateBuffer = [];
    }
    /* when using TURN, we might want to restrict the bandwidth
     * to the value specified by MAX_RELAY_BANDWIDTH
     * in order to prevent sending excessive traffic through
     * the TURN server.
     */
    restrictRelayBandwidth() {
        if (!(window.RTCRtpSender &&
            'getParameters' in window.RTCRtpSender.prototype)) {
            return;
        }
        this.pc.addEventListener('iceconnectionstatechange', async () => {
            if (this.pc.iceConnectionState !== 'completed' &&
                this.pc.iceConnectionState !== 'connected') {
                return;
            }
            if (this._firstTimeConnected) {
                return;
            }
            this._firstTimeConnected = true;
            const stats = await this.pc.getStats();
            let activeCandidatePair;
            stats.forEach(report => {
                if (report.type === 'transport') {
                    activeCandidatePair = stats.get(report.selectedCandidatePairId);
                }
            });
            // Fallback for Firefox.
            if (!activeCandidatePair) {
                stats.forEach(report => {
                    if (report.type === 'candidate-pair' && report.selected) {
                        activeCandidatePair = report;
                    }
                });
            }
            if (activeCandidatePair) {
                let isRelay = false;
                if (activeCandidatePair.remoteCandidateId) {
                    const remoteCandidate = stats.get(activeCandidatePair.remoteCandidateId);
                    if (remoteCandidate && remoteCandidate.candidateType === 'relay') {
                        isRelay = true;
                    }
                }
                if (activeCandidatePair.localCandidateId) {
                    const localCandidate = stats.get(activeCandidatePair.localCandidateId);
                    if (localCandidate && localCandidate.candidateType === 'relay') {
                        isRelay = true;
                    }
                }
                if (isRelay) {
                    this.maximumBitrate = this.maxRelayBandwidth;
                    if (this.currentBitrate) {
                        this.setMaximumBitrate(Math.min(this.currentBitrate, this.maximumBitrate));
                    }
                }
            }
        });
    }
    /* determine whether an ICE restart is in order
     * when transitioning to disconnected. Strategy is
     * 'wait 2 seconds for things to repair themselves'
     * 'maybe check if bytes are sent/received' by comparing
     *   getStats measurements
     */
    maybeRestartIce() {
        // only initiators do an ice-restart to avoid conflicts.
        if (!this.isInitiator) {
            return;
        }
        if (this._maybeRestartingIce !== undefined) {
            clearTimeout(this._maybeRestartingIce);
        }
        this._maybeRestartingIce = setTimeout(() => {
            delete this._maybeRestartingIce;
            if (this.pc.iceConnectionState === 'disconnected') {
                this.restartIce();
            }
        }, 2000);
    }
}
exports.default = ICESession;
