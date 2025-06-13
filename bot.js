const Bot = require('@maxhub/max-bot-api').Bot;
const fs = require('fs');

const bot = new Bot(process.env.BOT_TOKEN);

// BOT_TOKEN="f9LHodD0cOLzfJvVZB4pNX0cVbWrfjO57GExg55AcucnzMwycaD7Vgv23YsCJrpytxZluehx-pyBc5-DNzsD" node bot.js

console.log('начали');

bot.command('start', (ctx) => ctx.reply('куку ёпта'));

bot.on('bot_started', (ctx) => {
    const file = `${__dirname}/db/new_${Date.now()}.json`;

    console.log(`мимокрокодил: ${file}`);

    fs.writeFileSync(file, JSON.stringify(ctx.user, null, 2));
    ctx.reply('Вы кто такие, я вас не звал, идите [censored]');
});

// bot.hears(/pam (\d+) ([\S ]+)?/, async (ctx) => {
//     const res = /pam (\d+) ([\S ]+)?/.exec(ctx.message.body.text);
//     const [_, id, text] = res;

//     if (id && !isNaN(Number(id))) {

//         try {
//             const resp = await bot.api.sendMessageToUser(Number(id), text);

//             console.log('==== ok:', resp);
//         } catch (error) {
//             console.log('==== fail:', error);
//         }
//     }
// });

bot.on('message_created', (ctx) => {
    console.log('==== ctx.botInfo:', ctx.botInfo);

    const file = `${__dirname}/db/msg_${Date.now()}.json`;

    console.log(`новая сообщенька: ${file}`);

    ctx.reply(`палишься\n${JSON.stringify(ctx.user, null, 2)}`);
    fs.writeFileSync(file, JSON.stringify(ctx.message, null, 2));
});

bot.start();
