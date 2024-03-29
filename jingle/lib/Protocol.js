"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../../Constants");
const Namespaces_1 = require("../../Namespaces");
function convertIntermediateToApplication(media, role) {
    const rtp = media.rtpParameters;
    const rtcp = media.rtcpParameters || {};
    const encodingParameters = media.rtpEncodingParameters || [];
    let hasSSRC = false;
    if (encodingParameters && encodingParameters.length) {
        hasSSRC = !!encodingParameters[0].ssrc; // !== false ???
    }
    const application = {
        applicationType: Namespaces_1.NS_JINGLE_RTP_1,
        codecs: [],
        headerExtensions: [],
        media: media.kind,
        rtcpMux: rtcp.mux,
        rtcpReducedSize: rtcp.reducedSize,
        sourceGroups: [],
        sources: [],
        ssrc: hasSSRC ? encodingParameters[0].ssrc.toString() : undefined,
        streams: []
    };
    for (const ext of rtp.headerExtensions || []) {
        application.headerExtensions.push({
            id: ext.id,
            senders: ext.direction && ext.direction !== 'sendrecv'
                ? Constants_1.directionToSenders(role, ext.direction)
                : undefined,
            uri: ext.uri
        });
    }
    if (rtcp.ssrc && rtcp.cname) {
        application.sources = [
            {
                parameters: {
                    cname: rtcp.cname
                },
                ssrc: rtcp.ssrc.toString()
            }
        ];
    }
    if (hasSSRC && encodingParameters[0] && encodingParameters[0].rtx) {
        application.sourceGroups = [
            {
                semantics: 'FID',
                sources: [
                    encodingParameters[0].ssrc.toString(),
                    encodingParameters[0].rtx.ssrc.toString()
                ]
            }
        ];
    }
    for (const stream of media.streams || []) {
        application.streams.push({
            id: stream.stream,
            track: stream.track
        });
    }
    for (const codec of rtp.codecs || []) {
        const payload = {
            channels: codec.channels,
            clockRate: codec.clockRate,
            id: codec.payloadType.toString(),
            maxptime: codec.maxptime ? codec.maxptime.toString() : undefined,
            name: codec.name,
            parameters: codec.parameters,
            rtcpFeedback: codec.rtcpFeedback
        };
        for (const key of Object.keys(codec.parameters || {})) {
            if (key === 'ptime') {
                payload.ptime = codec.parameters[key].toString();
            }
        }
        application.codecs.push(payload);
    }
    return application;
}
exports.convertIntermediateToApplication = convertIntermediateToApplication;
function convertIntermediateToCandidate(candidate) {
    return {
        component: candidate.component,
        foundation: candidate.foundation,
        generation: undefined,
        id: undefined,
        ip: candidate.ip,
        network: undefined,
        port: candidate.port,
        priority: candidate.priority,
        protocol: candidate.protocol,
        relatedAddress: candidate.relatedAddress,
        relatedPort: candidate.relatedPort,
        tcpType: candidate.tcpType,
        type: candidate.type
    };
}
function convertCandidateToIntermediate(candidate) {
    return {
        address: candidate.ip,
        component: candidate.component,
        foundation: candidate.foundation,
        ip: candidate.ip,
        port: candidate.port,
        priority: candidate.priority,
        protocol: candidate.protocol,
        relatedAddress: candidate.relatedAddress,
        relatedPort: candidate.relatedPort,
        tcpType: candidate.tcpType,
        type: candidate.type
    };
}
exports.convertCandidateToIntermediate = convertCandidateToIntermediate;
function convertIntermediateToTransport(media, transportType) {
    const ice = media.iceParameters;
    const dtls = media.dtlsParameters;
    const transport = {
        candidates: [],
        transportType
    };
    if (ice) {
        transport.usernameFragment = ice.usernameFragment;
        transport.password = ice.password;
    }
    if (dtls) {
        transport.fingerprints = dtls.fingerprints.map(fingerprint => ({
            algorithm: fingerprint.algorithm,
            setup: media.setup,
            value: fingerprint.value
        }));
    }
    if (media.sctp) {
        transport.sctp = media.sctp;
    }
    for (const candidate of media.candidates || []) {
        transport.candidates.push(convertIntermediateToCandidate(candidate));
    }
    return transport;
}
exports.convertIntermediateToTransport = convertIntermediateToTransport;
function convertIntermediateToRequest(session, role, transportType) {
    return {
        contents: session.media.map(media => {
            const isRTP = media.kind === 'audio' || media.kind === 'video';
            return {
                application: isRTP
                    ? convertIntermediateToApplication(media, role)
                    : {
                        applicationType: 'datachannel',
                        protocol: media.protocol
                    },
                creator: Constants_1.JingleSessionRole.Initiator,
                name: media.mid,
                senders: Constants_1.directionToSenders(role, media.direction),
                transport: convertIntermediateToTransport(media, transportType)
            };
        }),
        groups: session.groups
            ? session.groups.map(group => ({
                contents: group.mids,
                semantics: group.semantics
            }))
            : []
    };
}
exports.convertIntermediateToRequest = convertIntermediateToRequest;
function convertContentToIntermediate(content, role) {
    const application = content.application || {};
    const transport = content.transport;
    const isRTP = application && application.applicationType === Namespaces_1.NS_JINGLE_RTP_1;
    const media = {
        direction: Constants_1.sendersToDirection(role, content.senders),
        kind: application.media || 'application',
        mid: content.name,
        protocol: isRTP ? 'UDP/TLS/RTP/SAVPF' : 'UDP/DTLS/SCTP'
    };
    if (isRTP) {
        media.rtcpParameters = {
            mux: application.rtcpMux,
            reducedSize: application.rtcpReducedSize
        };
        if (application.sources && application.sources.length) {
            const source = application.sources[0];
            media.rtcpParameters.ssrc = parseInt(source.ssrc, 10);
            if (source.parameters) {
                media.rtcpParameters.cname = source.parameters.cname;
            }
        }
        media.rtpParameters = {
            codecs: [],
            fecMechanisms: [],
            headerExtensions: []
        };
        if (application.streams) {
            media.streams = [];
            for (const stream of application.streams) {
                media.streams.push({
                    stream: stream.id,
                    track: stream.track
                });
            }
        }
        if (application.ssrc) {
            media.rtpEncodingParameters = [
                {
                    ssrc: parseInt(application.ssrc, 10)
                }
            ];
            if (application.sourceGroups && application.sourceGroups.length) {
                const group = application.sourceGroups[0];
                media.rtpEncodingParameters[0].rtx = {
                    // TODO: actually look for a FID one with matching ssrc
                    ssrc: parseInt(group.sources[1], 10)
                };
            }
        }
        for (const payload of application.codecs || []) {
            const parameters = payload.parameters || {};
            const rtcpFeedback = [];
            for (const fb of payload.rtcpFeedback || []) {
                rtcpFeedback.push({
                    parameter: fb.parameter,
                    type: fb.type
                });
            }
            media.rtpParameters.codecs.push({
                channels: payload.channels,
                clockRate: payload.clockRate,
                name: payload.name,
                numChannels: payload.channels,
                parameters,
                payloadType: parseInt(payload.id, 10),
                rtcpFeedback
            });
        }
        for (const ext of application.headerExtensions || []) {
            media.rtpParameters.headerExtensions.push({
                direction: ext.senders && ext.senders !== 'both'
                    ? Constants_1.sendersToDirection(role, ext.senders)
                    : undefined,
                id: ext.id,
                uri: ext.uri
            });
        }
    }
    if (transport) {
        if (transport.usernameFragment && transport.password) {
            media.iceParameters = {
                password: transport.password,
                usernameFragment: transport.usernameFragment
            };
        }
        if (transport.fingerprints && transport.fingerprints.length) {
            media.dtlsParameters = {
                fingerprints: [],
                role: 'auto'
            };
            for (const fingerprint of transport.fingerprints) {
                media.dtlsParameters.fingerprints.push({
                    algorithm: fingerprint.algorithm,
                    value: fingerprint.value
                });
            }
            if (transport.sctp) {
                media.sctp = transport.sctp;
            }
            media.setup = transport.fingerprints[0].setup;
        }
    }
    return media;
}
exports.convertContentToIntermediate = convertContentToIntermediate;
function convertRequestToIntermediate(jingle, role) {
    const session = {
        groups: [],
        media: []
    };
    for (const group of jingle.groups || []) {
        session.groups.push({
            mids: group.contents,
            semantics: group.semantics
        });
    }
    for (const content of jingle.contents || []) {
        session.media.push(convertContentToIntermediate(content, role));
    }
    return session;
}
exports.convertRequestToIntermediate = convertRequestToIntermediate;
function convertIntermediateToTransportInfo(mid, candidate, transportType) {
    return {
        contents: [
            {
                creator: Constants_1.JingleSessionRole.Initiator,
                name: mid,
                transport: {
                    candidates: [convertIntermediateToCandidate(candidate)],
                    transportType,
                    usernameFragment: candidate.usernameFragment || undefined
                }
            }
        ]
    };
}
exports.convertIntermediateToTransportInfo = convertIntermediateToTransportInfo;
