require("dotenv").config();
const EnergyBridge = require("./src/EnergyBridge.js");

function getSelection(argv) {
  if (argv.includes("--all")) {
    return "all";
  }

  if (argv.includes("--instant")) {
    return "instant";
  }

  if (argv.includes("--metering")) {
    return "metering";
  }

  return "summation";
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

async function main() {
  const argv = process.argv.slice(2);
  const bridge = new EnergyBridge({
    publishDiscovery:
      process.env.HA_DISCOVERY_ENABLED === "true" ||
      hasFlag(argv, "--publish-ha-discovery"),
    sourceClientId: process.env.EB_CLIENT_ID,
    sourceHost: process.env.EB_IP,
    sourcePassword: process.env.EB_PASSWORD,
    sourcePort: process.env.EB_PORT,
    sourceUsername: process.env.EB_USERNAME,
    targetClientId: process.env.TARGET_MQTT_CLIENT_ID,
    targetPassword: process.env.TARGET_MQTT_PASSWORD,
    targetUrl: process.env.TARGET_MQTT_URL,
    targetUsername: process.env.TARGET_MQTT_USERNAME,
    topicSelection: getSelection(argv),
  });

  bridge.connect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
