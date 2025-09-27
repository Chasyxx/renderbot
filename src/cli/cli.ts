//     Renderbot: a Discord bot for rendering bytebeat codes
//     CLI code
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

import { renderCode, Modes } from "../bytebeatToAudio.ts";
import { parseArgs } from "@std/cli";

const cliArguments = parseArgs(Deno.args);

function printUsage(f: (text: string) => void = console.warn) {
    f(`Usage: deno cli.ts <options> <infile> <outfile>`);
    f(`e.g. deno cli.ts -r 48000 -m funcbeat bootsinbed.js bootsinbed.wav`);
    f("");
    f("Possible arguments:");
    f("   -r, --samplerate: (8000) Samplerate of the track.");
    f("   -m, --mode      : (byte) Sound mode, can be 'byte' 'signed' 'float' 'func'.");
    f("   -s, --stereo    : (x)    Explicitly set stereo, can be 'y', 'n', or 'x'.");
    f("                      ... Automatically decide if 'x'.");
    f("   -t, --time      : (60)   Render length in seconds.");
    f("   -d, --depth     : (16)   Bit depth.");
}

Deno.exitCode = (function main(): number {
    if (cliArguments["--help"]||cliArguments["-h"]||cliArguments._.length!==2) {
        printUsage(console.log);
        return 1;
    }
    // Parse command-line arguments.

    const inFile = cliArguments._[0];
    const outFile = cliArguments._[1];

    let sampleRate: number = 8000;
    let mode: Modes = Modes.Bytebeat;
    let stereo: boolean | null = null;
    let seconds: number = 60;
    let bitDepth: 8 | 16 = 16;

    const sampleRateArgument = cliArguments["samplerate"]??cliArguments["r"];
    const modeArgument = cliArguments["mode"]??cliArguments["m"];
    const stereoArgument = cliArguments["stereo"]??cliArguments["s"];
    const timeArgument = cliArguments["seconds"]??cliArguments["time"]??cliArguments["t"];
    const depthArgument = cliArguments["depth"]??cliArguments["d"];
    if(sampleRateArgument) {
        sampleRate = parseInt(sampleRateArgument);
        if(isNaN(sampleRate)){
            console.error("samplerate is not an integer");
            printUsage();
            return 1;
        }
    }
    if(modeArgument) {
        switch(modeArgument) {
            case 'bytebeat': case 'byte': case '0': case 0: {
                mode = Modes.Bytebeat;
            } break;
            case 'signedBytebeat': case 'signed': case '1': case 1: {
                mode = Modes.SignedBytebeat;
            } break;
            case 'floatbeat': case 'float': case '2': case 2: {
                mode = Modes.Floatbeat;
            } break;
            case 'funcbeat': case 'func': case '3': case 3: {
                mode = Modes.Funcbeat;
            } break;
            default: {
                console.error("mode is not:\n"+
                    "bytebeat, signedBytebeat, floatbeat, funcbeat,\n"+
                    "byte,     signed,         float,     func,\n"+
                    "0,        1,              2,         3."
                );
                printUsage();
                return 1;
            }
        }
    }
    if(stereoArgument) {
        switch(stereoArgument) {
            case '1': case 'y': case 'true': case 1: case true: {
                stereo = true;
            } break;
            case '0': case 'n': case 'false': case 0: {
                stereo = false;
            } break;
            case 'x': case 'null': case 'auto': {
                stereo = null;
            } break;
            default: {
                console.error("stereo is not:\n"+
                    "bytebeat, signedBytebeat, floatbeat, funcbeat,\n"+
                    "byte,     signed,         float,     func,\n"+
                    "0,        1,              2,         3."
                );
                printUsage();
                return 1;
            }
        }
    }
    if(timeArgument) {
        seconds = parseFloat(timeArgument);
        if(isNaN(seconds)){
            console.error("seconds is not a number");
            printUsage();
            return 1;
        }
    }
    if(depthArgument) {
        switch(depthArgument) {
            case '8': case 8: {
                bitDepth = 8;
            } break;
            case '16': case 16: {
                bitDepth = 16;
            } break;
            default: {
            console.error("depth is not 8 or 16");
            printUsage();
            return 1;
            }
        }
    }

    console.log(`${Modes[mode]} at ${sampleRate}Hz stereo ${stereo} for ${seconds} seconds`);
    Deno.readTextFile(String(inFile)).then(data=>{
        const result = renderCode(sampleRate, mode, data, String(outFile), seconds, stereo, bitDepth, false, 1, 0);
        if(result.error != null) {
            console.error(`Couldn't make the render, the function returned "${result.error}"`);
        } else {
            console.log(`Sucessfully rendered to ${result.file}`);
        }
    }).catch(reason=>{
        console.error(`Couldn't open a file: ${reason}`);
    });
    return 0;
})();
