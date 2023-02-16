const db = require("../db")
const Valorant = require("../auth/main.js")

const crypto = require("crypto")

const log4js = require("log4js");
const logger = log4js.getLogger()

const Bottleneck = require("bottleneck/es5");
const limiter = new Bottleneck({
  maxConcurrent: 2,
});

module.exports.reauthUser = async (discordid) => {
  const user = await db.getUser(discordid)

  const date1 = new Date(user.date)
  const date2 = new Date()
  date1.setHours(date1.getHours() + 1)

  if (date1.toISOString() < date2.toISOString()) {
    // request reauth
    const valorantApi = new Valorant.API(user.region)

    valorantApi.ssidcookie = user.ssidcookie

    valorantApi.tdidcookie = user.tdidcookie

    let status = false

    //Cookie reauth
    //Sometimes the response is empty.
    logger.info("Reauth Request", discordid)

    // valorantApi.reauthorizeproxy()
    // .catch((err) => {
    //   console.error("Reauth Error", discordid, err.message)
    //   logger.error("Reauth Error", discordid, err.message)
    //   status = err.message
    // });

    await limiter.schedule(() => valorantApi.reauthorizeproxy())
    .catch((err) => {
      console.error("Reauth Error", discordid, err.message)
      logger.error("Reauth Error", discordid, err.message)
      status = err.message
    });

    if (status) {
      if (status == "expired") {
        if (user.relogin == 1) {
          // auto relogin
          const userdata = await db.getUserData(user.id)

          const decipher = crypto.createDecipher(
            "aes-256-cbc",
            process.env.CRYPTOPASS
          )

          if (userdata.length == 0) {
            await db.remove(discordid)
            return { success: false, error: 'An error occurred while re-logging in. Automatically logged out. [1]' }
          }

          const decrypted = decipher.update(userdata.password, "hex", "utf-8")
          const decrypted_pass = decrypted + decipher.final("utf-8")

          // valorantApi.authorize(userdata.username, decrypted_pass)
          // .then(() => {
          //   status = false
          // })
          // .catch((err) => {
          //   console.error(err)
          //   status = err.message
          // });

          await limiter.schedule(() => valorantApi.authorize(userdata.username, decrypted_pass))
          .then(() => {
            status = false
          })
          .catch((err) => {
            console.error(err)
            status = err.message
          });

          if (status) {
            if (status == "2fa") {
              await db.remove(discordid)
              return {
                success: false,
                error:
                  "Automatic login is not possible because two-factor authentication is enabled. Automatically logged out.",
              }
            } else if (status == "auth_failure") {
              await db.remove(discordid)
              return {
                success: false,
                error:
                  "Password is incorrect. If you have changed your password, please logout and login again. Automatically logged out.",
              }
            } else if (status.includes('403')) {
              return {
                success: false,
                error:
                  "Sorry, there seems to be a problem with the Proxy. Could you please try again?",
              }
            } else {
              return {
                success: false,
                error:
                  "An error occurred while re-logging in. Automatically logged out. [2]",
              }
            }
          } else {
            logger.info("Reauth Success [Relogin]", discordid)
            const update = await db.update(
              valorantApi.access_token,
              valorantApi.ssidcookie,
              valorantApi.tdidcookie,
              discordid
            )
            if (!update) return { success: false, error: "Update failed." }
            return { success: true }
          }
        } else {
          await db.remove(discordid)
          return {
            success: false,
            error:
              "Session has expired. Please login again. Automatically logged out.",
          }
        }
      } else {
        return { success: false, error: status }
      }
    } else {
      logger.info("Reauth Success", discordid)
      const update = await db.update(
        valorantApi.access_token,
        valorantApi.ssidcookie,
        valorantApi.tdidcookie,
        discordid
      )
      if (!update) return { success: false, error: "Update failed." }
      return { success: true }
    }
  } else {
    return { success: true }
  }
}
