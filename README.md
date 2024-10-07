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
3. Sync commands to Discord: `pushd target && node target/deployCommands.mjs && popd`

### Configuration options
#### config.json
* **token**: The discord bot token. **This must be changed from the template.**
* **disabledChannels**: A list of channel IDs where RenderBot won't automatically render or allow the render command to be used.
* **audio**: Various audio settings.
  * **sampleLimit**: How many samples are allowed to be rendered. For N seconds of samplerate S Hz, S*N will get you the value. The default value is 1 minute of 48kHz audio. **You should probably only go up to 9000000 to meet file size limits if you don't use the FFMPEG feature.**
  * **defaultSeconds**: The default number of seconds for the `/render` command, and for message auto-rendering, where it may get shortened to meet the sample limit if needed.
* **ffmpeg**: Options for FFMPEG conversion. Mainly for file size reasons.
  * **enable**: Set this to false if you don't have FFMPEG or don't want to use it. This causes RenderBot to directly give .wav files. **If you want other file formats and have FFMPEG set this to *true.***
  * **location**: *Where the `ffmpeg` or `ffmpeg.exe` binary is.* The default location is good for most Unix systems. If you're using Windows you want to change this.
  * **format**: The audio format you want to use. Defaults to `ogg`.
  * **fileExtension**: The file extension for the file, in case it's different from the FFMPEG format.
  * **extra**: Any extra function calls to the FFMPEG converter. Replace `"audioQuality": [5]` with `"audioBitrate": [125]` if you're using mp3.
#### config.ts
  * **`export const bytebeatPlayerLinkDetectionRegexp`**: This regular expression by default detects [DollChan bytebeat player](https://dollchan.net/bytebeat/) links. You can change it easily to detect any other player with `v3b64` syntax, **anything else may require extracting the link differently in `generateRender.js`.** Always check the bytebeat player you want link compatibility for.

## Execution
Executing the bot should be as easy as `npm run bot`.
Using the CLI renderer is done through `npm run cli`. Note that relative filepaths go from `target/cli` instead of where you run the command.
