const express = require("express")
const router = express.Router()

const axios = require("axios").default

const cron = require("node-cron")
cron.schedule("0 0 */1 * * *", () => updateNews())

let news = undefined

updateNews()

async function updateNews() {
  try {
    let tmp = []
    let number = 0

    const response = await axios.get(
      "https://api.henrikdev.xyz/valorant/v1/website/en-us"
    )

    for (const k in response.data.data) {
      if (number > 3) {
        break
      } else if (response.data.data[k].category == "game_updates") {
        tmp.push({
          title: response.data.data[k].title,
          url: response.data.data[k].url,
          banner_url: response.data.data[k].banner_url,
        })
        number++
      } else {
        continue
      }
    }
    news = tmp
    console.log("Update", "Valorant Game News")
  } catch (error) {
    console.log(error.response.data.error)
  }
}

router.get("/valorant/news", async (req, res, _next) => {
  res.json(news)
})

module.exports = router
