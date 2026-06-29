import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the env module so cloudflare.ts gets a configured shape without us
// having to set real CLOUDFLARE_* env vars in the test process.
vi.mock("~/env", () => ({
  env: {
    CLOUDFLARE_ZONE_ID: "test-zone-id",
    CLOUDFLARE_API_TOKEN: "test-token",
    NEXT_PUBLIC_ROOT_DOMAIN: "porfilo.com",
  },
}));

import {
  cfCreateHostname,
  cfCreateOrGetHostname,
  cfDeleteHostname,
  cfGetHostname,
  CloudflareApiError,
  CloudflareDisabledError,
  rollupStatus,
} from "./cloudflare";

// Helper: shape a successful CF envelope for any result body.
function ok<T>(result: T) {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
  });
}

function err(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, errors: [{ code: status, message }] }),
    { status },
  );
}

describe("rollupStatus", () => {
  it("maps active+active to active", () => {
    expect(rollupStatus({ status: "active", sslStatus: "active" })).toBe(
      "active",
    );
  });

  it("maps pending_validation to pending", () => {
    expect(
      rollupStatus({ status: "pending_validation", sslStatus: null }),
    ).toBe("pending");
  });

  it("maps deleted to error", () => {
    expect(rollupStatus({ status: "deleted", sslStatus: null })).toBe("error");
  });

  it("maps validation_timed_out to action_needed", () => {
    expect(
      rollupStatus({ status: "pending", sslStatus: "validation_timed_out" }),
    ).toBe("action_needed");
  });

  it("defaults to pending when status is unknown", () => {
    expect(rollupStatus({ status: "weird", sslStatus: null })).toBe("pending");
  });
});

describe("cfCreateHostname", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to the right URL with the right body and normalizes the result", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        ok({
          id: "cf-1",
          hostname: "portfolio.max.com",
          status: "pending",
          ownership_verification: {
            name: "_acme",
            value: "abc",
            type: "txt",
          },
          ssl: {
            status: "pending_validation",
            validation_records: [
              { txt_name: "_acme2", txt_value: "xyz" },
            ],
          },
        }),
      );

    const result = await cfCreateHostname("portfolio.max.com");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0]!;
    const url = call[0];
    const init = call[1]!;
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/zones/test-zone-id/custom_hostnames",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body as string) as {
      hostname: string;
      ssl: { method: string; type: string };
    };
    expect(body.hostname).toBe("portfolio.max.com");
    expect(body.ssl).toMatchObject({ method: "txt", type: "dv" });

    expect(result).toEqual({
      id: "cf-1",
      hostname: "portfolio.max.com",
      status: "pending",
      ownershipVerification: { name: "_acme", value: "abc", type: "txt" },
      sslStatus: "pending_validation",
      sslValidationRecords: [
        { txtName: "_acme2", txtValue: "xyz" },
      ],
    });
  });

  it("throws CloudflareApiError with the first error message on 4xx/5xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      err(409, "already exists"),
    );

    await expect(cfCreateHostname("dup.com")).rejects.toMatchObject({
      name: "CloudflareApiError",
      status: 409,
      message: "already exists",
    });
  });
});

describe("cfCreateOrGetHostname", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses an existing hostname when Cloudflare returns 409", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(err(409, "Duplicate custom hostname found."))
      .mockResolvedValueOnce(
        ok([
          {
            id: "cf-existing",
            hostname: "rami.co.nz",
            status: "pending",
            ssl: { status: "pending_validation" },
          },
        ]),
      );

    const result = await cfCreateOrGetHostname("rami.co.nz");
    expect(result.id).toBe("cf-existing");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("cfGetHostname / cfDeleteHostname", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs the right URL and normalizes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok({
        id: "cf-2",
        hostname: "portfolio.example.com",
        status: "active",
        ssl: { status: "active" },
      }),
    );

    const result = await cfGetHostname("cf-2");
    expect(result.status).toBe("active");
    expect(result.sslStatus).toBe("active");
    // ownership_verification omitted → null
    expect(result.ownershipVerification).toBeNull();
  });

  it("DELETEs the right URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok({ id: "cf-2" }));

    await cfDeleteHostname("cf-2");
    const init = fetchSpy.mock.calls[0]![1]!;
    expect(init.method).toBe("DELETE");
  });

  it("surfaces 404 as CloudflareApiError so callers can branch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(err(404, "not found"));
    await expect(cfGetHostname("missing")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("disabled configuration", () => {
  it("throws CloudflareDisabledError when token is missing", async () => {
    vi.resetModules();
    vi.doMock("~/env", () => ({
      env: { CLOUDFLARE_ZONE_ID: "", CLOUDFLARE_API_TOKEN: "" },
    }));
    const m = await import("./cloudflare");
    await expect(m.cfCreateHostname("x.com")).rejects.toBeInstanceOf(
      m.CloudflareDisabledError,
    );
  });
});

// Sanity check imports are real
describe("public surface", () => {
  it("exports the error classes", () => {
    expect(CloudflareApiError).toBeTypeOf("function");
    expect(CloudflareDisabledError).toBeTypeOf("function");
  });
});
