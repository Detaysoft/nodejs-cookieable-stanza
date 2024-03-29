"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Element_1 = tslib_1.__importDefault(require("./Element"));
const Parser_1 = require("./Parser");
function createElement(namespace, name, parentNamespace, parent) {
    if (parent) {
        namespace = namespace || parent.getNamespace();
        const root = parent.getNamespaceRoot(namespace);
        if (root) {
            const prefix = root.useNamespace('', namespace);
            name = `${prefix}:${name}`;
        }
    }
    const el = new Element_1.default(name);
    if (name.indexOf(':') < 0 && (!parentNamespace || namespace !== parentNamespace)) {
        el.setAttribute('xmlns', namespace);
    }
    return el;
}
exports.createElement = createElement;
function getLang(xml, lang) {
    return (xml.getAttribute('xml:lang') || lang || '').toLowerCase();
}
exports.getLang = getLang;
function getTargetLang(children, context) {
    const availableLanguages = [];
    for (const child of children) {
        availableLanguages.push(getLang(child, context.lang));
    }
    let targetLanguage;
    if (!context.resolveLanguage) {
        targetLanguage = context.lang;
    }
    else {
        targetLanguage = context.resolveLanguage(availableLanguages, context.acceptLanguages || [], context.lang);
    }
    return targetLanguage || '';
}
exports.getTargetLang = getTargetLang;
function findAll(xml, namespace, element, lang) {
    const existing = xml.getChildren(element, namespace);
    const parentLang = getLang(xml);
    if (existing.length) {
        if (lang) {
            return existing.filter(child => {
                const childLang = getLang(child, parentLang);
                if (childLang === lang) {
                    return true;
                }
            });
        }
        else {
            return existing;
        }
    }
    return [];
}
exports.findAll = findAll;
function findOrCreate(xml, namespace, element, lang) {
    namespace = namespace || xml.getNamespace();
    const existing = findAll(xml, namespace, element, lang);
    if (existing.length) {
        return existing[0];
    }
    const created = createElement(namespace, element, xml.getDefaultNamespace(), xml);
    const parentLang = getLang(xml, lang);
    if (lang && parentLang !== lang) {
        created.setAttribute('xml:lang', lang);
    }
    xml.appendChild(created);
    return created;
}
exports.findOrCreate = findOrCreate;
function createAttributeField(opts) {
    return {
        importer(xml) {
            const rawValue = xml.getAttribute(opts.name, opts.namespace);
            if (!rawValue) {
                return opts.dynamicDefault ? opts.dynamicDefault(rawValue) : opts.staticDefault;
            }
            return opts.parseValue(rawValue);
        },
        exporter(xml, value) {
            if (value === undefined) {
                return;
            }
            const output = opts.writeValue(value);
            if (!output && !opts.emitEmpty) {
                return;
            }
            if (!opts.namespace || !opts.prefix) {
                xml.setAttribute(opts.name, output, opts.emitEmpty);
            }
            else {
                let prefix;
                const root = xml.getNamespaceRoot(opts.namespace);
                if (root) {
                    prefix = root.useNamespace(opts.prefix, opts.namespace);
                }
                else {
                    const namespaces = xml.getNamespaceContext();
                    if (!namespaces[opts.namespace]) {
                        prefix = xml.useNamespace(opts.prefix, opts.namespace);
                        namespaces[opts.namespace] = prefix;
                    }
                }
                xml.setAttribute(`${prefix}:${opts.name}`, output, opts.emitEmpty);
            }
        }
    };
}
function createAttributeType(parser, createOpts) {
    return (name, defaultValue = undefined, opts = {}) => {
        opts = { staticDefault: defaultValue, ...opts };
        return createAttributeField({
            name,
            ...parser,
            ...(createOpts ? createOpts(opts) : opts)
        });
    };
}
function createNamespacedAttributeType(parser, createOpts) {
    return (prefix, namespace, name, defaultValue = undefined, opts = {}) => {
        opts = { staticDefault: defaultValue, ...opts };
        return createAttributeField({
            name,
            namespace,
            prefix,
            ...parser,
            ...(createOpts ? createOpts(opts) : opts)
        });
    };
}
function createChildAttributeField(opts) {
    const converter = opts.converter ||
        createAttributeField({
            ...opts,
            namespace: opts.attributeNamespace
        });
    return {
        importer(xml, context) {
            const child = xml.getChild(opts.element, opts.namespace || xml.getNamespace());
            if (!child) {
                return opts.dynamicDefault ? opts.dynamicDefault() : opts.staticDefault;
            }
            return converter.importer(child, context);
        },
        exporter(xml, value, context) {
            if (value !== undefined) {
                const child = findOrCreate(xml, opts.namespace || xml.getNamespace(), opts.element);
                converter.exporter(child, value, context);
            }
        }
    };
}
function createChildAttributeType(parser, createOpts) {
    return (namespace, element, name, defaultValue = undefined, opts = {}) => {
        opts = { staticDefault: defaultValue, ...opts };
        return createChildAttributeField({
            element,
            name,
            namespace,
            ...parser,
            ...(createOpts ? createOpts(opts) : opts)
        });
    };
}
function createTextField(opts) {
    return {
        importer(xml) {
            const rawValue = xml.getText();
            if (!rawValue) {
                return opts.dynamicDefault ? opts.dynamicDefault(rawValue) : opts.staticDefault;
            }
            return opts.parseValue(rawValue);
        },
        exporter(xml, value) {
            if (value === undefined) {
                return;
            }
            const output = opts.writeValue(value);
            if (output) {
                xml.children.push(output);
            }
        }
    };
}
function createChildTextField(opts) {
    const converter = createTextField(opts);
    return {
        importer(xml, context) {
            const children = findAll(xml, opts.namespace || xml.getNamespace(), opts.element);
            const targetLanguage = getTargetLang(children, context);
            if (!children.length) {
                return opts.dynamicDefault ? opts.dynamicDefault() : opts.staticDefault;
            }
            if (opts.matchLanguage) {
                for (const child of children) {
                    if (getLang(child, context.lang) === targetLanguage) {
                        return converter.importer(child, context);
                    }
                }
            }
            return converter.importer(children[0], context);
        },
        exporter(xml, value, context) {
            if (value !== undefined) {
                const child = findOrCreate(xml, opts.namespace || xml.getNamespace(), opts.element, opts.matchLanguage ? context.lang : undefined);
                converter.exporter(child, value, context);
            }
        }
    };
}
const stringParser = {
    parseValue: v => v,
    writeValue: v => v
};
const integerParser = {
    parseValue: v => parseInt(v, 10),
    writeValue: v => v.toString()
};
const floatParser = {
    parseValue: v => parseFloat(v),
    writeValue: v => v.toString()
};
const boolParser = {
    parseValue: v => {
        if (v === 'true' || v === '1') {
            return true;
        }
        if (v === 'false' || v === '0') {
            return false;
        }
        return;
    },
    writeValue: v => (v ? 'true' : 'false')
};
const dateParser = {
    parseValue: v => new Date(v),
    writeValue: v => (typeof v === 'string' ? v : v.toISOString())
};
const jsonParser = {
    parseValue: v => JSON.parse(v),
    writeValue: v => JSON.stringify(v)
};
const bufferParser = (encoding = 'utf8') => ({
    parseValue: v => {
        if (encoding === 'base64' && v === '=') {
            v = '';
        }
        return Buffer.from(v.trim(), encoding);
    },
    writeValue: v => {
        let data;
        if (typeof v === 'string') {
            data = Buffer.from(v).toString(encoding);
        }
        else if (v) {
            data = v.toString(encoding);
        }
        else {
            data = '';
        }
        if (encoding === 'base64') {
            data = data || '=';
        }
        return data;
    }
});
const tzOffsetParser = {
    parseValue: v => {
        let sign = -1;
        if (v.charAt(0) === '-') {
            sign = 1;
            v = v.slice(1);
        }
        const split = v.split(':');
        const hours = parseInt(split[0], 10);
        const minutes = parseInt(split[1], 10);
        return (hours * 60 + minutes) * sign;
    },
    writeValue: v => {
        if (typeof v === 'string') {
            return v;
        }
        else {
            let formatted = '-';
            if (v < 0) {
                v = -v;
                formatted = '+';
            }
            const hours = v / 60;
            const minutes = v % 60;
            formatted +=
                (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
            return formatted;
        }
    }
};
// ====================================================================
// Field Types
// ====================================================================
exports.attribute = createAttributeType(stringParser, opts => ({
    dynamicDefault: opts.emitEmpty ? v => (v === '' ? '' : opts.staticDefault) : undefined,
    ...opts
}));
exports.booleanAttribute = createAttributeType(boolParser);
exports.integerAttribute = createAttributeType(integerParser);
exports.floatAttribute = createAttributeType(floatParser);
exports.dateAttribute = createAttributeType(dateParser);
exports.namespacedAttribute = createNamespacedAttributeType(stringParser);
exports.namespacedBooleanAttribute = createNamespacedAttributeType(boolParser);
exports.namespacedIntegerAttribute = createNamespacedAttributeType(integerParser);
exports.namespacedFloatAttribute = createNamespacedAttributeType(floatParser);
exports.namespacedDateAttribute = createNamespacedAttributeType(dateParser);
exports.childAttribute = createChildAttributeType(stringParser);
exports.childBooleanAttribute = createChildAttributeType(boolParser);
exports.childIntegerAttribute = createChildAttributeType(integerParser);
exports.childFloatAttribute = createChildAttributeType(floatParser);
exports.childDateAttribute = createChildAttributeType(dateParser);
exports.text = (defaultValue) => createTextField({
    staticDefault: defaultValue,
    ...stringParser
});
exports.textJSON = () => createTextField({ ...jsonParser });
exports.textBuffer = (encoding = 'utf8') => createTextField({
    ...bufferParser(encoding)
});
function languageAttribute() {
    return {
        importer(xml, context) {
            return getLang(xml, context.lang);
        },
        exporter(xml, value, context) {
            if (value && value.toLowerCase() !== context.lang) {
                xml.setAttribute('xml:lang', value);
            }
            else {
                xml.setAttribute('xml:lang', undefined);
            }
        }
    };
}
exports.languageAttribute = languageAttribute;
exports.childLanguageAttribute = (namespace, element) => createChildAttributeField({
    converter: languageAttribute(),
    element,
    name: 'xml:lang',
    namespace,
    ...stringParser
});
exports.childText = (namespace, element, defaultValue) => createChildTextField({
    element,
    matchLanguage: true,
    namespace,
    staticDefault: defaultValue,
    ...stringParser
});
exports.childTextBuffer = (namespace, element, encoding = 'utf8') => createChildTextField({
    element,
    matchLanguage: true,
    namespace,
    ...bufferParser(encoding)
});
exports.childDate = (namespace, element) => createChildTextField({
    element,
    namespace,
    ...dateParser
});
exports.childInteger = (namespace, element, defaultValue) => createChildTextField({
    element,
    namespace,
    staticDefault: defaultValue,
    ...integerParser
});
exports.childFloat = (namespace, element, defaultValue) => createChildTextField({
    element,
    namespace,
    staticDefault: defaultValue,
    ...floatParser
});
exports.childJSON = (namespace, element) => createChildTextField({
    element,
    namespace,
    ...jsonParser
});
function childTimezoneOffset(namespace, element) {
    return createChildTextField({
        element,
        namespace,
        staticDefault: 0,
        ...tzOffsetParser
    });
}
exports.childTimezoneOffset = childTimezoneOffset;
function childBoolean(namespace, element) {
    return {
        importer(xml) {
            const child = xml.getChild(element, namespace || xml.getNamespace());
            if (child) {
                return true;
            }
        },
        exporter(xml, value) {
            if (value) {
                findOrCreate(xml, namespace || xml.getNamespace(), element);
            }
        }
    };
}
exports.childBoolean = childBoolean;
const deepChildExpoter = (path, xml, value) => {
    if (!value) {
        return;
    }
    let current = xml;
    for (const node of path) {
        current = findOrCreate(current, node.namespace || current.getNamespace(), node.element);
    }
    current.children.push(value.toString());
};
function deepChildText(path, defaultValue) {
    return {
        importer(xml) {
            let current = xml;
            for (const node of path) {
                current = current.getChild(node.element, node.namespace || current.getNamespace());
                if (!current) {
                    return defaultValue;
                }
            }
            return current.getText() || defaultValue;
        },
        exporter(xml, value) {
            deepChildExpoter(path, xml, value);
        }
    };
}
exports.deepChildText = deepChildText;
function deepChildInteger(path, defaultValue) {
    return {
        importer(xml) {
            let current = xml;
            for (const node of path) {
                current = current.getChild(node.element, node.namespace || current.getNamespace());
                if (!current) {
                    return;
                }
            }
            const data = current.getText();
            if (data) {
                return parseInt(data, 10);
            }
            else if (defaultValue) {
                return defaultValue;
            }
        },
        exporter(xml, value) {
            deepChildExpoter(path, xml, value);
        }
    };
}
exports.deepChildInteger = deepChildInteger;
function deepChildBoolean(path) {
    return {
        importer(xml) {
            let current = xml;
            for (const node of path) {
                current = current.getChild(node.element, node.namespace || current.getNamespace());
                if (!current) {
                    return false;
                }
            }
            return true;
        },
        exporter(xml, value) {
            if (!value) {
                return;
            }
            let current = xml;
            for (const node of path) {
                current = findOrCreate(current, node.namespace || current.getNamespace(), node.element);
            }
        }
    };
}
exports.deepChildBoolean = deepChildBoolean;
function childEnum(namespace, elements, defaultValue) {
    const elementNames = new Map();
    const valueNames = new Map();
    for (const el of elements) {
        if (typeof el === 'string') {
            elementNames.set(el, el);
            valueNames.set(el, el);
        }
        else {
            elementNames.set(el[1], el[0]);
            valueNames.set(el[0], el[1]);
        }
    }
    return {
        importer(xml) {
            for (const child of xml.children) {
                if (typeof child === 'string') {
                    continue;
                }
                else if (child.getNamespace() === (namespace || xml.getNamespace()) &&
                    elementNames.has(child.getName())) {
                    return elementNames.get(child.getName());
                }
            }
            return defaultValue;
        },
        exporter(xml, value) {
            findOrCreate(xml, namespace, valueNames.get(value));
        }
    };
}
exports.childEnum = childEnum;
function childDoubleEnum(namespace, parentElements, childElements, defaultValue) {
    const parentNames = new Set(parentElements);
    const childNames = new Set(childElements);
    return {
        importer(xml) {
            for (const parent of xml.children) {
                if (typeof parent === 'string') {
                    continue;
                }
                else if (parent.getNamespace() === (namespace || xml.getNamespace()) &&
                    parentNames.has(parent.getName())) {
                    for (const child of parent.children) {
                        if (typeof child === 'string') {
                            continue;
                        }
                        else if (child.getNamespace() === (namespace || xml.getNamespace()) &&
                            childNames.has(child.getName())) {
                            return [parent.getName(), child.getName()];
                        }
                    }
                    return [parent.getName()];
                }
            }
            return defaultValue;
        },
        exporter(xml, value) {
            const parent = findOrCreate(xml, namespace, value[0]);
            if (value[1]) {
                findOrCreate(parent, namespace, value[1]);
            }
        }
    };
}
exports.childDoubleEnum = childDoubleEnum;
function multipleChildText(namespace, element) {
    return {
        importer(xml, context) {
            const result = [];
            const children = findAll(xml, namespace || xml.getNamespace(), element);
            const targetLanguage = getTargetLang(children, context);
            for (const child of children) {
                if (getLang(child, context.lang) === targetLanguage) {
                    result.push(child.getText());
                }
            }
            return result;
        },
        exporter(xml, values, context) {
            for (const value of values) {
                const child = createElement(namespace || xml.getNamespace(), element, context.namespace, xml);
                child.children.push(value);
                xml.appendChild(child);
            }
        }
    };
}
exports.multipleChildText = multipleChildText;
function multipleChildAttribute(namespace, element, name) {
    return {
        importer(xml) {
            const result = [];
            const children = xml.getChildren(element, namespace || xml.getNamespace());
            for (const child of children) {
                const childAttr = child.getAttribute(name);
                if (childAttr !== undefined) {
                    result.push(childAttr);
                }
            }
            return result;
        },
        exporter(xml, values, context) {
            for (const value of values) {
                const child = createElement(namespace || xml.getNamespace(), element, context.namespace, xml);
                child.setAttribute(name, value);
                xml.appendChild(child);
            }
        }
    };
}
exports.multipleChildAttribute = multipleChildAttribute;
function multipleChildIntegerAttribute(namespace, element, name) {
    return {
        importer(xml) {
            const result = [];
            const children = xml.getChildren(element, namespace || xml.getNamespace());
            for (const child of children) {
                const childAttr = child.getAttribute(name);
                if (childAttr !== undefined) {
                    result.push(parseInt(childAttr, 10));
                }
            }
            return result;
        },
        exporter(xml, values, context) {
            for (const value of values) {
                const child = createElement(namespace || xml.getNamespace(), element, context.namespace, xml);
                child.setAttribute(name, value.toString());
                xml.appendChild(child);
            }
        }
    };
}
exports.multipleChildIntegerAttribute = multipleChildIntegerAttribute;
function childAlternateLanguageText(namespace, element) {
    return {
        importer(xml, context) {
            const results = [];
            const children = findAll(xml, namespace || xml.getNamespace(), element);
            const seenLanuages = new Set();
            for (const child of children) {
                const langText = child.getText();
                if (langText) {
                    const lang = getLang(child, context.lang);
                    if (seenLanuages.has(lang)) {
                        continue;
                    }
                    results.push({ lang, value: langText });
                    seenLanuages.add(lang);
                }
            }
            return seenLanuages.size > 0 ? results : undefined;
        },
        exporter(xml, values, context) {
            for (const entry of values) {
                const val = entry.value;
                if (val) {
                    const child = createElement(namespace || xml.getNamespace(), element, context.namespace, xml);
                    if (entry.lang !== context.lang) {
                        child.setAttribute('xml:lang', entry.lang);
                    }
                    child.children.push(val);
                    xml.appendChild(child);
                }
            }
        }
    };
}
exports.childAlternateLanguageText = childAlternateLanguageText;
function multipleChildAlternateLanguageText(namespace, element) {
    return {
        importer(xml, context) {
            const results = [];
            const langIndex = new Map();
            let hasResults = false;
            const children = findAll(xml, namespace || xml.getNamespace(), element);
            for (const child of children) {
                const langText = child.getText();
                if (langText) {
                    const lang = getLang(child, context.lang);
                    let langResults = langIndex.get(lang);
                    if (!langResults) {
                        langResults = [];
                        langIndex.set(lang, langResults);
                        results.push({ lang, value: langResults });
                    }
                    langResults.push(langText);
                    hasResults = true;
                }
            }
            return hasResults ? results : undefined;
        },
        exporter(xml, values, context) {
            for (const entry of values) {
                for (const val of entry.value) {
                    const child = createElement(namespace || xml.getNamespace(), element, context.namespace, xml);
                    if (entry.lang !== context.lang) {
                        child.setAttribute('xml:lang', entry.lang);
                    }
                    child.children.push(val);
                    xml.appendChild(child);
                }
            }
        }
    };
}
exports.multipleChildAlternateLanguageText = multipleChildAlternateLanguageText;
function multipleChildEnum(namespace, elements) {
    const elementNames = new Map();
    const valueNames = new Map();
    for (const el of elements) {
        if (typeof el === 'string') {
            elementNames.set(el, el);
            valueNames.set(el, el);
        }
        else {
            elementNames.set(el[1], el[0]);
            valueNames.set(el[0], el[1]);
        }
    }
    return {
        importer(xml) {
            const results = [];
            for (const child of xml.children) {
                if (typeof child === 'string') {
                    continue;
                }
                else if (child.getNamespace() === (namespace || xml.getNamespace()) &&
                    elementNames.has(child.getName())) {
                    results.push(elementNames.get(child.getName()));
                }
            }
            return results;
        },
        exporter(xml, values) {
            for (const value of values) {
                findOrCreate(xml, namespace, valueNames.get(value));
            }
        }
    };
}
exports.multipleChildEnum = multipleChildEnum;
function splicePath(namespace, element, path, multiple = false) {
    return {
        importer(xml, context) {
            const child = xml.getChild(element, namespace || xml.getNamespace());
            if (!child) {
                return;
            }
            const results = [];
            for (const grandChild of child.children) {
                if (typeof grandChild === 'string') {
                    continue;
                }
                if (context.registry.getImportKey(grandChild) === path) {
                    const imported = context.registry.import(grandChild);
                    if (imported) {
                        results.push(imported);
                    }
                }
            }
            return multiple ? results : results[0];
        },
        exporter(xml, data, context) {
            let values = [];
            if (!Array.isArray(data)) {
                values = [data];
            }
            else {
                values = data;
            }
            const children = [];
            for (const value of values) {
                const child = context.registry.export(path, value, {
                    ...context,
                    namespace: namespace || xml.getNamespace() || undefined
                });
                if (child) {
                    children.push(child);
                }
            }
            if (children.length) {
                const skipChild = findOrCreate(xml, namespace || xml.getNamespace(), element);
                for (const child of children) {
                    skipChild.appendChild(child);
                }
            }
        }
    };
}
exports.splicePath = splicePath;
function staticValue(value) {
    return {
        exporter: () => undefined,
        importer: () => value
    };
}
exports.staticValue = staticValue;
function childRawElement(namespace, element, sanitizer) {
    return {
        importer(xml, context) {
            if (sanitizer && (!context.sanitizers || !context.sanitizers[sanitizer])) {
                return;
            }
            const child = xml.getChild(element, namespace || xml.getNamespace());
            if (child) {
                if (sanitizer) {
                    return context.sanitizers[sanitizer](child.toJSON());
                }
                else {
                    return child.toJSON();
                }
            }
        },
        exporter(xml, value, context) {
            if (typeof value === 'string') {
                const wrapped = Parser_1.parse(`<${element} xmlns="${namespace || xml.getNamespace()}">${value}</${element}>`);
                value = wrapped.toJSON();
            }
            if (sanitizer) {
                if (!context.sanitizers || !context.sanitizers[sanitizer]) {
                    return;
                }
                value = context.sanitizers[sanitizer](value);
            }
            if (value) {
                xml.appendChild(new Element_1.default(value.name, value.attributes, value.children));
            }
        }
    };
}
exports.childRawElement = childRawElement;
function childLanguageRawElement(namespace, element, sanitizer) {
    return {
        importer(xml, context) {
            if (sanitizer && (!context.sanitizers || !context.sanitizers[sanitizer])) {
                return;
            }
            const children = findAll(xml, namespace || xml.getNamespace(), element);
            const targetLanguage = getTargetLang(children, context);
            for (const child of children) {
                if (getLang(child, context.lang) === targetLanguage) {
                    if (sanitizer) {
                        return context.sanitizers[sanitizer](child.toJSON());
                    }
                    else {
                        return child.toJSON();
                    }
                }
            }
            if (children[0]) {
                if (sanitizer) {
                    return context.sanitizers[sanitizer](children[0].toJSON());
                }
                else {
                    return children[0].toJSON();
                }
            }
        },
        exporter(xml, value, context) {
            if (typeof value === 'string') {
                const wrapped = Parser_1.parse(`<${element} xmlns="${namespace || xml.getNamespace()}">${value}</${element}>`);
                value = wrapped.toJSON();
            }
            if (value && sanitizer) {
                if (!context.sanitizers || !context.sanitizers[sanitizer]) {
                    return;
                }
                value = context.sanitizers[sanitizer](value);
            }
            if (!value) {
                return;
            }
            const rawElement = findOrCreate(xml, namespace || xml.getNamespace(), element, context.lang);
            for (const child of value.children) {
                if (typeof child === 'string') {
                    rawElement.appendChild(child);
                }
                else if (child) {
                    rawElement.appendChild(new Element_1.default(child.name, child.attributes, child.children));
                }
            }
        }
    };
}
exports.childLanguageRawElement = childLanguageRawElement;
function childAlternateLanguageRawElement(namespace, element, sanitizer) {
    return {
        importer(xml, context) {
            if (sanitizer && (!context.sanitizers || !context.sanitizers[sanitizer])) {
                return;
            }
            const results = [];
            const seenLanuages = new Set();
            const children = findAll(xml, namespace || xml.getNamespace(), element);
            for (const child of children) {
                let result = child.toJSON();
                if (sanitizer) {
                    result = context.sanitizers[sanitizer](result);
                }
                if (result) {
                    const lang = getLang(child, context.lang);
                    if (seenLanuages.has(lang)) {
                        continue;
                    }
                    results.push({ lang, value: result });
                    seenLanuages.add(lang);
                }
            }
            return seenLanuages.size > 0 ? results : undefined;
        },
        exporter(xml, values, context) {
            for (const entry of values) {
                let value = entry.value;
                if (typeof value === 'string') {
                    const wrapped = Parser_1.parse(`<${element} xmlns="${namespace ||
                        xml.getNamespace()}">${value}</${element}>`);
                    value = wrapped.toJSON();
                }
                if (value && sanitizer) {
                    if (!context.sanitizers || !context.sanitizers[sanitizer]) {
                        continue;
                    }
                    value = context.sanitizers[sanitizer](value);
                }
                if (value) {
                    const rawElement = createElement(namespace || xml.getNamespace(), element, context.namespace, xml);
                    xml.appendChild(rawElement);
                    if (entry.lang !== context.lang) {
                        rawElement.setAttribute('xml:lang', entry.lang);
                    }
                    for (const child of value.children) {
                        if (typeof child === 'string') {
                            rawElement.appendChild(child);
                        }
                        else {
                            rawElement.appendChild(new Element_1.default(child.name, child.attributes, child.children));
                        }
                    }
                }
            }
        }
    };
}
exports.childAlternateLanguageRawElement = childAlternateLanguageRawElement;
function parameterMap(namespace, element, keyName, valueName) {
    return {
        importer(xml, context) {
            const result = {};
            const params = findAll(xml, namespace, element);
            const keyImporter = exports.attribute(keyName).importer;
            const valueImporter = exports.attribute(valueName).importer;
            for (const param of params) {
                result[keyImporter(param, context)] = valueImporter(param, context);
            }
            return result;
        },
        exporter(xml, values, context) {
            const keyExporter = exports.attribute(keyName).exporter;
            const valueExporter = exports.attribute(valueName).exporter;
            const ns = namespace || xml.getNamespace();
            for (const [param, value] of Object.entries(values)) {
                const paramEl = createElement(ns, element, context.namespace, xml);
                keyExporter(paramEl, param, context);
                if (values[param]) {
                    valueExporter(paramEl, value, context);
                }
                xml.appendChild(paramEl);
            }
        }
    };
}
exports.parameterMap = parameterMap;
