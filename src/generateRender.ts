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
import { unlink } from 'fs/promises';
import { AnySelectMenuInteraction, AttachmentBuilder, DiscordAPIError, ModalSubmitInteraction } from 'discord.js';
import { CommandInteraction, ButtonInteraction, InteractionResponse, Message } from 'discord.js';
import { Worker } from 'worker_threads';
import { progressBar, Modes as bytebeatModes, renderOutputType } from './bytebeatToAudio.js';
import { bytebeatPlayerLinkDetectionRegexp, renderbotConfig as config } from './config.js';
import ffmpeg from 'fluent-ffmpeg'

type DiscordJSInteraction = CommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
type DollchanSongData = {
  sampleRate: number,
  mode: "Bytebeat" | "Signed Bytebeat" | "Floatbeat" | "Funcbeat"
}

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

function formatResponse(
    // Content data
    link: string, songData: DollchanSongData, credit: boolean,
    truncated: boolean, mention: string,
    // other
    duration: number,
    attachment: AttachmentBuilder
    ): object {
    const string =  (link.length > 1900 ? 
        `*${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}*` :
        `*[Rendered code](<${link}>), ${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}*`)
        + (truncated ? " (Truncated) " : "")
        + (credit ? `\nRequested by ${mention}` : '')
    return {
        content: string,
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
    }
}
export async function renderCodeWrapperInteraction(interaction: DiscordJSInteraction, link: string, duration = 30, button = false): Promise<InteractionResponse<boolean> | undefined> {
    if (!bytebeatPlayerLinkDetectionRegexp.test(link)) {
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
    const worker = new Worker('./rendererWorker.js', { workerData: { SR: songData.sampleRate, M: songData.mode == "Funcbeat" ? bytebeatModes.Funcbeat : songData.mode == "Floatbeat" ? bytebeatModes.Floatbeat : songData.mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat : bytebeatModes.Bytebeat, D: duration, code: songData.code } });
    prep(worker, async (data: {finished: renderOutputType}) => {
        const { error, file: wavFile, truncated } = data.finished;
        if (error == null) {
            const finalFile = wavFile.replace('.wav',config.ffmpeg.fileExtension);
            if(config.ffmpeg.enable) {
                let conversion = ffmpeg(wavFile)
                    .toFormat(config.ffmpeg.format)
                    .on('end', async()=>{
                        unlinkSync(wavFile);
                        const fileData = readFileSync(finalFile);
                        const attachment = new AttachmentBuilder(fileData, { name: finalFile });
                        if (button) await msg!.delete();
                        await interaction.followUp(formatResponse(link,songData,button,truncated,`<@${interaction.member!.user.id}>`,duration,attachment))
                        unlinkSync(finalFile);
                    })
                    .on('error', async(error,o,e)=>{
                        console.warn("FFMPEG FAILED",error);
                        console.warn("Last few lines of stdout:");
                        console.warn(o?.split('\n').slice(-5).join('\n'))
                        console.warn("Last few lines of stderr:");
                        console.warn(e?.split('\n').slice(-5).join('\n'))
                        unlink(finalFile).then(()=>{}).catch(()=>{}) // Just try to delete the file, doesn't matter if it succeeds
                        const fileData = readFileSync(wavFile);
                        const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                        if (button) await msg!.delete();
                        await interaction.followUp(formatResponse(link,songData,button,truncated,`<@${interaction.member!.user.id}>`,duration,attachment))
                        unlinkSync(wavFile);
                    })
                for(const key in config.ffmpeg.extra) {
                    const value = config.ffmpeg.extra[key];
                    //@ts-ignore - That probably means something.
                    conversion = conversion[key].apply(conversion,value)
                }
                conversion = conversion.save(finalFile)
            } else {
                const fileData = readFileSync(wavFile);
                const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                if (button) await msg!.delete();
                await interaction.followUp(formatResponse(link,songData,button,truncated,`<@${interaction.member!.user.id}>`,duration,attachment))
                unlinkSync(wavFile);
            }
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
        const duration = Math.min(2_880_000 / songData.sampleRate, 30);
        const worker = new Worker('./rendererWorker.js', { workerData: { SR: songData.sampleRate, M: songData.mode == "Funcbeat" ? bytebeatModes.Funcbeat : songData.mode == "Floatbeat" ? bytebeatModes.Floatbeat : songData.mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat : bytebeatModes.Bytebeat, D: duration, code: songData.code } });
        worker.on('messageerror', (e) => {
            console.error(e);
        });
        prep(worker, async (data) => {
            const { error, file: wavFile, truncated } = data.finished;
            if (error == null) {
                const finalFile = wavFile.replace('.wav',config.ffmpeg.fileExtension);
                if(config.ffmpeg.enable) {
                    let conversion = ffmpeg(wavFile)
                        .toFormat(config.ffmpeg.format)
                        .on('end', async()=>{
                            unlinkSync(wavFile);
                            const fileData = readFileSync(finalFile);
                            const attachment = new AttachmentBuilder(fileData, { name: finalFile });
                            await msg!.delete();
                            await message.reply(formatResponse(link,songData,false,truncated,"",duration,attachment))
                            unlinkSync(finalFile);
                        })
                        .on('error', async(error,o,e)=>{
                            console.warn("FFMPEG FAILED",error);
                            console.warn("Last few lines of stdout:");
                            console.warn(o?.split('\n').slice(-5).join('\n'))
                            console.warn("Last few lines of stderr:");
                            console.warn(e?.split('\n').slice(-5).join('\n'))
                            unlink(finalFile).then(()=>{}).catch(()=>{}) // Just try to delete the file, doesn't matter if it succeeds
                            const fileData = readFileSync(wavFile);
                            const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                            await msg!.delete();
                            await message.reply(formatResponse(link,songData,false,truncated,"",duration,attachment))
                            unlinkSync(wavFile);
                        })
                    for(const key in config.ffmpeg.extra) {
                        const value = config.ffmpeg.extra[key];
                        //@ts-ignore - That probably means something.
                        conversion = conversion[key].apply(conversion,value)
                    }
                    conversion = conversion.save(finalFile)
                } else {
                    const fileData = readFileSync(wavFile);
                    const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                    await msg!.delete();
                    await message.reply(formatResponse(link,songData,false,truncated,"",duration,attachment))
                    unlinkSync(wavFile);
                }
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
