const db = require("../db")
const cache = require("../misc/cache")
const reauth = require("./reauth")
const Valorant = require('../auth/main.js')
const axios = require("axios").default

let skinlevels = ""
let skindata = ""
let offers = ""

module.exports.getData = async () => {
  await axios.get("https://valorant-api.com/v1/weapons/skinlevels")
  .then((response) => {
    skinlevels = response.data
  })
  await axios.get("https://valorant-api.com/v1/weapons/skins")
  .then((response) => {
    skindata = response.data
  })
  await axios.get("https://api.henrikdev.xyz/valorant/v1/store-offers")
  .then((response) => {
    offers = response.data
  })
  console.log("Updated Data")
}

module.exports.getDailyShop = async (discordid) => {

  const reauthUser = await reauth.reauthUser(discordid)

  if (!reauthUser.success) return { success: false, error: reauthUser.error }

  const user = await db.getUser(discordid)

  const caches = await cache.getcache('daily', user.id)
  if (caches) {
    return { success: true, shop: caches }
  }

  const valorantApi = new Valorant.API(user.region)

  valorantApi.access_token = user.access_token
  valorantApi.entitlements_token = user.entitlements_token

  let store = ""
  let status = false

  // Get Player Store
  await valorantApi.getPlayerStoreFront(user.playerid)
  .then((response) => {
    store = response.data
  })
  .catch((error) => {
    status = error.message
  })

  if (status) {
    return { success: false, error: status }
  } else {
    const offersIDs = store["SkinsPanelLayout"]["SingleItemOffers"]

    const offerleft = store["SkinsPanelLayout"]["SingleItemOffersRemainingDurationInSeconds"]

    let offersweapons = []

    offersweapons.push({ offerleft: offerleft, date: Math.floor(new Date().getTime() / 1000) })

    for (var i = 0;  i < 4;  i++) {
      const weapon1 = skinlevels.data.find((v) => v.uuid == offersIDs[i])
      // Get offers
      const offer = offers.data.Offers.find((v) => v.OfferID == offersIDs[i])
      const offerid = Object.keys(offer.Cost)[0]
      const vp = offer.Cost[offerid]

      // Get Tier
      const tierid = skindata.data.filter((v) => v.levels[0]["uuid"] == weapon1.uuid)[0]["contentTierUuid"]

      // Weapon Videos and Image
      const image = 'https://s3.valorantstore.net/weaponskinlevels/' + offersIDs[i] + '.png'
      let video = 'null'
      if (weapon1.streamedVideo != undefined) {
        video = 'https://s3.valorantstore.net/streamedVideo/' + offersIDs[i] + '.mp4'
      }

      // Push
      offersweapons.push({ name: weapon1.displayName, imgsrc: image, vp: vp, tierid: tierid, videosrc: video })
    }
    db.updatecache(user.id, offersweapons, 'daily')
    return { success: true, shop: offersweapons }
  }
}

module.exports.getNightMarket = async (discordid) => {
  const reauthUser = await reauth.reauthUser(discordid)

  if (!reauthUser.success) return { success: false, error: reauthUser.error }

  const user = await db.getUser(discordid)

  const caches = await cache.getcache('nightmarket', user.id)
  if (caches) {
    return { success: true, nightmarket: caches }
  }

  const valorantApi = new Valorant.API(user.region)

  valorantApi.access_token = user.access_token
  valorantApi.entitlements_token = user.entitlements_token

  let store = ""
  let status = false

  // Get Player Store
  await valorantApi.getPlayerStoreFront(user.playerid)
  .then((response) => {
    store = response.data
  })
  .catch((error) => {
    status = error.message
  })

  if (status) {
    return { success: false, error: status }
  } else {
    // Night Marcket
    if ("BonusStore" in store) {
      let bonusweapons = []
      const bonus = store["BonusStore"]["BonusStoreOffers"]

      const bonusleft = store["BonusStore"]["BonusStoreRemainingDurationInSeconds"]

      bonusweapons.push({bonusleft: bonusleft, date: Math.floor(new Date().getTime() / 1000)})

      for (var i = 0;  i < 6;  i++) {
        let weapon1 = skinlevels.data.find((v) => v.uuid == bonus[i]["Offer"]["Rewards"][0]["ItemID"])
        let discount = Object.keys(bonus[i]["DiscountCosts"])[0]

        // Get Tier
        let tierid = skindata.data.filter((v) => v.levels[0]["uuid"] == weapon1.uuid)[0]["contentTierUuid"]

        // Weapon Videos and Image
        const image = 'https://s3.valorantstore.net/weaponskinlevels/' + weapon1.uuid + '.png'
        let video = 'null'
        if (weapon1.streamedVideo != undefined) {
          video = 'https://s3.valorantstore.net/streamedVideo/' + weapon1.uuid + '.mp4'
        }

        // Push
        bonusweapons.push({ name: weapon1.displayName, imgsrc: image, vp: bonus[i]["DiscountCosts"][discount], vpold: bonus[i]["Offer"]["Cost"][discount],tierid: tierid, videosrc: video, discountpercent: bonus[i].DiscountPercent})
      }
      db.updatecache(user.id, bonusweapons, 'nightmarket')
      return { success: true, nightmarket: bonusweapons }
    } else {
      return { success: true, nightmarket: {} }
    }
  }
}