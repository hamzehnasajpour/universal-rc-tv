import https from "node:https";
import http from "node:http";
import { createDecipheriv, createHmac, randomBytes } from "node:crypto";
import fetch from "node-fetch";
import DigestClient from "digest-fetch";

export const SHARED_KEY = Buffer.from(
  "ZmVay1EQVFOaZhwQ4Kv81ypLAZNczV9sG4KkseXWn1NEk6cXmPKO/MCa9sryslvLCFMnNe4Z4CPXzToowvhHvA==",
  "base64",
);
const tvAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false, maxSockets: 3 });
const httpTvAgent = new http.Agent({ keepAlive: false, maxSockets: 3 });
export const KEYS = [
  "Standby",
  "Mute",
  "VolumeUp",
  "VolumeDown",
  "ChannelStepUp",
  "ChannelStepDown",
  "CursorUp",
  "CursorDown",
  "CursorLeft",
  "CursorRight",
  "Confirm",
  "Back",
  "Home",
  "Options",
  "Info",
  "Find",
  "Adjust",
  "WatchTV",
  "Viewmode",
  "Teletext",
  "Subtitle",
  "Record",
  "Online",
  "Source",
  "AmbilightOnOff",
  "RedColour",
  "GreenColour",
  "YellowColour",
  "BlueColour",
  "Dot",
  "Play",
  "Pause",
  "PlayPause",
  "Stop",
  "FastForward",
  "Rewind",
  "Next",
  "Previous",
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
];

export class TvError extends Error {
  constructor(message, status = 502, code = "TV_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validateHost(host) {
  if (typeof host !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host))
    throw new TvError(
      "Enter a private IPv4 address, for example 192.168.1.50.",
      400,
    );
  const octets = host.split(".").map(Number);
  if (octets.some((value) => value > 255) || host !== octets.join("."))
    throw new TvError("Invalid IPv4 address.", 400);
  const [first, second] = octets;
  if (!(
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  ))
    throw new TvError("Only private LAN addresses are allowed.", 400);
  return host;
}

export function validatePath(path) {
  if (
    typeof path !== "string" ||
    path.length > 200 ||
    !/^(system|pair|input|audio|powerstate|screenstate|sources|channels|channeldb|activities|applications|ambilight|HueLamp|menuitems|recordings|context|strings)(\/[a-zA-Z0-9_.-]+)*$/.test(
      path,
    ) ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  )
    throw new TvError("Invalid or unsupported JointSpace endpoint path.", 400);
  return path;
}

export function pairingSignature(timestamp, pin) {
  return createHmac("sha1", SHARED_KEY)
    .update(`${timestamp}${pin}`)
    .digest("base64");
}

export function decodeSystem(system) {
  return Object.fromEntries(
    Object.entries(system).map(([key, value]) => {
      if (!key.endsWith("_encrypted")) return [key, value];
      try {
        const bytes = Buffer.from(value, "base64");
        const cipher = createDecipheriv(
          "aes-128-cbc",
          SHARED_KEY.subarray(0, 16),
          bytes.subarray(0, 16),
        );
        return [
          key.slice(0, -10),
          Buffer.concat([
            cipher.update(bytes.subarray(16)),
            cipher.final(),
          ]).toString("utf8"),
        ];
      } catch {
        return [key.slice(0, -10), "Unknown"];
      }
    }),
  );
}

export async function tvRequest(
  tv,
  path,
  method = "GET",
  body,
  { timeout = 4500, credentials = tv.credentials } = {},
) {
  const url = `${tv.protocol}://${tv.host}:${tv.port}/${tv.version}/${validatePath(path)}`;
  const client = credentials
    ? new DigestClient(credentials.username, credentials.password)
    : null;
  let response;
  try {
    const options = {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
      agent: tv.protocol === "https" ? tvAgent : httpTvAgent,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      size: 4 * 1024 * 1024,
    };
    response = await (client
      ? client.fetch(url, options)
      : fetch(url, options));
  } catch (error) {
    throw new TvError(
      error.name === "TimeoutError" || error.name === "AbortError"
        ? "TV timed out. It may be in standby."
        : "Cannot reach the TV. Check its power and network connection.",
      502,
      "OFFLINE",
    );
  }
  if (response.status === 401)
    throw new TvError(
      "This TV needs pairing, or its saved credentials have expired.",
      401,
      "PAIR_REQUIRED",
    );
  if (response.status === 404 || response.status === 403)
    throw new TvError(
      "This endpoint is not available on this TV.",
      422,
      "UNSUPPORTED",
    );
  if (!response.ok)
    throw new TvError(`TV returned HTTP ${response.status}.`, 502);
  const text = await response.text();
  if (!text.trim() || text.includes("<title>Ok</title>")) return {};
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new TvError("TV returned an invalid JSON response.", 502);
  }
  if (result.error_id && result.error_id !== "SUCCESS")
    throw new TvError(`TV rejected the request: ${result.error_id}.`, 422);
  return result;
}

export async function probeTv(host, ports = [1925, 1926], request = tvRequest) {
  validateHost(host);
  for (const port of ports) {
    for (const version of [6, 1, 5, 7, 2, 3, 4]) {
      const tv = {
        id: host,
        host,
        port,
        version,
        protocol: port === 1926 ? "https" : "http",
      };
      try {
        const system = decodeSystem(
          await request(tv, "system", "GET", undefined, { timeout: 1200 }),
        );
        if (
          !system.api_version &&
          !system.name &&
          !system.model &&
          !system.menulanguage &&
          !system.featuring
        )
          continue;
        const features = system.featuring?.systemfeatures || {};
        const secured =
          features.secured_transport === true ||
          features.secured_transport === "true";
        return {
          ...tv,
          version: Number(system.api_version?.Major) || version,
          ...(secured ? { port: 1926, protocol: "https" } : {}),
          name: system.name || system.model || "Philips TV",
          system,
          requiresPairing:
            features.pairing_type === "digest_auth_pairing" ||
            secured ||
            port === 1926,
        };
      } catch (error) {
        if (error.code === "OFFLINE") break;
        if (error.code === "PAIR_REQUIRED")
          return {
            ...tv,
            name: "Philips TV",
            system: {},
            requiresPairing: true,
          };
      }
    }
  }
  return null;
}

export function pairingDevice() {
  return {
    device_name: "Philips Remote",
    device_os: "Web",
    app_name: "Philips Remote",
    app_id: "local.philips.remote",
    type: "native",
    id: randomBytes(16).toString("hex"),
  };
}

export function publicTv(tv) {
  const { credentials, ...safe } = tv;
  return {
    ...safe,
    paired: Boolean(credentials),
    requiresPairing: Boolean(tv.requiresPairing && !credentials),
  };
}
