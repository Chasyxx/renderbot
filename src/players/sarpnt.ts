//     Renderbot: a Discord bot for rendering bytebeat codes
//     Copyright (C) 2024 Chase Taylor

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

export const name="SArpnt";
export const domain="https://bytebeat.ficial.net/";
export const hasAdditions=false;

import { URL } from "node:url";
import { BytebeatSongData, BytebeatMode } from "../import/bytebeatdata.ts";
import { inflateRaw } from "pako";

/** 
 * Although this code is inside of RenderBot, I actually copied SArpnt code and 
 * then modified it to fit RenderBot's enviornment.
 * I'd try to test this code more but the website coincidentially went down.
 * 
 * Here is the relevant license for the code (known as the MIT or Expat license):
 * 
 * Copyright (c) 2024 SArpnt
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
*/

const tochar =
	"!#$&'()*+,-./0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_abcdefghijklmnopqrstuvwxyz{|}~";
const fromchar = Object.fromEntries(Object.entries(tochar).map(([i, v]) => [v, BigInt(i)]));

// go through 123 bits at a time, into 19 character chunks
// bitIndex from 0 to 7 to trim bits off the input data

/** least amount of bits that requires a base 89 string of a specific length. */
//const lbl = Array(20)
//	.fill(undefined)
//	.map((_, i) => i && (89n ** BigInt(i - 1)).toString(2).length);
const smallmode_table = {
	Bytebeat: 0b00000111,
	"Signed Bytebeat": 0b00000110,
	Floatbeat: 0b00011100,
	Funcbeat: 0b11111100,
} as const;

// /**
//  * converts data into base89, using all the valid characters for a url anchor.
//  * this allows incredibly small urls, but many of these characters
//  * break markdown and other common post formatting.
//  *
//  * bitIndex is the first bit that into89 will read from and encode,
//  * and it'll continue until the end of the array.
//  * use bitIndex if you want to trim less than 8 bits off the data.
//  */
// function into89(data: Uint8Array, bitIndex = 0): string {
// 	let coded = "";
// 	while (true) {
// 		//const byteIndex = bitIndex >> 3;
// 		//const bitOffset = bitIndex & 7;
// 		// collects 123 bits of data
// 		let chunkInt = 0n;
// 		for (let i = 0; i < 123; i++) {
// 			if (bitIndex >> 3 < data.length) {
// 				// if bitIndex is negative, this will implicitly cast
// 				const currentByte = data[bitIndex >> 3] as number;
// 				const bitOfByte = 1 << (bitIndex & 7);
// 				chunkInt += BigInt(!!(currentByte & bitOfByte)) << BigInt(i);
// 				bitIndex++;
// 			} else {
// 				// length kept being wrong, i gave up on it

// 				//bigint = BigInt.asUintN(123, bigint << BigInt(bitOffset));
// 				//for (const bits of lbl.slice(1).map(x => x - 1)) {
// 				//	if (bits >= i) {
// 				//		return coded;
// 				//	}
// 				//	coded += tochar[Number(bigint % 89n)];
// 				//	bigint /= 89n;
// 				//}
// 				//// unreachable
// 				while (chunkInt) {
// 					coded += tochar[Number(chunkInt % 89n)];
// 					chunkInt /= 89n;
// 				}
// 				return coded;
// 			}
// 		}
// 		//bigint = BigInt.asUintN(123, bigint << BigInt(bitOffset));
// 		for (let j = 0; j < 19; j++) {
// 			coded += tochar[Number(chunkInt % 89n)];
// 			chunkInt /= 89n;
// 		}
// 	}
// }

/**
 * converts data from base89, the opposite of into89.
 * the decoded data will be placed at bitIndex in the returned array.
 * the length will always be equal or longer than the original data,
 * and any extra data will be 0 bits. this is fine for a deflate stream,
 * which already encodes the end in the format.
 */
function from89(coded: string, bitIndex = 0 /*, byteUp = true*/): Uint8Array {
	// all this code is PROBABLY correct but i'm not sure because into89 length is wrong anyways

	//const chunkCount = Math.max(Math.ceil(coded.length / 19) - 1, 0);
	//const chunkRem = coded.length - chunkCount * 19;
	//const lbla = lbl[chunkRem];
	//const bitrem = byteUp ? (lbla + 7 & ~7) - (bitIndex & 7) : lbla;
	//const bits = chunkCount * 123 + bitrem;
	const bits = bitIndex + Math.ceil(coded.length / 19) * 123; // always too long but that's good for now
	const data = new Uint8Array((bits + 7) >> 3);

	let currentByte = 0;
	if (coded.length) {
		const chunks = coded.match(/.{1,19}/g) as RegExpMatchArray;
		for (const chunk of chunks) {
			let chunkInt = 0n;
			for (const letter of chunk.split("").reverse()) {
				chunkInt *= 89n;
				chunkInt += fromchar[letter];
			}
			for (let i = 123; i; i--) {
				const bit = Number(chunkInt & 1n);
				currentByte |= bit << (bitIndex & 7);
				if ((bitIndex & 7) === 7) {
					data[bitIndex >> 3] = currentByte;
					currentByte = 0;
				}
				bitIndex++;
				if (bitIndex === bits) {
					if ((bitIndex & 7) !== 0) {
						data[bitIndex >> 3] = currentByte;
					}
					return data;
				}
				chunkInt >>= 1n;
			}
		}
	}

	return data;
}

export function parser(link: string): BytebeatSongData | null {
    const hash = new URL(link).hash;
	const v = hash[1];

    if (v === "6" || v === "5") {
        // #6, #5

        let data: Uint8Array;
        let compressedCode;
        if (v === "6") {
            data = from89(hash.substring(2), 12);
            // if data[1] is undefined the implicit cast to 0 is fine
            data[1] = (data[1] >> 4) | 0x40;
            compressedCode = data.subarray(6);
        } else {
            // add "00" to shift over float bytes and set first 4 bits to 0100
            data = Uint8Array.from(
                atob(`00${hash.substring(2, 8)}`),
                // @ts-ignore - dummy comment
                c => c.charCodeAt(),
            );
            compressedCode = Uint8Array.from(
                atob(hash.substring(8)),
                // @ts-ignore - dummy comment
                c => c.charCodeAt(),
            );
        }

        // this may be useful for extra properties without a new url version
        /*
        if (rateMode[1] >= 76) {
            // number >= 2**25
        }
        */

        const dataview = new DataView(data.buffer);
        const sampleRate = dataview.getFloat32(1);
        if (sampleRate >= 2 ** 24) {
            // invalid samplerate
            return null;
        }

        const maybe_mode = Object.entries(smallmode_table).find(x => x[1] === data[5]);
        if (maybe_mode === undefined) {
            // invalid mode
            return null;
        }
        const mode = maybe_mode[0] as BytebeatMode;

        const code = new TextDecoder().decode(
            inflateRaw(
                compressedCode,
                // a dictionary can be added later without breaking compatibility
            ),
        );
        
        return { code, sampleRate, mode };
    }
    if (v === "v") {
        // #v4, #v3b64
        const dataString = atob(hash.substring(hash[2] === "4" ? 3 : 6));

        const dataBuffer = Uint8Array.from(
            dataString,
            // @ts-ignore - dummy comment
            c => c.charCodeAt(),
        );

        const songDataString = new TextDecoder().decode(inflateRaw(dataBuffer));
        let { code, sampleRate, mode } = JSON.parse(songDataString);

        code += "";
        sampleRate = Math.fround(sampleRate ?? 8000);
        mode = mode ?? "Bytebeat";
        if (sampleRate < 2 || sampleRate >= 2 ** 24) {
            // invalid samplerate
            return null;
        }
        // @ts-ignore - accessing smallmode like this is reasonable but TS doesn't like it
        if (smallmode_table[mode] === undefined) {
            // invalid mode
            return null;
        }

        return { code, sampleRate, mode };
    }
	return null;
}

