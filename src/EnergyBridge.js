const mqtt = require("mqtt");
const ConsoleLogger = require("./ConsoleLogger.js").ConsoleLogger;
const MessageHandler = require("./MessageHandler.js");
const { resolveSelection } = require("./config-topics.js");

function boolFromEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

class EnergyBridge {
  constructor(configOrIp, port, selection = "summation") {
    const legacyConfig =
      typeof configOrIp === "string"
        ? { sourceHost: configOrIp, sourcePort: port, topicSelection: selection }
        : configOrIp;

    this.config = {
      discoveryPrefix: legacyConfig.discoveryPrefix || "homeassistant",
      keepAliveIntervalMs: Number(legacyConfig.keepAliveIntervalMs || 30000),
      logger: legacyConfig.logger || ConsoleLogger,
      mqttFactory: legacyConfig.mqttFactory || mqtt.connect,
      publishDiscovery:
        legacyConfig.publishDiscovery ??
        boolFromEnv(process.env.HA_DISCOVERY_ENABLED, false),
      selection: legacyConfig.topicSelection || selection || "summation",
      sourceClientId:
        legacyConfig.sourceClientId ||
        process.env.EB_CLIENT_ID ||
        `dte-energy-bridge-${Date.now()}`,
      sourceHost: legacyConfig.sourceHost || process.env.EB_IP,
      sourcePassword: legacyConfig.sourcePassword || process.env.EB_PASSWORD,
      sourcePort: Number(legacyConfig.sourcePort || process.env.EB_PORT || 2883),
      sourceProtocol:
        legacyConfig.sourceProtocol || process.env.EB_PROTOCOL || "mqtt",
      sourceUsername: legacyConfig.sourceUsername || process.env.EB_USERNAME,
      targetClientId:
        legacyConfig.targetClientId ||
        process.env.TARGET_MQTT_CLIENT_ID ||
        `dte-energy-bridge-target-${Date.now()}`,
      targetPassword:
        legacyConfig.targetPassword || process.env.TARGET_MQTT_PASSWORD,
      targetUrl: legacyConfig.targetUrl || process.env.TARGET_MQTT_URL,
      targetUsername:
        legacyConfig.targetUsername || process.env.TARGET_MQTT_USERNAME,
    };

    this.ip = this.config.sourceHost;
    this.port = this.config.sourcePort;
    this.client = null;
    this.targetClient = null;
    this.connected = false;
    this.subscriptionTopics = resolveSelection(this.config.selection);
    this.keepAliveTimer = null;
  }

  get sourceUrl() {
    return `${this.config.sourceProtocol}://${this.config.sourceHost}:${this.config.sourcePort}`;
  }

  connect() {
    if (!this.config.sourceHost) {
      throw new Error("Energy Bridge source host is required");
    }

    this.config.logger.event(
      `Connecting to Energy Bridge ${this.config.sourceHost}:${this.config.sourcePort}`
    );

    this.client = this.config.mqttFactory(this.sourceUrl, {
      clientId: this.config.sourceClientId,
      password: this.config.sourcePassword,
      username: this.config.sourceUsername,
    });
    this.addSourceListeners();

    if (this.config.targetUrl) {
      this.targetClient = this.config.mqttFactory(this.config.targetUrl, {
        clientId: this.config.targetClientId,
        password: this.config.targetPassword,
        username: this.config.targetUsername,
      });
      this.addTargetListeners();
    }

    return this;
  }

  disconnect() {
    clearInterval(this.keepAliveTimer);

    const closeClient = (client) =>
      new Promise((resolve) => {
        if (!client) {
          resolve();
          return;
        }

        client.end(true, () => resolve());
      });

    return Promise.all([closeClient(this.client), closeClient(this.targetClient)]).then(
      () => {
        this.connected = false;
      }
    );
  }

  addSourceListeners() {
    this.client.on("connect", () => {
      this.config.logger.event("Energy Bridge connected");
      this.connected = true;
      this.addSubscriptions();
      this.refresh();

      if (!this.keepAliveTimer) {
        this.keepAliveTimer = setInterval(
          () => this.refresh(),
          this.config.keepAliveIntervalMs
        );
        this.keepAliveTimer.unref?.();
      }
    });

    this.client.on("message", (topic, payload, packet) => {
      const normalized = MessageHandler.handle(
        { body: payload, topic },
        this.config.logger
      );

      if (this.targetClient) {
        this.targetClient.publish(topic, payload, { retain: false });
      }

      return normalized;
    });

    this.client.on("error", (error) => {
      this.config.logger.fail(error.message);
    });

    this.client.on("close", () => {
      this.connected = false;
      this.config.logger.fail("Energy Bridge connection closed");
    });

    this.client.on("offline", () => {
      this.config.logger.event("Energy Bridge offline");
    });

    this.client.on("reconnect", () => {
      this.config.logger.event("Reconnecting to Energy Bridge");
    });

    this.client.on("end", () => {
      this.config.logger.event("Energy Bridge session ended");
    });
  }

  addTargetListeners() {
    this.targetClient.on("connect", () => {
      this.config.logger.event(`Connected to target broker ${this.config.targetUrl}`);
      if (this.config.publishDiscovery) {
        this.publishHomeAssistantDiscovery();
      }
    });

    this.targetClient.on("error", (error) => {
      this.config.logger.fail(`Target broker error: ${error.message}`);
    });
  }

  addSubscriptions() {
    this.subscriptionTopics.forEach((topic) => {
      this.config.logger.subscribe(`Subscribing to ${topic.match}`);
      this.client.subscribe(topic.match);
    });
  }

  refresh() {
    if (!this.client) {
      return;
    }

    const payload = JSON.stringify(this.getTimestampRequestIdBody());
    this.config.logger.publish("Publishing keepalive to remote/request/is_app_open");
    this.client.publish("remote/request/is_app_open", payload, {}, (error) => {
      if (error) {
        this.config.logger.fail(`Error while publishing keepalive: ${error.message}`);
      }
    });
  }

  publishHomeAssistantDiscovery() {
    if (!this.targetClient) {
      return;
    }

    const discoveryBase = `${this.config.discoveryPrefix}/sensor/dte_energy_bridge`;
    const commonDevice = {
      identifiers: ["dte_energy_bridge"],
      manufacturer: "Powerley",
      model: "Energy Bridge",
      name: "DTE Energy Bridge",
    };

    const configs = [
      {
        objectId: "instantaneous_power",
        payload: {
          device: commonDevice,
          device_class: "power",
          name: "DTE Energy Usage Instantaneous",
          object_id: "dte_energy_usage_instantaneous",
          state_class: "measurement",
          state_topic: "event/metering/instantaneous_demand",
          unique_id: "dte_energy_usage_instantaneous",
          unit_of_measurement: "W",
          value_template: "{{ value_json.demand | float(0) | round(0) }}",
        },
      },
      {
        objectId: "minute_total",
        payload: {
          device: commonDevice,
          device_class: "energy",
          name: "DTE Energy Usage Minute Total",
          object_id: "dte_energy_usage_minute_total",
          state_class: "total_increasing",
          state_topic: "event/metering/summation/minute",
          unique_id: "dte_energy_usage_minute_total",
          unit_of_measurement: "kWh",
          value_template:
            "{{ (value_json.value | float(0) / 60000) | round(5) }}",
        },
      },
    ];

    configs.forEach(({ objectId, payload }) => {
      this.targetClient.publish(
        `${discoveryBase}/${objectId}/config`,
        JSON.stringify(payload),
        { retain: true }
      );
    });
  }

  getTimestampRequestIdBody() {
    return {
      request_id: `DteEnergyBridgeClient-${this.getRandomInt(0, 100000)}`,
      timestamp: Date.now().toString(),
    };
  }

  getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }
}

module.exports = EnergyBridge;
