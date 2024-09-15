import { renderCode, Modes } from "../bytebeatToAudio.js";
import { readFile } from "node:fs/promises";

let codeString: string = "t&t>>8";
let sampleRate: number = 8000;
let mode: Modes = Modes.Bytebeat;
let stereo: boolean | null = null;
let seconds: number = 15;
let usagePrinted: boolean = false;
// let fail: boolean = false;

function printUsage(f: (text: string) => void = console.warn) {
    if(usagePrinted) return;
    usagePrinted = true;
    f(`Usage: node ${process.argv[1]} <options> <infile> <outfile>`);
    f(`e.g. node ${process.argv[1]} samplerate:48000,mode:funcbeat bootsinbed.js bootsinbed.wav`);
    f("");
    f("Possible arguments:");
    f("    r, samplerate: (8000) Samplerate of the track.");
    f("    m, mode      : (byte) Sound mode, can be 'byte' 'signed' 'float' 'func'.");
    f("    s, stereo    : (x)    Explicitly set stereo, can be 'y', 'n', or 'x'.");
    f("                      ... Automatically decide if 'x'.");
    f("    t, time      : (15)   Render length in seconds.");
}

if (process.argv.length != 5) {
    printUsage(console.log);
} else {
    // Parse command-line arguments.

    const inFile = process.argv[3];
    const outFile = process.argv[4];

    // @ts-ignore - I think we're garunteed to have a [string, string][] at
    // this point. If not, try to blame regex first.
    const params: [string, string][] = process.argv[2].match(/\w+:[\w.]+/g)?.map(k => k.toLowerCase().split(':')) ?? [];

    for (const [key, value] of params) {
        switch (key) {
            case 'r': case 'samplerate': {
                sampleRate = parseInt(value, 10);
                if (isNaN(sampleRate)) {
                    process.exitCode = 1;
                    printUsage();
                    console.error("Invalid samplerate. Please use an integer.");
                }
            } break;
            case 'm': case 'mode': {
                switch (value) {
                    case '0': case 'byte': case 'bytebeat': {
                        mode = Modes.Bytebeat;
                    } break;
                    case '1': case 'signed': case 'signed-bytebeat': {
                        mode = Modes.SignedBytebeat;
                    } break;
                    case '2': case 'float': case 'floatbeat': {
                        mode = Modes.Floatbeat;
                    } break;
                    case '3': case 'func': case 'funcbeat': {
                        mode = Modes.Funcbeat;
                    } break;
                    default: {
                        process.exitCode = 1;
                        printUsage();
                        console.error("Invalid mode. Please use:");
                        console.error("Bytebeat    :    0, byte, or bytebeat");
                        console.error("Signed bytebeat: 1, signed, or signed-bytebeat");
                        console.error("Floatbeat   :    2, float, or floatbeat");
                        console.error("Funcbeat    :    3, func, or funcbeat");
                    }; break;
                }
            } break;
            case 's': case 'stereo': {
                switch (value) {
                    case 'n': case 'no': {
                        stereo = false;
                    } break;
                    case 'x': case 'null': {
                        stereo = null;
                    } break;
                    case 'y': case 'yes': {
                        stereo = true;
                    } break;
                    default: {
                        process.exitCode = 1;
                        printUsage();
                        console.error("Invalid stereo setting. Please use x, null, y, yes, n, or no");
                    }; break;
                }
            } break;
            case 't': case 'time': {
                seconds = parseFloat(value);
                if (isNaN(seconds)) {
                    process.exitCode = 1;
                    printUsage();
                    console.error("Invalid duration. Please use a number.");
                }
            } break;
            default: {
                process.exitCode = 1;
                printUsage();
                console.error(`Invalid option ${key}.`);
            }; break;
        }
    }

    if (process.exitCode != 1) {
        console.log(`${Modes[mode]} at ${sampleRate}Hz stereo ${stereo} for ${seconds} seconds`);
        readFile(inFile,{ encoding: 'utf8' }).then(data=>{
            const result = renderCode(sampleRate, mode, data, seconds, stereo, false, 1, outFile, false);
            if(result.error != null) {
                console.error(`Couldn't make the render, the function returned "${result.error}"`);
            } else {
                console.log(`Sucessfully rendered to ${result.file}`);
            }
        }).catch(reason=>{
            console.error(`Couldn't open a file: ${reason}`);
        })
    }

}