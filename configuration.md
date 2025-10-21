# Bot configuration options

> [!NOTE]
>
> These options **do not affect the CLI.** They only affect how the bot functionality operates.
> The CLI has it's own command-line flags.
>
> The configuration file is in `config.json`.

## Token
* **`token`** has the Discord app token. **This must be changed from the template.**

## Moderation

* **`disabledChannels`**: Channel hashes the bot won't work in.
  Useful for server owners who want to keep the bot out of certain channels
  (or you could just turn off view channel in your channel settings, as I have just realized while I am writing this).
* **`disabledServers`**: Server hashes the bot won't work in.
  Useful for the instance host to prevent abuse.

*Currently no userblock or roleblock is implemented*

* **`credit`**: Whether to send a mention for the user for either a **message** or when the `/render` **command** is run.

## Logging
* **`print`** controls progress bars
  * **`ms`** between progress bars. Depends on the enviornment you use (a log file probably wants a higher ms).
  * **`terminal`** colors the progress bar if it's on (and tries to keep it on one line). Setting it to false is useful if you use log files, the systemd journal and the like.
  * **`barSize`**: Progress bar length ¯\\\_(ツ)\_/¯

## Sound export opotions

* **`audio`** controls general sound output
  * **`sampleLimit`**: Max samples the bot will let itself render.
  You can multiply the sample rate by the duration in seconds to get this.
  The default value is 1 minute of 48kHz audio.
**You should only go up to 9900000 to meet file size limits if you don't use the FFmpeg feature documented below.**
  * **`defaultSeconds`**: The default number of seconds if nothing is specified in the `/render` command.
  It's also used for message previews (it will altomatically try to avoid over-render).
  * **`maximumProcessingTime`**: If the bot takes longer than this to make a render, it stops what it's doing and gives what it can (with a notice it was truncated) with silence filling the rest of the sound file.

---

* **`ffmpeg`**: Options for FFmpeg conversion, mainly for file size reasons.
  * **`enable`**: Set this to false if you don't have FFmpeg or don't want to use it.
  This causes RenderBot to directly give .wav files.
  * **`location`**: *Where the `ffmpeg` or `ffmpeg.exe` binary is.*
  *The default location is good for most Unix systems;
  If you're using Windows or have it elsewhere you want to change this.*
  * **`format`**: Whatever FFmpeg format name the export uses
  * **`fileExtension`**: The file extension for the file, in case it's different from the FFmpeg format.
  * **`bitrate`**: Bitrate of the output. Default 192. *You can set this to `null`.*
  * **`extra`**: Any extra function calls to the FFmpeg converter.

---

* **`bitDepth`**: either 8 or 16.
16 doubles the wav file size *(setting the MAX max (yes twice) samples without ffmpeg to 4900000)*, but it will increase the output quality a lot. Unless you disabled FFmpeg, just leave this at 16. The FFmpeg codec will do everything.