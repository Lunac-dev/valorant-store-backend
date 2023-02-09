const express = require("express")
const router = express.Router()

const axios = require("axios")

const db = require("../db")

router.get("/reminder/check", async function(req, res) {
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
    if (user_info.rank === 1) {
      res.json({ status: 200 })
    } else {
      res.json({ status: 404 })
    }
  } else {
    res.json({ status: 400 })
  }
})

router.post("/reminder/register", async function(req, res) {
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

  const user_info = await db.getuserinfo(user.id)

  if (user_info.rank === 1) {
    if (await db.add_reminder_weapons(req.body.weapons, auth.data.id)) {
      res.json({ "status": 200 })
    } else {
      res.json({ "status": 500 })
    }
  } else {
    res.json({ "status": 403 })
  }
})

router.get("/reminder/reset", async function(req, res) {
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

  const user_info = await db.getuserinfo(user.id)

  if (user_info.rank == 1) {
    if (await db.reset_reminder_weapons(auth.data.id)) {
      res.json({ "status": 200 })
    } else {
      res.json({ "status": 500 })
    }
  } else {
    res.json({ "status": 403 })
  }
})

module.exports = router
