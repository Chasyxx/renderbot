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

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
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

function write32(input: number) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(input, 0);
    return buffer;
}

function write16(input: number) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(input, 0);
    return buffer;
}

/**
 * Create a progress bar from 0 to `max` using `val` and barSize.
 * @param val a value. Must be between 0 and `max` inckusive.
 * @param max Maximum
 * @param barSize 
 */
export function progressBar(val: number, max: number, barSize: number = 20) {
    let step = Math.max(0, Math.min(barSize, val / max * barSize));
    return `\x1b[0;36;7m[${'#'.repeat(step).padEnd(barSize, '.').replace(/\./g, '\x1b[0m.').replace(/\#/g, '\x1b[0;7m#')}\x1b[0;36;7m]\x1b[0m`;
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
            const R = Math.floor((array[i + (j * width) + (array.length - (width * height))] / 256) * 7)
            switch (R) {
                case 0: out += ' '; break
                case 1: out += '.'; break
                case 2: out += ','; break
                case 3: out += ':'; break
                case 4: out += ';'; break
                case 5: out += '|'; break
                case 6: out += '#'; break
            }
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
    return power1024 + " / " + power1000;
}

export const EE = new EventEmitter();

/**
 * Get a list of functions for usage in bytebeat, including ll "Math" functions and potentially exotic functions.
 * 
 * 'int' is Math.floor.
 * @param useChasyxxPlayerAdditions Whether to use the Chasyxx player's exotic functions.
 * @returns 
 */
export function getFunctions(useChasyxxPlayerAdditions: boolean): ({ params: string[], values: any[] }) {
    let params: string[] = [];
    let values: any[] = [];

    params = Object.getOwnPropertyNames(Math);
    //@ts-expect-error - These subscripts work but TS doesn't like them that much.
    values = params.map(k=>Math[k]);

    if (useChasyxxPlayerAdditions) {
        let newParams = params = Object.getOwnPropertyNames(chasyxxPlayerAdditions);
        //@ts-expect-error - Same as above
        let newValues = newParams.map(k=>Math[k]);
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

/**
 * Render a bytebeat code into a .wav file.
 * @param samplerate Samplerate to use.
 * @param mode Mode to use. 0: Bytebeat, 1: Signed, 2: Floatbeat, 3: Funcbeat.
 * @param codeString a string of the JS bytebeat code. Must be the raw code, not a link or filename.
 * @param lengthValue How many seconds to render. Defaults to 10.
 * @param stereo Whether the code is stereo. Use `null` to autodetect.
 * @param useChasyxxPlayerAdditions Whether the exotic functions should be added.
 * @param printStats Whether stats should be printed. 0: No. 1: Yes. 2: Send events on EE.
 * @param filename A filename to use. Use `null` for render(Unix timestamp).
 * @param truncate Whether the function can truncate the output if rendering takes longet than 5 minutes.
 * 
 * @returns An object, where if error is a string, it shows what went wrong, and file and truncated are null.
 * If error is null, file is the filename of the output and truncated is a boolean stating if the output was truncated due to taking too long to render.
 */
export function renderCode(
    samplerate: number, mode: Modes, codeString: string,
    lengthValue: number = 10, stereo: boolean | null,
    useChasyxxPlayerAdditions: boolean, printStats: 0 | 1 | 2,
    filename: string | null = null, truncate: boolean = true): 

    ({ error: null, file: string, truncated: boolean }
    | { error: string, file: null, truncated: null }) {

    const sampleCount = Math.max(samplerate * lengthValue, samplerate);
    // @ts-expect-error - Tnank you Discord.JS for redefining EventEmitter and
    // breaking TypeScript!
    if (printStats == 2) EE.emit('len', sampleCount);
    let getValues: Function;
    switch (mode) {
        case Modes.Bytebeat: default: getValues = (x: number) => (x & 255); break;
        case Modes.SignedBytebeat: getValues = (x: number) => (x + 127 & 255); break;
        case Modes.Floatbeat:
        case Modes.Funcbeat: getValues = (x: number) => Math.max(-1, Math.min(1, x)) * 127.5 + 128 & 255; break;
    }
    let codeFunc: ((t: number, SR: number) => number[] | number) = () => { return 0; };
    let truncated = false;
    let { params, values } = getFunctions(useChasyxxPlayerAdditions);
    let sampleIndex = 0;
    if (printStats == 2) {
        // @ts-expect-error - D.JS shenannigains
        EE.emit('compile', codeString.length);
    } else if (printStats == 1) {
        console.log(`Compiling a code of length ${codeString.length}`);
        console.time('Compilation');
    }
    try {
        if (mode == Modes.Funcbeat) {
            const out = new Function(...params, codeString).bind(globalThis, ...values);
            if (printStats == 2) {
                // @ts-expect-error - D.JS shenannigains
                EE.emit('compileFuncbeat');
            } else if (printStats == 1) {
                console.log(`Funcbeat sub-compilation...`);
                console.time('Funcbeat');
            }
            codeFunc = out();
            if (printStats == 1) console.timeEnd('Funcbeat');
            try {
                if (codeFunc === undefined || codeFunc === null || typeof codeFunc !== 'function') throw { message: "Primary output was not a function" };
            } catch (e) {
                if (e instanceof Error) return { error: "Funcbeat error: " + e.message, file: null, truncated: null };
                else return { error: "Funcbeat error: " + String(e), file: null, truncated: null };
            }
        } else {
            codeFunc = new Function(...params, `t`, `return 0,\n${codeString || 0};`).bind(globalThis, ...values);
        }
        if (printStats == 2) {
            // @ts-expect-error - D.JS shenannigains
            EE.emit('prep');
            // @ts-expect-error - D.JS shenannigains
            EE.emit('index', 0);
        } else if (printStats == 1) {
            console.timeEnd('Compilation');
            console.log(`${progressBar(0, 1)} 0 / ${sampleCount}`);
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
        } catch (error) {
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
    let buffer: Buffer = Buffer.alloc(sampleCount * (stereo ? 2 : 1));
    let lastValue: number[] = [0, 0];
    const startTime = Date.now();
    let tick = startTime;
    for (sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex++) {
        if ((sampleIndex & 255) == 0) {
            const time = Date.now();
            if (truncate && (time - startTime) > (60 * 5 * 1000)) {
                truncated = true;
                break;
            }
            if (time > (tick + 100)) {
                tick = time;
                if (printStats == 2) {
                    // @ts-expect-error - D.JS shenannigains
                    EE.emit('index', sampleIndex);
                } else if (printStats == 1) {
                    console.log(`\x1b[1A${progressBar(sampleIndex, sampleCount, 40)} ${sampleIndex} / ${sampleCount}`);
                }
            }
        };
        try {
            const out = codeFunc(mode == Modes.Funcbeat ? sampleIndex / samplerate : sampleIndex, samplerate);
            if (stereo) {
                if (Array.isArray(out)) {
                    if (!isNaN(out[0] ?? NaN)) lastValue[0] = getValues(out[0]) & 255;
                    if (!isNaN(out[1] ?? NaN)) lastValue[1] = getValues(out[1]) & 255;
                    buffer[sampleIndex * 2] = lastValue[0];
                    buffer[sampleIndex * 2 + 1] = lastValue[1];
                } else {
                    // Copy to both signals
                    if (!isNaN(out ?? NaN)) lastValue[0] = lastValue[1] = getValues(out) & 255;
                    buffer[sampleIndex * 2] = buffer[sampleIndex * 2 + 1] = lastValue[0];
                }
            } else {
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
                        buffer[sampleIndex] = lastValue[0] / 2 + lastValue[1] / 2 & 255;
                    } else if (channels == 2) {
                        buffer[sampleIndex] = lastValue[1];
                    } else {
                        buffer[sampleIndex] = lastValue[0];
                    }
                } else {
                    if (!isNaN(out ?? NaN)) lastValue[0] = lastValue[1] = getValues(out) & 255;
                    buffer[sampleIndex] = lastValue[0];
                }
            }
        } catch { }
    }
    const length = Date.now() - startTime;
    let endIndex = buffer.length - 1;
    const endValue = buffer[endIndex];
    while (buffer[endIndex] == endValue && endIndex > samplerate) --endIndex;
    const header = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),                                 // Rescource Interchange File Format
        write32(buffer.length + 36),                                  // filesize - 8
        Buffer.from('WAVEfmt ', 'ascii'),                             // .wav file, begin formatting info
        write32(16),                                                  // length of formatting info
        write16(1),                                                   // Marker for PCM data
        write16(stereo ? 2 : 1),                                      // Channel No.
        write32(samplerate),                                          // Sample rate
        write32(samplerate * (stereo ? 2 : 1)),                       // Byte rate: (Sample rate * Number of channels * Bits per sample) / 8
        write16(stereo ? 2 : 1),                                      // Bytes per sample: (Bits per sample * Number of channels) / 8    
        write16(8),                                                   // bits per sample
        Buffer.from('data', 'ascii'),                                 // Begin data block
        write32(buffer.length),                                       // How long is this block?
    ]);

    const final = Buffer.concat([header, buffer.subarray(0, endIndex)]);
    const outputFile = filename ?? ("output" + String(Date.now()) + ".wav");

    function getHeaderString(header: Buffer): string {
        return header.toString('hex')
        .replace(/(\w\w)/g, '$1-')
        .replace(/(\w\w-\w\w-\w\w-\w\w-)/g, '$1!')
        .replace(/[-!]/g, ' ')
    }
    if (printStats == 2) {
        // @ts-expect-error - D.JS shenannigains
        EE.emit('index', sampleCount);
        // @ts-expect-error - D.JS shenannigains
        EE.emit('done', getHeaderString(header), outputFile, formatByteCount(final.length));
    } else if (printStats == 1) {
        console.log(`\x1b[1A${progressBar(1, 1, 40)} ${sampleIndex} / ${sampleIndex}`);
        console.log(`HEADER ${getHeaderString(header)}`);
        console.log(`FILE ${outputFile} SIZE ${formatByteCount(final.length)}`);
    }

    fs.writeFileSync(outputFile, final);
    return { error: null, file: outputFile, truncated };
}
