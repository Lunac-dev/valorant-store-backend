const express = require('express');
const router = express.Router();
const axios = require("axios")

const cron = require("node-cron")
cron.schedule("0 */30 * * * *", () => updateStoreFeatured())

let storefeatured = undefined

updateStoreFeatured()

async function updateStoreFeatured() {
  try {
    let tmp = []
    const response = await axios.get("https://api.henrikdev.xyz/valorant/v2/store-featured")
    let weapons = []

    for (const k1 in response.data.data) {
      for (const k2 in response.data.data[k1].items) {
        // let video = "null"
        // if (response.data.data.weapons[k2].levels[0].video != null) {
        //   video = `https://s3.valorantstore.net/streamedVideo/${response.data.data.weapons[k2].levels[0].uuid}.mp4`
        // }
        if (response.data.data[k1].items[k2].type != "skin_level") {
          continue
        }
        weapons.push({
          name: response.data.data[k1].items[k2].name,
          price: response.data.data[k1].items[k2].base_price,
          uuid: response.data.data[k1].items[k2].uuid,
          displayIcon: `https://s3.valorantstore.net/skins/${response.data.data[k1].items[k2].uuid}.png`,
          // video: video,
        })
      }

      const valapi = await axios.get(`https://valorant-api.com/v1/bundles/${ response.data.data[k1].bundle_uuid }`)

      tmp.push({
        name: valapi.data.data.displayName,
        price: response.data.data[k1].bundle_price,
        displayIcon: `https://s3.valorantstore.net/bundles/${response.data.data[k1].bundle_uuid}.png`,
        weapons: weapons,
      })
    }

    storefeatured = tmp
    console.log("Updated Bundles")
  } catch (err) {
    console.log(err.response.data.error)
  }
}

router.get("/bundles", async function(req, res) {
  res.json(storefeatured)
});

module.exports = router;