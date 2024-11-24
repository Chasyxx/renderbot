export {};

import { inflateRaw } from 'pako';
import { URL } from 'node:url';

export const bytebeatPlayerLinkDetectionRegexp = /https:\/\/dollchan\.net\/bytebeat\/?(\/index\.html)?#(v3b6)??4[^\)\r\n]+?(?=$|\)| )/;

export type BytebeatMode = "Bytebeat" | "Signed Bytebeat" | "Floatbeat" | "Funcbeat";

export type BytebeatSongData = {
    sampleRate: number,
    mode: BytebeatMode,
    code: string
}

export class RenderBotInvalidLinkError extends Error {};

export function BytebeatLinkToSongData(link: string): BytebeatSongData {
    if (!bytebeatPlayerLinkDetectionRegexp.test(link)) {
        throw new RenderBotInvalidLinkError("Invalid link");
    }

    const hash = new URL(link).hash.replace(/^#/,'');
    if(hash.startsWith('v3b64')) {
        const d1 = inflateRaw(Uint8Array.from(atob(hash.substring(6)), x => x.charCodeAt(0)), { to: 'string' });
        let d: { sampleRate: number, mode: BytebeatMode, code: string, formula?: string } = {code: '', mode: 'Bytebeat', sampleRate: 8000};
        if(d1.startsWith('{')) {
            d = JSON.parse(d1);
            if(d.formula) {
                d.code = d.formula;
            }
        } else {
            d = { code: d1, sampleRate: 8000, mode: 'Bytebeat' };
        }
        return d;
    } else if (hash.startsWith('4')) {
        const dataArr = Uint8Array.from(atob(hash.slice(1)), x => x.charCodeAt(0));
        let mode: BytebeatMode = 'Bytebeat';
        if(dataArr[0] == 2) mode = 'Floatbeat';
        else if(dataArr[0] == 3) mode = 'Funcbeat'
        else if(dataArr[0] == 1) mode = 'Signed Bytebeat';
        return { mode,
        sampleRate: new DataView(dataArr.buffer).getFloat32(1, true),
        code: inflateRaw(new Uint8Array(dataArr.buffer, 5), { to: 'string' }) }
    } else throw new RenderBotInvalidLinkError("Invalid link");
}