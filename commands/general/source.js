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

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
export const data = {
	name: 'source',
	description: 'RenderBot is open source!',
};

/** @param {import('discord.js').CommandInteraction} interaction */
export async function execute(interaction) {
	// interaction.user is the object representing the User who ran the command
	// interaction.member is the GuildMember object, which represents the user in the specific guild
	await interaction.reply( { ephemeral: true, content: 
    `RenderBot is open source! You can find this program's code on <https://github.com/Chasyxx/renderbot>.

The license for this program is GNU Affero General Public Licence version 3, which ensures you can modify and/or distrube this program under certain conditions.
See the COPYING file in the source code or <https://www.gnu.org/licenses/agpl-3.0.en.html>.`} );
}
