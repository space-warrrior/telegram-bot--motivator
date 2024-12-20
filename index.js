require("dotenv").config()
const { hydrate } = require("@grammyjs/hydrate")
const {Bot, InlineKeyboard} = require("grammy")

const bot = new Bot(process.env.API_KEY)
bot.use(hydrate())   // will hydrate the state on every update

// The text will be shown when the user starts the bot: 
const startHTML = `
<b>What can this bot do?</b>

Training Practice Bot helps you practice and learn about new
Telegram Bot features in an easy and convenient way

About the Author: <a href="https://github.com/7FOX7">https://github.com/7FOX7</a>

Contact <a href="mailto:kheeugene@gmail.com">kheeugene@gmail.com</a> should you have any questions and concerns 
`

// The categories will be used in the inline keyboard:
const categories = [
   {
      text: "Happiness 🤗", 
      data: "happiness"
   }, 
   {
      text: "Love ❤️",
      data: "love"
   }, 
   {
      text: "Hope 🌈",
      data: "hope"
   }
]

// Create the inline buttons:
const inlineButtons = categories.map(category => {
   // 'inlineButtons' is an ARRAY OF ARRAYS, each containing a single button
   return [InlineKeyboard.text(category.text, category.data)]
})

// Show the list of commands: 
bot.api.setMyCommands([
   {
      command: "start", 
      description: "Start the bot"
   }, 
   {
      command: "select_category", 
      description: "Select a category"
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

// Show the inline keyboard when user uses the command /select_category:
bot.command("select_category", ctx => {
   ctx.reply("What category would you like to choose?", {
      reply_markup: InlineKeyboard.from(inlineButtons)
   })
})

bot.start()