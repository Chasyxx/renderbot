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

export {};

export type bytebeatPlayerEntry = {
    name: string,
    domain: string | null,
    fileName: string,
    hasAdditions: boolean,
    parser: (link: string) => BytebeatSongData | null,
}

export const bytebeatPlayers: bytebeatPlayerEntry[] = [];

export type BytebeatMode = "Bytebeat" | "Signed Bytebeat" | "Floatbeat" | "Funcbeat";

export type BytebeatSongData = {
    sampleRate: number,
    mode: BytebeatMode,
    code: string
};

export class RenderBotInvalidLinkError extends Error {};

const blacklistedFiles: string[] = [
    'root.ts',
    'parser.ts'
];

bytebeatPlayers.push({ name: "File", domain: null, fileName: "hardcoded", parser:_=>null, hasAdditions: false });

for await(const x of Deno.readDir("./players/")) {
    if(blacklistedFiles.includes(x.name) || !x.name.includes('.ts')) continue;
    const data = await import("./"+x.name);
    const outputData: bytebeatPlayerEntry = { fileName: x.name, name: x.name, domain: x.name, parser: _=>null, hasAdditions: false };

    outputData.fileName = x.name;

    if('name' in data) outputData.name = data.name;
    else console.warn(`${x.name} name not found. Defaulting to filename.`);

    if('domain' in data) outputData.domain = data.domain;
    else console.warn(`${data.name} domain not found. Defaulting to filename.`);

    if('hasAdditions' in data) outputData.hasAdditions = data.hasAdditions;
    else console.warn(`${x.name} hasAdditions not found. Defaulting to false.`);

    if(!('parser' in data)) {
        console.error(`${data.name} parser not found. Skipping.`);
        continue;
    }
    // outputData.parser = (...a)=>data.parser(...a);
    outputData.parser = data.parser;
    bytebeatPlayers.push(outputData);
    console.log(`define ${x.name} -> ${data.name}: ${data.domain}`);
}

export type DecodedLink = { songData: BytebeatSongData, playerData: bytebeatPlayerEntry };

export function decodeLinkToSongData(input: string): DecodedLink | null {
    input = input.trim();
    try{
        const _a = new URL(input);
    } catch {
        return null;
    }
    for(const entry of bytebeatPlayers) {
        const r = entry.parser(input);
        if(r !== null) return { songData: r, playerData: entry };
    }
    return null;
}