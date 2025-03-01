export const name="Dollchan (Legacy format)";
export const domain="https://dollchan.net/bytebeat";
export const hasAdditions=false;

import { URL } from "node:url";
import { BytebeatSongData, BytebeatMode } from "../import/bytebeatdata.ts";
import { inflateRaw } from "pako";

// list of players to check against
const players = [
    { domain: "dollchan.net", path: "/bytebeat" },
    { domain: "t-8492.github.io", path: "/bbeat2" },
    { domain: "gfljbeat2.pages.dev", path: "/" },
    { domain: "gfljs2100-user.github.io", path: "/GFLJBeat" }
]

export function parser(link: string): BytebeatSongData | null {
    const url = new URL(link);
    for(const i of players) {
        if(url.hostname !== i.domain) continue;
        if(!url.pathname.startsWith(i.path)) continue;
        if(url.protocol.replace(/:/g,'') !== 'https') console.warn("Dafuq? A dollchan-like link that isn't HTTPS?");
        const hash = url.hash.replace(/^#/,'');
        if(hash.startsWith('v3b64')) {
            const dataString = inflateRaw(Uint8Array.from(atob(hash.slice(5)), x => x.charCodeAt(0)), { to: 'string' });
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
    }
    return null;
}
