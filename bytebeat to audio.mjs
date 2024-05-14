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
	/*bit*/        "bitC": function (x, y, z) { return x & y ? z : 0 },
	/*bit reverse*/"br": function (x, size = 8) {
		if (size > 32) { throw new Error("br() Size cannot be greater than 32") } else {
			let result = 0;
			for (let idx = 0; idx < (size - 0); idx++) {
				result += (x & (2 ** idx) ? (2 ** (size - idx + 1)) : 0);
			}
			return result
		}
	},
	/*sin that loops every 256 "steps", instead of every pi steps*/"sinf": function (x) { return Math.sin(x / (128 / Math.PI)) },
	/*cos that loops every 256 "steps", instead of every pi steps*/"cosf": function (x) { return Math.cos(x / (128 / Math.PI)) },
	/*tan that loops every 256 "steps", instead of every pi steps*/"tanf": function (x) { return Math.tan(x / (128 / Math.PI)) },
	/*converts t into a string composed of it's bits, regex's that*/"regG": function (t, X) { return X.test(t.toString(2)) }
	/*corrupt sound"crpt": function(x,y=8) {return chyx.br(chyx.br(x,y)+t,y)^chyx.br(t,y)},
	decorrupt sound"decrpt": function(x,y=8) {return chyx.br(chyx.br(x^chyx.br(t,y),y)-t,y)},*/
}

let bitsPerSample = 8;

function write32(input) {
	const buffer = Buffer.alloc(4);
	buffer.writeUInt32LE(input, 0);
	return buffer;
}

function write16(input) {
	const buffer = Buffer.alloc(2);
	buffer.writeUInt16LE(input, 0);
	return buffer;
}

export function progressBar(val, max, barSize = 20) {
	let step = Math.max(0, Math.min(barSize, val / max * barSize));
	return `\x1b[0;36;7m[${'#'.repeat(step).padEnd(barSize, '.').replace(/\./g, '\x1b[0m.').replace(/\#/g, '\x1b[0;7m#')}\x1b[0;36;7m]\x1b[0m`;
}

function visualizer(array) {
	let out = ''
	const width = 64;
	const height = 8;
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

function formatFileSize(bytes) {
	let ibi, iga;
	if (bytes < 1e3) {
		ibi = bytes + "b"
	} else if (bytes < 1e6) {
		const kib = String(bytes / 1e3).replace(/(?<=.\d\d)\d+$/, '')
		ibi = kib + " KiB"
	} else if (bytes < 1e9) {
		const mib = String(bytes / 1e6).replace(/(?<=.\d\d)\d+$/, '')
		ibi = mib + " MiB"
	} else if (bytes < 1e12) {
		const gib = String(bytes / 1e9).replace(/(?<=.\d\d)\d+$/, '')
		ibi = gib + " GiB"
	}
	if (bytes < 1024) {
		iga = bytes + "b"
	} else if (bytes < (1024 ** 2)) {
		const kb = String(bytes / 1024).replace(/(?<=.\d\d)\d+$/, '')
		iga = kb + " KB"
	} else if (bytes < (1024 ** 3)) {
		const mb = String(bytes / (1024 ** 2)).replace(/(?<=.\d\d)\d+$/, '')
		iga = mb + " MB"
	} else if (bytes < (1024 ** 4)) {
		const gb = String(bytes / (1024 ** 3)).replace(/(?<=.\d\d)\d+$/, '')
		iga = gb + " GB"
	}
	return iga + " / " + ibi;
}

export const EE = new EventEmitter();

export function renderCode(samplerate, mode, codeString, lengthValue = 10, stereo, useChasyxxPlayerAdditions = false, printStats = 0, filename = null) {
	const trueLength = Math.max(samplerate * lengthValue, samplerate);
	EE.emit('len', trueLength);
	let getvalues =
		mode >= 2 ? _ => Math.max(-1, Math.min(1, _)) * 127.5 + 128 :
			mode == 1 ? _ => (_ + 127) & 255 :
				_ => _ & 255;
	let codeFunc = () => { return 0; };
	let truncated = false;
	const params = Object.getOwnPropertyNames(Math);
	const values = params.map(k => Math[k]);
	const minute = 60000;
	const timeout = minute * 5;
	params.push('int', 'window');
	values.push(Math.floor, globalThis);
	if (useChasyxxPlayerAdditions) {
		for (let i in chasyxxPlayerAdditions) {
			params.push(Function.name(chasyxxPlayerAdditions[i]));
			values.push(chasyxxPlayerAdditions[i]);
		}
	}
	let i;
	if (printStats) {
		if (printStats >= 2) {
			EE.emit('compile', codeString.length);
		} else {
			console.log(`Compiling a ${codeString.length} code...`);
			console.time('Compilation');
		}
	}
	try {
		if (mode == 3) {
			const out = new Function(...params, codeString).bind(globalThis, ...values);
			if (printStats) {
				if (printStats >= 2) {
					EE.emit('compileFuncbeat');
				} else {
					console.log(`Funcbeat sub-compilation...`);
					console.time('Funcbeat');
				}
			}
			codeFunc = out();
			if (printStats == 1) console.timeEnd('Funcbeat');
			try {
				if (codeFunc === undefined || codeFunc === null || typeof codeFunc !== 'function') throw { message: "Primary output was not a function" };
			} catch (e) {
				return { error: "Funcbeat error: " + e.message, file: null, truncated: null };
			}
		} else {
			codeFunc = new Function(...params, `t`, `return 0,\n${codeString || 0};`).bind(globalThis, ...values);
		}
		if (printStats) {
			if (printStats >= 2) {
				EE.emit('prep');
				EE.emit('index', 0);
			} else {
				console.timeEnd('Compilation');
				console.log(`${progressBar(0, 1)} 0 / ${trueLength}`);
			}
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
		} catch (e) {
			// console.log(`\x1b[91m[!] Runtime error at t=0: ${e.message}\x1b[0m`);
			stereo = false;
		}
	} catch (e) {
		console.error("Compilation error: " + e.message);
		return { error: "Compilation error: " + e.message, file: null, truncated: null };
	}
	let buffer = Buffer.alloc(trueLength * (1 + stereo));
	let lastValue = stereo ? [0, 0] : 0;
	const startTime = Date.now();
	if (stereo) {
		for (i = 1; i <= trueLength; i++) {
			if ((i & 255) == 0) {
				const time = Date.now();
				if ((time - startTime) > timeout) {
					truncated = true;
					break;
				}
				if (printStats && (i & 1023) == 0) {
					if (printStats >= 2) {
						EE.emit('index', i);
					} else {
						console.log(`\x1b[1A${progressBar(i, trueLength, 40)} ${i} / ${trueLength}`);
					}
				}
			};
			let result = [NaN, NaN];
			try {
				result = codeFunc(mode == 3 ? i / samplerate : i, samplerate);
			} catch (e) {
				//if (e instanceof Error) {
				//	console.log(`\x1b[91m[ ] Runtime error at t=${i}: ${e.message}\x1b[0m`)
				//} else {
				//	console.log(`\x1b[93m[ ] Thrown at t=${i}: ${e}\x1b[0m`)
				//}
			}
			// try {
			if (!isNaN((result ?? [NaN, null])[0])) lastValue[0] = getvalues((result ?? [i & 1 && 255, null])[0]) & 255;
			if (!isNaN((result ?? [NaN, null])[1])) lastValue[1] = getvalues((result ?? [null, i & 2 && 255])[1]) & 255;
			// }catch(e){if(e instanceof TypeError){
			// 	return "Error reading stereo array: got undefined"
			// }}
			buffer[i * 2] = lastValue[0];
			buffer[i * 2 + 1] = lastValue[1];
		}
	} else {
		for (i = 1; i <= trueLength; i++) {
			if ((i & 255) == 0) {
				const time = Date.now();
				if ((time - startTime) > timeout) {
					truncated = true;
					break;
				}
				if (printStats && (i & 1023) == 0) {
					if (printStats >= 2) {
						EE.emit('index', i);
					} else {
						console.log(`\x1b[1A${progressBar(i, trueLength, 40)} ${i} / ${trueLength}`);
					}
				}
			};
			let result = NaN;
			try {
				result = codeFunc(mode == 3 ? i / samplerate : i, samplerate);
			} catch (e) {
				//if (e instanceof Error) {
				//	console.log(`\x1b[91m[ ] Runtime error at t=${i}: ${e.message}\x1b[0m`)
				//} else {
				//	console.log(`\x1b[93m[ ] Thrown at t=${i}: ${e}\x1b[0m`)
				//}
			}
			// try {
			if (!isNaN(result)) lastValue = getvalues(result) & 255;
			// }catch(e){if(e instanceof TypeError){
			// 	return "Error reading stereo array: got undefined"
			// }}
			buffer[i] = lastValue;
		}
	}
	let zeroIndex = buffer.length;
	while (buffer[zeroIndex - 1] == 0) --zeroIndex;
	//if(zeroIndex<512&&!zeroIndex==0) return "Truncation error: post-truncation render is under 512 samples"
	if (zeroIndex > samplerate) buffer = buffer.subarray(0, zeroIndex);
	else buffer = buffer.subarray(0, samplerate)
	const header = Buffer.concat([
		Buffer.from('RIFF', 'ascii'),									// Rescource Interchange File Format
		write32(buffer.length + 36),									// filesize - 8
		Buffer.from('WAVEfmt ', 'ascii'),								// .wav file, begin formatting info
		write32(16),													// length of formatting info
		write16(1),														// Marker for PCM data
		write16(1 + stereo),											// Channel No.
		write32(samplerate),											// Sample rate
		write32(samplerate * (stereo ? 2 : 1) * (bitsPerSample / 8)),	// Byte rate: (Sample rate * Number of channels * Bits per sample) / 8
		write16((bitsPerSample * (stereo ? 2 : 1)) / 8),				// Bytes per sample: (Bits per sample * Number of channels) / 8	
		write16(bitsPerSample),											// bits per sample
		Buffer.from('data', 'ascii'),									// Begin data block
		write32(buffer.length),											// How long is this block?
	]);

	const final = Buffer.concat([header, buffer]);

	const outputFile = filename ?? ("output" + String(Date.now()) + ".wav");

	if (printStats) {
		if (printStats >= 2) {
			EE.emit('done', header.toString('hex').replace(/(..)/g, '$1 '), outputFile, formatFileSize(final.length));
		} else {
			console.log(`\x1b[1A${progressBar(1, 1, 40)} ${trueLength} / ${trueLength}`);
			console.log(`HEADER ${header.toString('hex').replace(/(..)/g, '$1 ')}`);
			console.log(`FILE ${outputFile} SIZE ${formatFileSize(final.length)}`);
		}
	}

	fs.writeFileSync(outputFile, final);
	return { error: null, file: outputFile, truncated };
}
