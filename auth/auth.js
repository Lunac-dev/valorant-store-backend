"use strict";

const axios = require("axios")
const regions = require("./regions");
const fs = require('fs');

const log4js = require("log4js");
const logger = log4js.getLogger()
const { isRateLimited, checkRateLimit } = require("../misc/rateLimit")

const tlsCiphers = [
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-ECDSA-AES128-SHA256',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES128-SHA',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-ECDSA-AES256-SHA',
    'ECDHE-RSA-AES256-SHA',
    'RSA-PSK-AES128-GCM-SHA256',
    'RSA-PSK-AES256-GCM-SHA384',
    'RSA-PSK-AES128-CBC-SHA',
    'RSA-PSK-AES256-CBC-SHA',
]

const tlsSigAlgs = [
    'ecdsa_secp256r1_sha256',
    'rsa_pss_rsae_sha256',
    'rsa_pkcs1_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pss_rsae_sha384',
    'rsa_pkcs1_sha384',
    'rsa_pss_rsae_sha512',
    'rsa_pkcs1_sha512',
    'rsa_pkcs1_sha1',
]

const httpsAgentOptions = {
    ciphers: tlsCiphers.join(':'),
    sigalgs: tlsSigAlgs.join(':'),
    honorCipherOrder: true,
    minVersion: "TLSv1.3"
}

const parseSetCookie = (setCookie) => {
    if(!setCookie) {
        console.error("Riot didn't return any cookies during the auth request! Cloudflare might have something to do with it...");
        return {};
    }

    const cookies = {};
    for(const cookie of setCookie) {
        const sep = cookie.indexOf("=");
        cookies[cookie.slice(0, sep)] = cookie.slice(sep + 1, cookie.indexOf(';'));
    }
    return cookies;
}

const stringifyCookies = (cookies) => {
    const cookieList = [];
    for (let [key, value] of Object.entries(cookies)) {
        cookieList.push(key + "=" + value);
    }
    return cookieList.join("; ");
}

const { Agent } = require('better-https-proxy-agent');

let number = 0;

function getAgent() {
    const proxies = JSON.parse(fs.readFileSync('./proxies.json', 'utf8'));
    const max = proxies.all.length-1;
    if (number > max) { number = 0 }
    const proxy = proxies.all[number].split(':');;
    const proxyRequestOptions = {
        protocol: "http:",
        host: proxy[0],
        port: proxy[1]
    };
    const agent = new Agent(httpsAgentOptions, proxyRequestOptions);
    number++
    return agent
}

const parseTokensFromUrl = (uri) => {
    let url = new URL(uri);
    let params = new URLSearchParams(url.hash.substring(1));
    return {
        access_token: params.get("access_token"),
        id_token: params.get("id_token"),
    };
};

const parseUrl = (uri) => {
    const loginResponseURI = new URL(uri);
    const accessToken = loginResponseURI.searchParams.get('access_token');

    return {
        access_token: accessToken,
    };
};

class API {
    constructor(region = regions.AsiaPacific) {
        this.region = region;
        this.username = null;
        this.user_id = null;
        this.ssidcookie = null;
        this.asidcookie = null;
        this.tdidcookie = null;
        this.access_token = null;
        this.entitlements_token = null;
        this.user_agent = "RiotClient/63.0.5.4887690.4789131 rso-auth (Windows; 10;;Professional, x64)";
        this.client_version = "release-06.01-shipping-8-820493";
        this.client_platform = {
            platformType: "PC",
            platformOS: "Windows",
            platformOSVersion: "10.0.19042.1.256.64bit",
            platformChipset: "Unknown",
        };
    }

    getPlayerDataServiceUrl(region) {
        return `https://pd.${region}.a.pvp.net`;
    }

    getPartyServiceUrl(region) {
        return `https://glz-${region}-1.${region}.a.pvp.net`;
    }

    getSharedDataServiceUrl(region) {
        return `https://shared.${region}.a.pvp.net`;
    }

    generateRequestHeaders(extraHeaders = {}) {
        // generate default headers
        const defaultHeaders = {
        Authorization: `Bearer ${this.access_token}`,
        "X-Riot-Entitlements-JWT": this.entitlements_token,
        "X-Riot-ClientVersion": this.client_version,
        "X-Riot-ClientPlatform": Buffer.from(
            JSON.stringify(this.client_platform)
        ).toString("base64"),
        };

        // merge in extra headers
        return {
        ...defaultHeaders,
        ...extraHeaders,
        };
    }

    async authorize(username, password) {

        let rateLimit = false

        const httpsAgent = getAgent()
        const httpAgent = httpsAgent

        logger.info("Authorize Request", username, httpAgent._betterHttpsProxyOptions.host)

        // fetch session cookie
        const req1 = (
            await axios.post(
                "https://auth.riotgames.com/api/v1/authorization",
                {
                    "client_id": "riot-client",
                    "code_challenge": "",
                    "code_challenge_method": "",
                    "acr_values": "",
                    "claims": "",
                    "nonce": "69420",
                    "redirect_uri": "http://localhost/redirect",
                    "response_type": "token id_token",
                    "scope": "openid link ban lol_region"
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": this.user_agent,
                    },
                    httpAgent,
                    httpsAgent
                }
            )
        )

        console.assert(req1.status === 200, `Auth Request Cookies status code is ${req1.status}!`, req1.data);

        // check for RateLimit
        rateLimit = checkRateLimit(req1, "auth.riotgames.com");
        if (rateLimit) {
            logger.error("Authorize RateLimit", username, httpAgent._betterHttpsProxyOptions.host)
            throw new Error("There are too many people logging in at the same time, which is why the limit is being imposed. Please try again later.")
        }
        //

        let cookies = parseSetCookie(req1.headers["set-cookie"]);

        // update asid cookie
        //this.asidcookie = req1.headers["set-cookie"].find((elem) => /^asid/.test(elem)).split(';')[0] + ';';

        // fetch auth tokens
        const access_tokens = await axios.put(
            "https://auth.riotgames.com/api/v1/authorization",
            {
                "type": "auth",
                "username": username,
                "password": password,
                "remember": true
            },
            {
                headers: {
                    "Content-Type": 'application/json',
                    "Cookie": stringifyCookies(cookies),
                    "User-Agent": this.user_agent,
                },
                httpAgent,
                httpsAgent
            }
        );

        // check for error
        console.assert(access_tokens.status === 200, `Auth Request Cookies status code is ${access_tokens.status}!`, access_tokens.data);

        // check for RateLimit
        rateLimit = checkRateLimit(access_tokens, "auth.riotgames.com");
        if (rateLimit) {
            logger.error("Authorize RateLimit", username, httpAgent._betterHttpsProxyOptions.host)
            throw new Error("There are too many people logging in at the same time, which is why the limit is being imposed. Please try again later.")
        }
        //

        if(access_tokens.data.error){
            throw new Error(access_tokens.data.error);
        }

        if (access_tokens.data.type == "multifactor") {
            //this.asidcookie = access_tokens.headers["set-cookie"].find((elem) => /^asid/.test(elem)).split(';')[0] + ';';
            throw new Error("2fa");
        }

        // update ssid cookie
        this.ssidcookie = access_tokens.headers['set-cookie'].find(cookie => /^ssid/.test(cookie)).split(';')[0]+ ';';

        // update tdid cookie
        this.tdidcookie = access_tokens.headers["set-cookie"].find((elem) => /^tdid/.test(elem)).split(';')[0]+ ';';

        // update access token
        let tokens = parseTokensFromUrl(access_tokens.data.response.parameters.uri);
        this.access_token = tokens.access_token;

        // fetch entitlements token
        this.entitlements_token = (
            await axios.post(
                "https://entitlements.auth.riotgames.com/api/token/v1",
                {},
                {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
                }
            )
        ).data.entitlements_token;

        // update user_id from access_token
        this.user_id = JSON.parse(
        Buffer.from(tokens.access_token.split(".")[1], "base64").toString()
        ).sub;
        logger.info("Authorize Success", username)
    }


    // Not use
    async reauthorize() {
        const response = await axios.post(
        "https://auth.riotgames.com/api/v1/authorization",
        {
            client_id: "play-valorant-web-prod",
            nonce: 1,
            redirect_uri: "https://playvalorant.com/opt_in",
            response_type: "token id_token",
            response_mode: "query",
            scope: "account openid"
        },
        {
            headers: {
                "User-Agent": this.user_agent,
                Cookie: this.ssidcookie + " " + this.tdidcookie,
            },
            httpsAgent: agent,
        }
        );
        if (response.data.type == 'auth') {
            if (response.data.error == undefined) {
                throw new Error("Session has expired. Please login again.")
            } else {
                if (response.data.error = 'rate_limited') {
                    throw new Error("Cannot be processed by many requests. Please wait a while and try again.")
                } else {
                    console.log(response)
                    throw new Error("Unknown Error")
                }
            }
        } else if (response.data.type == 'response') {
            //update ssid cookie
            this.ssidcookie = response.headers['set-cookie'].find(elem => /^ssid/.test(elem)).split(';')[0]+ ';';
            //update tdid cookie
            this.tdidcookie = response.headers['set-cookie'].find(elem => /^tdid/.test(elem)).split(';')[0]+ ';';
            //update access token
            const tokens = parseUrl(response.data.response.parameters.uri);
            this.access_token = tokens.access_token;
        }
    }

    // test
    async reauthorizeproxy() {
        let rateLimit = false
        const httpsAgent = getAgent()
        const httpAgent = httpsAgent

        logger.info("Reauthorizeproxy Request")

        const response = await axios.post(
            "https://auth.riotgames.com/api/v1/authorization",
            {
                "client_id": "riot-client",
                "code_challenge": "",
                "code_challenge_method": "",
                "acr_values": "",
                "claims": "",
                "nonce": "69420",
                "redirect_uri": "http://localhost/redirect",
                "response_type": "token id_token",
                "scope": "openid link ban lol_region"
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": this.user_agent,
                    Cookie: this.ssidcookie + " " + this.tdidcookie,
                },
                httpAgent,
                httpsAgent
            }
        );

        // check for RateLimit
        rateLimit = checkRateLimit(response, "auth.riotgames.com");
        if (rateLimit) {
            logger.error("Reauthorizeproxy RateLimit", username, httpAgent._betterHttpsProxyOptions.host)
            throw new Error("The server is currently busy and you could not login. Please try again later.")
        }

        if (response.data.type == 'auth') {
            if (response.data.error == undefined) {
                throw new Error("expired")
            } else {
                throw new Error("Unknown Error")
            }
        } else if (response.data.type == 'response') {
            // update ssid cookie
            this.ssidcookie = response.headers['set-cookie'].find(elem => /^ssid/.test(elem)).split(';')[0]+ ';';
            // update tdid cookie
            this.tdidcookie = response.headers['set-cookie'].find(elem => /^tdid/.test(elem)).split(';')[0]+ ';';
            // update access token
            const tokens = parseTokensFromUrl(response.data.response.parameters.uri);
            this.access_token = tokens.access_token;
        }
        //console.assert(response.status === 303, `Cookie Reauth status code is ${response.status}!`, response);
    }

    // Not use
    async authWithCode(asidcookie, code) {
        const proxies = JSON.parse(fs.readFileSync('./proxies.json', 'utf8'));
        const max = proxies.all.length-1;
        if (number > max) { number = 0 }
        const proxy = process.env.SOCKS + proxies.all[number];
        number++;
        const httpsAgent = new SocksProxyAgent(proxy);
        httpsAgent.options = {
            ciphers: [
                "TLS_CHACHA20_POLY1305_SHA256",
                "TLS_AES_128_GCM_SHA256",
                "TLS_AES_256_GCM_SHA384",
            ].join(":"),
            honorCipherOrder: true,
            minVersion: "TLSv1.2",
            maxVersion: "TLSv1.3",
            keepAlive: true
        }
        const httpAgent = new SocksProxyAgent(proxy);
        httpAgent.options = {
            keepAlive: true
        }

        const response = await await axios.put("https://auth.riotgames.com/api/v1/authorization/", {
            type: "multifactor",
            code: code.toString(),
            rememberDevice: true,
            },
            {
            headers: {
                "Cookie": asidcookie,
                "User-Agent": this.user_agent,
            },
            httpsAgent: httpsAgent,
            httpAgent: httpAgent
            },
        );

        // check for error
        if(response.data.error){
            throw new Error(response.data.error);
        }

        // update ssid cookie
        this.ssidcookie = response.headers['set-cookie'].find(cookie => /^ssid/.test(cookie)).split(';')[0]+ ';';

        //update tdid cookie
        this.tdidcookie = response.headers["set-cookie"].find((elem) => /^tdid/.test(elem)).split(';')[0]+ ';';

        // update access token
        let tokens = parseTokensFromUrl(response.data.response.parameters.uri);
        this.access_token = tokens.access_token;

        // fetch entitlements token
        this.entitlements_token = (
        await axios.post(
            "https://entitlements.auth.riotgames.com/api/token/v1",
            {},
            {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
            }
        )
        ).data.entitlements_token;

        // update user_id from access_token
        this.user_id = JSON.parse(
        Buffer.from(tokens.access_token.split(".")[1], "base64").toString()
        ).sub;
    }

    getConfig(region = this.region) {
        return axios.get(
        this.getSharedDataServiceUrl(region) + "/v1/config/" + region
        );
    }

    getContent() {
        return axios.get(
        this.getSharedDataServiceUrl(this.region) + "/content-service/v2/content",
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getEntitlements(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/store/v1/entitlements/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getMatch(matchId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/match-details/v1/matches/${matchId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getParty(partyId) {
        return axios.get(
        this.getPartyServiceUrl(this.region) + `/parties/v1/parties/${partyId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getCompetitiveLeaderboard(seasonId, startIndex = 0, size = 510) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/mmr/v1/leaderboards/affinity/${this.region}/queue/competitive/season/${seasonId}?startIndex=${startIndex}&size=${size}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerLoadout(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/personalization/v2/players/${playerId}/playerloadout`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerMMR(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) + `/mmr/v1/players/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerMatchHistory(playerId, startIndex = 0, endIndex = 10) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/match-history/v1/history/${playerId}?startIndex=${startIndex}&endIndex=${endIndex}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerCompetitiveHistory(playerId, startIndex = 0, endIndex = 10) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/mmr/v1/players/${playerId}/competitiveupdates?startIndex=${startIndex}&endIndex=${endIndex}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerAccountXp(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/account-xp/v1/players/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerWallet(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/store/v1/wallet/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayerStoreFront(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/store/v2/storefront/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getPlayers(playerIds) {
        return axios.put(
        this.getPlayerDataServiceUrl(this.region) + "/name-service/v2/players",
        playerIds,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getSession(playerId) {
        return axios.get(
        this.getPartyServiceUrl(this.region) + `/session/v1/sessions/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getContractDefinitions() {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            "/contract-definitions/v2/definitions",
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getStoryContractDefinitions() {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            "/contract-definitions/v2/definitions/story",
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getStoreOffers() {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) + `/store/v1/offers`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getContract(playerId) {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/contracts/v1/contracts/${playerId}`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getItemUpgradesV2() {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/contract-definitions/v2/item-upgrades`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }

    getItemUpgradesV3() {
        return axios.get(
        this.getPlayerDataServiceUrl(this.region) +
            `/contract-definitions/v3/item-upgrades`,
        {
            headers: this.generateRequestHeaders(),
        }
        );
    }
}

module.exports = API;