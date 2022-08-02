const db = require("../db");
const Valorant = require('../auth/main.js');

const crypto = require('crypto')

module.exports.reauthUser = async (discordid) => {
  const user = await db.getUser(discordid)

  const date1 = new Date(user.date)
  const date2 = new Date()
  date1.setHours(date1.getHours() + 1)

  if (date1.toISOString() < date2.toISOString()) {
    // request reauth
    const valorantApi = new Valorant.API(user.region);

    valorantApi.ssidcookie = user.ssidcookie;

    valorantApi.tdidcookie = user.tdidcookie;

    let status = false;

    //Cookie reauth
    //Sometimes the response is empty.
    await valorantApi.reauthorizeproxy()
    .catch((err) => {
      status = err.message
    });

    if (status) {
      if (status == 'expired') {
        if (user.relogin == 1) {
          // auto relogin
          const userdata = await db.getUserData(user.id)

          const decipher = crypto.createDecipher('aes-256-cbc', process.env.CRYPTOPASS)
          const decrypted = decipher.update(userdata.password, 'hex', 'utf-8')
          const decrypted_pass = decrypted + decipher.final('utf-8')

          await valorantApi.authorize(userdata.username, decrypted_pass).then(() => {
            status = false
          }).catch((err) => {
            console.log(err.message)
            status = err.message
          });

          if (status) {
            await db.remove(discordid)
            if (status == '2fa') {
              return { success: false, error: 'Automatic login is not possible because two-factor authentication is enabled. Automatically logged out.' }
            } else if (status == 'auth_failure') {
              return { success: false, error: 'Password is incorrect. If you have changed your password, please logout and login again. Automatically logged out.' }
            } else {
              return { success: false, error: 'An error occurred while re-logging in. Automatically logged out.' }
            }
          } else {
            const update = await db.update(valorantApi.access_token, valorantApi.ssidcookie, valorantApi.tdidcookie, discordid)
            if (!update) return { success: false, error: "Update failed." }
            return { success: true }
          }
        } else {
          await db.remove(discordid)
          return { success: false, error: 'Session has expired. Please login again. Automatically logged out.' }
        }
      } else {
        return { success: false, error: status }
      }
    } else {
      const update = await db.update(valorantApi.access_token, valorantApi.ssidcookie, valorantApi.tdidcookie, discordid)
      if (!update) return { success: false, error: "Update failed." }
      return { success: true }
    }
  } else {
    return { success: true }
  }

}