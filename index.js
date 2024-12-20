require("dotenv").config()
const { hydrate } = require("@grammyjs/hydrate")
const {Bot, InlineKeyboard, GrammyError, HttpError} = require("grammy")
const {createClient} = require("@supabase/supabase-js")

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
   db: {
      schema: "public"
   }
})

const bot = new Bot(process.env.API_KEY)
bot.use(hydrate())   // will hydrate the state on every update

let selectedCategory = ""
let selectedTime = ""

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
      data: "category1"
   }, 
   {
      text: "Love ❤️",
      data: "category2"
   }, 
   {
      text: "Hope 🌈",
      data: "category3"
   }, 
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

bot.callbackQuery(/category[1-3]/, ctx => {
   selectedCategory = ctx.callbackQuery.data
   ctx.editMessageText("At what time would you like to receive quotes?", {
         reply_markup: InlineKeyboard.from([
            [InlineKeyboard.text("8:00 🕗", "8")],
            [InlineKeyboard.text("12:00 🕛", "12")],
            [InlineKeyboard.text("18:00 🕕", "18")],
            [InlineKeyboard.text("< Back", "back")]
         ])
      }
   )
})

bot.callbackQuery(/8|12|18/, async function(ctx) {
   try {
      const {first_name, id} = ctx.from
      selectedTime = ctx.callbackQuery.data
      let categoryId = Number(selectedCategory.split("category")[1]); 
      await client.from("users").insert(
         {
            firstName: first_name, 
            telegramId: id, 
            categoryId, 
            time: selectedTime
         }
      )
      await ctx.editMessageText(`Got it! You will be getting quotes about *${categories[categoryId -1 ].text}* at *${selectedTime}:00* every day!`, {
         parse_mode: "Markdown"
      })
   }
   catch(err) {
      console.error("Something went wrong: ", err)
   }
})

bot.callbackQuery("back", ctx => {
   ctx.editMessageText("What category would you like to choose?", {
      reply_markup: InlineKeyboard.from(inlineButtons)
   })
})

bot.catch(err => {
   const e = err.error
   if(e instanceof GrammyError) {
      console.error(`There was a Grammy error: ` + e.description)
   }
   else if(e instanceof HttpError) {
      console.error(`There was an HTTP error: ` + e.description)
   }
   else {
      console.error(`There was an error: ` + e)
   }
})

bot.start()