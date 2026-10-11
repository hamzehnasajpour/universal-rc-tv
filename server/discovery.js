import os from "node:os";
import net from "node:net";
import dgram from "node:dgram";
import { probeTv, validateHost, TvError } from "./jointspace.js";

export function subnetHosts(cidr) {
  const [host, prefixText, extra] = String(cidr).split("/");
  validateHost(host);
  const prefix = Number(prefixText);
  if (extra || !/^\d+$/.test(prefixText || "") || prefix < 22 || prefix > 32)
    throw new TvError(
      "Use a private IPv4 subnet between /22 and /32 (at most 1024 addresses).",
      400,
    );
  const address = host
    .split(".")
    .reduce((value, octet) => (value * 256 + Number(octet)) >>> 0, 0);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const base = prefix === 32 ? address : (address & mask) >>> 0;
  const count = 2 ** (32 - prefix);
  const start = prefix >= 31 ? 0 : 1;
  const end = prefix >= 31 ? count : count - 1;
  return Array.from({ length: end - start }, (_, index) => {
    const value = base + index + start;
    return validateHost(
      [
        value >>> 24,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
      ].join("."),
    );
  });
}

export function localSubnets() {
  if (process.env.TV_SUBNETS)
    return process.env.TV_SUBNETS.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item.family === "IPv4" && !item.internal);
  const subnets = new Set();
  for (const item of addresses) {
    try {
      validateHost(item.address);
      subnets.add(`${item.address.split(".").slice(0, 3).join(".")}.0/24`);
    } catch {
      /* Non-private interfaces are not discovery targets. */
    }
  }
  return [...subnets].slice(0, 4);
}

function openPort(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function ssdpHosts() {
  return new Promise((resolve) => {
    const hosts = new Set();
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      resolve([...hosts]);
    }, 1800);
    socket.on("error", () => {
      clearTimeout(timer);
      socket.close();
      resolve([...hosts]);
    });
    socket.on("message", (_, remote) => {
      try {
        hosts.add(validateHost(remote.address));
      } catch {}
    });
    socket.bind(0, () =>
      socket.send(
        Buffer.from(
          'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ssdp:all\r\n\r\n',
        ),
        1900,
        "239.255.255.250",
      ),
    );
  });
}

export class Discovery {
  constructor(onTv) {
    this.onTv = onTv;
    this.state = {
      running: false,
      scanned: 0,
      total: 0,
      found: 0,
      subnets: [],
      error: null,
    };
  }
  start(subnet, knownHosts = []) {
    if (this.state.running) return this.state;
    const subnets = subnet ? [subnet] : localSubnets();
    const hosts = [
      ...new Set([
        ...knownHosts.map(validateHost),
        ...subnets.flatMap(subnetHosts),
      ]),
    ];
    this.state = {
      running: true,
      scanned: 0,
      total: hosts.length,
      found: 0,
      subnets,
      error: null,
    };
    this.task = this.run(hosts)
      .catch((error) => {
        this.state.error = error.message;
      })
      .finally(() => {
        this.state.running = false;
        this.state.finishedAt = new Date().toISOString();
      });
    return this.state;
  }
  async run(hosts) {
    const discovered = await ssdpHosts();
    hosts = [...new Set([...discovered, ...hosts])];
    this.state.total = hosts.length;
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(32, hosts.length) }, async () => {
        while (cursor < hosts.length) {
          const host = hosts[cursor++];
          const ports = (
            await Promise.all(
              [1925, 1926].map(async (port) =>
                (await openPort(host, port)) ? port : null,
              ),
            )
          ).filter(Boolean);
          if (ports.length) {
            const tv = await probeTv(host, ports);
            if (tv) {
              await this.onTv(tv);
              this.state.found++;
            }
          }
          this.state.scanned++;
        }
      }),
    );
  }
}
