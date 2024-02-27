# Renderbot: A Discord bot for rendering bytebeat codes

Renderbot is as said above. The main purposes are:

1. Upload previews of bytebeat links for those who don't want to open the links
2. Give a clean audio file for those who have less powerful machines.

# Setup
1. Clone the repo: `git clone https://github.com/Chasyxx/renderbot.git`, and change into the new directory: `cd renderbot`
2. Install nessacary NPM packages: `npm i`

## Configuration
Rename `config.json.template` to `config.json` and edit it:
1. Replace `YOUR_BOT_TOEN_HERE` with your Discord bot's token.
2. Replce `YOUR_CLIENT_ID_HERE` with your bot's client ID.
3. Sync commands to Discord: `node deploy-commands.mjs`

# Execution
Run the main file: `node index.mjs`
