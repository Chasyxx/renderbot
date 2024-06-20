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

import { inflateRaw } from 'pako';
import { readFileSync, unlinkSync } from 'fs';
import { AttachmentBuilder, DiscordAPIError } from 'discord.js';
import { CommandInteraction, ButtonInteraction, AnySelectMenuInteraction, ModalSubmitInteraction, InteractionResponse, Message } from 'discord.js';
import { Worker } from 'worker_threads';
import { progressBar } from './bytebeatToAudio.js';

function _btoa($: string): string {
    return Buffer.from($, 'binary').toString('base64');
}
export function _atob($: string): string {
    return Buffer.from($, 'base64').toString('binary');
}

function prep(worker: Worker, fin: (msg: any) => void | Promise<void>) {
    worker.on('message', async (eventMessage) => {

        if (eventMessage.status) {
            switch (eventMessage.status) {
                case 'prep': {
                    console.log(progressBar(0, 1, 40));
                    break;
                }
                case 'done': {
                    console.log("HEADER", eventMessage.h);
                    console.log("FILE %s SIZE %s", eventMessage.f, eventMessage.s);
                    break;
                }
                case 'compile': default: {
                    console.log("Compiling %d", eventMessage.len);
                    break;
                }
                case 'funcbeat': {
                    console.log("Functionizing a code...");
                    break;
                }
            }
        }

        if (Object.hasOwnProperty.call(eventMessage,'index')) {
            console.log('\x1b[1A%s %d / %d', progressBar(eventMessage.index, eventMessage.max, 40), eventMessage.index, eventMessage.max);
        }

        if (eventMessage.finished) {
            await fin(eventMessage);
        }
    })
}

export async function renderCodeWrapperInteraction(interaction: CommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction, link: string, duration = 30, button = false): Promise<InteractionResponse<boolean> | undefined> {
    if (link.indexOf('#v3b64') == -1) {
        return await interaction.reply({ content: 'Please give a valid [dollChan](https://dollchan.net/bytebeat/) link.', ephemeral: true });
    }
    const hash = _atob(link.slice(link.indexOf('#v3b64') + 6));
    const dataBuffer = new Uint8Array(hash.length);
    for (let i = 0; i < hash.length; i++) {
        if (Object.prototype.hasOwnProperty.call(hash, i)) {
            dataBuffer[i] = hash.charCodeAt(i);
        }
    }
    let songData;
    try {
        songData = JSON.parse(inflateRaw(dataBuffer, { to: 'string' }));
    } catch (error) {
        if (error instanceof Error)
            return await interaction.reply({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error.message ?? error}\n\`\`\`\nThis was an error decoding the link given, ensure it is valid. `, ephemeral: true });
        else return await interaction.reply({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error}\n\`\`\`\nThis was an error decoding the link given, ensure it is valid. `, ephemeral: true });
    }
    let msg: InteractionResponse<boolean> | null = null;
    songData.sampleRate ??= 8000;
    if (duration * songData.sampleRate > 2_880_000) return await interaction.reply({ content: `\`\`\`Duration may not be greater than 2,880,000 samples.\n(${songData.sampleRate}Hz * ${duration}s = ${songData.sampleRate * duration} samples.)\nThe longest you can render is ${Math.floor(2_880_000 / songData.sampleRate)} seconds.\`\`\``, ephemeral: true });
    if (!button) { await interaction.deferReply() }
    else msg = await interaction.reply({ content: 'Rendering started!' });
    const worker = new Worker('./rendererWorker.js', { workerData: { SR: songData.sampleRate, M: songData.mode == "Funcbeat" ? 3 : songData.mode == "Floatbeat" ? 2 : songData.mode == "Signed Bytebeat" ? 1 : 0, D: duration, code: songData.code } });
    prep(worker, async (data) => {
        const { error, file, truncated } = data.finished;
        if (error == null) {
            const fileData = readFileSync(file);
            const attachment = new AttachmentBuilder(fileData, { name: file });
            if (button) await msg!.delete();
            await interaction.followUp(
                {
                    content: link.length > 1900 ? `*${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}*` : `*[Rendered code](<${link}>), ${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}*` + (truncated ? " (Truncated) " : "") + (button ? `\nRequested by <@${interaction.member!.user.id}>` : ''),
                    files: [attachment],
                    components: duration >= 60 || link.length > 1900 || songData.sampleRate > 48000 ? undefined : [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    label: '60 second render',
                                    style: 1,
                                    custom_id: 'full'
                                }
                            ]
                        }
                    ]
                })
            unlinkSync(file);
        } else {
            if (button) await msg!.delete();
            await interaction.followUp({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error}\n\`\`\`` });
        }
    });
    return;
}

export async function renderCodeWrapperMessage(message: Message, link: string): Promise<number> {
    try {
        const hash = _atob(link.slice(link.indexOf('#v3b64') + 6));
        const dataBuffer = new Uint8Array(hash.length);
        for (let i = 0; i < hash.length; i++) {
            if (Object.prototype.hasOwnProperty.call(hash, i)) {
                dataBuffer[i] = hash.charCodeAt(i);
            }
        }
        let songData;
        try {
            songData = JSON.parse(inflateRaw(dataBuffer, { to: 'string' }));
        } catch (error) {
            await message.react("\u274C");
            if (error instanceof Error) await message.reply({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error.message ?? error}\n\`\`\`\nThis was an error decoding the link in the message, it may be invalid. ` });
            else await message.reply({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error}\n\`\`\`\nThis was an error decoding the link in the message, it may be invalid. ` });
            return 1;
        }
        songData.sampleRate ??= 8000;
        let msg;
        try {
            msg = await message.reply({ content: 'Rendering started!' });
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code == 50013) {
                return 1;
            } else {
                if (e instanceof Error) console.error(e.stack);
                throw e;
            }
        }
        const worker = new Worker('./rendererWorker.js', { workerData: { SR: songData.sampleRate, M: songData.mode == "Funcbeat" ? 3 : songData.mode == "Floatbeat" ? 2 : songData.mode == "Signed Bytebeat" ? 1 : 0, D: Math.min(2_880_000 / songData.sampleRate, 30), code: songData.code } });
        worker.on('messageerror', (e) => {
            console.error(e);
        });
        prep(worker, async (data) => {
            const { error, file, truncated } = data.finished;
            if (error == null) {
                const fileData = readFileSync(file);
                const attachment = new AttachmentBuilder(fileData, { name: file });
                await msg.delete();
                await message.reply(
                    {
                        content: (link.length > 1900 ? `*Render, ${songData.sampleRate}hz ${songData.mode || "Bytebeat"}*` : `*[Rendered code](<${link}>), ${songData.sampleRate}hz ${songData.mode || "Bytebeat"}*`) + (truncated ? " (Truncated)" : ""),
                        files: [attachment],
                        components: songData.sampleRate > 48000 || link.length > 1900 ? undefined : [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: '60 second render',
                                        style: 1,
                                        custom_id: 'full'
                                    }
                                ]
                            }
                        ]
                    })
                unlinkSync(file);

            } else {
                await message.react("\u2755");
                await msg.delete();
                await message.reply({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error}\n\`\`\`` });
            }
        })
    } catch (_) {
        await message.react("\u2757");
        console.error(_);
        return 1;
    }
    return 0;
}
