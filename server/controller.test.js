import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Controller } from "./controller.js";
import { createApp } from "./index.js";

async function setup(context, request) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "philips-remote-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return new Controller(directory, request);
}
test("demo exposes catalog and controllable status without contacting a TV", async (context) => {
  const controller = await setup(context, () =>
    assert.fail("Demo must not use the network"),
  );
  controller.addDemo();
  assert.equal((await controller.catalog("demo")).apps.applications.length, 6);
  await controller.command("demo", { type: "volume", value: 30 });
  await controller.command("demo", { type: "key", value: "Mute" });
  assert.equal((await controller.status("demo")).volume.current, 30);
  assert.equal((await controller.status("demo")).volume.muted, true);
  await controller.command("demo", { type: "hue", value: "On" });
  assert.equal((await controller.status("demo")).hue.power, "On");
  await controller.command("demo", { type: "hue", value: "Off" });
  assert.equal((await controller.status("demo")).hue.power, "Off");
  await assert.rejects(
    controller.command("demo", { type: "volume", value: 100 }),
    (error) => error.status === 400,
  );
  await assert.rejects(
    controller.command("demo", { type: "key", value: "Destroy" }),
  );
  await controller.save();
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(controller.dataDir, "devices.json"), "utf8"),
    ),
    [],
  );
});
test("pairing checks expiry and persists credentials only after grant", async (context) => {
  const calls = [];
  const controller = await setup(
    context,
    async (_, endpoint, method, body, options) => {
      calls.push({ endpoint, method, body, options });
      return endpoint === "pair/request"
        ? {
            error_id: "SUCCESS",
            auth_key: "private-key",
            timestamp: 123,
            timeout: 60,
          }
        : { error_id: "SUCCESS" };
    },
  );
  await controller.add({
    id: "192.168.1.5",
    host: "192.168.1.5",
    version: 6,
    protocol: "https",
    port: 1926,
    requiresPairing: true,
  });
  await controller.startPairing("192.168.1.5");
  assert.equal(calls[0].options.credentials, null);
  assert.equal(calls[0].body.access.scope.length, 3);
  await assert.rejects(controller.finishPairing("192.168.1.5", "bad"));
  const tv = await controller.finishPairing("192.168.1.5", "1234");
  assert.equal(tv.paired, true);
  assert.equal(tv.credentials, undefined);
  assert.equal(calls[1].options.credentials.password, "private-key");
  const restored = new Controller(controller.dataDir);
  await restored.load();
  assert.equal(restored.get(tv.id).credentials.password, "private-key");
  await controller.startPairing(tv.id);
  controller.pairings.get(tv.id).expiresAt = 0;
  await assert.rejects(controller.finishPairing(tv.id, "1234"), /expired/);
});
test("non-Android feature advertisements avoid unsupported probes", async (context) => {
  const endpoints = [];
  const controller = await setup(context, async (_, endpoint) => {
    endpoints.push(endpoint);
    return endpoint === "audio/volume" ? { min: 0, max: 60, current: 4, muted: false } : { powerstate: "On" };
  });
  await controller.add({ id: "192.168.1.5", version: 6, system: { featuring: { jsonfeatures: { inputkey: ["key", "unicode"], activities: ["browser"], recordings: ["List"] } } } });
  const catalog = await controller.catalog("192.168.1.5");
  assert.equal(catalog.capabilities.apps, false);
  assert.equal(catalog.capabilities.ambilightConfig, false);
  assert.equal(catalog.capabilities.volume, true);
  assert.equal((await controller.status("192.168.1.5")).online, true);
  assert.deepEqual(endpoints, ["audio/volume", "powerstate", "audio/volume"]);
});

test("requests to one TV never overlap and recover after failures", async (context) => {
  let active = 0, maximum = 0;
  const controller = await setup(context, async (_, endpoint) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (endpoint === "context") throw new Error("Unsupported");
    return {};
  });
  const tv = { id: "192.168.1.5" };
  await Promise.allSettled([controller.call(tv, "system"), controller.call(tv, "context"), controller.call(tv, "audio/volume")]);
  assert.equal(maximum, 1);
  assert.deepEqual(await controller.call(tv, "powerstate"), {});
});

test("HTTP routes reject cross-origin commands and public targets", async (context) => {
  const controller = await setup(context);
  const { app } = createApp(controller);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, headers = {}) =>
    fetch(url + route, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await post("/api/demo", {}, { Origin: "https://evil.example" })).status,
    403,
  );
  assert.equal((await post("/api/devices", { host: "8.8.8.8" })).status, 400);
  assert.equal((await post("/api/demo", {})).status, 200);
  assert.equal(
    (await post("/api/devices/demo/command", { type: "key", value: "Home" }))
      .status,
    200,
  );
  const catalog = await fetch(url + "/api/devices/demo/catalog").then(
    (response) => response.json(),
  );
  assert.ok(catalog.capabilities.ambilightConfig);
});
