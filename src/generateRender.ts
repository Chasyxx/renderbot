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

export {};

import { readFileSync, unlinkSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { AnySelectMenuInteraction, AttachmentBuilder, DiscordAPIError, EmbedBuilder, ModalSubmitInteraction } from 'discord.js';
import { CommandInteraction, ButtonInteraction, InteractionResponse, Message } from 'discord.js';
import { Worker } from 'node:worker_threads';
import { progressBar, Modes as bytebeatModes, renderOutputType } from './bytebeatToAudio.ts';
import { renderbotConfig as config } from './import/config.ts';
import { BytebeatLinkToSongData, bytebeatPlayerLinkDetectionRegexp, BytebeatSongData, BytebeatMode } from './import/bytebeatplayer.ts';
import ffmpeg from 'fluent-ffmpeg'
import { v4 as uuidv4 } from 'uuid';

type DiscordJSInteraction = CommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction

function prep(worker: Worker, fin: (msg: {finished: renderOutputType}) => void | Promise<void>) {
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
    link: string | null, songData: BytebeatSongData, credit: boolean,
    truncated: boolean, mention: string,
    attachment: AttachmentBuilder, renderTime: number, ffmpegTime?: number
    ): object {
    const embed = new EmbedBuilder()
	    .setColor(0x00FF00)
        .setTitle(`${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}`)
        .addFields(
            { name: "Length", value: `${songData.code.length}c`, inline: true },
            { name: "Render time", value: `${renderTime}s`, inline: true }
        );
        if(ffmpegTime != undefined) embed.addFields({ name: "FFMPEG time", value: `${ffmpegTime}s`, inline: true })
        if(link !== null && link.length < 2048) {
            embed.setURL(link);
        }
        if(truncated) {
            embed.setFooter({ text: 'Output truncated due to processing time' })
        }
        if(credit) embed.addFields({ name: 'Triggered by', value: mention, inline: true});
    return {
        files: [attachment],
        embeds: [embed]
    }
}

export async function renderCodeWrapperInteraction(interaction: DiscordJSInteraction, link: string, duration = 30): Promise<InteractionResponse<boolean> | undefined> {
    if (!bytebeatPlayerLinkDetectionRegexp.test(link)) {
        return await interaction.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("Invalid link")
                .setDescription("Please give a valid [dollchan](https://dollchan.net/bytebeat) link.")
            ],
            ephemeral: true
        })
    }
    link = link.match(bytebeatPlayerLinkDetectionRegexp)![0];
    let songData: BytebeatSongData;
    try {
        songData = BytebeatLinkToSongData(link);
    } catch (error) {
        if (error instanceof Error)
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error decoding link")
                    .setDescription("Ensure the link is valid.")
                    .addFields({ name: "Error", value: error.message ?? error})
                ],
                ephemeral: true
            })
        else return await interaction.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("Error decoding link")
                .setDescription("Ensure the link is valid.")
                .addFields({ name: "Error", value: String(error) })
            ],
            ephemeral: true
        })
    }
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
    const renderStartTime = Date.now();
    const worker = new Worker('./rendererWorker.ts', { workerData: {
        SR: songData.sampleRate,

        M:  songData.mode == "Funcbeat" ? bytebeatModes.Funcbeat :
            songData.mode == "Floatbeat" ? bytebeatModes.Floatbeat :
            songData.mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat :
                                                 bytebeatModes.Bytebeat,

        D: duration,
        code: songData.code,
        N: `../render/render-${uuidv4()}.wav`,
        T: config.audio.maximumProcessingTime
    } });
    prep(worker, async (data: {finished: renderOutputType}) => {
        const { error, file: wavFile, truncated } = data.finished;
        const renderEndTime = Date.now();
        if (error == null) {
            const finalFile = wavFile.replace('.wav',config.ffmpeg.fileExtension);
            if(config.ffmpeg.enable) {
                const ffmpegStartTime = Date.now();
                const conversion = ffmpeg(wavFile)
                    .toFormat(config.ffmpeg.format)
                    .on('end', async()=>{
                        const ffmpegEndTime = Date.now();
                        unlinkSync(wavFile);
                        const fileData = readFileSync(finalFile);
                        const attachment = new AttachmentBuilder(fileData, { name: finalFile });
                        await interaction.followUp(formatResponse(
                            link,songData,config.credit.command,truncated,
                            `<@${interaction.user.id}>`,attachment
                            ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                            ,Math.round((ffmpegEndTime - ffmpegStartTime) / 10) / 100
                        ));
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
                        await interaction.followUp(formatResponse(
                            link,songData,config.credit.command,truncated,
                            `<@${interaction.user.id}>`,attachment
                            ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                        ));
                        unlinkSync(wavFile);
                    })
                for(const key in config.ffmpeg.extra) {
                    const value = config.ffmpeg.extra[key];
                    //@ts-ignore - That probably means something.
                    conversion[key].apply(conversion,value)
                }
                conversion.save(finalFile)
            } else {
                const fileData = readFileSync(wavFile);
                const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                await interaction.followUp(formatResponse(
                    link,songData,config.credit.command,truncated,
                    `<@${interaction.user.id}>`,attachment
                    ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                ));
                unlinkSync(wavFile);
            }
        } else {
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error while rendering")
                    .setDescription(`\`${error}\``)
                ]
            })
        }
    });
    return;
}

export async function renderCodeWrapperFile(message: Message, code: string, sampleRate: number, mode: BytebeatMode, duration = 30): Promise<void> {
    if (duration * sampleRate > config.audio.sampleLimit) {
        await message.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(`Duration may not be greater than ${config.audio.sampleLimit} samples.`)
                .setDescription(`The longest you can render is ${Math.floor(config.audio.sampleLimit / sampleRate)} seconds.`)
                // .setFooter({ text: `${songData.sampleRate}Hz * ${duration}s = ${songData.sampleRate * duration} samples.` })
            ]
        });
        return;
    }
    let renderingStarted: Message;
    try {
        //@ts-expect-error: send property doesn't exist on "partial channels"
        renderingStarted = await message.channel.send({ content: "Rendering started!" });
    } catch (e) {
        if (e instanceof DiscordAPIError && e.code == 50013) {
            return;
        } else {
            if (e instanceof Error) console.error(e.stack);
            throw e;
        }
    }
    const renderStartTime = Date.now();
    const worker = new Worker('./rendererWorker.ts', { workerData: {
        SR: sampleRate,

        M:  mode === 'Funcbeat' ? bytebeatModes.Funcbeat :
            mode === 'Floatbeat' ? bytebeatModes.Floatbeat :
            mode === 'Signed Bytebeat' ? bytebeatModes.SignedBytebeat :
                                                 bytebeatModes.Bytebeat,

        D: duration,
        code: code,
        N: `../render/file-${uuidv4()}.wav`,
        T: config.audio.maximumProcessingTime
    } });
    prep(worker, async (data: {finished: renderOutputType}) => {
        const { error, file: wavFile, truncated } = data.finished;
        const renderEndTime = Date.now();
        if (error == null) {
            const finalFile = wavFile.replace('.wav',config.ffmpeg.fileExtension);
            if(config.ffmpeg.enable) {
                const ffmpegStartTime = Date.now();
                const conversion = ffmpeg(wavFile)
                    .toFormat(config.ffmpeg.format)
                    .on('end', async()=>{
                        const ffmpegEndTime = Date.now();
                        //unlinkSync(wavFile);
                        const fileData = readFileSync(finalFile);
                        const attachment = new AttachmentBuilder(fileData, { name: finalFile });
                        await renderingStarted!.delete();
                        await message.reply(formatResponse(
                            null,{ code, mode, sampleRate },config.credit.command,truncated,
                            `<@${message.author.id}>`,attachment
                            ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                            ,Math.round((ffmpegEndTime - ffmpegStartTime) / 10) / 100
                        ));
                        //unlinkSync(finalFile);
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
                        await renderingStarted!.delete();
                        await message.reply(formatResponse(
                            null,{ code, mode, sampleRate },config.credit.command,truncated,
                            `<@${message.author.id}>`,attachment
                            ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                        ));
                        unlinkSync(wavFile);
                    })
                for(const key in config.ffmpeg.extra) {
                    const value = config.ffmpeg.extra[key];
                    //@ts-ignore - That probably means something.
                    conversion[key].apply(conversion,value)
                }
                conversion.save(finalFile)
            } else {
                const fileData = readFileSync(wavFile);
                const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                await renderingStarted!.delete();
                await message.reply(formatResponse(
                    null,{ code, mode, sampleRate },config.credit.command,truncated,
                    `<@${message.author.id}>`,attachment
                    ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                ));
                unlinkSync(wavFile);
            }
        } else {
            await renderingStarted!.delete();
            await message.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error while rendering")
                    .setDescription(`\`${error}\``)
                ]
            })
        }
    });
    return;
}

export async function renderCodeWrapperMessage(message: Message, link: string): Promise<void> {
    try {
        let songData;
        try {
            songData = BytebeatLinkToSongData(link);
        } catch (error) {
            await message.react("\u274C");
            if (error instanceof Error)
                await message.reply({
                    embeds: [
                        new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle("Error decoding link")
                        .setDescription("The link may be invalid.")
                        .addFields({ name: "Error", value: error.message ?? error})
                    ]
                })
            else await message.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error decoding link")
                    .setDescription("The link may be invalid.")
                    .addFields({ name: "Error", value: String(error) })
                ]
            })
            return;
        }
        songData.sampleRate ??= 8000;
        let renderingStarted;
        try {
            //@ts-expect-error: send property doesn't exist on "partial channels"
            renderingStarted = await message.channel.send({ content: "Rendering started!" });
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code == 50013) {
                return;
            } else {
                if (e instanceof Error) console.error(e.stack);
                throw e;
            }
        }
        const duration = Math.min(config.audio.sampleLimit / songData.sampleRate, config.audio.defaultSeconds);
        const worker = new Worker('./rendererWorker.ts', { workerData: {
            SR: songData.sampleRate,
    
            M:  songData.mode == "Funcbeat" ? bytebeatModes.Funcbeat :
                songData.mode == "Floatbeat" ? bytebeatModes.Floatbeat :
                songData.mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat :
                                                     bytebeatModes.Bytebeat,
    
            D: duration,
            code: songData.code,
            N: `../render/message-${uuidv4()}.wav`,
            T: config.audio.maximumProcessingTime
        } });
        worker.on('messageerror', (e) => {
            console.error(e);
        });
        const renderStartTime = Date.now();
        prep(worker, async (data) => {
            const renderEndTime = Date.now();
            const { error, file: wavFile, truncated } = data.finished;
            if (error == null) {
                const finalFile = wavFile.replace('.wav',config.ffmpeg.fileExtension);
                if(config.ffmpeg.enable) {
                    const ffmpegStartTime = Date.now();
                    const conversion = ffmpeg(wavFile)
                        .toFormat(config.ffmpeg.format)
                        .on('end', async()=>{
                            const ffmpegEndTime = Date.now();
                            unlinkSync(wavFile);
                            const fileData = readFileSync(finalFile);
                            const attachment = new AttachmentBuilder(fileData, { name: finalFile });
                            await renderingStarted!.delete();
                            await message.reply(formatResponse(
                                link,songData,config.credit.command,truncated,
                                `<@${message.member?.id}>`,attachment
                                ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                                ,Math.round((ffmpegEndTime - ffmpegStartTime) / 10) / 100
                            ));
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
                            await renderingStarted!.delete();
                            await message.reply(formatResponse(
                                link,songData,config.credit.command,truncated,
                                `<@${message.member?.id}>`,attachment
                                ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                            ));
                            unlinkSync(wavFile);
                        })
                    for(const key in config.ffmpeg.extra) {
                        const value = config.ffmpeg.extra[key];
                        //@ts-ignore - That probably means something.
                        conversion[key].apply(conversion,value)
                    }
                    conversion.save(finalFile)
                } else {
                    const fileData = readFileSync(wavFile);
                    const attachment = new AttachmentBuilder(fileData, { name: wavFile });
                    await renderingStarted!.delete();
                    await message.reply(formatResponse(
                        link,songData,config.credit.command,truncated,
                        `<@${message.member?.id}>`,attachment
                        ,Math.round((renderEndTime - renderStartTime) / 10) / 100
                    ));
                    unlinkSync(wavFile);
                }
            } else {
                await message.react("\u2755");
                await renderingStarted.delete();
                await message.reply({
                    embeds: [
                        new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle("Error while rendering")
                        .setDescription(`\`${error}\``)
                    ]
                })
            }
        })
    } catch (_) {
        await message.react("\u2757");
        console.error(_);
        return;
    }
    return;
}
