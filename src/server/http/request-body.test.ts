import { describe, expect, it } from "vitest";
import {
  InvalidRequestBodyError,
  readLimitedJson,
  readLimitedText,
  RequestBodyTooLargeError,
} from "./request-body";

describe("limited request bodies", () => {
  it("rejects a declared oversized body before reading it", async () => {
    const request = new Request("https://porfilo.com/api/test", {
      method: "POST",
      headers: { "content-length": "1000" },
      body: "{}",
    });

    await expect(readLimitedText(request, 100)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("rejects a streamed body that crosses the limit", async () => {
    const request = new Request("https://porfilo.com/api/test", {
      method: "POST",
      body: "x".repeat(101),
    });

    await expect(readLimitedText(request, 100)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("parses valid JSON and reports malformed JSON", async () => {
    await expect(
      readLimitedJson(
        new Request("https://porfilo.com/api/test", {
          method: "POST",
          body: JSON.stringify({ ok: true }),
        }),
        100,
      ),
    ).resolves.toEqual({ ok: true });

    await expect(
      readLimitedJson(
        new Request("https://porfilo.com/api/test", {
          method: "POST",
          body: "{",
        }),
        100,
      ),
    ).rejects.toBeInstanceOf(InvalidRequestBodyError);
  });

  it("maps invalid UTF-8 to a safe client error", async () => {
    const request = new Request("https://porfilo.com/api/test", {
      method: "POST",
      body: new Uint8Array([0xc3, 0x28]),
    });

    await expect(readLimitedText(request, 100)).rejects.toBeInstanceOf(
      InvalidRequestBodyError,
    );
  });
});
