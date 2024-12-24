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

// CONSTS: 
const wordLimit = 250; 

// We will use these variables to keep track of the flow of our program:
let selectedCategory = ""
let selectedTime = ""
let currentInlineText = ""
let currentInlineKeyboard = new InlineKeyboard
let feedbackClarification = ""
let userId = 0
let quoteId = 0
let awaitingComment = false

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
   selectedCategory = ctx.callbackQuery.data
   // Reduce the loading time of the heading (on mobile specially :) )
   await ctx.answerCallbackQuery()
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
      const {first_name, id} = ctx.from      // Get the user's first name and telegram id
      selectedTime = ctx.callbackQuery.data  // Get the selected time
      // Get the category id and convert it to the number: 
      let categoryId = Number(selectedCategory.split("category")[1]);
      // Reduce the loading time of the heading (on mobile specially :) )
      await ctx.answerCallbackQuery()
      // Insert user data to the 'users' table   
      await client.from("users").insert(
         {
            firstName: first_name, 
            telegramId: id, 
            categoryId, 
            time: selectedTime
         }
      )
      // Select id of the user we have just added 
      userId = (await client.from("users").select("id").eq("telegramId", id)).data[0].id
      // Show the message to the user after successfully setting up the quotes: 
      await ctx.editMessageText(`Got it! You will be getting quotes about *${categories[categoryId -1 ].text}* at *${selectedTime}:00* every day!`, {
         parse_mode: "Markdown"
      })
      // Reset values: 
      categoryId = ""
      selectedTime = "" 
   }
   // Handle errors: 
   catch(err) {
      ctx.reply("😨 Ooops! Something went wrong. Please try again later.")
      console.error("Something went wrong when inserting a new user record: ", err)
   }
})

// This will be executed whenever the user selects the rating:
bot.callbackQuery(["excellent", "good", "bad"], async(ctx) => {
   try {
      let inlineKeyboard = new InlineKeyboard()
      let textContent = ""
      // Reduce the loading time of the heading (on mobile specially :) )
      await ctx.answerCallbackQuery()
      // Check for the user rating 
      switch(ctx.callbackQuery.data) {
         case "excellent": {
            textContent = "😎 Thanks! What did you like most?"
            inlineKeyboard.text("The quote is meaningful and suits me", "excellent_meaningful").row().text("I'm just in a good mood", "excellent_mood").row().text("Both", "excellent_both").row().text("< Back", "back")
            break; 
         }
         case "good": {
            textContent = "🫡 Thanks! What do you think we can improve?"
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
      // Edit the message, so it shows the content that is specific to the selected rating:
      await ctx.editMessageText(textContent, {
         reply_markup: inlineKeyboard
      })
   }
   // Handle errors: 
   catch(err) {
      console.error("Something went wrong when creating the content based on the user rating: " + err)
   }
})

// This will be executed every time the user selects the clarification: 
bot.callbackQuery(/excellent_|good_|bad_/, async(ctx) => {
   try {
      // Assign the feedback clarification ('excellent_mood' | 'good_mood' | 'bad_mood', that shit) to the variable 'feedbackClarification': 
      feedbackClarification = ctx.callbackQuery.data; 
      // Reduce the loading time of the heading (on mobile specially :) ):  
      await ctx.answerCallbackQuery()
      // Insert the feedback into the db: 
      await client.from("feedback").insert(
         {
            clarification: feedbackClarification, 
            quoteId, 
            userId
         }
      )
      // Edit the message text with the inline buttons: 'Yes, of course' and 'No, thanks': 
      await ctx.editMessageText("✍ Would you like to write a comment? (that will help us a lot to send you better quotes down the road)", {
         reply_markup: new InlineKeyboard().text("🤩 Yes, of course!", "yes_comment").text("🥱 No, thanks!", "no_comment")
      })
   }
   // Handle errors:
   catch(err) {
      console.error("Could not insert user clarification to the db: " + err)
   }
})

// This will be executed every time the user decides if he wants to write a comment (yes/no): 
bot.callbackQuery(["yes_comment", "no_comment"], async(ctx) => {
   try {
      // Reduce the loading time of the heading (on mobile specially :) ):  
      await ctx.answerCallbackQuery()
      // If the user wants to write a comment
      if(ctx.callbackQuery.data === "yes_comment") {
         // Set the variable to true (we will use it to decide what content to show when the user
         // sends the message: 'bot.on('message')): 
         awaitingComment = true
         // Edit the message text respectively: 
         await ctx.editMessageText(`Please write your comment in the message input (*Word Limit - ${wordLimit}*)`, {
            parse_mode: "Markdown", 
            // The button 'Cancel' will be present in case the user does not want to write a comment: 
            reply_markup: new InlineKeyboard().text("Cancel", "cancel_comment")
         })
      }
      else {
         awaitingComment = false
         // We say goodbye to the user: 
         await ctx.editMessageText(`🤝 Thanks for your feedback, ${ctx.from.first_name}! That means a lot to us!`)
      }
   }
   // Handle errors:
   catch(err) {
      console.error("Could not get the data if the user wants to write a comment: " + err)
   }
})

// If the user clicks on 'cancel' button: 
bot.callbackQuery("cancel_comment", async(ctx) => {
   try {
      // Reduce the loading time of the heading (on mobile specially :) ):  
      await ctx.answerCallbackQuery()
      // Confirm that the user wants to cancel writing a comment: 
      await ctx.editMessageText("Are you sure you want to cancel writing your comment?", {
         reply_markup: new InlineKeyboard().text("Yes", "yes_cancel_comment").text("No", "no_cancel_comment")
      })
   }
   // Handle errors:
   catch(err) {
      console.error("Could not get the data if the user wants to cancel writing a comment: " + err)
   }
})

// If the user clicks on 'Yes/No' after asking him if he wants to cancel his comment: 
bot.callbackQuery(["yes_cancel_comment", "no_cancel_comment"], async(ctx) => {
   try {
      // Reduce the loading time of the heading (on mobile specially :) ):  
      await ctx.answerCallbackQuery()
      // If the user confirms that he wants to cancel his comment: 
      if(ctx.callbackQuery.data === "yes_cancel_comment") {
         // Set to 'false' to block all the default messages: 
         awaitingComment = false
         // We say goodbye to the user: 
         await ctx.editMessageText(`🤝 Thanks for your feedback, ${ctx.from.first_name}! That means a lot to us!`)
      }
      else {
         // Set to 'true' (we expect every sent message is a potential comment of the user):  
         awaitingComment = true
         // Edit the message text Respectively: 
         await ctx.editMessageText(`Please write your comment in the message input (*Word Limit - ${wordLimit}*)`, {
            parse_mode: "Markdown", 
            reply_markup: new InlineKeyboard().text("Cancel", "cancel_comment")
         })
      }
   }
   // Handle errors:
   catch(err) {
      // handle the error if the insertion failed
      console.error("Could not get the data if the user cancelled writing a comment: " + err)
   }
})

// Handle the callback query when user selects the back button:
bot.callbackQuery("back", async(ctx) => {
   try {
      // Reduce the loading time of the heading (on mobile specially :) ):  
      await ctx.answerCallbackQuery()
      // Edit the message text respectively (just switch to the last saved inline button): 
      await ctx.editMessageText(currentInlineText, {
         reply_markup: currentInlineKeyboard
      })
   }
   // Handle errors:
   catch(err) {
      console.error("Could not return back to the last inline button: " + err)
   }
})

bot.on("message", async(ctx) => {
   // If we expect no comment then just ignore the current message: 
   if(!awaitingComment) return
   // If we expect the comment but the length if greater or equal to 10: 
   if(ctx.message.text.length >= wordLimit) {
      await ctx.reply(`Please write your comment in the message input (*Word Limit - ${wordLimit}*)`, {
         parse_mode: "Markdown", 
         reply_markup: new InlineKeyboard().text("Cancel", "cancel_comment")
      })
      return
   }
   try {
      // Set it back to the false (messages will be ignored since we expect no comments)
      awaitingComment = false
      // Insert the optional user comment to the 'feedback' table based on the existing quote id and user id
      await client.from("feedback").update({userWishes: ctx.message.text}).eq("quoteId", quoteId).eq("userId", userId)
      // React to the comment (theoretically last message): 
      await ctx.react("❤️")
      // We say goodbye to the user: 
      await ctx.reply(`🤝 Thanks for your feedback, ${ctx.from.first_name}! That means a lot to us!`)
   }
   // Handle errors:
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
      // Send the quotes to all the users and feedback query after the quote:
      users.forEach(async (user) => {
         await sendQuotes(user)
      })
   }
   // Handle errors:
   catch(err) {
      console.error("Something went wrong when setting quotes of the user: ", err)
   }
}).subscribe()

// UTILS: 
async function sendQuotes(user) {
   const {firstName, telegramId, categoryId, time} = user
   const job = new Cron(`* ${time} * * *`)
   // Pass the callback function to the 'schedule' method (not the Cron constructor) to avoid duplicated 
   // messages: 
   job.schedule(async () => {
      // You want to create the 'try/catch' block here as on the outer level it will NOT handle the errors: 
      try {
         // Make sure there is an existing quote which has the refers to the categoryId (say 3), 
         // otherwise, an error will be thrown: 
         const quote = (await client.from("quotes").select("*").eq('categoryId', categoryId)).data[0]
         if(!quote) throw new Error("Quote does not contain full data (probably id is missing)")
         // Destructure values: 
         const {id, author, content} = quote
         // Assign originial id to the 'quoteId' (you will then use it to determine to which feedback add additional comment): 
         quoteId = id
         // Send the quote to the user: 
         await bot.api.sendMessage(telegramId, getQuoteHTML(firstName, content, author), {
            parse_mode: "HTML"
         })
         await sendFeedbackQuery(firstName, telegramId)
      }
      // Handle errors:
      catch(err) {
         console.error("Failed to select the quote for the user: " + err)
      }
   })
}

async function sendFeedbackQuery(firstName, telegramId) {
   try {
      currentInlineText = `${firstName}, if you don't mind us asking, give us a rating on the quote`
      currentInlineKeyboard = new InlineKeyboard().text("😍 Excellent", "excellent").text("🙂 Good", "good").text("😕 Bad", "bad")
      await bot.api.sendMessage(telegramId, currentInlineText, {
         reply_markup: currentInlineKeyboard
      })
   }
   catch(err) {
      console.error("Something went wrong when inserting a new user record: ", err)
   }
}