require("dotenv").config()
const {createClient} = require("@supabase/supabase-js")
const {Bot, InlineKeyboard, GrammyError, HttpError} = require("grammy")
const { hydrate } = require("@grammyjs/hydrate")
const {Cron} = require("croner")

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
   db: {
      schema: "public"
   }
})

const bot = new Bot(process.env.API_KEY)
bot.use(hydrate())   // will hydrate the state on every update

// The selected category and time will be stored in these variables:
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

// The function to get the quote in HTML format:
const getQuoteHTML = (firstName, content, author) => {
   return `
      👋 Hi, ${firstName} ! Here is your daily quote:
      <blockquote>${content}</blockquote>

      by <i>${author}</i>
   `
}

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

// Show the start message when user starts the bot:
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

// Handle the callback query when user selects a category:
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

// Handle the callback query when user selects a time:
bot.callbackQuery(/8|12|18/, async function(ctx) {
   try {
      const {first_name, id} = ctx.from      // Get the user's first name and telegram id
      selectedTime = ctx.callbackQuery.data  // Get the selected time
      let categoryId = Number(selectedCategory.split("category")[1]); 
      await client.from("users").insert(
         {
            firstName: first_name, 
            telegramId: id, 
            categoryId: categoryId, 
            time: selectedTime
         }
      )
      // Get all the users from the database:
      const users = (await client.from("users").select("*")).data
      if(users.length === 0) throw new Error("No users selected")
      // Send the quotes to all the users:
      users.forEach(async (user) => {
         await sendQuotes(user)
      })

      // Show the message to the user after successfully setting up the quotes: 
      await ctx.editMessageText(`Got it! You will be getting quotes about *${categories[categoryId -1 ].text}* at *${selectedTime}:00* every day!`, {
         parse_mode: "Markdown"
      })
   }
   catch(err) {
      ctx.reply("😨 Ooops! Something went wrong. Please try again later.")
      console.error("Something went wrong: ", err)
   }
})

// Handle the callback query when user selects the back button:
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

// UTILS: 
async function sendQuotes(user) {
   const {firstName, telegramId, categoryId, time} = user
   const job = new Cron(`* ${time} * * *`, async () => {
      const {content, author} = (await client.from("quotes").select("*").eq('categoryId', categoryId)).data[0]
      if(!content || !author) throw new Error("No content or author")
      await bot.api.sendMessage(telegramId, getQuoteHTML(firstName, content, author), {
         parse_mode: "HTML"
      })
   })
   job.schedule()
}