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

import { REST, Routes } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs'
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

const { clientId, token } = config;

const commands: ({ name: string, description: string })[] = [];
const foldersPath = fileURLToPath(new URL('commands', import.meta.url));
readdir(foldersPath).then(commandFolders => {
    for (const folder of commandFolders) {
        const commandsPath = join(foldersPath, folder);
        readdir(commandsPath).then((files) => files.filter((file) => file.endsWith('.js'))).then(commandFiles => {
            for (const file of commandFiles) {
                const filePath = join(commandsPath, file);
                import(filePath).then(command => {
                    if ('data' in command && 'execute' in command) {
                        commands.push(command.data);
                    } else {
                        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                    }
                });
            }
        });
    }
    const rest = new REST().setToken(token);
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        rest.put(Routes.applicationCommands(clientId), { body: commands }).then(data=>{
            //@ts-expect-error
            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        });
    } catch (error) {
        console.error("@# " + error);
    }
});
