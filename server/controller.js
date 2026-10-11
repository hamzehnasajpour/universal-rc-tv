import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  KEYS,
  TvError,
  publicTv,
  tvRequest,
  probeTv,
  pairingDevice,
  pairingSignature,
} from "./jointspace.js";

export const DEMO_TV = {
  id: "demo",
  host: "demo",
  name: "Living room TV",
  protocol: "https",
  port: 1926,
  version: 6,
  demo: true,
  requiresPairing: false,
  system: {
    name: "Living room TV",
    model: "Philips OLED · Demo",
    api_version: { Major: 6, Minor: 2 },
    os_type: "Android TV",
    featuring: {
      jsonfeatures: {
        input: ["key", "unicode"],
        activities: ["intent", "browser"],
        ambilight: ["Ambilight", "Hue"],
      },
    },
  },
};

function advertised(tv, name) {
  const features = tv.system?.featuring?.jsonfeatures;
  if (tv.demo || tv.version < 5 || !features) return true;
  const intent = features.activities?.includes("intent");
  const ambilight = Boolean(features.ambilight?.length);
  const support = {
    apps: Boolean(features.applications?.length),
    sources: Boolean(intent),
    channels: Boolean(intent || features.channeldb?.length || features.channels?.length),
    styles: ambilight,
    settings: Boolean(features.menuitems?.includes("Setup_Menu")),
    ambilightMode: ambilight,
    ambilightPower: ambilight,
    ambilightConfig: ambilight,
    ambilight,
    hue: Boolean(features.ambilight?.includes("Hue")),
    activity: Boolean(intent),
    screen: Boolean(intent || features.screenstate?.length),
  };
  return support[name] ?? true;
}

export class Controller {
  constructor(dataDir, request = tvRequest) {
    this.dataDir = dataDir;
    this.request = request;
    this.devices = new Map();
    this.pairings = new Map();
    this.catalogs = new Map();
    this.requests = new Map();
    this.writes = Promise.resolve();
    this.demo = {
      powerstate: "On",
      volume: { min: 0, max: 60, current: 18, muted: false },
      ambilight: {
        styleName: "FOLLOW_VIDEO",
        isExpert: false,
        menuSetting: "STANDARD",
      },
      screenstate: "On",
      hue: "Off",
      current: {},
    };
  }
  async load() {
    try {
      const devices = JSON.parse(
        await readFile(path.join(this.dataDir, "devices.json"), "utf8"),
      );
      for (const tv of devices) this.devices.set(tv.id, tv);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  async save() {
    const snapshot = JSON.stringify(
      [...this.devices.values()].filter((tv) => !tv.demo),
      null,
      2,
    );
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        await mkdir(this.dataDir, { recursive: true });
        const file = path.join(this.dataDir, "devices.json");
        await writeFile(`${file}.tmp`, snapshot, { mode: 0o600 });
        await rename(`${file}.tmp`, file);
      });
    await this.writes;
  }
  get(id) {
    const tv = this.devices.get(id);
    if (!tv)
      throw new TvError("TV not found. Add or discover a device first.", 404);
    return tv;
  }
  list() {
    return [...this.devices.values()].map(publicTv);
  }
  async add(tv) {
    const previous = this.devices.get(tv.id);
    this.devices.set(tv.id, {
      ...previous,
      ...tv,
      credentials: previous?.credentials,
    });
    this.catalogs.delete(tv.id);
    await this.save();
    return publicTv(this.get(tv.id));
  }
  async addHost(host) {
    const tv = await probeTv(host);
    if (!tv)
      throw new TvError(
        "No JointSpace API found at this address. Turn the TV on and enable network remote control.",
        404,
      );
    return this.add(tv);
  }
  async forget(id) {
    this.get(id);
    this.devices.delete(id);
    this.catalogs.delete(id);
    this.pairings.delete(id);
    await this.save();
  }
  addDemo() {
    this.devices.set("demo", structuredClone(DEMO_TV));
    return publicTv(this.get("demo"));
  }
  async call(tv, endpoint, method = "GET", body, options) {
    if (!tv.demo) {
      const previous = this.requests.get(tv.id) || Promise.resolve();
      const task = previous.catch(() => {}).then(() => this.request(tv, endpoint, method, body, options));
      this.requests.set(tv.id, task);
      try { return await task; }
      finally { if (this.requests.get(tv.id) === task) this.requests.delete(tv.id); }
    }
    const state = this.demo;
    const values = {
      system: tv.system,
      powerstate: { powerstate: state.powerstate },
      "audio/volume": state.volume,
      screenstate: { screenstate: state.screenstate },
      "ambilight/currentconfiguration": state.ambilight,
      "ambilight/mode": { current: "internal" },
      "ambilight/power": {
        power: state.ambilight.styleName === "OFF" ? "Off" : "On",
      },
      "HueLamp/power": { power: state.hue },
      "activities/current": state.current,
      "activities/tv": {
        channel: { ccid: 1, name: "BBC One", preset: "1" },
        channelList: { id: "all" },
      },
      applications: {
        applications: [
          "Netflix",
          "YouTube",
          "Prime Video",
          "Disney+",
          "Spotify",
          "Plex",
        ].map((label, index) => ({
          id: `demo-${index}`,
          label,
          intent: {
            component: { packageName: label.toLowerCase(), className: "Main" },
          },
        })),
      },
      sources: {
        hdmi1: { name: "HDMI 1" },
        hdmi2: { name: "HDMI 2" },
        hdmi3: { name: "HDMI 3" },
        tv: { name: "Watch TV" },
      },
      "channeldb/tv/channelLists/all": {
        Channel: [
          "BBC One",
          "BBC Two",
          "ITV",
          "Channel 4",
          "Sky News",
          "Discovery",
        ].map((name, index) => ({
          ccid: index + 1,
          name,
          preset: String(index + 1),
        })),
        id: "all",
      },
      "ambilight/supportedstyles": {
        supportedStyles: [
          {
            styleName: "FOLLOW_VIDEO",
            menuSettings: ["STANDARD", "NATURAL", "VIVID", "GAME"],
          },
          {
            styleName: "FOLLOW_AUDIO",
            menuSettings: [
              "ENERGY_ADAPTIVE_COLORS",
              "SPECTRUM_ANALYZER",
              "PARTY",
            ],
          },
          {
            styleName: "FOLLOW_COLOR",
            menuSettings: ["HOT_LAVA", "FRESH_NATURE", "DEEP_WATER"],
          },
          { styleName: "OFF" },
        ],
      },
      "menuitems/settings/structure": {
        node: {
          node_id: 1,
          string_id: "TV_Settings",
          nodes: [
            {
              node_id: 2,
              string_id: "Picture",
              nodes: [{ node_id: 3, string_id: "Brightness" }],
            },
            { node_id: 4, string_id: "Sound" },
          ],
        },
      },
      "recordings/list": { recordings: [] },
      context: { level1: "WatchTv" },
    };
    if (method === "GET") {
      if (!(endpoint in values))
        throw new TvError(
          "This endpoint is not available in demo mode.",
          422,
          "UNSUPPORTED",
        );
      return structuredClone(values[endpoint]);
    }
    if (endpoint === "audio/volume") Object.assign(state.volume, body);
    else if (endpoint === "powerstate") state.powerstate = body.powerstate;
    else if (endpoint === "screenstate") state.screenstate = body.screenstate;
    else if (endpoint === "ambilight/currentconfiguration")
      state.ambilight = body;
    else if (endpoint === "ambilight/power")
      state.ambilight.styleName = body.power === "On" ? "FOLLOW_VIDEO" : "OFF";
    else if (endpoint === "HueLamp/power") state.hue = body.power;
    else if (endpoint === "activities/launch") state.current = body.intent;
    else if (endpoint === "input/key") {
      if (body.key === "VolumeUp")
        state.volume.current = Math.min(
          state.volume.max,
          state.volume.current + 1,
        );
      if (body.key === "VolumeDown")
        state.volume.current = Math.max(
          state.volume.min,
          state.volume.current - 1,
        );
      if (body.key === "Mute") state.volume.muted = !state.volume.muted;
      if (body.key === "Standby")
        state.powerstate = state.powerstate === "On" ? "Standby" : "On";
      if (body.key === "AmbilightOnOff")
        state.ambilight.styleName =
          state.ambilight.styleName === "OFF" ? "FOLLOW_VIDEO" : "OFF";
    }
    return { demo: true };
  }
  async startPairing(id) {
    const tv = this.get(id);
    if (tv.demo) throw new TvError("Demo TVs do not need pairing.", 400);
    const device = pairingDevice();
    const response = await this.call(
      tv,
      "pair/request",
      "POST",
      {
        access: {
          scope: ["read", "write", "control"],
          ...(tv.system?.featuring ? { featuring: tv.system.featuring } : {}),
        },
        device,
      },
      { credentials: null },
    );
    if (!response.auth_key || response.timestamp === undefined)
      throw new TvError("TV did not return a pairing challenge.", 502);
    const expiresAt =
      Date.now() + Math.min(Number(response.timeout) || 60, 300) * 1000;
    this.pairings.set(id, {
      device,
      timestamp: response.timestamp,
      auth_key: response.auth_key,
      expiresAt,
    });
    return { expiresAt };
  }
  async finishPairing(id, pin) {
    if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin))
      throw new TvError("Enter the 4 to 8 digit PIN displayed on the TV.", 400);
    const tv = this.get(id);
    const state = this.pairings.get(id);
    if (!state || Date.now() > state.expiresAt) {
      this.pairings.delete(id);
      throw new TvError("Pairing expired. Request a new PIN.", 400);
    }
    const credentials = { username: state.device.id, password: state.auth_key };
    const result = await this.call(
      tv,
      "pair/grant",
      "POST",
      {
        device: state.device,
        auth: {
          auth_appId: "1",
          auth_timestamp: state.timestamp,
          auth_signature: pairingSignature(state.timestamp, pin),
          pin,
        },
      },
      { credentials },
    );
    if (result.error_id !== "SUCCESS")
      throw new TvError(
        "TV did not confirm pairing. Check the PIN and try again.",
        422,
      );
    tv.credentials = credentials;
    this.pairings.delete(id);
    this.catalogs.delete(id);
    await this.save();
    return publicTv(tv);
  }
  async optional(tv, endpoint) {
    try {
      return { data: await this.call(tv, endpoint), supported: true };
    } catch (error) {
      if (error.code === "UNSUPPORTED") return { data: null, supported: false };
      throw error;
    }
  }
  async status(id) {
    const tv = this.get(id);
    const result = {};
    for (const [name, endpoint] of [
      ["power", "powerstate"],
      ["volume", "audio/volume"],
      ["activity", "activities/current"],
      ["ambilight", "ambilight/currentconfiguration"],
      ["screen", "screenstate"],
      ["hue", "HueLamp/power"],
    ]) {
      if (!advertised(tv, name)) { result[name] = null; continue; }
      try {
        result[name] = (await this.optional(tv, endpoint)).data;
      } catch (error) {
        if (error.code === "PAIR_REQUIRED" || error.code === "OFFLINE")
          throw error;
        result[name] = null;
      }
    }
    return { ...result, online: true, updatedAt: new Date().toISOString() };
  }
  async catalog(id, refresh = false) {
    if (!refresh && this.catalogs.has(id)) return this.catalogs.get(id);
    const tv = this.get(id);
    const modern = tv.version >= 5;
    const result = { keys: KEYS, capabilities: {}, errors: {} };
    for (const [name, endpoint] of [
      ["apps", "applications"],
      ["sources", "sources"],
      ["channels", modern ? "channeldb/tv/channelLists/all" : "channels"],
      ["styles", "ambilight/supportedstyles"],
      ["settings", "menuitems/settings/structure"],
      ["ambilightMode", "ambilight/mode"],
      ["ambilightPower", "ambilight/power"],
      ["ambilightConfig", "ambilight/currentconfiguration"],
      ["hue", "HueLamp/power"],
      ["screen", "screenstate"],
      ["volume", "audio/volume"],
    ]) {
      if (!advertised(tv, name)) { result[name] = null; result.capabilities[name] = false; continue; }
      try {
        const response = await this.optional(tv, endpoint);
        result[name] = response.data;
        result.capabilities[name] = response.supported;
      } catch (error) {
        if (error.code === "PAIR_REQUIRED") throw error;
        result[name] = null;
        result.capabilities[name] = false;
        result.errors[name] = error.message;
      }
    }
    if (modern && !result.channels && advertised(tv, "channels")) {
      try {
        const db = await this.call(tv, "channeldb/tv");
        const lists = [];
        for (const list of (db.channelLists || []).slice(0, 8))
          lists.push(
            await this.call(tv, `channeldb/tv/channelLists/${list.id}`),
          );
        result.channels = {
          Channel: lists.flatMap((list) =>
            (list.Channel || []).map((channel) => ({
              ...channel,
              channelList: { id: list.id, version: list.version },
            })),
          ),
        };
        result.capabilities.channels = true;
      } catch (error) {
        if (error.code === "PAIR_REQUIRED" || error.code === "OFFLINE")
          throw error;
      }
    }
    this.catalogs.set(id, result);
    return result;
  }
  async command(id, command) {
    const tv = this.get(id);
    if (!command || typeof command !== "object")
      throw new TvError("A command object is required.", 400);
    const { type, value } = command;
    if (type === "key") {
      if (!KEYS.includes(value)) throw new TvError("Unknown remote key.", 400);
      return this.call(tv, "input/key", "POST", { key: value });
    }
    if (type === "text") {
      if (typeof value !== "string" || !value || value.length > 500)
        throw new TvError("Enter between 1 and 500 characters.", 400);
      return this.call(tv, "input/key", "POST", { unicode: value });
    }
    if (type === "volume") {
      const current = await this.call(tv, "audio/volume");
      if (
        !Number.isInteger(value) ||
        value < current.min ||
        value > current.max
      )
        throw new TvError("Volume is outside the TV range.", 400);
      return this.call(tv, "audio/volume", "POST", {
        current: value,
        muted: current.muted,
      });
    }
    if (
      type === "power" ||
      type === "screen" ||
      type === "hue" ||
      type === "ambilightPower"
    ) {
      const allowed = type === "power" ? ["On", "Standby"] : ["On", "Off"];
      if (!allowed.includes(value))
        throw new TvError("Invalid power state.", 400);
      const endpoint = {
        power: "powerstate",
        screen: "screenstate",
        hue: "HueLamp/power",
        ambilightPower: "ambilight/power",
      }[type];
      return this.call(tv, endpoint, "POST", {
        [type === "power"
          ? "powerstate"
          : type === "screen"
            ? "screenstate"
            : "power"]: value,
      });
    }
    if (type === "app") {
      const catalog = await this.catalog(id);
      const app = catalog.apps?.applications?.find((item) => item.id === value);
      if (!app?.intent) throw new TvError("Application not found.", 400);
      return this.call(tv, "activities/launch", "POST", { intent: app.intent });
    }
    if (type === "source") {
      if (tv.version >= 5 && !tv.demo)
        throw new TvError(
          "Direct source selection is not supported on this API version. Use the Source remote key.",
          422,
          "UNSUPPORTED",
        );
      const catalog = await this.catalog(id);
      if (!catalog.sources?.[value])
        throw new TvError("Source not found.", 400);
      return this.call(tv, "sources/current", "POST", { id: value });
    }
    if (type === "channel") {
      const catalog = await this.catalog(id);
      if (tv.version >= 5) {
        const channel = catalog.channels?.Channel?.find(
          (item) => String(item.ccid) === String(value),
        );
        if (!channel) throw new TvError("Channel not found.", 400);
        return this.call(tv, "activities/tv", "POST", {
          channel: { ccid: channel.ccid },
          channelList: channel.channelList || {
            id: catalog.channels.id || "all",
            ...(catalog.channels.version
              ? { version: catalog.channels.version }
              : {}),
          },
        });
      }
      if (!catalog.channels?.[value])
        throw new TvError("Channel not found.", 400);
      return this.call(tv, "channels/current", "POST", { id: String(value) });
    }
    if (type === "ambilight") {
      if (
        !value ||
        typeof value !== "object" ||
        typeof value.styleName !== "string"
      )
        throw new TvError("Invalid Ambilight configuration.", 400);
      return this.call(tv, "ambilight/currentconfiguration", "POST", value);
    }
    if (type === "ambilightColor") {
      if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value))
        throw new TvError("Invalid RGB color.", 400);
      const channels = [1, 3, 5].map((offset) =>
        parseInt(value.slice(offset, offset + 2), 16),
      );
      const [red, green, blue] = channels.map((channel) => channel / 255);
      const max = Math.max(red, green, blue),
        min = Math.min(red, green, blue),
        delta = max - min;
      let hue =
        delta === 0
          ? 0
          : max === red
            ? ((green - blue) / delta) % 6
            : max === green
              ? (blue - red) / delta + 2
              : (red - green) / delta + 4;
      hue = (hue * 60 + 360) % 360;
      if (tv.version >= 5)
        return this.call(tv, "ambilight/currentconfiguration", "POST", {
          styleName: "FOLLOW_COLOR",
          isExpert: true,
          algorithm: "MANUAL_HUE",
          colorSettings: {
            color: {
              hue: Math.round(hue),
              saturation: Math.round(max ? (delta / max) * 100 : 0),
              brightness: Math.round(max * 255),
            },
            colorDelta: { hue: 0, saturation: 0, brightness: 0 },
            speed: 255,
          },
        });
      await this.call(tv, "ambilight/mode", "POST", { current: "manual" });
      return this.call(tv, "ambilight/cached", "POST", {
        r: channels[0],
        g: channels[1],
        b: channels[2],
      });
    }
    if (type === "url") {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new TvError("Enter a valid http or https URL.", 400);
      }
      if (!["http:", "https:"].includes(url.protocol))
        throw new TvError("Only http and https URLs are allowed.", 400);
      return this.call(tv, "activities/browser", "POST", { url: url.href });
    }
    throw new TvError("Unknown command type.", 400);
  }
}
