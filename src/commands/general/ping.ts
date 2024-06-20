export const data: import('discord.js').RESTPostAPIApplicationCommandsJSONBody = {
	name: 'marco',
	description: 'Replies with polo!',
};

export async function execute(interaction: import('discord.js').CommandInteraction) {
	await interaction.reply('Polo!');
}
