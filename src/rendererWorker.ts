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

// All @ts-expect-error lines below unless said otherwise are due to discord.js
// redefining the EventEmmiter class and causing several issues with type
// checking. Amazing.

import { renderCode, EE } from "./bytebeatToAudio.js";
import { workerData, isMainThread, parentPort } from "node:worker_threads";

if (isMainThread) {
  console.error("Worker file shouldn't be run directly!");
  process.exit(1);
}

let maxLength = 4096;

// @ts-expect-error - Read the above comment
EE.on("len", (m: number) => {
  maxLength = m;
});

// @ts-expect-error
EE.on("compile", (len: number) => {
  parentPort!.postMessage({ status: "compile", len });
});

// @ts-expect-error
EE.on("compileFuncbeat", () => {
  parentPort!.postMessage({ status: "funcbeat" });
});

// @ts-expect-error
EE.on("index", (idx: number) => {
  parentPort!.postMessage({ index: idx, max: maxLength });
});

// @ts-expect-error
EE.on("done", (h: number, f: number, s: number) => {
  parentPort!.postMessage({ status: "done", h, f, s });
});

// @ts-expect-error
EE.on("prep", () => {
  parentPort!.postMessage({ status: "prep" });
});

let x;
try {
  x = renderCode(
    workerData.SR,
    workerData.M,
    workerData.code,
    workerData.D,
    null,
    false,
    2,
    null,
    workerData.T
  );
} catch (e) {
  if (e instanceof Error) x = { error: e.message ?? e, file: null };
  else x = { error: e, file: null };
}

parentPort!.postMessage({ finished: x });

// if(x!==null) {

// } else {

// }
