const express = require("express")
const router = express.Router()

const axios = require("axios").default

const cron = require("node-cron")
cron.schedule("0 0 */1 * * *", () => updateStoreFeatured())

let storefeatured = undefined

updateStoreFeatured()

async function updateStoreFeatured() {
  let tmp = []
  const response = await axios.get("https://api.valtracker.gg/featured-bundle")
  let weapons = []
  for (const k2 in response.data.data.weapons) {
    let video = "null"
    if (response.data.data.weapons[k2].levels[0].video != null) {
      video = `https://s3.valorantstore.net/streamedVideo/${response.data.data.weapons[k2].levels[0].uuid}.mp4`
    }
    weapons.push({
      name: response.data.data.weapons[k2].name,
      price: response.data.data.weapons[k2].price,
      uuid: response.data.data.weapons[k2].uuid,
      displayIcon: `https://s3.valorantstore.net/skins/${response.data.data.weapons[k2].uuid}.png`,
      video: video,
    })
  }
  tmp.push({
    name: response.data.data.name,
    price: response.data.data.price,
    displayIcon: `https://s3.valorantstore.net/bundles/${response.data.data.uuid}.png`,
    weapons: weapons,
  })

  storefeatured = tmp
  console.log("[Update] StoreFeatured")
}

router.get("/valorant/store-featured", async (req, res, _next) => {
  res.json(storefeatured)
})

module.exports = router
