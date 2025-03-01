export const name="Dollchan";
export const domain="https://dollchan.net/bytebeat";
export const hasAdditions=false;

import { URL } from "node:url";
import { BytebeatSongData, BytebeatMode } from "../import/bytebeatdata.ts";
import { inflateRaw } from "pako";

export function parser(link: string): BytebeatSongData | null {
    const url = new URL(link);
    if(url.hostname !== 'dollchan.net') return null;
    if(!url.pathname.startsWith("/bytebeat")) return null;
    if(url.protocol.replace(/:/g,'') !== 'https') console.warn("Dafuq? A dollchan link that isn't HTTPS?");
    const hash = url.hash.replace(/^#/,'');
    if(hash.startsWith('4')) {
        const dataArr = Uint8Array.from(atob(hash.slice(1)), x => x.charCodeAt(0));
        let mode: BytebeatMode = 'Bytebeat';
        if(dataArr[0] == 2) mode = 'Floatbeat';
        else if(dataArr[0] == 3) mode = 'Funcbeat'
        else if(dataArr[0] == 1) mode = 'Signed Bytebeat';
        return { mode,
        sampleRate: new DataView(dataArr.buffer).getFloat32(1, true),
        code: inflateRaw(new Uint8Array(dataArr.buffer, 5), { to: 'string' }) }
    }
    return null;
}
