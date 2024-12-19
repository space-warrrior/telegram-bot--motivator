require("dotenv").config()
const {Bot} = require("grammy")

const bot = new Bot(process.env.API_KEY)


console.log(process.env.API_KEY)

bot.start()