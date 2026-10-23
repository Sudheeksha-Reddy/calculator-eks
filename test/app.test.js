import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

let server;
let baseUrl;

// Start the API on a free port before the tests, stop it after
before(() => {
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

test("GET /health returns ok", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("GET /add returns the sum", async () => {
  const res = await fetch(`${baseUrl}/add?a=2&b=3`);
  assert.deepEqual(await res.json(), { result: 5 });
});

test("GET /divide by zero returns 400", async () => {
  const res = await fetch(`${baseUrl}/divide?a=4&b=0`);
  assert.equal(res.status, 400);
});

test("GET /add with text returns 400", async () => {
  const res = await fetch(`${baseUrl}/add?a=x&b=3`);
  assert.equal(res.status, 400);
});
