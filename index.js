require("dotenv").config()
const {Bot} = require("grammy")

const bot = new Bot(process.env.API_KEY)

// The text will be shown when the user starts the bot: 
const startHTML = `
<b>What can this bot do?</b>

Training Practice Bot helps you practice and learn about new
Telegram Bot features in an easy and convenient way

About the Author: <a href="https://github.com/7FOX7">https://github.com/7FOX7</a>

Contact <a href="mailto:kheeugene@gmail.com">kheeugene@gmail.com</a> should you have any questions and concerns 
`

// Show the list of commands: 
bot.api.setMyCommands([
   {
      command: "start", 
      description: "Start the bot"
   }
])

bot.command("start", ctx => {
   ctx.reply(startHTML, {
      parse_mode: "HTML", 
      link_preview_options: {
         is_disabled: true
      }
   })
})

bot.start()