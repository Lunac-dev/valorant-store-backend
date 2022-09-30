const express = require("express")
const router = express.Router()

const db = require("../db")
const Valorant = require("../auth/main.js")

const crypto = require("crypto")

const rate = require("express-rate-limit")

const log4js = require("log4js");
const logger = log4js.getLogger()

const unlinklimiter = rate({
  windowMs: 120 * 60 * 1000,
  max: 1,
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
  max: 3,
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

router.get("/valorant/login", loginlimiter, async (req, res, _next) => {
  logger.info("Login Request", req.header("discordid"), req.headers["cf-connecting-ip"])
  const password = req.header("password")
  const username = req.header("username")
  const discordid = req.header("discordid")
  const region = req.header("region")
  let relogin = req.header("relogin")

  if (relogin == "true") {
    relogin = 1
  } else {
    relogin = 0
  }

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
    return
  }
  if (!(await db.empty(discordid))) {
    res.end(JSON.stringify({ status: "FAILED" }))
  } else {
    const valorantApi = new Valorant.API(region)

    let status = false

    await valorantApi.authorize(username, password).catch((err) => {
      status = err.message
    })

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

router.get("/valorant/logout", unlinklimiter, async (req, res, _next) => {
  logger.info("Logout Request", req.header("discordid"), req.headers["cf-connecting-ip"])
  const discordid = req.header("discordid")
  if (discordid == undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :(" }))
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
