const express = require("express")
const router = express.Router()

const db = require("../db")
const cache = require("../misc/cache")
const reauth = require("../valorant/reauth")
const Valorant = require("../auth/main.js")

router.get("/valorant/getwallet", async (req, res, _next) => {
  const discordid = req.header("discordid")

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
    return
  }
  if (await db.empty(discordid)) {
    res.end(JSON.stringify({ status: "FAILED" }))
  } else {
    const reauthUser = await reauth.reauthUser(discordid)

    if (!reauthUser.success) {
      res.end(JSON.stringify({ status: reauthUser.error }))
      return
    }

    const user = await db.getUser(discordid)

    const caches = await cache.getcache("wallet", user.id)

    const valorantApi = new Valorant.API(user.region)

    valorantApi.access_token = user.access_token
    valorantApi.entitlements_token = user.entitlements_token

    let wallet = ""
    let status = false

    if (caches) {
      wallet = caches
    } else {
      await valorantApi
        .getPlayerWallet(user.playerid)
        .then((response) => {
          wallet = {
            data: response.data,
            date: Math.floor(new Date().getTime() / 1000),
          }
          db.updatecache(user.id, wallet, "wallet")
        })
        .catch((error) => {
          status = error.message
        })
    }
    if (status) {
      res.end(JSON.stringify({ status: status }))
    } else {
      res.json(wallet)
    }
  }
})

module.exports = router
