const db = require("../db")

const dayjs = require('dayjs')
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/customParseFormat'))
dayjs.extend(require('dayjs/plugin/isSameOrAfter'))
// dayjs.extend(require('dayjs/plugin/isToday'))

module.exports.getcache = async (type, userid) => {

  const cache = await db.getcache(type, userid)

  if (cache) {
    // Cache results for 1 days
    if (dayjs(dayjs.utc(cache.date, 'YYYY/MM/DD').format('YYYY-MM-DD')).isSameOrAfter(dayjs.utc().format('YYYY-MM-DD'))) {
      return cache.json
    } else {
      return false
    }
    // const date2 = new Date()
    // date1.setMinutes(date1.getMinutes() + 30)
    // if (date1.toISOString() < date2.toISOString()) {
    //   return false
    // } else {
    //   return cache.json
    // }
    // return false
  } else {
    // empty
    return false
  }
}