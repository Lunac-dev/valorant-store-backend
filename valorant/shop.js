const db = require("../db")
const cache = require("../misc/cache")
const reauth = require("./reauth")
const Valorant = require("../auth/main.js")
const axios = require("axios")

const dayjs = require('dayjs')
dayjs.extend(require('dayjs/plugin/utc'))

let skinlevels = ""
let skindata = ""

module.exports.getData = async () => {
  await axios
    .get("https://valorant-api.com/v1/weapons/skinlevels")
    .then((response) => {
      skinlevels = response.data
    })
  await axios
    .get("https://valorant-api.com/v1/weapons/skins")
    .then((response) => {
      skindata = response.data
    })
  console.log(dayjs().utc().format("YYYY/MM/DD"), "Updated SkinLevels and Skins", "shop.js")
}

module.exports.getDailyShop = async (discordid) => {
  let user = await db.getUser(discordid)

  const caches = await cache.getcache("store", user.id)
  if (caches) {
    return { success: true, shop: caches }
  }

  const reauthUser = await reauth.reauthUser(discordid)

  if (!reauthUser.success) return { success: false, error: reauthUser.error }

  user = await db.getUser(discordid) //Update cookie

  const valorantApi = new Valorant.API(user.region)

  valorantApi.access_token = user.access_token
  valorantApi.entitlements_token = user.entitlements_token

  let store = ""
  let offers = ""
  let vp = 0
  let rp = 0
  let status = false

  // Get Player Store
  await valorantApi.getPlayerStoreFront(user.playerid)
    .then((response) => {
      store = response.data
    })
    .catch((error) => {
      status = error.message
    })

  await valorantApi.getStoreOffers().then((response) => {
    offers = response.data
  }).catch((error) => {
    status = error.message
  })

  await valorantApi.getPlayerWallet(user.playerid).then((response) => {
    vp = response.data.Balances['85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741']
    rp = response.data.Balances['e59aa87c-4cbf-517a-5983-6e81511be9b7']
  }).catch((error) => {
    status = error.message
  })

  if (status) {
    return { success: false, error: status }
  } else {
    const offersIDs = store["SkinsPanelLayout"]["SingleItemOffers"]

    // Test Store Stats
    const cache_2 = await db.getcache("store", user.id)
    let stats = false
    if (cache_2) {
      if (cache_2.old_store.toString() !== offersIDs.toString()) {
        stats = true
      }
    } else {
      stats = true
    }

    const bundleid = store["FeaturedBundle"]["Bundle"]["DataAssetID"]

    let offersweapons = []

    offersweapons.push({
      date: dayjs().utc().format("YYYY/MM/DD"),
    })

    for (var i = 0; i < 4; i++) {
      const weapon1 = skinlevels.data.find((v) => v.uuid == offersIDs[i])
      // Get offers
      const offer = offers.Offers.find((v) => v.OfferID == offersIDs[i])
      const offerid = Object.keys(offer.Cost)[0]
      const vp = offer.Cost[offerid]

      // Get Tier
      const tierid = skindata.data.filter(
        (v) => v.levels[0]["uuid"] == weapon1.uuid
      )[0]["contentTierUuid"]

      const uuid = skindata.data.filter(
        (v) => v.levels[0]["uuid"] == weapon1.uuid
      )[0]["uuid"]

      // Weapon Videos and Image
      const image =
        "https://s3.valorantstore.net/weaponskinlevels/" + offersIDs[i] + ".png"
      let video = "null"
      if (weapon1.streamedVideo != undefined) {
        video =
          "https://s3.valorantstore.net/streamedVideo/" + offersIDs[i] + ".mp4"
      }

      // Stats
      if (stats) {
        db.add_store_stats(weapon1.displayName, uuid)
      }

      // Push
      offersweapons.push({
        uuid: uuid,
        name: weapon1.displayName,
        imgsrc: image,
        vp: vp,
        tierid: tierid,
        videosrc: video,
      })
    }
    // End Daily Store

    let result = null

    // Night Marcket
    let bonusweapons = []
    if ("BonusStore" in store) {
      const bonus = store["BonusStore"]["BonusStoreOffers"]

      const bonusleft =
        store["BonusStore"]["BonusStoreRemainingDurationInSeconds"]

      bonusweapons.push({
        bonusleft: bonusleft,
        date: Math.floor(new Date().getTime() / 1000),
      })

      for (var i = 0; i < 6; i++) {
        let weapon1 = skinlevels.data.find(
          (v) => v.uuid == bonus[i]["Offer"]["Rewards"][0]["ItemID"]
        )
        let discount = Object.keys(bonus[i]["DiscountCosts"])[0]

        // Get Tier
        let tierid = skindata.data.filter(
          (v) => v.levels[0]["uuid"] == weapon1.uuid
        )[0]["contentTierUuid"]

        const uuid = skindata.data.filter(
          (v) => v.levels[0]["uuid"] == weapon1.uuid
        )[0]["uuid"]

        // Weapon Videos and Image
        const image =
          "https://s3.valorantstore.net/weaponskinlevels/" +
          weapon1.uuid +
          ".png"
        let video = "null"
        if (weapon1.streamedVideo != undefined) {
          video =
            "https://s3.valorantstore.net/streamedVideo/" +
            weapon1.uuid +
            ".mp4"
        }

        // Push
        bonusweapons.push({
          uuid: uuid,
          name: weapon1.displayName,
          imgsrc: image,
          vp: bonus[i]["DiscountCosts"][discount],
          vpold: bonus[i]["Offer"]["Cost"][discount],
          tierid: tierid,
          videosrc: video,
          discountpercent: bonus[i].DiscountPercent,
        })
      }

      result = { offers: offersweapons, bundle: bundleid, bonus: bonusweapons, wallet: { vp, rp } }
    } else {
      result = { offers: offersweapons, bundle: bundleid, wallet: { vp, rp } }
    }
    db.updatecache(user.id, result, "store", offersIDs.toString())
    return { success: true, shop: result }
  }
}

module.exports.getNightMarket = async (discordid) => {
  const reauthUser = await reauth.reauthUser(discordid)

  if (!reauthUser.success) return { success: false, error: reauthUser.error }

  const user = await db.getUser(discordid)

  const caches = await cache.getcache("nightmarket", user.id)
  if (caches) {
    return { success: true, nightmarket: caches }
  }

  const valorantApi = new Valorant.API(user.region)

  valorantApi.access_token = user.access_token
  valorantApi.entitlements_token = user.entitlements_token

  let store = ""
  let status = false

  // Get Player Store
  await valorantApi
    .getPlayerStoreFront(user.playerid)
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

      const bonusleft =
        store["BonusStore"]["BonusStoreRemainingDurationInSeconds"]

      bonusweapons.push({
        bonusleft: bonusleft,
        date: Math.floor(new Date().getTime() / 1000),
      })

      for (var i = 0; i < 6; i++) {
        let weapon1 = skinlevels.data.find(
          (v) => v.uuid == bonus[i]["Offer"]["Rewards"][0]["ItemID"]
        )
        let discount = Object.keys(bonus[i]["DiscountCosts"])[0]

        // Get Tier
        let tierid = skindata.data.filter(
          (v) => v.levels[0]["uuid"] == weapon1.uuid
        )[0]["contentTierUuid"]

        const uuid = skindata.data.filter(
          (v) => v.levels[0]["uuid"] == weapon1.uuid
        )[0]["uuid"]

        // Weapon Videos and Image
        const image =
          "https://s3.valorantstore.net/weaponskinlevels/" +
          weapon1.uuid +
          ".png"
        let video = "null"
        if (weapon1.streamedVideo != undefined) {
          video =
            "https://s3.valorantstore.net/streamedVideo/" +
            weapon1.uuid +
            ".mp4"
        }

        // Push
        bonusweapons.push({
          uuid: uuid,
          name: weapon1.displayName,
          imgsrc: image,
          vp: bonus[i]["DiscountCosts"][discount],
          vpold: bonus[i]["Offer"]["Cost"][discount],
          tierid: tierid,
          videosrc: video,
          discountpercent: bonus[i].DiscountPercent,
        })
      }
      db.updatecache(user.id, bonusweapons, "nightmarket")
      return { success: true, nightmarket: bonusweapons }
    } else {
      return { success: true, nightmarket: {} }
    }
  }
}
