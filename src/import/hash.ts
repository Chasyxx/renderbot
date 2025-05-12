import { Message, EmbedBuilder, CommandInteraction } from "discord.js";
export {};

import { renderbotConfig as config } from "./config.ts";

export async function hashString(data: string, algo: AlgorithmIdentifier = "SHA-256"): Promise<string> {
    const hash1 = new Uint8Array(await(crypto.subtle.digest(algo,new TextEncoder().encode(data))));
    let hash = "";
    for(let i = 0; i < hash1.length; i++) hash += hash1[i].toString(16).padStart(2,'0');
    return hash;
}

export async function checkServerBlacklist(src: CommandInteraction | Message): Promise<boolean> {
    const hash = await hashString(src.guildId?.trim()??"minus-one");
    if(config.disabledServers.includes(hash)) {
        const builder = new EmbedBuilder();
        builder.setTitle("This server has been blocked by RenderBot");
        builder.setDescription("Please remove the bot.");
        builder.setColor(0xed4f4f);
        try { src.reply({ embeds: [ builder ], ephemeral: false }); } catch { /* idc */ };
        return false;
    }
    return true;
}

export async function checkChannelBlacklist(src: CommandInteraction | Message, send: boolean = false): Promise<boolean> {
    const hash = await hashString(src.channelId);
    if(config.disabledChannels.includes(hash)) {
        if(send) {
            try { src.reply({ content: "Sorry, you can't use me in this channel!", ephemeral: true }); } catch { /* idc */ };
        }
        return false;
    }
    return true;
}

export async function checkBlacklist(src: CommandInteraction | Message, send: boolean = false) {
    return await checkServerBlacklist(src) && await checkChannelBlacklist(src,send);
}