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

export const splashes: string[] = [
    "[object Object]",
    "WOO!",
    "[object JSON]",
    "1+1 isn't 2, you've probably been gaslit!",
    "What's a bit reverse? The only thing I know is a line break.",
    "The G",
    "Wait, Why is there a math constant named SQRT1_2? Just run Math.sqrt(1/2)?",
    "Imagine if this bot completely broke 💀",
    "Fun fact: The 16 bit integer limit will overflow and corrupt the javascript. Never enter 65535 as it will crash the bot.",
    "Go away, exotic modes and functions! GO AWAY!",
    "I don't think the whale would *swear* over air conditioning...",
    "The initramfs will completely freak out the linting.",
    "POV: `'use strict'; 0765` 💀💀💀 bruh",
    "THE 64 BIT INTEGER LIMIT WILL COLLAPSE AND DESTROY THE MINCERAFT",
    "0x8F rawr :3",
    "Something to do with an indie video game... Oops, I forgor.",
    "the nixos files will be unpacked and corrupt the router. Seriously, NixOS installation unplugged it.",
    "Dum de bum!",
    "The infinite loop will EAT YOUR PROCESSOR AND MEMORY!!!1!",
    "There's a really cool glitch in that one game. But I forgot the numbers... Guess they're missing.",
    "*\\*SCREAMING\\**",
    "Laughl.",
    "Spot the references in these splashtexts!",
    "Metal pipe moment",
    'See an issue? [Let me know!!](<https://github.com/Chasyxx/renderbot/issues>)',
    "wth what is this text above me",
    "I dunno, man, I *might* have eighty televisions, but if I do, *they're all 1080p!*",
    "Reject all else, 8 bit computing is the way!",
    "Windows systems when you remove system32 -> :(",
    "The creator of this bot uses Arch Linux, and they'd like to let you anow of that fact.",
    "Where's my pet eldrich horror now?",
    "galvanize that steel and squAre it",
    "Sorry, maximum call stack size exceeded!",
    "Segmentation fault (core dumped)",
    "Aborted (core dumped)",
    "Quit (core dumped)",
    "Woo, r/bytebeat!",
    "Woo, dollchan.net/btb!",
    "Woo, chasyxx bytebeat player!",
    "Woo, chasyxx landing page!",
    "Woo, bytetable!",
    "Woo, dollchan!",
    "Woo, sArpnt!",
    "Cookie?",
    "Change is OK!",
    "Expand your mind, OMORI!",
    "Expand!",
    "Check out the [user manual](<https://www.youtube.com/watch?v=dQw4w9WgXcQ>)!",
    "\"As hard as it may be, sometimes you have to leave from what leaves you in a worse place.\" - Chasyxx, May 14th 2025",
    "Why is there a GDI malware server that's mislabelled as \"bytebeat\"?", // reference to an april fools joke
    "How's BoxedBot?", // another one
    "That's your Q-Blast! Always try it when you enter a new room!"
];

function getIdx() {
    return Math.random()*splashes.length|0;
}

let lastIndex = -1;
export function getSplash(): string {
    let idx: number = lastIndex;
    while(idx === lastIndex) idx = getIdx();
    lastIndex = idx;
    return splashes[idx];
}