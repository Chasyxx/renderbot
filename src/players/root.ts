export {};

export type bytebeatPlayerEntry = {
    name: string,
    domain: string,
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

for await(const x of Deno.readDir("./players/")) {
    if(blacklistedFiles.includes(x.name) || !x.name.includes('.ts')) continue;
    const data = await import("./"+x.name);
    if(!('name' in data)) {
        console.warn(`${x.name} name not found. Defaulting to filename.`);
        data.name = "`"+x.name+"`";
    }
    if(!('domain' in data)) {
        console.warn(`${data.name} domain not found. Defaulting to filename (${x.name}).`);
        data.domain = "`"+x.name+"`";
    }
    if(!('parser' in data)) {
        console.error(`${data.name} parser not found. Skipping.`);
        continue;
    }
    bytebeatPlayers.push(data);
}

export function decodeLinkToSongData(input: string): BytebeatSongData | null {
    for(const entry of bytebeatPlayers) {
        const r = entry.parser(input);
        if(r !== null) return r;
    }
    return null;
}