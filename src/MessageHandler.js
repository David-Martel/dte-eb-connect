const ConsoleLogger = require("./ConsoleLogger.js").ConsoleLogger;
const { topics } = require("./config-topics.js");

const Topics = topics();

class MessageHandler {
  static handle(message, logger = ConsoleLogger) {
    const normalized = this.normalize(message);

    if (!normalized.knownTopic) {
      logger.fail(`Unhandled Topic - ${message.topic}`);
      logger.white(this.stringifyPayload(normalized.payload));
      return normalized;
    }

    if (message.topic.includes("polling_mode")) {
      return normalized;
    }

    logger.timestamp();
    logger.topic(`TOPIC: ${message.topic}`);
    if (normalized.summary) {
      logger.white(normalized.summary);
    }

    return normalized;
  }

  static normalize(message) {
    const payload = this.parsePayload(message.body);
    let topic = this.getTopicByName(message.topic);

    const normalized = {
      category: topic ? topic.category : null,
      knownTopic: Boolean(topic),
      payload,
      summary: null,
      topic: message.topic,
      topicConfig: topic,
    };

    if (!topic) {
      normalized.summary = "Unable to parse message for topic: " + message.topic;
      return normalized;
    }

    if (
      topic.category === "usage-instant" ||
      topic.category === "usage-summation"
    ) {
      let value = null;
      if (topic.category === "usage-summation") {
        value = payload.value;
      }
      if (topic.category === "usage-instant") {
        value = payload.demand;
      }
      normalized.summary = this.formatUsage(payload.time, value);
      return normalized;
    }

    normalized.summary = this.stringifyPayload(payload);
    return normalized;
  }

  static formatUsage(time, value) {
    let result = this.convertTimestamp(time) + " - ";
    result += `${Math.round(value)} watts`;
    return result;
  }

  static convertTimestamp(timeStamp) {
    let date = new Date(timeStamp);
    return date.toLocaleTimeString("en-US");
  }

  static getTopicByName(name) {
    return Topics.find(function (topic) {
      return topic.match === name;
    });
  }

  static searchTopicByName(name) {
    let result = false;
    Topics.forEach(function (topic) {
      if (name.includes(topic.match.slice(0, -2))) {
        result = true;
      }
    });
    return result;
  }

  static parsePayload(payload) {
    if (Buffer.isBuffer(payload)) {
      payload = payload.toString();
    }

    if (typeof payload !== "string") {
      return payload;
    }

    try {
      return JSON.parse(payload);
    } catch (_error) {
      return payload;
    }
  }

  static stringifyPayload(payload) {
    if (typeof payload === "string") {
      return payload;
    }

    return JSON.stringify(payload);
  }
}

module.exports = MessageHandler;
