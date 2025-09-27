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

export {};

// import { EventEmitter } from 'node:events';
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

export function formatByteCount(bytes: number) {
    if(bytes<1e3) return bytes + "B";
    let power1000, power1024;
    if (bytes < 1e6) {
        power1000 = (bytes / 1e3).toFixed(2) + "KB"
    } else if (bytes < 1e9) {
        power1000 = (bytes / 1e6).toFixed(2) + "MB"
    } else /*if (bytes < 1e12)*/ {
        power1000 = (bytes / 1e9).toFixed(2) + "GB"
    }
    if (bytes < 1024) {
        power1024 = bytes + "B"
    } else if (bytes < (1024 ** 2)) {
        power1024 = (bytes / 1024).toFixed(2) + "KiB"
    } else if (bytes < (1024 ** 3)) {
        power1024 = (bytes / (1024 ** 2)).toFixed(2) + "MiB"
    } else /*if (bytes < (1024 ** 4))*/ {
        power1024 = (bytes / (1024 ** 3)).toFixed(2) + "GiB"
    }
    return power1024 + "/" + power1000;
}

export const ET = new EventTarget();

type codeValue = (keyof typeof Math | keyof typeof chasyxxPlayerAdditions | typeof Math.floor | typeof globalThis);

/**
 * Get a list of functions for usage in bytebeat, including "Math" functions and potentially exotic functions.
 * 
 * 'int' is Math.floor, for compatibility reasons, even though it should be Math.trunc.
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
        const newParams = Object.getOwnPropertyNames(chasyxxPlayerAdditions);
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

type micSampleType = [ left: number, right: number, mono: number ];

let micSound: Uint8Array | null = null;

try {
    micSound = Deno.readFileSync("../input-sound.raw")
    console.log("Input sound loaded.");
} catch (e) {
    console.warn(e, "\nYou should add an input sound.");
}

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
 * @param truncate Whether the function can truncate the output.
 * If rendering time takes longer then this many seconds it will be truncated.
 * 
 * @returns An object, where if error is a string, it shows what went wrong, and file and truncated are null.
 * If error is null, file is the filename of the output and truncated is a boolean stating if the output was truncated due to taking too long to render.
 */
export function renderCode(
    samplerate: number, mode: Modes, codeString: string, filename: string,
    lengthValue: number = 10, stereo: boolean | null, bitDepth: 8 | 16 = 8,
    useChasyxxPlayerAdditions: boolean, printStats: 0 | 1 | 2,
    truncate: number = 300, printMillis: number = 100,): renderOutputType {

    const sampleCount = Math.max(samplerate * lengthValue, samplerate);
    if (printStats == 2) ET.dispatchEvent(new CustomEvent("len",{detail: sampleCount}));
    let getValues: (x: number) => number;
    switch (mode) {
        case Modes.Bytebeat: default: getValues = (x: number) => (x & 255)/127.5-1; break;
        case Modes.SignedBytebeat: getValues = (x: number) => (x + 128 & 255)/127.5-1; break;
        case Modes.Floatbeat:
        case Modes.Funcbeat: getValues = (x: number) => Math.max(-1, Math.min(1, x)); break;
    }
    let codeFunc: ((t: number, SRoI: number | micSampleType, samples: number, I: micSampleType) => number[] | number) = () => { return 0; };
    let truncated = false;
    const { params, values } = getFunctions(useChasyxxPlayerAdditions);
    let sampleIndex = 0;
    if (printStats == 2) {
        
        ET.dispatchEvent(new CustomEvent("compile",{detail: codeString.length}));
    } else if (printStats == 1) {
        console.log(`Compiling a code of length ${codeString.length}`);
        console.time('Compilation');
    }
    try {
        if (mode == Modes.Funcbeat) {
            const out = new Function(...params, codeString).bind(globalThis, ...values);
            if (printStats == 2) {
                
                ET.dispatchEvent(new CustomEvent("compileFuncbeat"));
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
            codeFunc = new Function(...params, 't', '_micSample', `return 0,\n${codeString || 0};`).bind(globalThis, ...values);
        }
        if (printStats == 2) {
            
            ET.dispatchEvent(new CustomEvent("prep"));
            
            ET.dispatchEvent(new CustomEvent("index",{detail: 0}));
        } else if (printStats == 1) {
            console.timeEnd('Compilation');
            console.log(`${progressBar(0, 1, 20, true)} 0 / ${sampleCount}`);
        }
        try {
            const out = codeFunc(0, mode == Modes.Funcbeat ? samplerate : [0, 0, 0], 0, [0, 0, 0]);
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
    const songByteCount = (sampleCount * (stereo ? 2 : 1) * bitDepth / 8);
    const buffer: ArrayBuffer = new ArrayBuffer(44 + songByteCount);
    const dataView = new DataView(buffer, 44, songByteCount);
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
                
                ET.dispatchEvent(new CustomEvent("index",{detail: sampleIndex}));
            } else if (printStats == 1) {
                console.log(`\x1b[1A${progressBar(sampleIndex, sampleCount, Deno.consoleSize().columns - String(sampleIndex).length - String(sampleCount).length - 7, true)} ${sampleIndex} / ${sampleCount}`);
            }
        }
        try {
            const micSample: micSampleType = [0, 0, 0];
            if(micSound !== null) {
                const idx = Math.floor(sampleIndex / samplerate * 48000) * 2;
                const left = micSound[idx % micSound.length | 0] / 128 - 1;
                const right = micSound[(idx + 1) % micSound.length | 0] / 128 - 1;
                micSample[0] = left;
                micSample[1] = right;
                micSample[2] = left/2+right/2;
            }
            let out: number | number[] = NaN;
            try {
                out = codeFunc(
                    mode == Modes.Funcbeat ? sampleIndex / samplerate : sampleIndex, // Time (samples in non-funcbeat, seconds otherwise)
                    mode == Modes.Funcbeat ? samplerate : micSample, // sample rate on funcbeat, mic sample otherwise
                    sampleIndex, // funcbeat sample counter
                    micSample // funcbeat mic sample
                );
            } catch {
                out = NaN;
            }
            if (stereo) {
                if (Array.isArray(out)) {
                    if (!isNaN(out[0] ?? NaN)) lastValue[0] = getValues(out[0]);
                    if (!isNaN(out[1] ?? NaN)) lastValue[1] = getValues(out[1]);
                    if(bitDepth===16) {
                        dataView.setUint16(sampleIndex*4,lastValue[0]*32767.5&65535,true);
                        dataView.setUint16(sampleIndex*4+2,lastValue[1]*32767.5&65535,true);
                    } else {
                        dataView.setUint8(sampleIndex*2,lastValue[0]*127.5+128&255);
                        dataView.setUint8(sampleIndex*2+1,lastValue[1]*127.5+128&255);
                    }
                } else {
                    // Copy to both signals
                    if (!isNaN(out ?? NaN)) lastValue[0] = lastValue[1] = getValues(out);
                    if(bitDepth===16) {
                        dataView.setUint16(sampleIndex*4,lastValue[0]*32767.5&65535,true);
                        dataView.setUint16(sampleIndex*4+2,lastValue[1]*32767.5&65535,true);
                    } else {
                        dataView.setUint8(sampleIndex*2,lastValue[0]*127.5+128&255);
                        dataView.setUint8(sampleIndex*2+1,lastValue[1]*127.5+128&255);
                    }
                }
            } else {
                if (Array.isArray(out)) {
                    // Downmix to mono 
                    let channels: number = 0;
                    if (!isNaN(out[0] ?? NaN)) {
                        lastValue[0] = getValues(out[0]);
                        channels |= 1;
                    }
                    if (!isNaN(out[1] ?? NaN)) {
                        lastValue[1] = getValues(out[1]);
                        channels |= 2;
                    }
                    if(bitDepth===16) {
                        if (channels == 3) {
                            dataView.setUint16(sampleIndex*2,lastValue[0] * 16383.25 + lastValue[1] * 16383.25 + 32768 & 65535);
                        } else if (channels == 2) {
                            dataView.setUint16(sampleIndex*2,lastValue[1]*32767.5&65535,true);
                        } else {
                            dataView.setUint16(sampleIndex*2,lastValue[0]*32767.5&65535,true);
                        }
                    } else {
                        if (channels == 3) {
                            dataView.setUint8(sampleIndex,lastValue[0] * 63.25 + lastValue[1] * 63.25 + 128 & 255);
                        } else if (channels == 2) {
                            dataView.setUint8(sampleIndex,lastValue[1]*127.5+128&255);
                        } else {
                            dataView.setUint8(sampleIndex,lastValue[0]*127.5+128&255);
                        }
                    }
                } else {
                    if (!isNaN(out ?? NaN)) lastValue[0] = lastValue[1] = getValues(out);
                    if(bitDepth===16) {
                        dataView.setUint16(sampleIndex*2,lastValue[0]*32767.5&65535,true);
                    } else {
                        dataView.setUint8(sampleIndex,lastValue[0]*127.5+128&255);
                    }
                }
            }
        } catch { /* TODO: cli would print an error here */ }
    }
    if (printStats == 1) {
        console.log(`\x1b[1A${progressBar(1, 1, Deno.consoleSize().columns - String(sampleIndex).length * 2 - 7, true)} ${sampleIndex} / ${sampleIndex}`);
        console.timeEnd("Rendering");
    }

    const headerView = new DataView(buffer,0,44);

    headerView.setUint32(0,  0x52494646);                                        // "RIFF"
    headerView.setUint32(4,  buffer.byteLength-8,true);                          // Size of all data beyond this point
    headerView.setUint32(8,  0x57415645);                                        // "WAVE"
    headerView.setUint32(12, 0x666d7420);                                        // "fmt "
    headerView.setUint32(16, 16,true);                                           // The format chunk size is 16 bytes long
    headerView.setUint16(20, 1,true);                                            // PCM marker
    headerView.setUint16(22, stereo ? 2 : 1,true);                               // Channel count
    headerView.setUint32(24, samplerate,true);                                   // Sample rate
    headerView.setUint32(28, samplerate * (stereo ? 2 : 1) * bitDepth / 8,true); // samplerate*channels*bitdepth/8
    headerView.setUint16(32, (stereo ? 2 : 1) * bitDepth / 8,true);              // Same thing without samplerate
    headerView.setUint16(34, bitDepth,true);                                     // Bit depth
    headerView.setUint32(36, 0x64617461);                                        // "data"
    headerView.setUint32(40, songByteCount);                                     // Song byte count (size of the data chunk)

    const outputFile = filename;

    const headerString: string = 
    `Size 0x${buffer.byteLength.toString(16)} - ${stereo ? 2 : 1} channels - samplerate ${samplerate} - byterate ${samplerate * (stereo ? 2 : 1) * bitDepth / 8} - bytes per sample ${(stereo ? 2 : 1) * bitDepth / 8} - ${bitDepth} bits little endian`;

    if (printStats == 2) {
        if(!truncated)
            
            ET.dispatchEvent(new CustomEvent("index",{detail: sampleCount}));
        
        ET.dispatchEvent(new CustomEvent("done",{detail: {headerString, outputFile, bytes: formatByteCount(buffer.byteLength)}}));
    } else if (printStats == 1) {
        console.log(headerString);
        console.log(`FILE ${outputFile} SIZE ${formatByteCount(buffer.byteLength)}`);
    }

    Deno.writeFileSync(outputFile, new Uint8Array(buffer));
    return { error: null, file: outputFile, truncated };
}
