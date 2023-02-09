const express = require("express")
const router = express.Router()

const shop = require("../valorant/shop")
const db = require("../db")
const cache = require("../misc/cache")

const axios = require("axios")

router.get("/getstore", async (req, res, _next) => {
  // Auth
  if (req.header('Authorization') == undefined) {
    res.end(JSON.stringify({ status: 400 }))
    return
  }
  let auth = undefined
  try {
    auth = await axios.get('https://discordapp.com/api/users/@me', {
    headers: {
      Authorization: req.header('Authorization'),
    }
  })
  } catch (err) {
    console.error(err.message, req.headers["cf-connecting-ip"])
    return
  }
  // End
  if (await db.empty(auth.data.id)) {
    res.json({ status: "FAILED" })
  } else {
    const store = await shop.getDailyShop(auth.data.id)
    if (store.success) {
      res.json(store.shop)
    } else {
      res.end(JSON.stringify({ status: store.error }))
    }
  }
})

//share
router.get("/getstore2", async (req, res, _next) => {
  const discordid = atob(req.header("discordid"))

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: 400 }))
    return
  }
  if (await db.empty(discordid)) {
    res.json({ status: 404 })
  } else {
    const user = await db.getUser(discordid)
    const store = await db.getcache("store", user.id)
    const user_info = await db.getuserinfo(user.id)
    if (store) {
      if (user_info) {
        if (user_info.private === 1) {
          res.json({ status: 'You cannot see it because it is not open to the public.' })
          return
        }
      }
      res.json(store.json)
    } else {
      res.json({ status: 'Store has not been acquired.' })
    }
  }
})
//end

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