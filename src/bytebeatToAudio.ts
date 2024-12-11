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

import { EventEmitter } from 'node:events';
const chasyxxPlayerAdditions = {
    /*bit*/        "bitC": function (x: number, y: number, z: number) { return x & y ? z : 0 },
    /*bit reverse*/"br": function (x: number, size: number = 8) {
        if (size > 32) { throw new Error("br() Size cannot be greater than 32") }
        let result = 0;
        for (let idx = 0; idx < size; idx++) {
            result += (x & (2 ** idx) ? (2 ** (size - idx + 1)) : 0);
        }
        return result;
    },
    /*sin that loops every 256 "steps", instead of every 2pi steps*/"sinf": function (x: number) { return Math.sin(x / (128 / Math.PI)) },
    /*cos that loops every 256 "steps", instead of every 2pi steps*/"cosf": function (x: number) { return Math.cos(x / (128 / Math.PI)) },
    /*tan that loops every 256 "steps", instead of every 2pi steps*/"tanf": function (x: number) { return Math.tan(x / (128 / Math.PI)) },
    /*converts t into a string composed of it's bits, regex's that*/"regG": function (t: number, X: RegExp) { return X.test(t.toString(2)) }
    /*corrupt sound"crpt": function(x,y=8) {return chyx.br(chyx.br(x,y)+t,y)^chyx.br(t,y)},
    decorrupt sound"decrpt": function(x,y=8) {return chyx.br(chyx.br(x^chyx.br(t,y),y)-t,y)},*/
}

function write32(input: number): Uint8Array {
    // 0x12345678 -> [ 78 56 34 12 ]
    return Uint8Array.from([ input>>0&0xFF, input>>8&0xFF, input>>16&0xFF, input>>24&0xFF ]);;
}

function write16(input: number): Uint8Array {
    // 0x1234 -> [ 34 12 ]
    return Uint8Array.from([ input>>0&0xFF, input>>8&0xFF ]);
}

function formatUTF8(input: string): Uint8Array {
    const dummy: Uint8Array = Uint8Array.from({length: input.length});
    new TextEncoder().encodeInto(input,dummy);
    return dummy;
}

/**
 * Create a progress bar from 0 to `max` using `val` and barSize.
 * @param val a value. Must be between 0 and `max` inckusive.
 * @param max Maximum
 * @param barSize 
 */
export function progressBar(val: number, max: number, barSize: number = 20, terminal: boolean = false): string {
    const step = Math.max(0, Math.min(barSize, val / max * barSize));
    // Print colored terminal output
    if(terminal) return `\x1b[0;36;7m[${'#'.repeat(step).padEnd(barSize, '.').replace(/\./g, '\x1b[0m.').replace(/\#/g, '\x1b[0;7m#')}\x1b[0;36;7m]\x1b[0m`;
    // Not using terminal, just print a basic progress bar
    return `[${'#'.repeat(step).padEnd(barSize, '.')}]`;
}

/**
 * Visualize the end of an array.
 * @param array Array to visualize. All numbers should be between 0 and 255 inclusive.
 * @param width width of the visualization.
 * @param height height of the visualization.
 */
export function visualizer(array: number[], width: number = 64, height: number = 8) {
    let out = ''
    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            out += ' .,:;|#'[Math.floor((array[i + (j * width) + (array.length - (width * height))] / 256) * 7)];
        }
        out += '\n'
    }
    return out
}

function formatByteCount(bytes: number) {
    let power1000, power1024;
    if (bytes < 1e3) {
        power1000 = bytes + " B"
    } else if (bytes < 1e6) {
        const kb = String(bytes / 1e3).replace(/(?<=.\d\d)\d+$/, '')
        power1000 = kb + " KB"
    } else if (bytes < 1e9) {
        const mb = String(bytes / 1e6).replace(/(?<=.\d\d)\d+$/, '')
        power1000 = mb + " MB"
    } else /*if (bytes < 1e12)*/ {
        const gb = String(bytes / 1e9).replace(/(?<=.\d\d)\d+$/, '')
        power1000 = gb + " GB"
    }
    if (bytes < 1024) {
        power1024 = bytes + " B"
    } else if (bytes < (1024 ** 2)) {
        const kib = String(bytes / 1024).replace(/(?<=.\d\d)\d+$/, '')
        power1024 = kib + " KiB"
    } else if (bytes < (1024 ** 3)) {
        const mib = String(bytes / (1024 ** 2)).replace(/(?<=.\d\d)\d+$/, '')
        power1024 = mib + " MiB"
    } else /*if (bytes < (1024 ** 4))*/ {
        const gib = String(bytes / (1024 ** 3)).replace(/(?<=.\d\d)\d+$/, '')
        power1024 = gib + " GiB"
    }
    return power1000 + " / " + power1024;
}

export const EE = new EventEmitter();

type codeValue = (keyof typeof Math | keyof typeof chasyxxPlayerAdditions | typeof Math.floor | typeof globalThis);

/**
 * Get a list of functions for usage in bytebeat, including ll "Math" functions and potentially exotic functions.
 * 
 * 'int' is Math.floor.
 * @param useChasyxxPlayerAdditions Whether to use the Chasyxx player's exotic functions.
 * @returns 
 */
export function getFunctions(useChasyxxPlayerAdditions: boolean): ({ params: string[], values: codeValue[] }) {
    let params: string[] = [];
    let values: codeValue[] = [];

    params = Object.getOwnPropertyNames(Math);
    //@ts-expect-error - These subscripts work but TS doesn't like them that much.
    values = params.map(k=>Math[k]);

    if (useChasyxxPlayerAdditions) {
        const newParams = params = Object.getOwnPropertyNames(chasyxxPlayerAdditions);
        //@ts-expect-error - Same as above
        const newValues = newParams.map(k=>chasyxxPlayerAdditions[k]);
        params.push(...newParams);
        values.push(...newValues);
    }

    params.push('int', 'window');
    values.push(Math.floor, globalThis);

    return { params, values };
}

export enum Modes {
    Bytebeat = 0,
    SignedBytebeat = 1,
    Floatbeat = 2,
    Funcbeat = 3
};

export type renderOutputType = {
    error: null;
    file: string;
    truncated: boolean;
} | {
    error: string;
    file: null;
    truncated: null;
};

/**
 * Render a bytebeat code into a .wav file.
 * @param samplerate Samplerate to use.
 * @param mode Mode to use. 0: Bytebeat, 1: Signed, 2: Floatbeat, 3: Funcbeat.
 * @param codeString a string of the JS bytebeat code. Must be the raw code, not a link or filename.
 * @param lengthValue How many seconds to render. Defaults to 10.
 * @param stereo Whether the code is stereo. Use `null` to autodetect.
 * @param useChasyxxPlayerAdditions Whether the exotic functions should be added.
 * @param printStats Whether stats should be printed. 0: No. 1: Yes. 2: Send events on EE.
 * @param filename A filename to use. Use `null` for render-(UUIDv4).
 * @param truncate Whether the function can truncate the output if rendering takes longet than 5 minutes.
 * 
 * @returns An object, where if error is a string, it shows what went wrong, and file and truncated are null.
 * If error is null, file is the filename of the output and truncated is a boolean stating if the output was truncated due to taking too long to render.
 */
export function renderCode(
    samplerate: number, mode: Modes, codeString: string, filename: string,
    lengthValue: number = 10, stereo: boolean | null,
    useChasyxxPlayerAdditions: boolean, printStats: 0 | 1 | 2,
    truncate: number = 300, printMillis: number = 100): renderOutputType {

    const sampleCount = Math.max(samplerate * lengthValue, samplerate);
    if (printStats == 2) EE.emit('len', sampleCount);
    let getValues: (x: number) => number;
    switch (mode) {
        case Modes.Bytebeat: default: getValues = (x: number) => (x & 255); break;
        case Modes.SignedBytebeat: getValues = (x: number) => (x + 128 & 255); break;
        case Modes.Floatbeat:
        case Modes.Funcbeat: getValues = (x: number) => Math.max(-1, Math.min(1, x)) * 127.5 + 128 & 255; break;
    }
    let codeFunc: ((t: number, SR: number) => number[] | number) = () => { return 0; };
    let truncated = false;
    const { params, values } = getFunctions(useChasyxxPlayerAdditions);
    let sampleIndex = 0;
    if (printStats == 2) {
        
        EE.emit('compile', codeString.length);
    } else if (printStats == 1) {
        console.log(`Compiling a code of length ${codeString.length}`);
        console.time('Compilation');
    }
    try {
        if (mode == Modes.Funcbeat) {
            const out = new Function(...params, codeString).bind(globalThis, ...values);
            if (printStats == 2) {
                
                EE.emit('compileFuncbeat');
            } else if (printStats == 1) {
                console.log(`Funcbeat sub-compilation...`);
                console.time('Funcbeat');
            }
            codeFunc = out();
            if (printStats == 1) console.timeEnd('Funcbeat');
            try {
                if (codeFunc === undefined || codeFunc === null || typeof codeFunc !== 'function') throw new TypeError("Funcbeat output was not a function");
            } catch (e) {
                if (e instanceof Error) return { error: "Funcbeat error: " + e.message, file: null, truncated: null };
                else return { error: "Funcbeat error: " + String(e), file: null, truncated: null };
            }
        } else {
            codeFunc = new Function(...params, `t`, `return 0,\n${codeString || 0};`).bind(globalThis, ...values);
        }
        if (printStats == 2) {
            
            EE.emit('prep');
            
            EE.emit('index', 0);
        } else if (printStats == 1) {
            console.timeEnd('Compilation');
            console.log(`${progressBar(0, 1, 20, true)} 0 / ${sampleCount}`);
        }
        try {
            const out = codeFunc(0, samplerate);
            if (stereo == null) {
                try {
                    stereo = Array.isArray(out);
                } catch {
                    stereo = false;
                }
            }
        } catch {
            if (stereo == null) stereo = false;
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("Compilation error: " + error.message);
            return { error: "Compilation error: " + error.message, file: null, truncated: null };
        } else {
            console.error("Compilation error: " + String(error));
            return { error: "Compilation error: " + String(error), file: null, truncated: null };
        }
    }
    const buffer: Uint8Array = Uint8Array.from({length: 44 + (sampleCount * (stereo ? 2 : 1))});
    const lastValue: number[] = [0, 0];
    const startTime = Date.now();
    let lastTime = startTime;
    if(printStats==1) console.time("Rendering");
    for (sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex++) {
        const time = Date.now();
        if (truncate && (time - startTime) > (truncate * 1000)) {
            truncated = true;
            break;
        }
        if (time > (lastTime + printMillis)) {
            lastTime = time;
            if (printStats == 2) {
                
                EE.emit('index', sampleIndex);
            } else if (printStats == 1) {
                console.log(`\x1b[1A${progressBar(sampleIndex, sampleCount, Deno.consoleSize().columns - String(sampleIndex).length - String(sampleCount).length - 7, true)} ${sampleIndex} / ${sampleCount}`);
            }
        }
        try {
            const out = codeFunc(mode == Modes.Funcbeat ? sampleIndex / samplerate : sampleIndex, samplerate);
            if (stereo) {
                const bufferIndex = sampleIndex * 2 + 44;
                if (Array.isArray(out)) {
                    if (!isNaN(out[0] ?? NaN)) lastValue[0] = getValues(out[0]) & 255;
                    if (!isNaN(out[1] ?? NaN)) lastValue[1] = getValues(out[1]) & 255;
                    buffer[bufferIndex] = lastValue[0];
                    buffer[bufferIndex + 1] = lastValue[1];
                } else {
                    // Copy to both signals
                    if (!isNaN(out ?? NaN)) lastValue[0] = lastValue[1] = getValues(out) & 255;
                    buffer[bufferIndex] = buffer[bufferIndex + 1] = lastValue[0];
                }
            } else {
                const bufferIndex = sampleIndex + 44;
                if (Array.isArray(out)) {
                    // Downmix to mono 
                    let channels: number = 0;
                    if (!isNaN(out[0] ?? NaN)) {
                        lastValue[0] = getValues(out[0]) & 255;
                        channels |= 1;
                    }
                    if (!isNaN(out[1] ?? NaN)) {
                        lastValue[1] = getValues(out[1]) & 255;
                        channels |= 2;
                    }
                    if (channels == 3) {
                        buffer[bufferIndex] = lastValue[0] / 2 + lastValue[1] / 2 & 255;
                    } else if (channels == 2) {
                        buffer[bufferIndex] = lastValue[1];
                    } else {
                        buffer[bufferIndex] = lastValue[0];
                    }
                } else {
                    if (!isNaN(out ?? NaN)) lastValue[0] = lastValue[1] = getValues(out) & 255;
                    buffer[bufferIndex] = lastValue[0];
                }
            }
        } catch { /* TODO: cli would print an error here */ }
    }
    if (printStats == 1) {
        console.log(`\x1b[1A${progressBar(1, 1, Deno.consoleSize().columns - String(sampleIndex).length * 2 - 7, true)} ${sampleIndex} / ${sampleIndex}`);
        console.timeEnd("Rendering");
    }
    let endIndex = buffer.length - 1;
    const endValue = buffer[endIndex];
    if(!stereo)
        while (buffer[endIndex] == endValue && endIndex > samplerate) --endIndex;

    buffer.set(formatUTF8('RIFF'),0);                      // RIFF header
    buffer.set(write32(buffer.length - 8),4);              // chunk length
    buffer.set(formatUTF8('WAVEfmt '),8);                  // chunk type, format info
    buffer.set(write32(16),16);                            // format length
    buffer.set(write16(1),20);                             // PCM marker
    buffer.set(write16(stereo ? 2 : 1),22);                // channel count
    buffer.set(write32(samplerate),24);                    // sample rate
    buffer.set(write32(samplerate * (stereo ? 2 : 1)),28); // samplerate*channels*bitdepth/8
    buffer.set(write16(stereo ? 2 : 1),32);                // channels*bitdepth/8
    buffer.set(write16(8),34);                             // bit depth
    buffer.set(formatUTF8('data'),36);                     // data chunk
    buffer.set(write32(buffer.length - 44),40);            // chunk length

    const outputFile = filename;

    const headerString: string = 
    `RIFF-${(buffer.length - 8).toString(16).padStart(8,'0')}-WAVEfmt-${stereo?2:1}ch-${samplerate.toString(16).padStart(8,'0')}Hz-${(samplerate*(stereo?2:1)).toString(16).padStart(8,'0')}Bps-${stereo?2:1}ba-data-${(buffer.length - 8).toString(16).padStart(8,'0')}`;

    if (printStats == 2) {
        if(!truncated)
            
            EE.emit('index', sampleCount);
        
        EE.emit('done', headerString, outputFile, formatByteCount(buffer.length));
    } else if (printStats == 1) {
        console.log(`HEADER ${headerString}`);
        console.log(`FILE ${outputFile} SIZE ${formatByteCount(buffer.length)}`);
    }

    Deno.writeFileSync(outputFile, buffer);
    return { error: null, file: outputFile, truncated };
}
