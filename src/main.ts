//     Renderbot: a Discord bot for rendering bytebeat codes
//     Copyright (C) 2024, 2025 Chase Taylor

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

import { Client, Collection, CommandInteraction, Events, GatewayIntentBits } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import { renderbotConfig as config } from './import/config.ts';
if(config.ffmpeg.enable) ffmpeg.setFfmpegPath(config.ffmpeg.location);
import { renderCodeWrapperMessage } from './generateRender.ts';
import { linkDetector } from './import/bytebeatdata.ts';
import { checkBlacklist } from './import/hash.ts';

const djsClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const djsCommands: Collection<string, {data: { name: string, description: string }, execute: (x: CommandInteraction)=> void}> = new Collection();

const djsCommandsPath = 'commands';
for (const commandDir of Deno.readDirSync(djsCommandsPath)) {
    const commandDirPath = djsCommandsPath+'/'+commandDir.name;
    for (const commandFile of Deno.readDirSync(commandDirPath)) {
        const commandFilePath = './'+commandDirPath+'/'+commandFile.name;
        import(commandFilePath).then(command => {
            if ('data' in command && 'execute' in command) {
                djsCommands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${commandFilePath} is missing a required "data" or "execute" property.`);
            }
        });
    }   
}

djsClient.on(Events.MessageCreate, ($) => {
    if ($.author.bot) return;
    if (config.disabledChannels.includes($.channelId)) return;
    const links = $.content.match(linkDetector)??[];
    for(let link = 0; link < links.length; link++) {
        // if(!checkBlacklist($)) return;
        checkBlacklist($).then(x=>{
            if(x) {
                renderCodeWrapperMessage($, links[link].trim(), link>0?link+1:null);
            }
        })
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

try {
await Deno.stat("../render/");
} catch (error) {
if (error instanceof Deno.errors.NotFound) {
    Deno.mkdirSync("../render/");
} else {
    throw error;
}
}

console.log(`Logging in using token...`);
djsClient.login(config.token);
