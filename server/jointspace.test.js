import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import {
  validateHost,
  validatePath,
  probeTv,
  publicTv,
  pairingSignature,
  SHARED_KEY,
  tvRequest,
} from "./jointspace.js";
import { subnetHosts } from "./discovery.js";

test("only canonical private IPv4 targets are allowed", () => {
  for (const host of ["192.168.1.4", "10.0.0.1", "172.16.0.10"])
    assert.equal(validateHost(host), host);
  for (const host of [
    "8.8.8.8",
    "127.0.0.1",
    "localhost",
    "192.168.01.4",
    "192.168.1.256",
    "http://10.0.0.1",
  ])
    assert.throws(() => validateHost(host));
});
test("subnets exclude network and broadcast and are bounded", () => {
  assert.deepEqual(subnetHosts("192.168.1.4/30"), [
    "192.168.1.5",
    "192.168.1.6",
  ]);
  assert.deepEqual(subnetHosts("192.168.1.4/32"), ["192.168.1.4"]);
  assert.throws(() => subnetHosts("10.0.0.1/8"));
  assert.throws(() => subnetHosts("192.168.1.4/24/25"));
});
test("paths cannot escape the JointSpace API", () => {
  assert.equal(
    validatePath("menuitems/settings/structure"),
    "menuitems/settings/structure",
  );
  for (const path of [
    "../pair/request",
    "http://example.com",
    "audio/../system",
    "/system",
    "system?x=1",
  ])
    assert.throws(() => validatePath(path));
});
test("discovery follows system-reported API version and secure transport", async () => {
  const tv = await probeTv("192.168.1.5", [1925], async () => ({
    name: "Living room",
    api_version: { Major: 6 },
    featuring: {
      systemfeatures: {
        secured_transport: "true",
        pairing_type: "digest_auth_pairing",
      },
    },
  }));
  assert.equal(tv.protocol, "https");
  assert.equal(tv.port, 1926);
  assert.equal(tv.requiresPairing, true);
  assert.equal(
    publicTv({ ...tv, credentials: { username: "secret", password: "secret" } })
      .credentials,
    undefined,
  );
});
test("pairing signs raw timestamp and PIN using base64 SHA1 HMAC", () => {
  assert.equal(
    pairingSignature(123, "1234"),
    createHmac("sha1", SHARED_KEY).update("1231234").digest("base64"),
  );
});
test("transport posts JSON, performs digest authentication, and handles errors", async (context) => {
  const calls = [];
  const server = http.createServer(async (request, response) => {
    if (!request.headers.authorization) {
      response.writeHead(401, {
        "WWW-Authenticate":
          'Digest realm="TV", nonce="test-nonce", qop="auth", algorithm=MD5',
      });
      response.end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    calls.push({
      path: request.url,
      body,
      auth: request.headers.authorization,
    });
    if (request.url.endsWith("/context")) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(body || "{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const tv = {
    host: "127.0.0.1",
    port: server.address().port,
    protocol: "http",
    version: 6,
    credentials: { username: "user", password: "pass" },
  };
  assert.deepEqual(await tvRequest(tv, "input/key", "POST", { key: "Home" }), {
    key: "Home",
  });
  assert.equal(calls[0].path, "/6/input/key");
  assert.match(calls[0].auth, /^Digest /);
  await assert.rejects(
    tvRequest(tv, "context"),
    (error) => error.code === "UNSUPPORTED",
  );
});
