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
2. Edit `config.json` as needed. See `configuration.md`.
3. Sync commands to Discord: `deno run -REN deployCommands.ts` inside of `src`

## Execution
To execute the bot, use `deno run -REN --allow-write=../render/ --allow-run=/usr/bin/ffmpeg main.ts` inside of `src`. I wished to specifically use `--allow-net=discord.com:443,gateway.discord.gg:443,cdn.discordapp.com:443`, but the bot eventually contacts region-specific servers, so a generic `--allow-net` is probably needed, and at some point generic env access is needed too. And workers seem to bring up a bunch of read permissions prompts too, unavoidable without full read permissions for some godforsaken reason.
`--unstable-worker-options` will be used if you enable it (That way there's more sandboxing on the render workers).
To use the CLI, go to `src/cli` and run `cli.ts`.

### Node.JS
This branch is designed to work with Deno. For Node.JS use the "main" branch.
