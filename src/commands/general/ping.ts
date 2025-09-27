export const data: import('discord.js').RESTPostAPIApplicationCommandsJSONBody = {
	name: 'marco',
	description: 'Replies with polo!',
};

export async function execute(interaction: import('discord.js').ChatInputCommandInteraction): Promise<void> {
	await interaction.reply('Polo!');
}
