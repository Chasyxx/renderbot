# Renderbot: A Discord bot for rendering bytebeat codes

Renderbot is as said above. The main purposes are:

1. Upload previews of bytebeat links for those who don't want to open the links
2. Give a clean audio file for those who have less powerful machines.

## Setup
1. Clone the repo: `git clone https://github.com/Chasyxx/renderbot.git`, and change into the new directory: `cd renderbot`
2. Install nessacary NPM packages: `npm i`
3. Configure the bot as below so tsc can check your config typing.
4. Compile to JS: `npm run tsc`. It will detect missing values or typing errors in your config, refer to config.ts to see the exact typing.

### Configuration
1. Rename `config.json.template` to `config.json`.
2. Edit `config.json` and `src/config.ts` as needed. See configuration options below.
3. Sync commands to Discord: `npm run cmd`

### Configuration options
These options **do not affect the CLI.** They only affect how the bot functionality operates.
#### config.json
* **token**: The discord bot token. **This must be changed from the template.**
* **disabledChannels**: A list of channel IDs where RenderBot won't automatically render or allow the render command to be used.
* **print**: Related to progress bars.
  * **ms**: Milliseconds between prints. Turn this up if **terminal** is disabled.
  * **terminal**: True has a colored progress bar that stays on one line, while false has a basic progress bar that prints on a new line. False is designed for the systemd journal.
  * **barSize**: How big the progress bar is.
* **audio**: Various audio settings.
  * **sampleLimit**: How many samples are allowed to be rendered. For N seconds of samplerate S Hz, S*N will get you the value. The default value is 1 minute of 48kHz audio. **You should probably only go up to 9000000 to meet file size limits if you don't use the FFmpeg feature.**
  * **defaultSeconds**: The default number of seconds for the `/render` command, and for message auto-rendering, where it may get shortened to meet the sample limit if needed.
  * **maximumProcessingTime**: The amount of seconds the bot will try to process a code. If it takes longer it'll stop there and output what it could process in that time, giving a notice it was truncated. Discord gives the bot 15 minutes to react to a deferred reply before giving an error, so it's in the range (0,900). 780 is a good max to allow for 2 minutes for FFmpeg.
* **credit**: Whehter to send a mention for the user for either a **message** or when the `/render` **command** is run. Discord already credits command usage, so it isn't needed, and setting it for message means if the message is deleted the code will still be attributed to the user, which might be better for moderation.
* **ffmpeg**: Options for FFmpeg conversion. Mainly for file size reasons.
  * **enable**: Set this to false if you don't have FFmpeg or don't want to use it. This causes RenderBot to directly give .wav files. **If you want other file formats and have FFmpeg set this to *true.***
  * **location**: *Where the `ffmpeg` or `ffmpeg.exe` binary is.* The default location is good for most Unix systems. If you're using Windows you want to change this.
  * **format**: The audio format you want to use. Defaults to `ogg`.
  * **fileExtension**: The file extension for the file, in case it's different from the FFmpeg format.
  * **extra**: Any extra function calls to the FFmpeg converter. Replace `"audioQuality": [5]` with `"audioBitrate": [125]` if you're using mp3.
#### config.ts
  * **`export const bytebeatPlayerLinkDetectionRegexp`**: This regular expression by default detects [DollChan bytebeat player](https://dollchan.net/bytebeat/) links. You can change it easily to detect any other player with `v3b64` syntax, **anything else may require extracting the link differently in `generateRender.js`.** Always check the bytebeat player you want link compatibility for.

## Execution
To execute the bot, use `deno run --allow-env --allow-net --allow-read=../render/ --allow-read=commands --allow-write=../render/ --allow-run=/usr/bin/ffmpeg main.ts` inside of `src`. I wished to specifically use `--allow-net=discord.com:443,gateway.discord.gg:443,cdn.discordapp.com:443`, but the bot eventually contacts region-specific servers, so a generic `--allow-net` is probably needed. And at some point generic env access is needed too.
To use the CLI, go to `src/cli` and run `cli.ts`.

### Node.JS
This branch is designed to work with Deno. For Deno use the "main" branch.
