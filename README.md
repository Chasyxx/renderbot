# Renderbot: A Discord bot for rendering bytebeat codes

Renderbot is as said above. The main purposes are:

1. Upload previews of bytebeat links for those who don't want to open the links
2. Give a clean audio file for those who have less powerful machines.

## Setup
1. Clone the repo: `git clone https://github.com/Chasyxx/renderbot.git`, and change into the new directory: `cd renderbot`
2. Install nessacary NPM packages: `npm i`
3. Configure the bot as below.

### Configuration
1. Rename `config.json.template` to `config.json`.
2. Edit `config.json` as needed. See configuration options below.
3. Sync commands to Discord: `deno run -REN deployCommands.ts` inside of `src`

### Configuration options
These options **do not affect the CLI.** They only affect how the bot functionality operates.
#### config.json
* **token**: The discord bot token. **This must be changed from the template.**
* **disabledChannels**: A list of channel hashes where the bot won't operate. Useful for server admins who want RenderBot-free channels.
* **disabledServers**: A list of server hashes where the bot won't operate. Useful for the instance host to prevent abuse.
* **print**: Related to progress bars.
  * **ms**: Milliseconds between prints. Turn this up if **terminal** is disabled.
  * **terminal**: True has a colored progress bar that stays on one line, while false has a basic progress bar that prints on a new line (designed for the systemd journal).
  * **barSize**: How big the progress bar is.
* **audio**: Various audio settings.
  * **sampleLimit**: How many samples are allowed to be rendered. For N seconds of samplerate S Hz, S*N will get you the value. The default value is 1 minute of 48kHz audio. **You should probably only go up to 9900000 to meet file size limits if you don't use the FFmpeg feature.**
  * **defaultSeconds**: The default number of seconds for the `/render` command, and for message auto-rendering, where it may get shortened to meet the sample limit if needed.
  * **maximumProcessingTime**: The amount of seconds the bot will try to process a code. If it takes longer it'll stop there and output what it could process in that time, giving a notice it was truncated. The default is 14 minutes (Make sure it's shorter than Discord's 15 minute command limit).
* **credit**: Whehter to send a mention for the user for either a **message** or when the `/render` **command** is run.
* **ffmpeg**: Options for FFmpeg conversion. Mainly for file size reasons.
  * **enable**: Set this to false if you don't have FFmpeg or don't want to use it. This causes RenderBot to directly give .wav files.
  * **location**: *Where the `ffmpeg` or `ffmpeg.exe` binary is.* The default location is good for most Unix systems; If you're using Windows or have it elsewhere you want to change this.
  * **format**: The audio format you want to use. Defaults to `mp3`.
  * **fileExtension**: The file extension for the file, in case it's different from the FFmpeg format.
  * **bitrate**: Bitrate of the output. Default 125. You can set this to `null`.
  * **extra**: Any extra function calls to the FFmpeg converter.
* **bitDepth**: either 8 or 16. 16 doubles the wav file size (setting the MAX max (yes twice) samples without ffmpeg to 4900000) but gives MUCH higher quality.

## Execution
To execute the bot, use `deno run -REN --allow-write=../render/ --allow-run=/usr/bin/ffmpeg main.ts` inside of `src`. I wished to specifically use `--allow-net=discord.com:443,gateway.discord.gg:443,cdn.discordapp.com:443`, but the bot eventually contacts region-specific servers, so a generic `--allow-net` is probably needed, and at some point generic env access is needed too. And workers seem to bring up a bunch of read permissions prompts too, unavoidable without full read permissions for some godforsaken reason.
To use the CLI, go to `src/cli` and run `cli.ts`.

### Node.JS
This branch is designed to work with Deno. For Node.JS use the "main" branch.
