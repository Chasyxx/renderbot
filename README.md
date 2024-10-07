# Renderbot: A Discord bot for rendering bytebeat codes

Renderbot is as said above. The main purposes are:

1. Upload previews of bytebeat links for those who don't want to open the links
2. Give a clean audio file for those who have less powerful machines.

# Setup
1. Clone the repo: `git clone https://github.com/Chasyxx/renderbot.git`, and change into the new directory: `cd renderbot`
2. Install nessacary NPM packages: `npm i`
3. Configure the bot as below so tsc can check your config typing.
4. Compile to JS: `npm run tsc`. The typing will detect any errors in your config, refer to config.ts to see the exact typing.

## Configuration
Rename `config.json.template` to `config.json` and edit it:
1. Replace `YOUR_BOT_TOKEN_HERE` with your Discord bot's token.
2. Replace `YOUR_CLIENT_ID_HERE` with your bot's client ID.
3. Configure the FFMPEG settings: **Set enable to false if you don't have FFMPEG on your system.**
   * location: The path to the ffmpeg binary. /usr/bin/ffmpeg is a good choice but it depends on your OS and system structure. Run `which ffmpeg` on a Linux system to find out where it is.
   * format: The format of audio file to use.
   * fileExtension: The file extension (.mp3, .ogg, etc.)
   * extra: a list of functions to run and their parameters. Try `"audioBitrate": [192]` instead of `"audioQuality": [5]` for MP3.
4. Sync commands to Discord: `pushd target && node target/deployCommands.mjs && popd`

Executing the bot should be as easy as `npm run bot`.
Using the CLI renderer is done through `npm run cli`. Note that relative filepaths go from `target/cli` instead of where you run the command.
