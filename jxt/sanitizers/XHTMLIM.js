"use strict";
/**
 * This file is derived from prior work.
 *
 * See NOTICE.md for full license text.
 *
 * Derived from: xhtml-im.js, Copyright © 2013 Waqas Hussain
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ALLOWED_ELEMENTS = new Set([
    'a',
    'blockquote',
    'br',
    'cite',
    'em',
    'img',
    'li',
    'ol',
    'p',
    'span',
    'strong',
    'ul'
]);
const style = new Set(['style']);
const ALLOWED_ATTRIBUTES = new Map([
    ['a', new Set(['href', 'style'])],
    ['body', new Set(['style', 'xml:lang'])],
    ['blockquote', style],
    ['br', style],
    ['cite', style],
    ['em', style],
    ['img', new Set(['alt', 'height', 'src', 'style', 'width'])],
    ['li', style],
    ['ol', style],
    ['p', style],
    ['span', style],
    ['strong', style],
    ['ul', style]
]);
const CSS_RULES = new Map([
    ['font-style', /normal|italic|oblique|inherit/i],
    ['font-weight', /normal|bold|bolder|lighter|inherit|\d\d\d/i],
    ['text-decoration', /none|underline|overline|line-through|blink|inherit/i]
    // These properties are allowed by XHTML-IM, but really only cause UX issues:
    //  background-color
    //  color
    //  font-family
    //  font-size
    //  margin-left
    //  margin-right
    //  text-align
]);
const sanitizeCSS = (css) => {
    const declarations = `;${css}` // Declarations are ; delimited, not terminated
        .replace(/\/\*[^*]*\*+([^\/*][^*]*\*+)*\//g, '') // Strip comments
        .replace(/\/\*.*/, '') // Strip unclosed comments
        .replace(/\\([a-fA-F0-9]{1,6})\s?/, (_, x) => {
        // Decode escape sequences
        return String.fromCharCode(parseInt(x, 16));
    })
        .match(/;\s*([a-z\-]+)\s*:\s*([^;]*[^\s;])\s*/g); // Split into declarations
    const rules = [];
    if (!declarations) {
        return false;
    }
    for (const declaration of declarations) {
        const parts = declaration.match(/^;\s*([a-z\-]+)\s*:\s*([^;]*[^\s])\s*$/);
        if (!parts) {
            continue;
        }
        const sanitizer = CSS_RULES.get(parts[1]);
        if (sanitizer) {
            const value = parts[2].match(sanitizer);
            if (value) {
                rules.push(`${parts[1]}:${value[0]}`);
            }
        }
    }
    if (rules.length) {
        return rules.join('');
    }
    return false;
};
const sanitizeURL = (url) => {
    return (!!url.match(/^(https?|xmpp|cid|mailto|ftps?|im|ircs?|sips?|tel|geo|bitcoin|magnet):/i) &&
        url);
};
const sanitizeNumber = (num) => {
    return !!num.match(/^[0-9]*$/) && num;
};
const ATTRIBUTE_SANITIZERS = {
    alt: text => text,
    height: sanitizeNumber,
    href: sanitizeURL,
    src: sanitizeURL,
    style: sanitizeCSS,
    width: sanitizeNumber
};
const stripElement = (input) => {
    let results = [];
    for (const child of input.children) {
        if (typeof child === 'string') {
            results.push(child);
        }
        else if (child) {
            const sanitized = sanitizeInterior(child);
            if (sanitized) {
                if (Array.isArray(sanitized)) {
                    results = results.concat(sanitized);
                }
                else {
                    results.push(sanitized);
                }
            }
        }
    }
    return results;
};
const sanitizeRoot = (input) => {
    if (typeof input === 'string') {
        return;
    }
    let children = [];
    for (const child of input.children) {
        if (!child) {
            continue;
        }
        if (typeof child === 'string') {
            children.push(child);
            continue;
        }
        const sanitized = sanitizeInterior(child);
        if (Array.isArray(sanitized)) {
            children = children.concat(sanitized);
        }
        else if (sanitized) {
            children.push(sanitized);
        }
    }
    const attributes = {};
    if (input.name !== 'body') {
        return;
    }
    if (input.attributes.xmlns !== undefined) {
        attributes.xmlns = input.attributes.xmlns;
    }
    if (input.attributes.style) {
        attributes.style = input.attributes.style;
    }
    if (input.attributes['xml:lang'] !== undefined) {
        attributes['xml:lang'] = input.attributes['xml:lang'];
    }
    return {
        attributes,
        children,
        name: 'body'
    };
};
const sanitizeInterior = (input) => {
    if (typeof input === 'string') {
        return input;
    }
    if (!ALLOWED_ELEMENTS.has(input.name)) {
        if (input.name === 'script') {
            return;
        }
        return stripElement(input);
    }
    const children = input.children
        .map(sanitizeInterior)
        .filter(child => child !== undefined);
    const attributes = {};
    for (const key of Object.keys(input.attributes)) {
        const allowed = ALLOWED_ATTRIBUTES.get(input.name);
        if (!allowed || !allowed.has(key)) {
            continue;
        }
        let value = input.attributes[key];
        if (!value) {
            continue;
        }
        value = ATTRIBUTE_SANITIZERS[key](value);
        if (!value) {
            continue;
        }
        attributes[key] = value;
    }
    return {
        attributes,
        children,
        name: input.name
    };
};
exports.default = sanitizeRoot;
