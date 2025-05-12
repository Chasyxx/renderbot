import { Message, EmbedBuilder, CommandInteraction } from "discord.js";

let renderbotBlacklist: string[] = [];

try {
    const text = Deno.readTextFileSync("../blacklist.txt");
    const lines = text.split('\n');
    renderbotBlacklist = lines.filter(line=>{
        if(line.trim().length < 32 || line.trim().startsWith('#')) return false;
        return true;
    }).map(x=>x.trim());
    for(const id of renderbotBlacklist) {
        console.log("Blacklisted servers:");
        console.log(id);
    }
} catch (error) {
    console.error("Not loading blacklist due to error",error);
    renderbotBlacklist = [];
}

export {};
export async function checkBlacklist(src: CommandInteraction | Message): Promise<boolean> {
    const hash1 = new Uint8Array(await(crypto.subtle.digest('SHA-256',new TextEncoder().encode(src.guildId?.trim()??"minus-one"))));
    let hash = "";
    for(let i = 0; i < hash1.length; i++) hash += hash1[i].toString(16).padStart(2,'0');
    if(renderbotBlacklist.includes(hash)) {
        const builder = new EmbedBuilder();
        builder.setTitle("This server has been blocked by RenderBot");
        builder.setDescription("Please remove the bot.");
        builder.setColor([255,0,0]);
        try { src.reply({ embeds: [ builder ], ephemeral: false }); } catch { /* idc */ };
        return false;
    }
    return true;
}