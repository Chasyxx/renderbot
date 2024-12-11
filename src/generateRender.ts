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

import { AttachmentBuilder, EmbedBuilder, CommandInteraction, Message } from 'discord.js';
import { Buffer } from 'node:buffer';
import { Worker } from 'node:worker_threads';
import { progressBar, Modes as bytebeatModes, renderOutputType } from './bytebeatToAudio.ts';
import { renderbotConfig as config } from './import/config.ts';
import { BytebeatLinkToSongData, bytebeatPlayerLinkDetectionRegexp, BytebeatSongData, BytebeatMode } from './import/bytebeatplayer.ts';
import ffmpeg from 'fluent-ffmpeg'

function prepareWorker(worker: Worker, fin: (msg: {finished: renderOutputType}) => void | Promise<void>) {
    worker.on('message', async (eventMessage) => {

        if (eventMessage.status) {
            switch (eventMessage.status) {
                case 'prep': {
                    if(config.print.terminal) console.log(progressBar(0, 1, config.print.barSize, config.print.terminal));
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
            console.log(`${config.print.terminal?'\x1b[1A':''}%s %d / %d`, progressBar(eventMessage.index, eventMessage.max, 40, config.print.terminal), eventMessage.index, eventMessage.max);
        }

        if (eventMessage.finished) {
            await fin(eventMessage);
        }
    })
}

function formatResponse(
    link: string | null, songData: BytebeatSongData, credit: boolean,
    truncated: boolean, mention: string,
    attachment: AttachmentBuilder, duration: number, renderTime: number, ffmpegTime?: number
    ): object {
    const embed = new EmbedBuilder()
	    .setColor(0x00FF00)
        .setTitle(`${songData.sampleRate || 8000}hz ${songData.mode || "Bytebeat"}`)
        .addFields(
            { name: "Length", value: `${songData.code.length}c`, inline: true },
            { name: "Render time", value: `${renderTime}s (${Math.round((duration/renderTime) * 100) / 100}s/s)`, inline: true }
        );
        if(ffmpegTime != undefined) embed.addFields({ name: "FFMPEG time", value: `${ffmpegTime}s (${Math.round((duration/ffmpegTime) * 100) / 100}s/s)`, inline: true })
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

async function checkLink(link: string, respondee: Message | CommandInteraction): Promise<boolean> {
    if (!bytebeatPlayerLinkDetectionRegexp.test(link)) {
        await respondee.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("Invalid link")
                .setDescription("Please give a valid [dollchan](https://dollchan.net/bytebeat) link.")
            ],
            ephemeral: respondee instanceof CommandInteraction ? true : undefined
        });
        return false;
    };
    return true;
}

async function decodeLink(link: string, respondee: Message | CommandInteraction): Promise <BytebeatSongData | null> {
    let songData: BytebeatSongData;
    try {
        songData = BytebeatLinkToSongData(link);
    } catch (error) {
        if (error instanceof Error) {
            await respondee.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error decoding link")
                    .setDescription("Ensure the link is valid.")
                    .addFields({ name: "Error", value: error.message ?? error})
                ],
                ephemeral: respondee instanceof CommandInteraction ? true : undefined
            });
            return null;
        } else {
            await respondee.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error decoding link")
                    .setDescription("Ensure the link is valid.")
                    .addFields({ name: "Error", value: String(error) })
                ],
                ephemeral: respondee instanceof CommandInteraction ? true : undefined
            });
            return null;
        }
    }
    songData.sampleRate ??= 8000;
    return songData;
}

async function checkSampleLength(seconds: number, samplerate: number, respondee: Message | CommandInteraction): Promise<boolean> {
    if (seconds * samplerate > config.audio.sampleLimit) {
        await respondee.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(`Duration may not be greater than ${config.audio.sampleLimit} samples.`)
                .setDescription(`The longest you can render is ${Math.floor(config.audio.sampleLimit / samplerate)} seconds.`)
                // .setFooter({ text: `${songData.sampleRate}Hz * ${duration}s = ${songData.sampleRate * duration} samples.` })
            ], ephemeral: respondee instanceof CommandInteraction ? true : undefined
        });
        return false;
    }
    return true;
}

async function sendFile(respondee: Message | CommandInteraction, file: string, link: string | null, songData: BytebeatSongData,
    truncated: boolean, duration: number, renderTimes: [number, number], ffmpegTimes?: [number, number]) {
    const fileData = Deno.readFileSync(file);
    const attachment = new AttachmentBuilder(Buffer.from(fileData), { name: file });
    const renderTime = Math.round((renderTimes[1] - renderTimes[0]) / 10) / 100;
    const ffmpegTime = ffmpegTimes===undefined?undefined:Math.round((ffmpegTimes[1] - ffmpegTimes[0]) / 10) / 100;
    if (respondee instanceof CommandInteraction) {
        await respondee.followUp(formatResponse(
            link,songData,config.credit.command,truncated,
            `<@${respondee.user.id}>`,attachment,
            duration, renderTime, ffmpegTime
        ));
    } else {
        await respondee.reply(formatResponse(
            link,songData,config.credit.command,truncated,
            `<@${respondee.author.id}>`,attachment,
            duration, renderTime, ffmpegTime
        ));
    }
}

function printFfmpegError(error: Error, stdout: string, stderr: string): void {
    console.error("FFMPEG FAILED",error);
    console.error("Last dozen lines of stdout:");
    console.error(stdout?.split('\n').slice(-12).join('\n'));
    console.error("Last dozen lines of stderr:");
    console.error(stderr?.split('\n').slice(-12).join('\n'));
}

async function sendRender(wavFile: string, respondee: Message | CommandInteraction, link: string | null, songData: BytebeatSongData, truncated: boolean, duration: number, renderStartTime: number, renderEndTime: number) {
    const finalFile = wavFile.replace('.wav', config.ffmpeg.fileExtension);
    if (config.ffmpeg.enable) {
        const ffmpegStartTime = Date.now();
        const conversion = ffmpeg(wavFile)
            .toFormat(config.ffmpeg.format)
            .on('end', async () => {
                const ffmpegEndTime = Date.now();
                Deno.removeSync(wavFile);
                await sendFile(respondee, finalFile, link, songData, truncated, duration, [renderStartTime, renderEndTime], [ffmpegStartTime, ffmpegEndTime]);
                Deno.removeSync(finalFile);
            })
            .on('error', async (error, o, e) => {
                Deno.remove(finalFile).then(() => { }).catch(() => { }); // Just try to delete the file, doesn't matter if it succeeds
                printFfmpegError(error, o ?? '(null)', e ?? '(null)')
                await sendFile(respondee, wavFile, link, songData, truncated, duration, [renderStartTime, renderEndTime]);
                Deno.removeSync(wavFile);
            })
        for (const key in config.ffmpeg.extra) {
            const value = config.ffmpeg.extra[key];
            //@ts-ignore - That probably means something.
            conversion[key].apply(conversion, value)
        }
        conversion.save(finalFile);
    } else {
        await sendFile(respondee, wavFile, link, songData, truncated, duration, [renderStartTime, renderEndTime]);
        Deno.removeSync(wavFile);
    }
}

function getMode(mode: BytebeatMode): bytebeatModes {
    return  mode == "Funcbeat" ? bytebeatModes.Funcbeat :
            mode == "Floatbeat" ? bytebeatModes.Floatbeat :
            mode == "Signed Bytebeat" ? bytebeatModes.SignedBytebeat :
                                         bytebeatModes.Bytebeat;
}

export async function renderCodeWrapperInteraction(interaction: CommandInteraction, link: string, duration = 30): Promise<void> {
    if(!(await checkLink(link,interaction))) return;
    link = link.match(bytebeatPlayerLinkDetectionRegexp)![0];
    const songData: BytebeatSongData | null = await decodeLink(link,interaction);
    if(songData===null) return;
    if(!(await checkSampleLength(duration,songData.sampleRate,interaction))) return;
    await interaction.deferReply();
    const renderStartTime = Date.now();
    const worker = new Worker('./rendererWorker.ts', { workerData: {
        SR: songData.sampleRate,
        M:  getMode(songData.mode),
        D: duration,
        code: songData.code,
        N: `../render/render-${crypto.randomUUID()}.wav`,
    } });
    prepareWorker(worker, async (data: {finished: renderOutputType}) => {
        const { error, file: wavFile, truncated } = data.finished;
        const renderEndTime = Date.now();
        if (error == null) {
            sendRender(wavFile,interaction,link,songData,truncated,duration,renderStartTime,renderEndTime);
        } else {
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("Error while rendering")
                    .setDescription(`\`${error}\``)
                ]
            });
        }
    });
    return;
}

export async function renderCodeWrapperFile(message: Message, code: string, sampleRate: number, mode: BytebeatMode, duration = 30): Promise<void> {
    try {
        if(!(await checkSampleLength(duration,sampleRate,message))) return;
        let renderingStarted;
        try {
            // @ts-expect-error: Property 'send' does not exist on partal channels (i'll only care about those if needed)
            renderingStarted = await message.channel.send({ content: "Rendering started!"});
        } catch {
            console.error(renderingStarted);
            // We don't have permission, stop now
            return;
        }
        const renderStartTime = Date.now();
        const worker = new Worker('./rendererWorker.ts', { workerData: {
            SR: sampleRate,
            M: getMode(mode),
            D: duration,
            code: code,
            N: `../render/file-${crypto.randomUUID()}.wav`,
        } });
        prepareWorker(worker, (data: {finished: renderOutputType}) => {
            const { error, file: wavFile, truncated } = data.finished;
            const renderEndTime = Date.now();
            if (error == null) {
                renderingStarted!.delete();
                sendRender(wavFile,message,null,{ code, sampleRate, mode},truncated,duration,renderStartTime,renderEndTime);
            } else {
                renderingStarted!.delete();
                message.react("\u2755");
                message.reply({
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
    } catch (_) {
        message.react("\u2757");
        console.error(_);
        return;
    }
}

export async function renderCodeWrapperMessage(message: Message, link: string): Promise<void> {
    try {
        if(!(await checkLink(link,message))) return;
        link = link.match(bytebeatPlayerLinkDetectionRegexp)![0];
        const songData: BytebeatSongData | null = await decodeLink(link,message);
        if(songData===null) return;
        const duration = Math.min(config.audio.sampleLimit / songData.sampleRate, config.audio.defaultSeconds);
        let renderingStarted;
        try {
            // @ts-expect-error: Property 'send' does not exist on partal channels (i'll only care about those if needed)
            renderingStarted = await message.channel.send({ content: "Rendering started!"});
        } catch {
            console.error(renderingStarted);
            // We don't have permission, stop now
            return;
        }
        const renderStartTime = Date.now();
        const worker = new Worker('./rendererWorker.ts', { workerData: {
            SR: songData.sampleRate,
            M:  getMode(songData.mode),
            D: duration,
            code: songData.code,
            N: `../render/message-${crypto.randomUUID()}.wav`,
        } });
        prepareWorker(worker, (data: {finished: renderOutputType}) => {
            const { error, file: wavFile, truncated } = data.finished;
            const renderEndTime = Date.now();
            if (error == null) {
                renderingStarted!.delete();
                sendRender(wavFile,message,link,songData,truncated,duration,renderStartTime,renderEndTime);
            } else {
                renderingStarted!.delete();
                message.react("\u2755");
                message.reply({
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
    } catch (_) {
        message.react("\u2757");
        console.error(_);
        return;
    }
}
