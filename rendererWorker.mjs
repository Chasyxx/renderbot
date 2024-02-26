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

import { renderCode } from './bytebeat to audio.mjs';
import { workerData, isMainThread, parentPort } from 'node:worker_threads';

if(isMainThread) {
    console.error("Worker file shouldn't be run directly!");
    process.exit(1);
}

if(process.env.NODE_NO_WARNINGS==1) console.log = console.warn = console.error = console.debug = () => { return; };

let x;
try {
    x = renderCode(workerData.SR, workerData.M, workerData.code, workerData.D, null);
} catch (e) {
    x = { error: e.message ?? e, file: null };
}

parentPort.postMessage(x)

// if(x!==null) {

// } else {

// }
