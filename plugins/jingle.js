"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Jingle = tslib_1.__importStar(require("../jingle"));
const Namespaces_1 = require("../Namespaces");
let root;
try {
    root = window;
}
catch (err) {
    root = global;
}
function default_1(client) {
    const jingle = (client.jingle = new Jingle.SessionManager());
    client.disco.addFeature(Namespaces_1.NS_JINGLE_1);
    if (root.RTCPeerConnection) {
        const caps = [
            Namespaces_1.NS_JINGLE_RTP_1,
            Namespaces_1.NS_JINGLE_RTP_RTCP_FB_0,
            Namespaces_1.NS_JINGLE_RTP_HDREXT_0,
            Namespaces_1.NS_JINGLE_RTP_SSMA_0,
            Namespaces_1.NS_JINGLE_DTLS_0,
            Namespaces_1.NS_JINGLE_GROUPING_0,
            Namespaces_1.NS_JINGLE_ICE_0,
            Namespaces_1.NS_JINGLE_ICE_UDP_1,
            Namespaces_1.NS_JINGLE_RTP_AUDIO,
            Namespaces_1.NS_JINGLE_RTP_VIDEO,
            Namespaces_1.NS_JINGLE_FILE_TRANSFER_3,
            Namespaces_1.NS_JINGLE_DTLS_SCTP_1,
            'urn:ietf:rfc:3264',
            'urn:ietf:rfc:5576',
            'urn:ietf:rfc:5888'
        ];
        for (const cap of caps) {
            client.disco.addFeature(cap);
        }
    }
    const mappedEvents = [
        'outgoing',
        'incoming',
        'accepted',
        'terminated',
        'ringing',
        'mute',
        'unmute',
        'hold',
        'resumed'
    ];
    for (const event of mappedEvents) {
        jingle.on(event, (session, data) => {
            client.emit(('jingle:' + event), session, data);
        });
    }
    jingle.on('createdSession', data => {
        client.emit('jingle:created', data);
    });
    jingle.on('send', async (data) => {
        try {
            if (data.type === 'set') {
                const resp = await client.sendIQ(data);
                if (!resp.jingle) {
                    resp.jingle = {};
                }
                resp.jingle.sid = data.jingle.sid;
                jingle.process(resp);
            }
            if (data.type === 'result') {
                client.sendIQResult({ type: 'set', id: data.id, from: data.to }, data);
            }
            if (data.type === 'error') {
                client.sendIQError({ type: 'set', id: data.id, from: data.to }, data);
            }
        }
        catch (err) {
            console.error(err);
            if (!err.jingle) {
                err.jingle = {};
            }
            err.jingle.sid = data.jingle.sid;
            jingle.process(err);
        }
    });
    client.on('session:bound', (jid) => {
        jingle.selfID = jid;
    });
    client.on('iq:set:jingle', (data) => {
        jingle.process(data);
    });
    client.on('unavailable', (pres) => {
        jingle.endPeerSessions(pres.from, undefined, true);
    });
    client.getServices = async (jid, type) => {
        const resp = await client.sendIQ({
            externalServices: {
                type
            },
            to: jid,
            type: 'get'
        });
        const services = resp.externalServices;
        services.services = services.services || [];
        return services;
    };
    client.getServiceCredentials = async (jid, host, type, port) => {
        const resp = await client.sendIQ({
            externalServiceCredentials: {
                host,
                port,
                type
            },
            to: jid,
            type: 'get'
        });
        return resp.externalServiceCredentials;
    };
    client.discoverICEServers = async () => {
        try {
            const resp = await client.getServices(client.config.server);
            const services = resp.services || [];
            const discovered = [];
            for (const service of services) {
                const ice = {
                    urls: []
                };
                const baseUrl = `${service.type}:${service.host}`;
                const port = service.port ? `:${service.port}` : '';
                const transport = service.transport ? `?transport=${service.transport}` : '';
                if (service.type === 'stun' || service.type === 'stuns') {
                    ice.urls = [`${baseUrl}${port}`];
                }
                if (service.type === 'turn' || service.type === 'turns') {
                    if (service.username) {
                        ice.username = service.username;
                    }
                    if (service.password) {
                        ice.credential = service.password;
                    }
                    ice.urls = [`${baseUrl}${port}${transport}`];
                }
                if (ice.urls.length) {
                    discovered.push(ice);
                }
            }
            for (const ice of discovered) {
                client.jingle.addICEServer(ice);
            }
            return discovered;
        }
        catch (err) {
            return [];
        }
    };
}
exports.default = default_1;
