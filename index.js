require("dotenv").config()
const {createClient} = require("@supabase/supabase-js")
const {Bot, InlineKeyboard, GrammyError, HttpError, Keyboard} = require("grammy")
const { hydrate } = require("@grammyjs/hydrate")
const {Cron} = require("croner")

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
   db: {
      schema: "public"
   }
})

const bot = new Bot(process.env.API_KEY)
bot.use(hydrate())   // will hydrate the state on every update

// We will use these variables to keep track of the flow of our program:
let selectedCategory = ""
let selectedTime = ""
let currentInlineText = ""
let currentInlineKeyboard = new InlineKeyboard
let awaitingComment = false;

// The text will be shown when the user starts the bot: 
const startHTML = `
<b>🤔 What can this bot do?</b>

<strong>'Motivator Bot'</strong> helps you stay motivated and inspired by sending you daily quotes. You can choose <strong>one</strong> of the following categories:

- Happiness 🤗
- Love ❤️
- Hope 🌈

To get started, use the command: /select_category

About the Author: <a href="https://github.com/7FOX7">https://github.com/7FOX7</a>

Contact <a href="mailto:kheeugene@gmail.com">kheeugene@gmail.com</a> should you have any questions or concerns
`

// The function to get the quote in HTML format:
const getQuoteHTML = (firstName, content, author) => {
   return `
      👋 Hi, ${firstName} ! Here is your daily quote:
      <blockquote>${content}</blockquote>

      by <i>${author}</i>
   `
}

// The 'categories' will be used in the inline keyboard:
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

// Create the inline buttons for the categories:
const categoriesButtons = categories.map(category => {
   // 'categoriesButtons' is an ARRAY OF ARRAYS, each containing a single button
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
bot.command("start", async(ctx) => {
   await ctx.reply(startHTML, {
      parse_mode: "HTML", 
      link_preview_options: {
         is_disabled: true
      }
   })
})

// Show the inline keyboard when user uses the command /select_category:
bot.command("select_category", async(ctx) => {
   currentInlineText = "What category would you like to choose?"
   currentInlineKeyboard = InlineKeyboard.from(categoriesButtons)
   await ctx.reply(currentInlineText, {
      reply_markup: currentInlineKeyboard
   })
})

// Handle the callback query when user selects a category:
bot.callbackQuery(/category[1-3]/, async(ctx) => {
   ctx.answerCallbackQuery();             // Answer the callback query
   selectedCategory = ctx.callbackQuery.data
   await ctx.editMessageText("At what time would you like to receive quotes?", {
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
      ctx.answerCallbackQuery();             // Answer the callback query
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

      // Show the message to the user after successfully setting up the quotes: 
      await ctx.editMessageText(`Got it! You will be getting quotes about *${categories[categoryId -1 ].text}* at *${selectedTime}:00* every day!`, {
         parse_mode: "Markdown"
      })
      categoryId = ""
      selectedTime = "" 
   }
   catch(err) {
      ctx.reply("😨 Ooops! Something went wrong. Please try again later.")
      console.error("Something went wrong when inserting a new user record: ", err)
   }
})

bot.callbackQuery(["excellent", "good", "bad"], async(ctx) => {
   ctx.answerCallbackQuery()
   let inlineKeyboard = new InlineKeyboard()
   let textContent = ""
   // Check for the user rating 
   switch(ctx.callbackQuery.data) {
      case "excellent": {
         textContent = "😎 Thanks! Whad did you like most?"
         inlineKeyboard.text("The quote is meaningful and suits me", "excellent_meaningful").row().text("I'm just in a good mood", "excellent_mood").row().text("Both", "excellent_both").row().text("< Back", "back")
         break; 
      }
      case "good": {
         textContent = "🫡 Thanks! Whad do you think we can improve?"
         inlineKeyboard.text("Improve the quality of your quotes", "good_quality").row().text("Improve my mood", "good_mood").row().text("Both", "good_both").row().text("< Back", "back")
         break; 
      }
      case "bad": {
         textContent = "😢 Ohhh... What did you not like most?"
         inlineKeyboard.text("The quote is meaningless and does not suit me", "bad_meaningless").row().text("I'm just in a bad mood", "bad_mood").row().text("Both", "bad_both").row().text("< Back", "back") 
         break;
      }
      default: {
         ctx.reply("🤨 Hmmm... Could not evaluate your rating")
         break; 
      }
   }
   await ctx.editMessageText(textContent, {
      reply_markup: inlineKeyboard
   })
})

bot.callbackQuery(/excellent_|good_|bad_/, async(ctx) => {
   try {
      ctx.answerCallbackQuery(); 
      // userClarification = ctx.callbackQuery.data
      await client.from("feedback").insert({clarification: ctx.callbackQuery.data})
      await ctx.editMessageText("✍ Would you like to write a comment? (that will help us a lot to send you better quotes down the road)", {
         reply_markup: new InlineKeyboard().text("🤩 Yes, of course!", "yes_comment").text("🥱 No, thanks!", "no_comment")
      })
   }
   catch(err) {
      console.error("Could not insert user clarification to the db: " + err)
   }
})

bot.callbackQuery(["yes_comment", "no_comment"], async(ctx) => {
   if(ctx.callbackQuery.data === "yes_comment") {
      awaitingComment = true
      await ctx.editMessageText("Please write your comment in the message input (*Word Limit - 250*)", {
         parse_mode: "Markdown", 
         reply_markup: new InlineKeyboard().text("Cancel", "cancel_comment")
      })
   }
   else {
      awaitingComment = false
      await ctx.editMessageText(`🤝 Thanks for your feedback, ${ctx.from.first_name}! That means a lot to us!`)
   }
})

bot.callbackQuery("cancel_comment", async(ctx) => {
   await ctx.editMessageText("Are you sure you want to cancel writing your comment?", {
      reply_markup: new InlineKeyboard().text("Yes", "yes_cancel_comment").text("No", "no_cancel_comment")
   })
})

bot.callbackQuery(["yes_cancel_comment", "no_cancel_comment"], async(ctx) => {
   if(ctx.callbackQuery.data === "yes_cancel_comment") {
      awaitingComment = false
      await ctx.editMessageText(`🤝 Thanks for your feedback, ${ctx.from.first_name}! That means a lot to us!`)
   }
   else {
      awaitingComment = true
      await ctx.editMessageText("Please write your comment in the message input (*Word Limit - 250*)", {
         parse_mode: "Markdown", 
         reply_markup: new InlineKeyboard().text("Cancel", "cancel_comment")
      })
   }
})

// Handle the callback query when user selects the back button:
bot.callbackQuery("back", async(ctx) => {
   ctx.answerCallbackQuery();    // Answer the callback query
   await ctx.editMessageText(currentInlineText, {
      reply_markup: currentInlineKeyboard
   })
})

/*
   Goal: 
   1. Send a quote to the user at the specified time
   2. Ask the user to rate the quote: 
      - The user can rate the quote from 1 to 3; 
      - We will be using the inline keyboard buttons for the rating; 
   3. After the user has clicked on the button, we will store the rating (data) in a variable; 
   4. Based on the rating (data), we will send him a message with the options of why he rated the quote that way;
   5. When the user has selected the reason, we will store the reason in a variable;
   6. => we will ask him to write a comment about the quote (optional); 
      - The user can also return to the rating buttons if he wants to change his rating; 
   
   7. After the user has written the comment (or not), we will store the comment in a variable;
   8. We will then store the rating and comment in the database as well as some of the user and quote details; 
   9. In the end, we will send a message to the user to thank him for the rating and comment.
*/

bot.on(":voice", ctx => {
   currentInlineText = "If you don't mind us asking, give us a rating on the quote"
   currentInlineKeyboard = new InlineKeyboard().text("😍 Excellent", "excellent").text("🙂 Good", "good").text("😕 Bad", "bad")
   ctx.reply(currentInlineText, {
      reply_markup: currentInlineKeyboard
   })
})

bot.on("message", async(ctx) => {
   if(!awaitingComment) return
   if(ctx.message.text.length >= 10) {
      await ctx.reply("Please write your comment in the message input (*Word Limit - 250*)")
      return
   }
   try {
      awaitingComment = false
      await client.from("feedback").insert({userWishes: ctx.message.text})
      await ctx.react("❤️")
      await ctx.reply(`🤝 Thanks for your feedback, ${ctx.from.first_name}! That means a lot to us!`)
   }
   catch(err) {
      console.error("Could not insert user comment to the db: " + err)
   }
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

// DATABASE part:
client.channel("telegram-channel").on("postgres_changes", {
   event: "INSERT", 
   schema: "public", 
   table: "users"
}, async function() {
   // Get all the users from the database:
   try {
      const users = (await client.from("users").select("*")).data
      if(users.length === 0) throw new Error("No users selected")
      // Send the quotes to all the users:
      users.forEach(async (user) => {
         await sendQuotes(user)
         await sendFeedbackQuery()
      })
   }
   catch(err) {
      console.error("Something went wrong when setting quotes of the user: ", err)
   }
}).subscribe()

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

async function sendFeedbackQuery() {

}