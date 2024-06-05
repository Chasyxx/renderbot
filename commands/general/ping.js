/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
export const data = {
	name: 'marco',
	description: 'Replies with polo!',
};

/** @param {import('discord.js').CommandInteraction} interaction */
export async function execute(interaction) {
	await interaction.reply('Polo!');
}
