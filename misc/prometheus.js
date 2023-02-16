const prometheusClient = require("prom-client");

const StoreRequests = new prometheusClient.Counter({
  name: "vsc_store_requests",
  help: "Status of store requests",
  labelNames: ["status"]
});

const LoginRequests = new prometheusClient.Counter({
  name: "vsc_login_requests",
  help: "Status of login requests",
  labelNames: ["status"]
});

module.exports = { prometheusClient, StoreRequests, LoginRequests }