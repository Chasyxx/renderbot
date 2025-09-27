//     Renderbot: a Discord bot for rendering bytebeat codes
//     Copyright (C) 2024, 2025 Chase Taylor

//     This program is free software: you can redistribute it and/or modify
//     it under the terms of the GNU Affero General Public License as published
//     by the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.

//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU Affero General Public License for more details.

//     You should have received a copy of the GNU Affero General Public License
//     along with this program.  If not, see <https://www.gnu.org/licenses/>.

//     Email contact is at creset200@gmail.com

export const name="Dollchan";
export const domain="https://dollchan.net/bytebeat";
export const hasAdditions=false;

import { URL } from "node:url";
import { BytebeatSongData, BytebeatMode } from "../import/bytebeatdata.ts";
import { inflateRaw } from "pako";

// list of players to check against
const players = [
    { domain: "dollchan.net", path: "/bytebeat" },
    { domain: "dollchan.net", path: "/bb" },
]

export function parser(link: string): BytebeatSongData | null {
    const url = new URL(link);
    for(const i of players) {
        if(url.hostname !== i.domain) continue;
        if(!url.pathname.startsWith(i.path)) continue;
        if(url.protocol.replace(/:/g,'') !== 'https') console.warn("Dafuq? A dollchan-like link that isn't HTTPS?");
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
    }
    return null;
}
