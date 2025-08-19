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

import { AttachmentBuilder, EmbedBuilder, CommandInteraction, Message, InteractionResponse } from 'discord.js';
import { Buffer } from 'node:buffer';
import { Worker } from 'node:worker_threads';
import { progressBar, Modes as bytebeatModes, renderOutputType, formatByteCount } from './bytebeatToAudio.ts';
import { renderbotConfig as config } from './import/config.ts';
import { BytebeatMode } from './import/bytebeatdata.ts';
import ffmpeg from 'fluent-ffmpeg'
import { bytebeatPlayers, DecodedLink, decodeLinkToSongData } from './players/root.ts';
import { getSplash } from './splashes.ts';

type sendFileOutput = null | { fileSize: number, duration: number, bitrate: number | null };
type Context = {
    timeTruncation: boolean | null,
    fileSizeBitrateReduction: number | null,
    fileSizeTruncation: number | null,
    ffmpegError: Error | null
};

function prepareWorker(worker: Worker, 
    fin?: (msg: {finished: renderOutputType}) => void | Promise<void>,
    update?: (percentage: number) => void | Promise<void>
) {
    let lastPercentage = 0;
    let percentage = 0;
    let cb = 0;
    function rate() {
        if(percentage>lastPercentage) {
            update!(percentage);
            lastPercentage = percentage;
        }
        cb = setTimeout(rate,5000);
    }
    if(update) rate();
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
            console.log(`${config.print.terminal?'\x1b[1A':''}%s %d / %d`, progressBar(eventMessage.index, eventMessage.max, config.print.barSize, config.print.terminal), eventMessage.index, eventMessage.max);
            percentage = Math.floor(eventMessage.index/eventMessage.max*100);
        }

        if (eventMessage.finished) {
            if(cb>0) clearTimeout(cb); // Even if I'm just superstitious it's still valid
            if(fin) await fin(eventMessage);
        }
    })
}

function handleContext(builder: EmbedBuilder, context: Context) {
    if(context.timeTruncation) {
        builder.addFields({ name: 'Time truncated',
            value: "Rendering took too long and I gave up.\nSome of the file is silent and the s/s value is less accurate."
        });
    }
    if(context.fileSizeBitrateReduction) {
        builder.addFields({ name: 'Bitrate reduced',
            value: `The full bitrate ${config.ffmpeg.bitrate} resulted in a file that was too large. I reduced it to ${context.fileSizeBitrateReduction}.`
        });
    }
    if(context.fileSizeTruncation) {
        builder.addFields({ name: 'Size truncation',
            value: `The full duration resulted in a file that was too large. I reduced it to ${context.fileSizeTruncation} seconds.`
        });
    }
    if(context.ffmpegError) {
        builder.addFields({ name: 'FFmpeg error',
            value: `FFmpeg encountered an error and I sent the WAV file instead.`
        });
    }
}

function formatResponse(
    decodedLink: DecodedLink, credit: boolean,
    context: Context, mention: string,
    attachment: AttachmentBuilder, duration: number, renderTime: number, ffmpegTime?: number, messageContent?: string
    ): object {
    const embed = new EmbedBuilder()
	    .setColor(0x22d871)
        .setTitle(`${decodedLink.songData.sampleRate || 8000}hz ${decodedLink.songData.mode || "Bytebeat"}`)
        .addFields(
            { name: "Length", value: `${decodedLink.songData.code.length}c`, inline: true },
            { name: "Size", value: formatByteCount(new Blob([decodedLink.songData.code]).size), inline: true },
            { name: "Render time", value: `${renderTime}s (${Math.round((duration/renderTime) * 100) / 100}s/s)`, inline: true }
        );
        if(ffmpegTime != undefined) embed.addFields({ name: "FFmpeg time", value: `${ffmpegTime}s (${Math.round((duration/ffmpegTime) * 100) / 100}s/s)`, inline: true })
        embed.setFooter({ text: getSplash() });
        if(credit) embed.addFields({ name: 'Triggered by', value: mention, inline: true});
        if(decodedLink.playerData.domain == null)
            embed.addFields({ name: 'Detected player',
            value: `${decodedLink.playerData.name} \`${decodedLink.playerData.fileName}\``, inline: true})
        else
            embed.addFields({ name: 'Detected player',
            value: `[${decodedLink.playerData.name}](${decodedLink.playerData.domain}) \`${decodedLink.playerData.fileName}\``, inline: true});
        handleContext(embed, context);
    return messageContent?{
        content: messageContent,
        files: [attachment],
        embeds: [embed],
        allowedMentions: { repliedUser: false } 
    }:{
        files: [attachment],
        embeds: [embed],
        allowedMentions: { repliedUser: false } 
    }
}

async function linkInvalidError(respondee: Message | CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
    .setColor(0xed4f4f)
    .setTitle("Invalid link")
    .setDescription("Please give a valid link using (one of) the below bytebeat player(s).");
    let counter = 0;
    for(const player of bytebeatPlayers) {
        if(counter>23 && bytebeatPlayers.length > 25) {
            embed.addFields({ name: "And more", value: "There are too many players to list!" });
            break;
        }
        embed.addFields([{ name: player.name, value: player.domain ?? "no domain" }]);
        counter++;
    }
    await respondee.reply({
        embeds: [
            embed
        ],
        ephemeral: respondee instanceof CommandInteraction ? true : undefined
    });
}

async function linkErrorError(respondee: Message | CommandInteraction, error: string): Promise<void> {
    await respondee.reply({
        embeds: [
            new EmbedBuilder()
            .setColor(0xed4f4f)
            .setTitle("Error decoding link")
            .setDescription("Ensure the link is valid.")
            .addFields({ name: "Error", value: "```"+(error.length > 994 ? `${error.slice(0,989)}(...)` : error)+"```" })
        ],
        ephemeral: respondee instanceof CommandInteraction ? true : undefined
    });
}

function renderError(respondee: Message | CommandInteraction, responder: Message | null | InteractionResponse, error: string, emoji="\u2755") {
    if(respondee instanceof Message) respondee.react(emoji);
    if(responder instanceof InteractionResponse || (responder instanceof Message && responder?.editable)) {
        responder.edit({
            content: "There was an error.",
            embeds: [
                new EmbedBuilder()
                .setColor(0xed4f4f)
                .setTitle("Error while rendering")
                .setDescription("```"+(error.length > 994 ? `${error.slice(0,989)}(...)` : error)+"```")
            ],
            allowedMentions: { repliedUser: false } 
        });
    } else if(respondee instanceof CommandInteraction) {
        respondee.followUp({
            embeds: [
                new EmbedBuilder()
                .setColor(0xed4f4f)
                .setTitle("Error while rendering")
                .setDescription("```"+(error.length > 994 ? `${error.slice(0,989)}(...)` : error)+"```")
            ],
            ephemeral: (respondee instanceof CommandInteraction) ? true : undefined,
            allowedMentions: { repliedUser: false } 
        });
    } else {
        respondee.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xed4f4f)
                .setTitle("Error while rendering")
                .setDescription("```"+(error.length > 994 ? `${error.slice(0,989)}(...)` : error)+"```")
            ],
            allowedMentions: { repliedUser: false } 
        });
    }
}

async function decodeLink(link: string, respondee: Message | CommandInteraction, print: boolean = true): Promise <DecodedLink | null> {
    let data: DecodedLink | null;
    try {
        data = decodeLinkToSongData(link);
    } catch (error) {
        if(error instanceof Error) {
            await linkErrorError(respondee, (error.stack??error.message));
        } else {
            await linkErrorError(respondee, String(error));
        }
        return null;
    }
    if(data == null) {
        if(print) await linkInvalidError(respondee);
        return null;
    }
    data.songData.sampleRate ??= 8000;
    data.songData.mode ??= 'Bytebeat';
    return data;
}

async function checkSampleLength(seconds: number, samplerate: number, respondee: Message | CommandInteraction): Promise<boolean> {
    if (seconds * samplerate > config.audio.sampleLimit) {
        await respondee.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0xed4f4f)
                .setTitle(`Duration may not be greater than ${config.audio.sampleLimit} samples.`)
                .setDescription(`The longest you can render is ${Math.floor(config.audio.sampleLimit / samplerate)} seconds.`)
                // .setFooter({ text: `${songData.sampleRate}Hz * ${duration}s = ${songData.sampleRate * duration} samples.` })
            ], ephemeral: respondee instanceof CommandInteraction ? true : undefined
        });
        return false;
    }
    return true;
}

async function fileLengthError(responder: Message | null | InteractionResponse, fileSize: number, maxDuration: number, maxBitrate: number, context: Context) {
    const embed = new EmbedBuilder()
        .setTitle("Error sending render")
        .setColor(0xeded4f)
        .setDescription(`File too large! Got ${formatByteCount(fileSize)} > 10 MB filesize limit.`)
        .addFields({
            name: "Max length estimate",
            value: `${maxDuration} seconds`
        });
    handleContext(embed, context);
    if(config.ffmpeg.bitrate!==null) {
        embed.addFields({
            name: "Max bitrate estimate",
            value: `${maxBitrate}`
        });
    }
    await responder?.edit({
        content: "There was an error.",
        embeds: [
            embed
        ]
    });
}

async function sendFile(respondee: Message | CommandInteraction, responder: Message | null | InteractionResponse, file: string, songData: DecodedLink,
    context: Context, duration: number, renderTimes: [number, number], ffmpegTimes?: [number, number], messageContent?: string): Promise<sendFileOutput> {
    const fileData = Deno.readFileSync(file);
    if(fileData.length >= 10_000_000) {
        return { fileSize: fileData.length, duration: duration / fileData.length*9_000_000|0, bitrate: config.ffmpeg.bitrate ? config.ffmpeg.bitrate / fileData.length*9_000_000|0  : null };
    }
    const attachment = new AttachmentBuilder(Buffer.from(fileData), { name: file });
    const renderTime = Math.round((renderTimes[1] - renderTimes[0]) / 10) / 100;
    const ffmpegTime = ffmpegTimes===undefined?undefined:Math.round((ffmpegTimes[1] - ffmpegTimes[0]) / 10) / 100;
    if (respondee instanceof CommandInteraction) {
        await responder?.edit(formatResponse(
            songData,config.credit.command,context,
            `<@${respondee.user.id}>`,attachment,
            duration, renderTime, ffmpegTime, messageContent
        ));
    } else {
        if(responder instanceof Message && responder?.editable) {
            await responder.edit(formatResponse(
                songData,config.credit.command,context,
                `<@${respondee.author.id}>`,attachment,
                duration, renderTime, ffmpegTime, messageContent
            ));
        } else {
            await respondee.reply(formatResponse(
                songData,config.credit.command,context,
                `<@${respondee.author.id}>`,attachment,
                duration, renderTime, ffmpegTime, messageContent
            ));
        }
    };
    return null;
}

function printFfmpegError(error: Error, stdout: string, stderr: string): void {
    console.error("FFMPEG FAILED",error);
    console.error("Last dozen lines of stdout:");
    console.error(stdout?.split('\n').slice(-12).join('\n'));
    console.error("Last dozen lines of stderr:");
    console.error(stderr?.split('\n').slice(-12).join('\n'));
}

function runFFmpeg(wavFile: string, finalFile: string, duration: number | null, bitrate: number | null,
    successCallback: (time: [ number, number ]) => void, 
    errorCallback: (error: Error, stdout: string | null, stderr: string | null) => void): Promise<[ number, number? ]> {
    return new Promise(resolve=>{
        const ffmpegStartTime = Date.now();
        const conversion = ffmpeg(wavFile)
            .toFormat(config.ffmpeg.format)
            .on('end', () => {
                const ffmpegEndTime = Date.now();
                // await sendFile(respondee, responder, finalFile, decodedLink, truncated, duration, [renderStartTime, renderEndTime], [ffmpegStartTime, ffmpegEndTime], textContent);
                successCallback([ ffmpegStartTime, ffmpegEndTime ]);
                // Deno.removeSync(finalFile);
                // Deno.removeSync(wavFile);
                resolve([ ffmpegStartTime, ffmpegEndTime ]);
            })
            .on('error', (error, o, e) => {
                Deno.remove(finalFile).then(() => { }).catch(() => { }); // Just try to delete the file, doesn't matter if it succeeds
                printFfmpegError(error, o ?? '(null)', e ?? '(null)');
                // await sendFile(respondee,responder,  wavFile, decodedLink, truncated, duration, [renderStartTime, renderEndTime], undefined, textContent);
                errorCallback(error, o, e);
                // Deno.removeSync(wavFile);
                resolve([ ffmpegStartTime ]);
            })
        if(bitrate !== null) {
            conversion.audioBitrate(bitrate);
        }
        if(duration !== null) {
            conversion.duration(duration);
        }
        for (const key in config.ffmpeg.extra) {
            const value = config.ffmpeg.extra[key];
            //@ts-ignore - That probably means something.
            conversion[key].apply(conversion, value)
        }
        conversion.save(finalFile);
    });
}

async function sendRender(wavFile: string, respondee: Message | CommandInteraction, responder: Message | InteractionResponse | null, decodedLink: DecodedLink, context: Context, duration: number, renderStartTime: number, renderEndTime: number, textContent?: string) {
    const finalFile = wavFile.replace('.wav', config.ffmpeg.fileExtension);
    if (config.ffmpeg.enable) {
        responder?.edit("Running FFmpeg, please wait...");
        const errorCallback = async (error: Error)=>{
            context.ffmpegError = error;
            const result = await sendFile(respondee, responder, wavFile, decodedLink, context, duration, [renderStartTime, renderEndTime], undefined, textContent);
            if(result!==null) {
                fileLengthError(responder, result.fileSize, result.duration, result.bitrate ?? 0, context);
            }
        };
        runFFmpeg(wavFile, finalFile, null, config.ffmpeg.bitrate, async (time: [ number, number ])=>{
            const result1 = await sendFile(respondee, responder, finalFile, decodedLink, context, duration, [renderStartTime, renderEndTime], time, textContent);
            if(result1!==null) {
                context.fileSizeBitrateReduction = result1.bitrate ?? config.ffmpeg.bitrate ?? 125;
                responder?.edit(`File too large! Reducing bitrate to ${context.fileSizeBitrateReduction}k...`);
                runFFmpeg(wavFile, finalFile, null, context.fileSizeBitrateReduction, async (time: [ number, number ])=>{
                    const result2 = await sendFile(respondee, responder, finalFile, decodedLink, context, duration, [renderStartTime, renderEndTime], time, textContent);
                    if(result2!==null) {
                        context.fileSizeTruncation = result2.duration;
                        responder?.edit(`File still too large!? Truncating to ${result2.duration} seconds...`);
                        runFFmpeg(wavFile, finalFile, result2.duration, context.fileSizeBitrateReduction, async (time: [ number, number ])=>{
                            const result3 = await sendFile(respondee, responder, finalFile, decodedLink, context, duration, [renderStartTime, renderEndTime], time, textContent);
                            if(result3!==null) {
                                fileLengthError(responder, result3.fileSize, result1.duration, context.fileSizeBitrateReduction!, context);
                            }
                            Deno.removeSync(wavFile);
                            Deno.removeSync(finalFile);
                        }, errorCallback);
                    } else {
                        Deno.removeSync(wavFile);
                        Deno.removeSync(finalFile);
                    }
                }, errorCallback);
            } else {
                Deno.removeSync(wavFile);
                Deno.removeSync(finalFile);
            }
        }, errorCallback);
    } else {
        const result = await sendFile(respondee, responder, wavFile, decodedLink, context, duration, [renderStartTime, renderEndTime], undefined, textContent);
        if(result!==null) {
            fileLengthError(responder, result.fileSize, result.duration, 0, context);
        }
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
    const decodedLink: DecodedLink | null = await decodeLink(link,interaction);
    if(decodedLink===null) return;
    const context: Context = {
        timeTruncation: null,
        fileSizeBitrateReduction: null,
        fileSizeTruncation: null,
        ffmpegError: null
    };
    if(!(await checkSampleLength(duration,decodedLink.songData.sampleRate,interaction))) return;
    const outputMessage = await interaction.reply({ content: "Rendering started, Please wait...\n-# "+getSplash(), allowedMentions: { repliedUser: false } });
    const renderStartTime = Date.now();
    const worker = new Worker('./rendererWorker.ts', { workerData: {
        UC: decodedLink.playerData.hasAdditions,
        SR: decodedLink.songData.sampleRate,
        M:  getMode(decodedLink.songData.mode),
        D: duration,
        code: decodedLink.songData.code,
        N: `../render/render-${crypto.randomUUID()}.wav`,
    } });
    prepareWorker(worker, (data: {finished: renderOutputType}) => {
        const { error, file: wavFile, truncated } = data.finished;
        const renderEndTime = Date.now();
        context.timeTruncation = truncated;
        if (error == null) {
            sendRender(wavFile,interaction,outputMessage,decodedLink,context,duration,renderStartTime,renderEndTime,"Output:");
        } else {
            renderError(interaction,outputMessage,error);
        }
    }, (percentage: number) => {
        outputMessage.edit({ content: `Rendering started, Please wait... [${percentage}%]\n-# ${getSplash()}`, allowedMentions: { repliedUser: false } });
    });
    return;
}

export async function renderCodeWrapperFile(interaction: CommandInteraction, code: string, sampleRate: number, mode: BytebeatMode, duration = 30, outputMessage: InteractionResponse<boolean>): Promise<void> {
    try {
        const context: Context = {
            timeTruncation: null,
            fileSizeBitrateReduction: null,
            fileSizeTruncation: null,
            ffmpegError: null
        };
        if(!(await checkSampleLength(duration,sampleRate,interaction))) return;
        await outputMessage.edit({ content: "Rendering started, please wait...\n-# "+getSplash(), allowedMentions: { repliedUser: false } });
        const renderStartTime = Date.now();
        const worker = new Worker('./rendererWorker.ts', { workerData: {
            UC: false,
            SR: sampleRate,
            M: getMode(mode),
            D: duration,
            code: code,
            N: `../render/file-${crypto.randomUUID()}.wav`,
        } });
        prepareWorker(worker, (data: {finished: renderOutputType}) => {
            const { error, file: wavFile, truncated } = data.finished;
            context.timeTruncation = truncated;
            const renderEndTime = Date.now();
            if (error == null) {
                sendRender(wavFile,interaction,outputMessage,{songData: {code, sampleRate, mode}, playerData: bytebeatPlayers[0]},context,duration,renderStartTime,renderEndTime,"Output:");
            } else {
                renderError(interaction, outputMessage, error);
            }
        }, (percentage: number) => {
            outputMessage.edit({ content: `Rendering started, please wait... [${percentage}%]\n-# ${getSplash()}`, allowedMentions: { repliedUser: false } });
        });
        return;    
    } catch (e) {
        console.error(e);
        try { renderError(interaction, null, "Internal error in RenderBot:\n"+(e instanceof Error ? e.stack??String(e) : String(e)), '\u2757'); } catch { /* what */ }
        return;
    }
}

export async function renderCodeWrapperMessage(message: Message, link: string, count: number | null): Promise<void> {
    try {
        const decodedLink: DecodedLink | null = await decodeLink(link, message, false);
        if(decodedLink===null) return;
        const duration = Math.min(config.audio.sampleLimit / decodedLink.songData.sampleRate, config.audio.defaultSeconds);
        let outputMessage;
        try {
            outputMessage = await message.reply({ content: "Preview generation started. Please wait..." + (count ? ` x${count}\n-# `: "\n-# ") + getSplash(), allowedMentions: { repliedUser: false } });
        } catch {
            // We don't have permission to send messages, so stop now
            return;
        }
        const context: Context = {
            timeTruncation: null,
            fileSizeBitrateReduction: null,
            fileSizeTruncation: null,
            ffmpegError: null
        };
        const renderStartTime = Date.now();
        const worker = new Worker('./rendererWorker.ts', { workerData: {
            UC: decodedLink.playerData.hasAdditions,
            SR: decodedLink.songData.sampleRate,
            M:  getMode(decodedLink.songData.mode),
            D: duration,
            code: decodedLink.songData.code,
            N: `../render/message-${crypto.randomUUID()}.wav`,
        } });
        prepareWorker(worker, (data: {finished: renderOutputType}) => {
            const { error, file: wavFile, truncated } = data.finished;
            context.timeTruncation = truncated;
            const renderEndTime = Date.now();
            if (error == null) {
                sendRender(wavFile,message,outputMessage,decodedLink,context,duration,renderStartTime,renderEndTime, "Preview for link" + (count ? " "+count : "") + ":");
            } else {
                renderError(message, outputMessage, error);
            }
        }, (percentage: number) => {
            outputMessage.edit({ content: "Preview generation ongoing. Please wait..." + (count ? " x "+count : " ") + `[${percentage}%]\n-# ${getSplash()}`, allowedMentions: { repliedUser: false } });
        });
        return;    
    } catch (e) {
        console.error(e);
        try { renderError(message, null, "Internal error in RenderBot:\n"+(e instanceof Error ? e.stack??String(e) : String(e)), '\u2757'); } catch { /* what */ }
        return;
    }
}
