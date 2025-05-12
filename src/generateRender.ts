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

function prepareWorker(worker: Worker, 
    fin?: (msg: {finished: renderOutputType}) => void | Promise<void>,
    update?: (percentage: number) => void | Promise<void>
) {
    let over = false;
    let cb = 0;
    function rate(){
        cb = setTimeout(rate, 5000);
        over = true;
    }
    rate();over=false;
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
            if(update && over) {
                over = false;
                const percentage = Math.floor(eventMessage.index/eventMessage.max*100);
                update(percentage);
            }
        }

        if (eventMessage.finished) {
            clearTimeout(cb); // If I'm just superstitious it's still valid
            if(fin) await fin(eventMessage);
        }
    })
}

function formatResponse(
    decodedLink: DecodedLink, credit: boolean,
    truncated: boolean, mention: string,
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
        if(ffmpegTime != undefined) embed.addFields({ name: "FFMPEG time", value: `${ffmpegTime}s (${Math.round((duration/ffmpegTime) * 100) / 100}s/s)`, inline: true })
        if(truncated) {
            embed.setFooter({ text: 'Output truncated due to processing time. s/s value may be inaccurate.' })
        }
        if(credit) embed.addFields({ name: 'Triggered by', value: mention, inline: true});
        if(decodedLink.playerData.domain == null)
            embed.addFields({ name: 'Detected player',
            value: `${decodedLink.playerData.name} \`${decodedLink.playerData.fileName}\``, inline: true})
        else
            embed.addFields({ name: 'Detected player',
            value: `[${decodedLink.playerData.name}](${decodedLink.playerData.domain}) \`${decodedLink.playerData.fileName}\``, inline: true})
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
            content: "There was an error while rendering.",
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

async function sendFile(respondee: Message | CommandInteraction, responder: Message | null | InteractionResponse, file: string, songData: DecodedLink,
    truncated: boolean, duration: number, renderTimes: [number, number], ffmpegTimes?: [number, number], messageContent?: string) {
    const fileData = Deno.readFileSync(file);
    const attachment = new AttachmentBuilder(Buffer.from(fileData), { name: file });
    const renderTime = Math.round((renderTimes[1] - renderTimes[0]) / 10) / 100;
    const ffmpegTime = ffmpegTimes===undefined?undefined:Math.round((ffmpegTimes[1] - ffmpegTimes[0]) / 10) / 100;
    if (respondee instanceof CommandInteraction) {
        await responder?.edit(formatResponse(
            songData,config.credit.command,truncated,
            `<@${respondee.user.id}>`,attachment,
            duration, renderTime, ffmpegTime, messageContent
        ));
    } else {
        if(responder instanceof Message && responder?.editable) {
            await responder.edit(formatResponse(
                songData,config.credit.command,truncated,
                `<@${respondee.author.id}>`,attachment,
                duration, renderTime, ffmpegTime, messageContent
            ));
        } else {
            await respondee.reply(formatResponse(
                songData,config.credit.command,truncated,
                `<@${respondee.author.id}>`,attachment,
                duration, renderTime, ffmpegTime, messageContent
            ));
        }
    }
}

function printFfmpegError(error: Error, stdout: string, stderr: string): void {
    console.error("FFMPEG FAILED",error);
    console.error("Last dozen lines of stdout:");
    console.error(stdout?.split('\n').slice(-12).join('\n'));
    console.error("Last dozen lines of stderr:");
    console.error(stderr?.split('\n').slice(-12).join('\n'));
}

async function sendRender(wavFile: string, respondee: Message | CommandInteraction, responder: Message | InteractionResponse | null, decodedLink: DecodedLink, truncated: boolean, duration: number, renderStartTime: number, renderEndTime: number, textContent?: string) {
    const finalFile = wavFile.replace('.wav', config.ffmpeg.fileExtension);
    if (config.ffmpeg.enable) {
        const ffmpegStartTime = Date.now();
        const conversion = ffmpeg(wavFile)
            .toFormat(config.ffmpeg.format)
            .on('end', async () => {
                const ffmpegEndTime = Date.now();
                Deno.removeSync(wavFile);
                await sendFile(respondee, responder, finalFile, decodedLink, truncated, duration, [renderStartTime, renderEndTime], [ffmpegStartTime, ffmpegEndTime], textContent);
                Deno.removeSync(finalFile);
            })
            .on('error', async (error, o, e) => {
                Deno.remove(finalFile).then(() => { }).catch(() => { }); // Just try to delete the file, doesn't matter if it succeeds
                printFfmpegError(error, o ?? '(null)', e ?? '(null)')
                await sendFile(respondee,responder,  wavFile, decodedLink, truncated, duration, [renderStartTime, renderEndTime], undefined, textContent);
                Deno.removeSync(wavFile);
            })
        for (const key in config.ffmpeg.extra) {
            const value = config.ffmpeg.extra[key];
            //@ts-ignore - That probably means something.
            conversion[key].apply(conversion, value)
        }
        conversion.save(finalFile);
    } else {
        await sendFile(respondee, responder, wavFile, decodedLink, truncated, duration, [renderStartTime, renderEndTime], undefined, textContent);
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
    if(!(await checkSampleLength(duration,decodedLink.songData.sampleRate,interaction))) return;
    const outputMessage = await interaction.reply({ content: "Rendering started, Please wait...", allowedMentions: { repliedUser: false } });
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
        if (error == null) {
            sendRender(wavFile,interaction,outputMessage,decodedLink,truncated,duration,renderStartTime,renderEndTime,"Output:");
        } else {
            renderError(interaction,outputMessage,error);
        }
    }, (percentage: number) => {
        outputMessage.edit({ content: `Rendering started, Please wait... [${percentage}%]`, allowedMentions: { repliedUser: false } });
    });
    return;
}

export async function renderCodeWrapperFile(interaction: CommandInteraction, code: string, sampleRate: number, mode: BytebeatMode, duration = 30): Promise<void> {
    try {
        if(!(await checkSampleLength(duration,sampleRate,interaction))) return;
        let outputMessage;
        try {
            outputMessage = await interaction.reply({ content: "Rendering started, please wait...", allowedMentions: { repliedUser: false } });
        } catch {
            console.error(outputMessage);
            // We don't have permission, stop now
            return;
        }
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
            const renderEndTime = Date.now();
            if (error == null) {
                sendRender(wavFile,interaction,outputMessage,{songData: {code, sampleRate, mode}, playerData: bytebeatPlayers[0]},truncated,duration,renderStartTime,renderEndTime,"Output:");
            } else {
                renderError(interaction, outputMessage, error);
            }
        }, (percentage: number) => {
            outputMessage.edit({ content: `Rendering started, please wait... [${percentage}%]`, allowedMentions: { repliedUser: false } });
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
            outputMessage = await message.reply({ content: "Preview generation started. Please wait..." + (count ? " x"+count : ""), allowedMentions: { repliedUser: false } });
        } catch {
            // We don't have permission to send messages, so stop now
            return;
        }
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
            const renderEndTime = Date.now();
            if (error == null) {
                sendRender(wavFile,message,outputMessage,decodedLink,truncated,duration,renderStartTime,renderEndTime, "Preview for link" + (count ? " "+count : "") + ":");
            } else {
                renderError(message, outputMessage, error);
            }
        }, (percentage: number) => {
            outputMessage.edit({ content: "Preview generation ongoing. Please wait..." + (count ? " x "+count : " ") + `[${percentage}%]`, allowedMentions: { repliedUser: false } });
        });
        return;    
    } catch (e) {
        console.error(e);
        try { renderError(message, null, "Internal error in RenderBot:\n"+(e instanceof Error ? e.stack??String(e) : String(e)), '\u2757'); } catch { /* what */ }
        return;
    }
}
