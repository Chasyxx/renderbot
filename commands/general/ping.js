/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
export const data = {
	name: 'ping',
	description: 'Replies with Pong!',
};

/** @param {import('discord.js').CommandInteraction} interaction */
export async function execute(interaction) {
	await interaction.reply('Pong!');
}