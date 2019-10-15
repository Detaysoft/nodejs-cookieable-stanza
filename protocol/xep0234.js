"use strict";
// ====================================================================
// XEP-0234: Jingle File Transfer
// --------------------------------------------------------------------
// Source: https://xmpp.org/extensions/xep-0234.html
// Version: Version 0.18.3 (2017-08-24)
// ====================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const jxt_1 = require("../jxt");
const Namespaces_1 = require("../Namespaces");
const Protocol = [
    jxt_1.addAlias(Namespaces_1.NS_HASHES_2, 'hash', [{ path: 'file.hashes', multiple: true }]),
    jxt_1.addAlias(Namespaces_1.NS_HASHES_2, 'hash-used', [{ path: 'file.hashesUsed', multiple: true }]),
    jxt_1.addAlias(Namespaces_1.NS_THUMBS_1, 'thumbnail', [{ path: 'file.thumbnails', multiple: true }]),
    {
        aliases: [
            'file',
            {
                path: 'iq.jingle.contents.application.file',
                selector: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5
            },
            {
                path: 'iq.jingle.info.file',
                selector: `{${Namespaces_1.NS_JINGLE_FILE_TRANSFER_5}}checksum`
            }
        ],
        element: 'file',
        fields: {
            date: jxt_1.childDate(null, 'date'),
            description: jxt_1.childText(null, 'desc'),
            mediaType: jxt_1.childText(null, 'media-type'),
            name: jxt_1.childText(null, 'name'),
            size: jxt_1.childInteger(null, 'size')
        },
        namespace: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5
    },
    {
        element: 'range',
        fields: {
            length: jxt_1.integerAttribute('length'),
            offset: jxt_1.integerAttribute('offset', 0)
        },
        namespace: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5,
        path: 'file.range'
    },
    {
        element: 'description',
        namespace: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5,
        path: 'iq.jingle.contents.application',
        type: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5,
        typeField: 'applicationType'
    },
    {
        element: 'received',
        fields: {
            creator: jxt_1.attribute('creator'),
            name: jxt_1.attribute('name')
        },
        namespace: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5,
        path: 'iq.jingle.info',
        type: `{${Namespaces_1.NS_JINGLE_FILE_TRANSFER_5}}received`,
        typeField: 'infoType'
    },
    {
        element: 'checksum',
        fields: {
            creator: jxt_1.attribute('creator'),
            name: jxt_1.attribute('name')
        },
        namespace: Namespaces_1.NS_JINGLE_FILE_TRANSFER_5,
        path: 'iq.jingle.info',
        type: `{${Namespaces_1.NS_JINGLE_FILE_TRANSFER_5}}checksum`,
        typeField: 'infoType'
    }
];
exports.default = Protocol;
