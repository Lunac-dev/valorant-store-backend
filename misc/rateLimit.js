const rateLimits = {};

const rateLimitCap = 10 * 60
const rateLimitBackoff = 60

const log4js = require("log4js");
const logger = log4js.getLogger()

module.exports.checkRateLimit = (res, url) => {
  let rateLimited = res.status === 429;
  if(!rateLimited) try {
    rateLimited = res.data.error === "rate_limited";
  } catch(e) {}

  if(rateLimited) {
    res.headers['retry-after']
    let retryAfter = parseInt(res.headers['retry-after']) + 1;
    if(retryAfter) {
      logger.error(`I am ratelimited at ${url} for ${retryAfter - 1} more seconds!`)
      console.log(`I am ratelimited at ${url} for ${retryAfter - 1} more seconds!`);
      if(retryAfter > rateLimitCap) {
        logger.error(`Delay higher than rateLimitCap, setting it to ${rateLimitCap} seconds instead`)
        console.log(`Delay higher than rateLimitCap, setting it to ${rateLimitCap} seconds instead`);
        retryAfter = rateLimitCap;
      }
    }
    else {
      retryAfter = rateLimitBackoff;
      logger.error(`I am temporarily ratelimited at ${url} (no ETA given, waiting ${rateLimitBackoff}s)`)
      console.log(`I am temporarily ratelimited at ${url} (no ETA given, waiting ${rateLimitBackoff}s)`);
    }

    const retryAt = Date.now() + retryAfter * 1000;
    rateLimits[url] = retryAt;
    return retryAt;
  }

  return false;
}

module.exports.isRateLimited = (url) => {
    const retryAt = rateLimits[url];

    if(!retryAt) return false;

    if(retryAt < Date.now()) {
        delete rateLimits[url];
        return false;
    }

    const retryAfter = (retryAt - Date.now()) / 1000;
    console.log(`I am still ratelimited at ${url} for ${retryAfter} more seconds!`);

    return retryAt;
}