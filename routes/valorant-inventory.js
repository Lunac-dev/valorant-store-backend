const express = require("express")
const router = express.Router()

const db = require("../db")
const cache = require("../misc/cache")
const reauth = require("../valorant/reauth")
const Valorant = require("../auth/main.js")

router.get("/valorant/getinventory", async (req, res, _next) => {
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

    const caches = await cache.getcache("inventory", user.id)

    const valorantApi = new Valorant.API(user.region)

    valorantApi.access_token = user.access_token
    valorantApi.entitlements_token = user.entitlements_token

    let inventory = ""
    let status = false

    if (caches) {
      inventory = caches
    } else {
      await valorantApi
        .getEntitlements(user.playerid)
        .then((response) => {
          inventory = {
            data: response.data.EntitlementsByTypes,
            date: Math.floor(new Date().getTime() / 1000),
          }
          db.updatecache(user.id, inventory, "inventory")
        })
        .catch((error) => {
          status = error.message
        })
    }
    if (status) {
      res.end(JSON.stringify({ status: status }))
    } else {
      res.json(inventory)
    }
  }
})

module.exports = router
