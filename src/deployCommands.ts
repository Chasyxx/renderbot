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
import { renderbotConfig as config } from './import/config.js';

const commands: ({ name: string, description: string })[] = [];
const foldersPath = fileURLToPath(new URL('commands', import.meta.url));
console.log("Finding command folders...");

readdir(foldersPath).then(async commandFolders => {
    for (let i = 0; i < commandFolders.length; i++) {
        const folder = commandFolders[i];
        console.log(`${(i==commandFolders.length-1?"`-":"|-")} ${folder}`);
        const commandsPath = join(foldersPath, folder);
        const commandFiles = await readdir(commandsPath);
        for (let j = 0; j < commandFiles.length; j++) {
            const file = commandFiles[j];
            if (!file.endsWith('.js') && !file.endsWith('.mjs') && !file.endsWith('.cjs')) {
                continue;
            }
            console.log(`${(i==commandFolders.length-1?" ":"|")}  ${(j==commandFiles.length-1?"`-":"|-")} ${file}`);
            const filePath = join(commandsPath, file);
            const command = await import(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data);
                console.log(`${(i==commandFolders.length-1?" ":"|")}  ${(j==commandFiles.length-1?" ":"|")}  \`- (done)`)
            } else {
                console.log(`${(i==commandFolders.length-1?" ":"|")}  ${(j==commandFiles.length-1?" ":"|")}  \`- (missing properties!)`)
            }
        }
    }
}).then(() => {
    const rest = new REST().setToken(config.token);
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        rest.put(Routes.applicationCommands(Buffer.from(config.token.match(/^[\w\d=]+?(?=\.)/)![0],'base64').toString('binary')), { body: commands }).then(data => {
            //@ts-expect-error
            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        });
    } catch (error) {
        console.error("@# " + error);
    }
});
