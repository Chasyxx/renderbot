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

import { renderCodeWrapperInteraction } from '../../generateRender.js';
import { renderbotConfig } from '../../import/config.js';

export const data: import('discord.js').RESTPostAPIApplicationCommandsJSONBody = {
    name: 'render',
    description: 'Render a bytebeat expression',
    options: [
        {
            type: 3,
            required: true,
            name: "link",
            description: "Bytebeat player link"
        },
        {
            type: 10,
            name: "duration",
            description: "Duration in seconds"
        }
    ]
};

export async function execute(interaction: import('discord.js').CommandInteraction) {
    if (renderbotConfig.disabledChannels.includes(interaction.channelId)) {
        await interaction.reply({ content: "Sorry, you can't use me here!", ephemeral: true });
        return;
    }
    const link: string = String(interaction.options.get('link',true).value||'invalid');
    const duration: number = Math.abs(Number(interaction.options.get('duration',false)?.value??0))||renderbotConfig.audio.defaultSeconds;
    await renderCodeWrapperInteraction(interaction,link,duration);
}
