export {};

import { inflateRaw } from 'pako';

export const bytebeatPlayerLinkDetectionRegexp = /https:\/\/dollchan\.net\/bytebeat\/?(\/index\.html)?#v3b64[^\)\r\n]+?(?=$|\)| )/;

export type BytebeatSongData = {
    sampleRate: number,
    mode: "Bytebeat" | "Signed Bytebeat" | "Floatbeat" | "Funcbeat",
    code: string
}

export function _atob($: string): string {
    return Buffer.from($, 'base64').toString('binary');
}

export class RenderBotInvalidLinkError extends Error {};

export function BytebeatLinkToSongData(link: string): BytebeatSongData {
    if (!bytebeatPlayerLinkDetectionRegexp.test(link)) {
        throw new RenderBotInvalidLinkError("Invalid link");
    }

    const hash = Buffer.from(link.slice(link.indexOf('#v3b64') + 6), 'base64').toString('binary');
    const dataBuffer = new Uint8Array(hash.length);
    for (let i = 0; i < hash.length; i++) {
        if (Object.prototype.hasOwnProperty.call(hash, i)) {
            dataBuffer[i] = hash.charCodeAt(i);
        }
    }
    return JSON.parse(inflateRaw(dataBuffer, { to: 'string' }));
}