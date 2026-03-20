const TOPICS = [
  { name: "all", match: "#" },
  { name: "announce", match: "announce", category: "diagnostic" },
  { name: "clients", match: "clients/#" },
  { name: "event_all", match: "event/#" },
  { name: "remote_announce", match: "remote/announce", category: "diagnostic" },
  { name: "device_announce", match: "device/?/announce", category: "diagnostic" },
  { name: "usage_summation", match: "summation", category: "usage-summation" },
  {
    name: "remote_summation",
    match: "remote/summation",
    category: "usage-summation",
  },
  {
    name: "event_metering",
    match: "event/metering/#",
    category: "usage-summation",
  },
  {
    name: "event_usage_summation",
    match: "event/metering/summation/minute",
    category: "usage-summation",
  },
  {
    name: "remote_summation_min",
    match: "remote/event/metering/summation/minute",
    category: "usage-summation",
  },
  {
    name: "event_usage_instant",
    match: "event/metering/instantaneous_demand",
    category: "usage-instant",
  },
  {
    name: "remote_instant",
    match: "remote/event/metering/instantaneous_demand",
    category: "usage-instant",
  },
  {
    name: "remote_request_summation",
    match: "remote/request/metering/summation/minute",
  },
  {
    name: "remote_response_summation",
    match: "remote/response/metering/summation/minute/#",
  },
  { name: "remote_request_announce", match: "remote/request/announce" },
  { name: "remote_response_announce", match: "remote/response/announce/#" },
  {
    name: "remote_request_polling_mode",
    match: "remote/request/metering/polling_mode/set",
  },
  { name: "remote_request_configure", match: "remote/request/metering/configure" },
  {
    name: "remote_response_configure",
    match: "remote/response/metering/configure",
  },
  {
    name: "remote_response_polling_mode",
    match: "remote/response/metering/polling_mode/set",
  },
  { name: "remote_request_wifi", match: "remote/request/wifi/current" },
  { name: "remote_response_wifi", match: "remote/response/wifi/current/#" },
  { name: "remote_request_timezone", match: "remote/request/timezone/set" },
  { name: "remote_response_timezone", match: "remote/response/timezone/set" },
  {
    name: "remote_request_ha_device_list",
    match: "remote/request/ha_device/device_list",
  },
  {
    name: "remote_response_ha_device_list",
    match: "remote/response/ha_device/device_list/#",
  },
  {
    name: "remote_request_demand_response",
    match: "remote/request/demand_response/enlisted_devices",
  },
  {
    name: "remote_response_demand_response",
    match: "remote/response/demand_response/enlisted_devices",
  },
  { name: "request_polling_mode", match: "request/metering/polling_mode/get" },
  {
    name: "response_polling_mode",
    match: "response/metering/polling_mode/get/ble_data2",
  },
  {
    name: "request_heartbeat_stats",
    match: "request/diagnostics/heartbeat_stats",
  },
  {
    name: "response_heartbeat_stats",
    match: "response/diagnostics/heartbeat_stats/heartbeat273",
  },
  { name: "event_zigbee", match: "event/diagnostics/zigbee" },
  { name: "remote_event_zigbee", match: "remote/event/diagnostics/zigbee" },
  { name: "remote_request_is_app_open", match: "remote/request/is_app_open" },
  { name: "remote_response_is_app_open", match: "remote/response/is_app_open/#" },
  { name: "request_post_minute_summations", match: "request/ebapi/post_minute_summations" },
  { name: "request_post_realtime", match: "request/ebapi/post_realtime" },
  {
    name: "response_post_minute_summations",
    match: "response/ebapi/post_minute_summations/minute_summations274",
  },
  {
    name: "response_post_realtime",
    match: "response/ebapi/post_realtime/realtime275",
  },
];

const PRESETS = {
  all: ["all"],
  instant: ["announce", "event_usage_instant"],
  summation: ["announce", "event_usage_summation"],
  metering: ["announce", "event_usage_instant", "event_usage_summation"],
};

function topics() {
  return TOPICS;
}

function resolveSelection(selection = "summation") {
  const names = PRESETS[selection] || [selection];
  const resolved = names
    .map((name) => TOPICS.find((topic) => topic.name === name))
    .filter(Boolean);

  return resolved.length > 0 ? resolved : [TOPICS.find((topic) => topic.name === "event_usage_summation")];
}

function getTopicByMatch(match) {
  return TOPICS.find((topic) => topic.match === match);
}

module.exports = {
  PRESETS,
  TOPICS,
  getTopicByMatch,
  resolveSelection,
  topics,
};
