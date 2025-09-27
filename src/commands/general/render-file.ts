//     Renderbot: a Discord bot for rendering bytebeat codes
//     Copyright (C) 2024, 2025 Chase Taylor

//     This program is free software: you can redistribute it and/or modify
//     it under the terms of the GNU Affero General Public License as published
//     by the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.

//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU Affero General Public License for more details.

//     You should have received a copy of the GNU Affero General Public License
//     along with this program.  If not, see <https://www.gnu.org/licenses/>.

//     Email contact is at creset200@gmail.com

export {};

import { renderCodeWrapperFile, checkSampleLength } from '../../generateRender.ts';
import { renderbotConfig} from '../../import/config.ts';
import { checkBlacklist } from '../../import/hash.ts';
import { EmbedBuilder } from 'discord.js';
import { BytebeatMode } from '../../import/bytebeatdata.ts';

export const data: import('discord.js').RESTPostAPIApplicationCommandsJSONBody = {
    name: 'render-file',
    description: 'Render a bytebeat expression from file',
    options: [
        {
            type: 11,
            required: true,
            name: "file",
            description: "JavaScript file"
        },
        {
            type: 3,
            name: "mode",
            description: "Sound mode",
            choices: [
                { name: "Bytebeat", value: "byte" },
                { name: "Signed bytebeat", value: "signed" },
                { name: "Floatbeat", value: "float" },
                { name: "Funcbeat", value: "func" }
            ]
        },
        {
            type: 10,
            name: "samplerate",
            description: "Sample rate (Hz)"
        },
        {
            type: 10,
            name: "duration",
            description: "Duration in seconds"
        }
    ]
};

export async function execute(interaction: import('discord.js').CommandInteraction) {
    if(!(await checkBlacklist(interaction,true))) return;
    // const link: string = String(interaction.options.get('link',true).value||'invalid');
    // await renderCodeWrapperInteraction(interaction,link,duration);
    // @ts-expect-error - On my system tpyes for options doesn't exist for some reasonm, but options itself does. If you get an error on this line LET ME KNOW IMMEADIATELY.
    const mode1 = interaction.options.get('mode',false)?.value ?? "byte";
    let mode: BytebeatMode = "Bytebeat";
    if(mode1==="signed") mode = "Signed Bytebeat";
    else if(mode1==="float") mode = "Floatbeat";
    else if(mode1==="func") mode = "Funcbeat";
    // @ts-expect-error - On my system tpyes for options doesn't exist for some reasonm, but options itself does. If you get an error on this line LET ME KNOW IMMEADIATELY.
    const sampleRate: number = Math.abs(Number(interaction.options.get('samplerate',false)?.value??0))||8000;
    // @ts-expect-error - On my system tpyes for options doesn't exist for some reasonm, but options itself does. If you get an error on this line LET ME KNOW IMMEADIATELY.
    const duration: number = Math.abs(Number(interaction.options.get('duration',false)?.value??0))||renderbotConfig.audio.defaultSeconds;
    if(!(await checkSampleLength(duration,sampleRate,interaction))) return;
    // @ts-expect-error - On my system tpyes for options doesn't exist for some reasonm, but options itself does. If you get an error on this line LET ME KNOW IMMEADIATELY.
    const url: URL = new URL(interaction.options.get('file',true)!.attachment!.url);
    const message = await interaction.reply("Downloading code, this might take a moment...");
    fetch(url).then((v)=>{
        if(v.status === 200) {
            v.text().then(code=>{
                renderCodeWrapperFile(interaction,code,sampleRate,mode,duration,message);
            })
        } else {
            const generator = new EmbedBuilder()
            .setColor(0xed4f4f)
            .setTitle("HTTP error")
            .setDescription("Server returned " + v.status);
            interaction.reply({ embeds: [generator] });
        }
    });
}
