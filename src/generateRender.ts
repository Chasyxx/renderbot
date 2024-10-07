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
import { AnySelectMenuInteraction, AttachmentBuilder, DiscordAPIError, EmbedBuilder, ModalSubmitInteraction } from 'discord.js';
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
    link: string, songData: DollchanSongData, credit: boolean,
    truncated: boolean, mention: string,
    attachment: AttachmentBuilder
    ): object {
    const embed = new EmbedBuilder()
	    .setColor(0x00FF00)
        .setTitle(`${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}`);
        if(link.length < 1900) {
            embed.setURL(link);
        }
        if(truncated) {
            embed.setFooter({ text: 'Output truncated due to processing time' })
        }
        if(credit) embed.addFields({ name: 'Triggered by', value: mention, inline: true});
    return {
        // content: string,
        files: [attachment],
        embeds: [embed]
    }
}
export async function renderCodeWrapperInteraction(interaction: DiscordJSInteraction, link: string, duration = 30): Promise<InteractionResponse<boolean> | undefined> {
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
    if (duration * songData.sampleRate > config.audio.sampleLimit) return await interaction.reply({
        embeds: [
            new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`Duration may not be greater than ${config.audio.sampleLimit} samples.`)
            .setDescription(`The longest you can render is ${Math.floor(config.audio.sampleLimit / songData.sampleRate)} seconds.`)
            // .setFooter({ text: `${songData.sampleRate}Hz * ${duration}s = ${songData.sampleRate * duration} samples.` })
        ], ephemeral: true
    });
    await interaction.deferReply()
    const worker = new Worker('./rendererWorker.js', { workerData: { SR: songData.sampleRate, M: songData.mode == "Funcbeat" ? bytebeatModes.Funcbeat : songData.mode == "Floatbeat" ? bytebeatModes.Floatbeat : songData.mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat : bytebeatModes.Bytebeat, D: duration, code: songData.code, T: config.audio.maximumProcessingTime } });
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
                        await interaction.followUp(formatResponse(link,songData,config.credit.command,truncated,`<@${interaction.user.id}>`,attachment))
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
                        await interaction.followUp(formatResponse(link,songData,config.credit.command,truncated,`<@${interaction.user.id}>`,attachment))
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
                await interaction.followUp(formatResponse(link,songData,config.credit.command,truncated,`<@${interaction.user.id}>`,attachment))
                unlinkSync(wavFile);
            }
        } else {
            await interaction.followUp({ content: `\`\`\`ansi\n\x1b[31m[ERR]\x1b[0m ${error}\n\`\`\`` });
        }
    });
    return;
}

export async function renderCodeWrapperMessage(message: Message, link: string): Promise<void> {
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
            return;
        }
        songData.sampleRate ??= 8000;
        let msg;
        try {
            msg = await message.channel.send({ content: "Rendering started!" });
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code == 50013) {
                return;
            } else {
                if (e instanceof Error) console.error(e.stack);
                throw e;
            }
        }
        const duration = Math.min(config.audio.sampleLimit / songData.sampleRate, config.audio.defaultSeconds);
        const worker = new Worker('./rendererWorker.js', { workerData: { SR: songData.sampleRate, M: songData.mode == "Funcbeat" ? bytebeatModes.Funcbeat : songData.mode == "Floatbeat" ? bytebeatModes.Floatbeat : songData.mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat : bytebeatModes.Bytebeat, D: duration, code: songData.code, T: config.audio.maximumProcessingTime } });
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
                            await message.reply(formatResponse(link,songData,config.credit.message,truncated,`<@${message.member?.id}>`,attachment))
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
                            await message.reply(formatResponse(link,songData,config.credit.message,truncated,`<@${message.member?.id}>`,attachment))
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
                    await message.reply(formatResponse(link,songData,config.credit.message,truncated,`<@${message.member?.id}>`,attachment))
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
        return;
    }
    return;
}
