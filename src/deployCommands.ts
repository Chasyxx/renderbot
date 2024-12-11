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
import { renderbotConfig as config } from './import/config.ts';

const commands: ({ name: string, description: string })[] = [];
console.log("Finding command folders...");

for (const commandDir of Deno.readDirSync('./commands/')) {
    console.log(` - ${commandDir.name}`);
    for (const commandFile of Deno.readDirSync('./commands/'+commandDir.name+'/')) {
        const path = './commands/'+commandDir.name+'/'+commandFile.name;
        console.log(`   - ${commandFile.name}`);
        const command = await import(path);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data);
            console.log(`     ...done`);
        } else {
            console.log(`     ...missing properites`);
        }
    }
}
const rest = new REST().setToken(config.token);
try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    rest.put(Routes.applicationCommands(atob(config.token.match(/^[\w\d=]+?(?=\.)/)![0])), { body: commands }).then(() => {
        console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
    });
} catch (error) {
    console.error("@# " + error);
}