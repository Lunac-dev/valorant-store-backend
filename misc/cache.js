const db = require("../db");

module.exports.getcache = async (type, userid) => {

  const cache = await db.getcache(type, userid)

  if (cache) {
    // Cache results for 30 minutes
    const date1 = new Date(cache.date)
    const date2 = new Date()
    date1.setMinutes(date1.getMinutes() + 30)
    if (date1.toISOString() < date2.toISOString()) {
      return false
    } else {
      return cache.json
    }
  } else {
    // empty
    return false
  }
}