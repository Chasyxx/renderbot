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

import { renderCode, EE } from "./bytebeatToAudio.ts";
import { workerData, isMainThread, parentPort } from "node:worker_threads";
import { renderbotConfig } from "./import/config.ts";

if (isMainThread) {
  console.error("Worker file shouldn't be run directly!");
} else {
  let maxLength = 4096;

  EE.on("len", (m: number) => {
    maxLength = m;
  });

  EE.on("compile", (len: number) => {
    parentPort!.postMessage({ status: "compile", len });
  });

  EE.on("compileFuncbeat", () => {
    parentPort!.postMessage({ status: "funcbeat" });
  });

  EE.on("index", (idx: number) => {
    parentPort!.postMessage({ index: idx, max: maxLength });
  });

  EE.on("done", (h: number, f: number, s: number) => {
    parentPort!.postMessage({ status: "done", h, f, s });
  });

  EE.on("prep", () => {
    parentPort!.postMessage({ status: "prep" });
  });

  let x;
  try {
    x = renderCode(
      workerData.SR,
      workerData.M,
      workerData.code,
      workerData.N,
      workerData.D,
      null,
      false,
      2,
      renderbotConfig.audio.maximumProcessingTime,
      renderbotConfig.print.ms
    );
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.stack);
      x = { error: e.message ?? e, file: null, truncated: null };
    } else x = { error: e, file: null, truncated: null };
  }

  parentPort!.postMessage({ finished: x });
}