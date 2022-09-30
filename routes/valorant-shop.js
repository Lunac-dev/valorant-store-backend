const express = require("express")
const router = express.Router()

const shop = require("../valorant/shop")
const db = require("../db")
const cache = require("../misc/cache")

router.get("/valorant/getshop", async (req, res, _next) => {
  const discordid = req.header("discordid")

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
    return
  }
  if (await db.empty(discordid)) {
    res.json({ status: "FAILED" })
  } else {
    const store = await shop.getDailyShop(discordid)
    if (store.success) {
      res.json(store.shop)
    } else {
      res.end(JSON.stringify({ status: store.error }))
    }
  }
})

//share
router.get("/valorant/getshop2", async (req, res, _next) => {
  const discordid = atob(req.header("discordid"))

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
    return
  }
  if (await db.empty(discordid)) {
    res.json({ status: "FAILED" })
  } else {
    const user = await db.getUser(discordid)
    const store = await db.getcache("daily", user.id)
    res.json(store.json)
  }
})

router.get("/valorant/getnightmarket2", async (req, res, _next) => {
  const discordid = atob(req.header("discordid"))

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
    return
  }
  if (await db.empty(discordid)) {
    res.json({ status: "FAILED" })
  } else {
    const user = await db.getUser(discordid)
    const nightmarket = await db.getcache("nightmarket", user.id)
    res.json(nightmarket.json)
  }
})

router.get("/valorant/getnightmarket", async (req, res, _next) => {
  const discordid = req.header("discordid")

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
    return
  }
  if (await db.empty(discordid)) {
    res.json({ status: "FAILED" })
  } else {
    const store = await shop.getNightMarket(discordid)
    if (store.success) {
      res.json(store.nightmarket)
    } else {
      res.end(JSON.stringify({ status: store.error }))
    }
  }
})

module.exports = router
