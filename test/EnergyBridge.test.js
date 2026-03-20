const { EventEmitter } = require("events");

jest.mock("mqtt", () => ({
  connect: jest.fn(),
}));

const mqtt = require("mqtt");
const EnergyBridge = require("../src/EnergyBridge.js");

class FakeClient extends EventEmitter {
  constructor() {
    super();
    this.publish = jest.fn((_topic, _payload, _options, callback) => {
      if (typeof _options === "function") {
        _options();
        return;
      }

      if (callback) {
        callback();
      }
    });
    this.subscribe = jest.fn();
    this.end = jest.fn((force, callback) => callback?.());
  }
}

function createBridge(overrides = {}) {
  return new EnergyBridge({
    logger: {
      event: jest.fn(),
      fail: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      timestamp: jest.fn(),
      topic: jest.fn(),
      white: jest.fn(),
    },
    mqttFactory: mqtt.connect,
    publishDiscovery: true,
    sourceHost: "10.0.0.10",
    sourcePort: 2883,
    targetUrl: "mqtt://broker:1883",
    topicSelection: "metering",
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("constructs a bridge with metering subscriptions", () => {
  const bridge = createBridge();

  expect(bridge.ip).toBe("10.0.0.10");
  expect(bridge.port).toBe(2883);
  expect(bridge.subscriptionTopics.map((topic) => topic.name)).toEqual([
    "announce",
    "event_usage_instant",
    "event_usage_summation",
  ]);
});

test("connects source and target brokers with explicit options", () => {
  const sourceClient = new FakeClient();
  const targetClient = new FakeClient();

  mqtt.connect
    .mockReturnValueOnce(sourceClient)
    .mockReturnValueOnce(targetClient);

  const bridge = createBridge({
    sourceClientId: "source-client",
    sourcePassword: "source-pass",
    sourceUsername: "source-user",
    targetClientId: "target-client",
    targetPassword: "target-pass",
    targetUsername: "target-user",
  });

  bridge.connect();

  expect(mqtt.connect).toHaveBeenNthCalledWith(1, "mqtt://10.0.0.10:2883", {
    clientId: "source-client",
    password: "source-pass",
    username: "source-user",
  });
  expect(mqtt.connect).toHaveBeenNthCalledWith(2, "mqtt://broker:1883", {
    clientId: "target-client",
    password: "target-pass",
    username: "target-user",
  });
});

test("subscribes and publishes Home Assistant discovery on connect", () => {
  const sourceClient = new FakeClient();
  const targetClient = new FakeClient();

  mqtt.connect
    .mockReturnValueOnce(sourceClient)
    .mockReturnValueOnce(targetClient);

  const bridge = createBridge();
  bridge.connect();

  sourceClient.emit("connect");
  targetClient.emit("connect");

  expect(sourceClient.subscribe).toHaveBeenCalledWith("announce");
  expect(sourceClient.subscribe).toHaveBeenCalledWith(
    "event/metering/instantaneous_demand"
  );
  expect(sourceClient.subscribe).toHaveBeenCalledWith(
    "event/metering/summation/minute"
  );
  expect(targetClient.publish).toHaveBeenCalledWith(
    "homeassistant/sensor/dte_energy_bridge/instantaneous_power/config",
    expect.any(String),
    { retain: true }
  );
});

test("bridges metering payloads to the target broker", () => {
  const sourceClient = new FakeClient();
  const targetClient = new FakeClient();

  mqtt.connect
    .mockReturnValueOnce(sourceClient)
    .mockReturnValueOnce(targetClient);

  const bridge = createBridge();
  bridge.connect();

  sourceClient.emit(
    "message",
    "event/metering/instantaneous_demand",
    Buffer.from(JSON.stringify({ demand: 412, time: 1700000000000 }))
  );

  expect(targetClient.publish).toHaveBeenCalledWith(
    "event/metering/instantaneous_demand",
    expect.any(Buffer),
    { retain: false }
  );
});

test("disconnect closes both clients", async () => {
  const sourceClient = new FakeClient();
  const targetClient = new FakeClient();

  mqtt.connect
    .mockReturnValueOnce(sourceClient)
    .mockReturnValueOnce(targetClient);

  const bridge = createBridge();
  bridge.connect();

  await bridge.disconnect();

  expect(sourceClient.end).toHaveBeenCalled();
  expect(targetClient.end).toHaveBeenCalled();
  expect(bridge.connected).toBe(false);
});
