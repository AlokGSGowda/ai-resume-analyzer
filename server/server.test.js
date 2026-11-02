const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

process.env.GEMINI_API_KEY ||= "test-key-not-used-by-these-tests";

const app = require("./server.js");
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health endpoint reports the backend is ready", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("resume analysis rejects missing text", async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText: "  " }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Resume text is required/);
});

test("resume analysis rejects oversized text", async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText: "a".repeat(30001) }),
  });
  assert.equal(response.status, 413);
});

test("job matching validates both required inputs", async () => {
  const response = await fetch(`${baseUrl}/api/match-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText: "Candidate has experience." }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Job description is required/);
});

test("malformed JSON receives a client error", async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid JSON/);
});

test("disallowed browser origins are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://unapproved.example" },
  });
  assert.equal(response.status, 403);
});
