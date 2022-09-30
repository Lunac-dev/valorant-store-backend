const express = require("express")
const router = express.Router()

const axios = require("axios").default

const cron = require("node-cron")
cron.schedule("0 0 */1 * * *", () => getData())

let skindata = ""
let offers = ""

getData()

async function getData() {
  await axios
    .get("https://valorant-api.com/v1/weapons/skins")
    .then((response) => {
      skindata = response.data
    })
    .catch((error) => {
      console.error(error.response.status)
    })
  await axios
    .get("https://api.henrikdev.xyz/valorant/v1/store-offers")
    .then((response) => {
      offers = response.data
    })
    .catch((error) => {
      console.error(error.response.status)
    })
  console.log(new Date().toString(), "[Weapon] Update Data")
}

router.get("/valorant/skin/:uuid", (req, res, _next) => {
  const uuid = req.params.uuid

  const weapon = skindata.data.find((v) => v.uuid == uuid)

  if (weapon == undefined) {
    res.end(JSON.stringify({ status: "No weapons found." }))
    return
  }

  const offer = offers.data.Offers.find(
    (v) => v.OfferID == weapon.levels[0].uuid
  )
  let vp
  if (offer == undefined) {
    vp = "Not available on store"
  } else {
    const offerid = Object.keys(offer.Cost)[0]
    vp = offer.Cost[offerid]
  }

  let levels = []

  const tmpuuid = weapon.levels[0].uuid

  for (k in weapon.levels) {
    if (weapon.levels[k].streamedVideo == undefined) continue
    levels.push({
      name: weapon.levels[k].displayName,
      streamedVideo: `https://s3.valorantstore.net/streamedVideo/${weapon.levels[k].uuid}.mp4`,
    })
  }

  let chromas = []

  for (k in weapon.chromas) {
    if (weapon.chromas[k].displayName.includes("Variant")) {
      chromas.push({
        name: weapon.chromas[k].displayName
          .substr(weapon.chromas[k].displayName.indexOf("(") + 1)
          .replace(")", ""),
        displayIcon: `https://s3.valorantstore.net/weaponskinchromas/${weapon.chromas[k].uuid}.png`,
      })
    }
  }

  res.json({
    name: weapon.displayName,
    tierid: weapon.contentTierUuid,
    price: vp,
    displayIcon: `https://s3.valorantstore.net/weaponskinlevels/${tmpuuid}.png`,
    levels: levels,
    chromas: chromas,
  })
})

module.exports = router
