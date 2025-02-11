export const name="Chasyxx";
export const domain="https://chasyxx.github.io/EnBeat_NEW";

import { URL } from "node:url";
import { BytebeatSongData, BytebeatMode } from "../import/bytebeatdata.ts";
import { inflateRaw } from "pako";

export function parser(link: string): BytebeatSongData | null {
    const url = new URL(link);
    if(url.hostname !== 'chasyxx.github.io') return null;
    if(!url.pathname.startsWith("/EnBeat_NEW")) return null;
    if(url.protocol !== 'https') console.warn("Dafuq? A dollchan link that isn't HTTPS?");
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
    } else if(hash.startsWith('EnBeat2-')) {
        const dataString = inflateRaw(Uint8Array.from(atob(hash.slice(8)), x => x.charCodeAt(0)), { to: 'string' });
        let songData: { sampleRate: number, mode: BytebeatMode, code: string, formula?: string } = {code: '', mode: 'Bytebeat', sampleRate: 8000};
        if(dataString.startsWith('{')) {
            songData = JSON.parse(dataString);
            if(songData.formula) {
                songData.code = songData.formula;
            }
        } else {
            songData = { code: dataString, sampleRate: 8000, mode: 'Bytebeat' };
        }
        return songData;
    }
    return null;
}
