const express = require("express")
const router = express.Router()

const db = require("../db")
const Valorant = require("../auth/main.js")

const crypto = require("crypto")

const rate = require("express-rate-limit")

const log4js = require("log4js");
const logger = log4js.getLogger()

const axios = require("axios")

const Bottleneck = require("bottleneck/es5");
const limiter = new Bottleneck({
  maxConcurrent: 2,
});

const unlinklimiter = rate({
  windowMs: 120 * 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function (_req, res, _next) {
    return res.status(200).json({
      status:
        "You sent too many unlink requests. Please wait a while then try again!",
    })
  },
  keyGenerator: (req, _res) => req.headers["cf-connecting-ip"],
})

const loginlimiter = rate({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function (_req, res /*next*/) {
    return res.status(200).json({
      status:
        "You sent too many register requests. Please wait a while then try again!",
    })
  },
  keyGenerator: (req, _res) => req.headers["cf-connecting-ip"],
})

router.post("/login", loginlimiter, async (req, res, _next) => {

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

  logger.info("Login Request", auth.data.id, req.headers["cf-connecting-ip"])
  const password = req.body.password
  const username = req.body.username
  const discordid = auth.data.id
  const region = req.body.region
  let relogin = req.body.relogin

  if (relogin) {
    relogin = 1
  } else {
    relogin = 0
  }

  if (!(await db.empty(discordid))) {
    res.end(JSON.stringify({ status: "FAILED" }))
  } else {
    const valorantApi = new Valorant.API(region)

    let status = false

    // await valorantApi.authorize(username, password)
    // .catch((err) => {
    //   logger.error("[x] Login Request", err.message)
    //   console.error(err)
    //   status = err.message
    // });

    await limiter.schedule(() => valorantApi.authorize(username, password))
    .catch((err) => {
      logger.error("[x] Login Request", err.message)
      console.error(err)
      status = err.message
    });

    if (status) {
      res.end(JSON.stringify({ status: status }))
      return
    }

    let insert = await db.register(
      valorantApi.user_id,
      valorantApi.access_token,
      valorantApi.entitlements_token,
      valorantApi.ssidcookie,
      region,
      valorantApi.tdidcookie,
      discordid,
      relogin
    )

    if (relogin == 1) {
      const user = await db.getUser(discordid)
      const cipher = crypto.createCipher("aes-256-cbc", process.env.CRYPTOPASS)
      const crypted = cipher.update(password, "utf-8", "hex")
      const crypted_pass = crypted + cipher.final("hex")
      insert = await db.addLoginData(user.id, username, crypted_pass)
    }

    if (insert) {
      res.end(JSON.stringify({ status: "OK" }))
    } else {
      res.end(JSON.stringify({ status: "Error while adding" }))
    }
  }
})

router.post("/logout", unlinklimiter, async (req, res, _next) => {

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

  logger.info("Logout Request", auth.data.id, req.headers["cf-connecting-ip"])
  const discordid = auth.data.id
  if (discordid == undefined) {
    res.end(JSON.stringify({ status: 400 }))
    return
  }

  if (await db.empty(discordid)) {
    res.end(JSON.stringify({ status: "You are not logged in." }))
  } else {
    if (await db.remove(discordid)) {
      res.end(JSON.stringify({ status: "OK" }))
    } else {
      res.end(JSON.stringify({ status: "An error occurred during logout." }))
    }
  }
})

module.exports = router
