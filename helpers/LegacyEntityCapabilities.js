"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Hashes = tslib_1.__importStar(require("../lib/crypto"));
const Utils_1 = require("../Utils");
function escape(value) {
    return new Buffer(value.replace(/</g, '&lt;'), 'utf-8');
}
function encodeIdentities(identities = []) {
    const result = [];
    const existing = new Set();
    for (const { category, type, lang, name } of identities) {
        const encoded = `${category}/${type}/${lang || ''}/${name || ''}`;
        if (existing.has(encoded)) {
            return null;
        }
        existing.add(encoded);
        result.push(escape(encoded));
    }
    result.sort(Utils_1.octetCompare);
    return result;
}
function encodeFeatures(features = []) {
    const result = [];
    const existing = new Set();
    for (const feature of features) {
        if (existing.has(feature)) {
            return null;
        }
        existing.add(feature);
        result.push(escape(feature));
    }
    result.sort(Utils_1.octetCompare);
    return result;
}
function encodeForms(extensions = []) {
    const forms = [];
    const types = new Set();
    for (const form of extensions) {
        let type;
        for (const field of form.fields || []) {
            if (field.name === 'FORM_TYPE' &&
                field.type === 'hidden' &&
                field.rawValues &&
                field.rawValues.length === 1) {
                type = escape(field.rawValues[0]);
                break;
            }
        }
        if (!type) {
            continue;
        }
        if (types.has(type.toString())) {
            return null;
        }
        types.add(type.toString());
        forms.push({ type, form });
    }
    forms.sort((a, b) => Utils_1.octetCompare(a.type, b.type));
    const results = [];
    for (const form of forms) {
        results.push(form.type);
        const fields = encodeFields(form.form.fields);
        for (const field of fields) {
            results.push(field);
        }
    }
    return results;
}
function encodeFields(fields = []) {
    const sortedFields = [];
    for (const field of fields) {
        if (field.name === 'FORM_TYPE') {
            continue;
        }
        sortedFields.push({
            name: escape(field.name),
            values: (field.rawValues || []).map(val => escape(val)).sort(Utils_1.octetCompare)
        });
    }
    sortedFields.sort((a, b) => Utils_1.octetCompare(a.name, b.name));
    const result = [];
    for (const field of sortedFields) {
        result.push(field.name);
        for (const value of field.values) {
            result.push(value);
        }
    }
    return result;
}
function generate(info, hashName) {
    const S = [];
    const separator = new Buffer('<');
    const append = (b1, b2) => {
        S.push(b1);
        S.push(separator);
        if (b2) {
            S.push(b2);
        }
    };
    const identities = encodeIdentities(info.identities);
    const features = encodeFeatures(info.features);
    const extensions = encodeForms(info.extensions);
    if (!identities || !features || !extensions) {
        return null;
    }
    for (const id of identities) {
        append(id);
    }
    for (const feature of features) {
        append(feature);
    }
    for (const form of extensions) {
        append(form);
    }
    let version = Hashes.createHash(hashName)
        .update(Buffer.concat(S))
        .digest('base64');
    let padding = 4 - (version.length % 4);
    if (padding === 4) {
        padding = 0;
    }
    for (let i = 0; i < padding; i++) {
        version += '=';
    }
    return version;
}
exports.generate = generate;
function verify(info, hashName, check) {
    const computed = generate(info, hashName);
    return !!computed && computed === check;
}
exports.verify = verify;
