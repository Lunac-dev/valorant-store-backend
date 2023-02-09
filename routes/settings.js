const express = require("express")
const router = express.Router()

const axios = require("axios")

const db = require("../db")

const rate = require('express-rate-limit')
const limiter = rate({
  windowMs: 10*60*1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function (_req, res, _next) {
    return res.status(200).json({
      error: 'Too many requests!'
    })
  },
  keyGenerator: (req, _res) => req.headers["x-forwarded-for"]
});

router.get("/settings", async function(req, res) {
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

  const user = await db.getUser(auth.data.id)

  if (user) {
    const user_info = await db.getuserinfo(user.id)
    if (user_info) {
      res.json({ status: 200, data: user_info })
    } else {
      res.json({ status: 404 })
    }
  } else {
    res.json({ status: 400 })
  }
});

router.post("/settings", limiter, async function(req, res) {
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

  const user = await db.getUser(auth.data.id)

  if (user) {
    if ('private' in req.body) {
      let private = 0
      if (req.body.private) {
        private = 1
      }
      if (await db.updateuserinfo(user.id, user.discordid, private, 0)) {
        res.json({ status: 200 })
      } else {
        res.json({ status: 400 })
      }
    } else {
      res.json({ status: 400 })
    }
  } else {
    res.json({ status: 404 })
  }
});

module.exports = router;