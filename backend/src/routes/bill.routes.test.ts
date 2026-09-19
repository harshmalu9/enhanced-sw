import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";

describe("Backend API: /api/bill/process", () => {
  let server: http.Server;
  let port: number;

  before(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const addr = server.address();
    if (addr && typeof addr === "object") {
      port = addr.port;
    }
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should return 400 if receipt file is missing", async () => {
    const formData = new FormData();
    formData.append("people", JSON.stringify(["A", "B"]));
    formData.append("instruction", "A and B shared.");

    const res = await fetch(`http://localhost:${port}/api/bill/process`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error.code, "MISSING_FILE");
  });

  it("should return 400 if participants are missing or fewer than 2", async () => {
    const formData = new FormData();
    const fakeBlob = new Blob(["fake image data"], { type: "image/jpeg" });
    formData.append("file", fakeBlob, "test.jpg");
    formData.append("people", JSON.stringify(["OnlyOnePerson"]));
    formData.append("instruction", "OnlyOnePerson had everything.");

    const res = await fetch(`http://localhost:${port}/api/bill/process`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error.code, "INSUFFICIENT_PARTICIPANTS");
  });

  it("should return 400 if instruction is missing", async () => {
    const formData = new FormData();
    const fakeBlob = new Blob(["fake image data"], { type: "image/jpeg" });
    formData.append("file", fakeBlob, "test.jpg");
    formData.append("people", JSON.stringify(["A", "B"]));
    formData.append("instruction", "");

    const res = await fetch(`http://localhost:${port}/api/bill/process`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error.code, "MISSING_INSTRUCTION");
  });

  it("should return 503 if Python AI service is unreachable", async () => {
    // Set AI_SERVICE_URL to an unused port to simulate unavailable service
    process.env.AI_SERVICE_URL = "http://localhost:59999";

    const formData = new FormData();
    const fakeBlob = new Blob(["fake image content"], { type: "image/jpeg" });
    formData.append("file", fakeBlob, "test.jpg");
    formData.append("people", JSON.stringify(["A", "B", "C"]));
    formData.append("instruction", "A and B had pizza.");

    const res = await fetch(`http://localhost:${port}/api/bill/process`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error.code, "AI_SERVICE_UNAVAILABLE");
    assert.equal(
      data.error.message,
      "AI service is currently unavailable. Please try again."
    );
  });
});
