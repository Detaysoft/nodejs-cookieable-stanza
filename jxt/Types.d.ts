/// <reference types="node" />
import { FieldDefinition, JSONData, LanguageSet, TranslationContext } from './Definitions';
import XMLElement, { JSONElement } from './Element';
declare type ElementPath = Array<{
    namespace: string | null;
    element: string;
}>;
export declare function createElement(namespace: string | null | undefined, name: string, parentNamespace?: string, parent?: XMLElement): XMLElement;
export declare function getLang(xml: XMLElement, lang?: string): string;
export declare function getTargetLang(children: XMLElement[], context: TranslationContext): string;
export declare function findAll(xml: XMLElement, namespace: string | null | undefined, element: string, lang?: string): XMLElement[];
export declare function findOrCreate(xml: XMLElement, namespace: string | null, element: string, lang?: string): XMLElement;
export interface CreateAttributeOptions<T, E = T> {
    staticDefault?: T;
    dynamicDefault?: (raw?: string) => T | undefined;
    emitEmpty?: boolean;
    name: string;
    namespace?: string | null;
    prefix?: string;
    parseValue(raw: string): T | undefined;
    writeValue(raw: T | E): string;
}
export interface CreateChildAttributeOptions<T, E = T> extends CreateAttributeOptions<T, E> {
    element: string;
    attributeNamespace?: string | null;
    converter?: FieldDefinition<T, E>;
}
export interface CreateTextOptions<T, E = T> {
    staticDefault?: T;
    dynamicDefault?: (raw?: string) => T | undefined;
    parseValue(raw: string): T | undefined;
    writeValue(raw: T | E): string;
}
export interface CreateChildTextOptions<T, E = T> extends CreateTextOptions<T, E> {
    matchLanguage?: boolean;
    element: string;
    namespace: string | null;
}
export declare const attribute: (name: string, defaultValue?: string | undefined, opts?: Partial<CreateAttributeOptions<string, string>>) => FieldDefinition<string, string>;
export declare const booleanAttribute: (name: string, defaultValue?: boolean | undefined, opts?: Partial<CreateAttributeOptions<boolean, boolean>>) => FieldDefinition<boolean, boolean>;
export declare const integerAttribute: (name: string, defaultValue?: number | undefined, opts?: Partial<CreateAttributeOptions<number, number>>) => FieldDefinition<number, number>;
export declare const floatAttribute: (name: string, defaultValue?: number | undefined, opts?: Partial<CreateAttributeOptions<number, number>>) => FieldDefinition<number, number>;
export declare const dateAttribute: (name: string, defaultValue?: Date | undefined, opts?: Partial<CreateAttributeOptions<Date, string>>) => FieldDefinition<Date, string>;
export declare const namespacedAttribute: (prefix: string, namespace: string, name: string, defaultValue?: string | undefined, opts?: Partial<CreateAttributeOptions<string, string>>) => FieldDefinition<string, string>;
export declare const namespacedBooleanAttribute: (prefix: string, namespace: string, name: string, defaultValue?: boolean | undefined, opts?: Partial<CreateAttributeOptions<boolean, boolean>>) => FieldDefinition<boolean, boolean>;
export declare const namespacedIntegerAttribute: (prefix: string, namespace: string, name: string, defaultValue?: number | undefined, opts?: Partial<CreateAttributeOptions<number, number>>) => FieldDefinition<number, number>;
export declare const namespacedFloatAttribute: (prefix: string, namespace: string, name: string, defaultValue?: number | undefined, opts?: Partial<CreateAttributeOptions<number, number>>) => FieldDefinition<number, number>;
export declare const namespacedDateAttribute: (prefix: string, namespace: string, name: string, defaultValue?: Date | undefined, opts?: Partial<CreateAttributeOptions<Date, string>>) => FieldDefinition<Date, string>;
export declare const childAttribute: (namespace: string | null, element: string, name: string, defaultValue?: string | undefined, opts?: Partial<CreateChildAttributeOptions<string, string>>) => FieldDefinition<string, string>;
export declare const childBooleanAttribute: (namespace: string | null, element: string, name: string, defaultValue?: boolean | undefined, opts?: Partial<CreateChildAttributeOptions<boolean, boolean>>) => FieldDefinition<boolean, boolean>;
export declare const childIntegerAttribute: (namespace: string | null, element: string, name: string, defaultValue?: number | undefined, opts?: Partial<CreateChildAttributeOptions<number, number>>) => FieldDefinition<number, number>;
export declare const childFloatAttribute: (namespace: string | null, element: string, name: string, defaultValue?: number | undefined, opts?: Partial<CreateChildAttributeOptions<number, number>>) => FieldDefinition<number, number>;
export declare const childDateAttribute: (namespace: string | null, element: string, name: string, defaultValue?: Date | undefined, opts?: Partial<CreateChildAttributeOptions<Date, string>>) => FieldDefinition<Date, string>;
export declare const text: (defaultValue?: string | undefined) => FieldDefinition<string, string>;
export declare const textJSON: () => FieldDefinition<JSONData, JSONData>;
export declare const textBuffer: (encoding?: BufferEncoding) => FieldDefinition<Buffer, string>;
export declare function languageAttribute(): FieldDefinition<string>;
export declare const childLanguageAttribute: (namespace: string | null, element: string) => FieldDefinition<string, string>;
export declare const childText: (namespace: string | null, element: string, defaultValue?: string | undefined) => FieldDefinition<string, string>;
export declare const childTextBuffer: (namespace: string | null, element: string, encoding?: BufferEncoding) => FieldDefinition<Buffer, string | Buffer>;
export declare const childDate: (namespace: string | null, element: string) => FieldDefinition<Date, string | Date>;
export declare const childInteger: (namespace: string | null, element: string, defaultValue?: number | undefined) => FieldDefinition<number, number>;
export declare const childFloat: (namespace: string | null, element: string, defaultValue?: number | undefined) => FieldDefinition<number, number>;
export declare const childJSON: (namespace: string | null, element: string) => FieldDefinition<JSONData, JSONData>;
export declare function childTimezoneOffset(namespace: string | null, element: string): FieldDefinition<number, string>;
export declare function childBoolean(namespace: string | null, element: string): FieldDefinition<boolean>;
export declare function deepChildText(path: ElementPath, defaultValue?: string): FieldDefinition<string>;
export declare function deepChildInteger(path: ElementPath, defaultValue?: number): FieldDefinition<number>;
export declare function deepChildBoolean(path: ElementPath): FieldDefinition<boolean>;
export declare function childEnum(namespace: string | null, elements: Array<string | [string, string]>, defaultValue?: string): FieldDefinition<string>;
export declare function childDoubleEnum(namespace: string | null, parentElements: string[], childElements: string[], defaultValue?: [string] | [string, string]): FieldDefinition<[string] | [string, string]>;
export declare function multipleChildText(namespace: string | null, element: string): FieldDefinition<string[]>;
export declare function multipleChildAttribute(namespace: string | null, element: string, name: string): FieldDefinition<string[]>;
export declare function multipleChildIntegerAttribute(namespace: string | null, element: string, name: string): FieldDefinition<number[]>;
export declare function childAlternateLanguageText(namespace: string | null, element: string): FieldDefinition<LanguageSet<string>>;
export declare function multipleChildAlternateLanguageText(namespace: string | null, element: string): FieldDefinition<LanguageSet<string[]>>;
export declare function multipleChildEnum(namespace: string | null, elements: Array<string | [string, string]>): FieldDefinition<string[]>;
export declare function splicePath(namespace: string | null, element: string, path: string, multiple?: boolean): FieldDefinition<JSONData | JSONData[]>;
export declare function staticValue<T>(value: T): FieldDefinition<T>;
export declare function childRawElement(namespace: string | null, element: string, sanitizer?: string): FieldDefinition<JSONElement | string>;
export declare function childLanguageRawElement(namespace: string | null, element: string, sanitizer?: string): FieldDefinition<JSONElement | string>;
export declare function childAlternateLanguageRawElement(namespace: string | null, element: string, sanitizer?: string): FieldDefinition<LanguageSet<JSONElement>, LanguageSet<JSONElement | string>>;
export declare function parameterMap(namespace: string, element: string, keyName: string, valueName: string): FieldDefinition;
export {};
