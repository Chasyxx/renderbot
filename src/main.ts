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

import { readdir } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Collection, CommandInteraction, EmbedBuilder, Events, GatewayIntentBits } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import { renderbotConfig as config } from './import/config.ts';
if(config.ffmpeg.enable) ffmpeg.setFfmpegPath(config.ffmpeg.location);
import { renderCodeWrapperFile, renderCodeWrapperMessage } from './generateRender.ts';
import { BytebeatMode, bytebeatPlayerLinkDetectionRegexp } from './import/bytebeatplayer.ts';

const djsClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const djsCommands: Collection<string, {data: { name: string, description: string }, execute: (x: CommandInteraction)=> void}> = new Collection();

function addCommandsfromFilesWrapper(commandsPath: string) {
    return (commandFiles: string[]) => {
        for (const file of commandFiles) {
            const filePath = join(commandsPath, file);
            import('./'+filePath).then(command => {
                if ('data' in command && 'execute' in command) {
                    djsCommands.set(command.data.name, command);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            });
        }
    }
}

const djsCommandsPath = 'commands';
readdir(djsCommandsPath).then(djsCommandFolders => {
    for (const folder of djsCommandFolders) {
        const commandsPath = join('commands',folder);
        readdir(commandsPath).then((files) => files).then(addCommandsfromFilesWrapper(commandsPath));
    }
});

djsClient.on(Events.MessageCreate, ($) => {
    if ($.author.bot) return;
    if (config.disabledChannels.includes($.channelId)) return;
    if (bytebeatPlayerLinkDetectionRegexp.test($.content)) {
        const link = $.content.match(bytebeatPlayerLinkDetectionRegexp)![0];
        renderCodeWrapperMessage($, link.trim());
    } else if ($.content.startsWith('r.file')) {
        if($.attachments.size > 0 && /^r\.file\s(byte|signed|float|func)\s\d+(\s\d+)?$/.test($.content)) {
            let samplerate = 8000;
            let seconds = 30;
            let mode: BytebeatMode = 'Bytebeat';
            const matches = $.content.match(/\d+/g)!;
            if(matches.length > 1) seconds = parseInt(matches[1],10);
            samplerate = parseInt(matches[0],10);
            if(/r\.file\sfloat/.test($.content)) mode = 'Floatbeat';
            else if(/r\.file\sfunc/.test($.content)) mode = 'Funcbeat';
            else if(/r\.file\ssigned/.test($.content)) mode = 'Signed Bytebeat';
            console.log(mode);
            fetch($.attachments.at(0)!.url).then((v)=>{
                if(v.status === 200) {
                    v.text().then(code=>{
                        renderCodeWrapperFile($,code,samplerate,mode,seconds);
                    })
                } else {
                    const generator = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("HTTP error")
                    .setDescription("Server returned " + v.status);
                    $.reply({ embeds: [generator] });
                }
            });
        } else {
            const generator = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle("Help for r.file")
            .setDescription("Renders large codes using a JavaScript text file and message parameters.")
            .addFields({ name: "Syntax", value: "r.file <byte|signed|float|func> <samplerate> [seconds]" })
            $.reply({ embeds: [generator] });
        }
    }
});

djsClient.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = djsCommands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            await interaction.reply({ content: 'Couldn\'t find that command!', ephemeral: true });
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
	    try {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
	    } catch(error) {
		    console.error(error, "Even worse!!");
	    }
        }
    }
});

djsClient.once(Events.ClientReady, () => {
    console.log('Ready! (' + djsClient.user!.tag + ')');
});

if(!existsSync("../render/")) mkdirSync("../render/");

djsClient.login(config.token);
