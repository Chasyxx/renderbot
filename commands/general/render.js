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

import { renderCodeWrapperInteraction } from '../../generateRender.js';

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
export const data = {
    name: 'render',
    description: 'Render a bytebeat expression',
    options: [
        {
            type: 3,
            required: true,
            name: "link",
            description: "dollChan bytebeat player link"
        },
        {
            type: 10,
            name: "duration",
            description: "Duration in seconds"
        }
    ]
};

/** @param {import('discord.js').CommandInteraction} interaction */
export async function execute(interaction) {
    const link = interaction.options.getString('link',true)||'invalid';
    const duration = Math.abs(interaction.options.getNumber('duration',false))||30;
    await renderCodeWrapperInteraction(interaction,link,duration)
}
