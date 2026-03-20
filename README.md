
# DTE Energy Bridge Connect

This service connects to a Powerley Energy Bridge, subscribes to metering
topics, logs normalized telemetry, and can republish those topics to the local
Home Assistant MQTT broker.

## Install

```sh
cd dte-eb-connect
npm install
cp .env.example .env
```

Set the Energy Bridge source details and, if you want Home Assistant to ingest
the data through Mosquitto, set `TARGET_MQTT_*` as well.

## Usage

```sh
npm run start:summation
npm run start:instant
npm run start:metering
npm run start:ha
```

- `start:summation`: subscribe to minute totals only.
- `start:instant`: subscribe to instantaneous demand only.
- `start:metering`: subscribe to both power topics and `announce`.
- `start:ha`: bridge metering topics into the target broker and publish Home
  Assistant MQTT discovery payloads.

## Recommended Home Assistant Wiring

- Keep the Energy Bridge as the source broker.
- Republish onto `core-mosquitto` or another local broker.
- Let Home Assistant consume the republished topics from
  `packages/dte_energy_bridge.yaml`.

## Compatible Products

- DTE Insight
- AEP Ohio It's Your Power

## License

MIT. See `LICENSE`.
