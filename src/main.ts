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
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import { renderbotConfig as config } from './config.js';
if(config.ffmpeg.enable) ffmpeg.setFfmpegPath(config.ffmpeg.location);
import { renderCodeWrapperInteraction, renderCodeWrapperMessage } from './generateRender.js';
import { bytebeatPlayerLinkDetectionRegexp } from './config.js';

const djsClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const djsCommands: Collection<string, {data: { name: string, description: string }, execute: Function}> = new Collection();

function addCommandsfromFilesWrapper(commandsPath: string) {
    return (commandFiles: string[]) => {
        for (const file of commandFiles) {
            const filePath = join(commandsPath, file);
            import(filePath).then(command => {
                if ('data' in command && 'execute' in command) {
                    djsCommands.set(command.data.name, command);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            });
        }
    }
}

const djsCommandsPath = fileURLToPath(new URL('commands', import.meta.url));
readdir(djsCommandsPath).then(djsCommandFolders => {
    for (const folder of djsCommandFolders) {
        const commandsPath = fileURLToPath(new URL('commands/' + folder, import.meta.url));
        readdir(commandsPath).then((files) => files.filter((file) => file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'))).then(addCommandsfromFilesWrapper(commandsPath));
    }
});

djsClient.on(Events.MessageCreate, async ($) => {
    if ($.author.bot) return;
    if (config.disabledChannels.includes($.channelId)) return;
    if (bytebeatPlayerLinkDetectionRegexp.test($.content)) {
        const link = $.content.match(bytebeatPlayerLinkDetectionRegexp)![0];
        renderCodeWrapperMessage($, link.trim());
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

djsClient.login(config.token);
