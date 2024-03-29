"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const SDP = tslib_1.__importStar(require("sdp"));
// ====================================================================
// Import SDP to Intermediary
// ====================================================================
function importFromSDP(sdp) {
    const mediaSections = SDP.getMediaSections(sdp);
    const sessionPart = SDP.getDescription(sdp);
    const session = {
        groups: [],
        media: []
    };
    for (const groupLine of SDP.matchPrefix(sessionPart, 'a=group:')) {
        const parts = groupLine.split(' ');
        const semantics = parts.shift().substr(8);
        session.groups.push({
            mids: parts,
            semantics
        });
    }
    for (const mediaSection of mediaSections) {
        const kind = SDP.getKind(mediaSection);
        const isRejected = SDP.isRejected(mediaSection);
        const mLine = SDP.parseMLine(mediaSection);
        const media = {
            direction: SDP.getDirection(mediaSection, sessionPart),
            kind,
            mid: SDP.getMid(mediaSection),
            protocol: mLine.protocol
            // TODO: what about end-of-candidates?
        };
        if (!isRejected) {
            media.iceParameters = SDP.getIceParameters(mediaSection, sessionPart);
            media.dtlsParameters = SDP.getDtlsParameters(mediaSection, sessionPart);
            media.setup = SDP.matchPrefix(mediaSection, 'a=setup:')[0].substr(8);
        }
        if (kind === 'audio' || kind === 'video') {
            media.rtpParameters = SDP.parseRtpParameters(mediaSection);
            media.rtpEncodingParameters = SDP.parseRtpEncodingParameters(mediaSection);
            media.rtcpParameters = SDP.parseRtcpParameters(mediaSection);
            const msid = SDP.parseMsid(mediaSection);
            if (msid) {
                media.streams = [msid];
            }
            else {
                media.streams = [];
            }
        }
        else if (kind === 'application') {
            media.sctp = SDP.parseSctpDescription(mediaSection);
        }
        media.candidates = SDP.matchPrefix(mediaSection, 'a=candidate:').map(SDP.parseCandidate);
        session.media.push(media);
    }
    return session;
}
exports.importFromSDP = importFromSDP;
// ====================================================================
// Export Intermediary to SDP
// ====================================================================
function exportToSDP(session) {
    const output = [];
    output.push(SDP.writeSessionBoilerplate(session.sessionId, session.sessionVersion), 'a=msid-semantic:WMS *\r\n');
    if (session.iceLite) {
        output.push('a=ice-lite\r\n');
    }
    for (const group of session.groups || []) {
        output.push(`a=group:${group.semantics} ${group.mids.join(' ')}\r\n`);
    }
    for (const media of session.media || []) {
        const isRejected = !(media.iceParameters && media.dtlsParameters);
        if (media.kind === 'application' && media.sctp) {
            output.push(SDP.writeSctpDescription(media, media.sctp));
        }
        else if (media.rtpParameters) {
            let mline = SDP.writeRtpDescription(media.kind, media.rtpParameters);
            if (isRejected) {
                mline = mline.replace(`m=${media.kind} 9 `, `m=${media.kind} 0 `);
            }
            output.push(mline);
            output.push(`a=${media.direction || 'sendrecv'}\r\n`);
            for (const stream of media.streams || []) {
                output.push(`a=msid:${stream.stream} ${stream.track}\r\n`);
            }
            if (media.rtcpParameters && media.rtcpParameters.cname) {
                output.push(`a=ssrc:${media.rtcpParameters.ssrc} cname:${media.rtcpParameters.cname}\r\n`);
                if (media.rtpEncodingParameters && media.rtpEncodingParameters[0].rtx) {
                    const params = media.rtpEncodingParameters[0];
                    output.push(`a=ssrc-group:FID ${params.ssrc} ${params.rtx.ssrc}\r\n`);
                    output.push(`a=ssrc:${params.rtx.ssrc} cname:${media.rtcpParameters.cname}\r\n`);
                }
            }
        }
        if (media.mid !== undefined) {
            output.push(`a=mid:${media.mid}\r\n`);
        }
        if (media.iceParameters) {
            output.push(SDP.writeIceParameters(media.iceParameters));
        }
        if (media.dtlsParameters && media.setup) {
            output.push(SDP.writeDtlsParameters(media.dtlsParameters, media.setup));
        }
        if (media.candidates && media.candidates.length) {
            for (const candidate of media.candidates) {
                output.push(`a=${SDP.writeCandidate(candidate)}`);
            }
        }
    }
    return output.join('');
}
exports.exportToSDP = exportToSDP;
