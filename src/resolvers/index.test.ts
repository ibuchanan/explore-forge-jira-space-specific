import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJira = vi.fn();
const requestAtlassian = vi.fn();
const captured = vi.hoisted(() => ({
  records: [] as Record<string, unknown>[],
}));
vi.mock("@forge-ahead/logging", async () => {
  const { createCapturingLogger } = await import(
    "@forge-ahead/logging/testing"
  );
  const { logger, records } = createCapturingLogger({
    env: { LOG_LEVEL: "info" },
  });
  captured.records = records;
  return { createForgeLogger: () => logger };
});
vi.mock("@forge/api", () => ({
  default: {
    asUser: () => ({ requestJira }),
    asApp: () => ({ requestAtlassian }),
  },
  route: (strings: TemplateStringsArray, ...parts: string[]) =>
    strings.reduce((path, chunk, i) => path + chunk + (parts[i] ?? ""), ""),
}));

import { handler } from "./index";

const respond = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 503 ? "Service Unavailable" : "OK",
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const call = (functionKey: string, payload?: unknown) =>
  handler({ call: { functionKey, payload }, context: {} });

beforeEach(() => {
  requestJira.mockReset();
  requestAtlassian.mockReset();
  captured.records.length = 0;
  requestJira.mockImplementation((path: string) =>
    Promise.resolve(
      path.includes("mypermissions")
        ? respond({ permissions: { ADMINISTER: { havePermission: true } } })
        : respond({
            values: [
              { key: "ALPHA", name: "Alpha" },
              { key: "BETA", name: "Beta" },
            ],
            isLast: true,
          }),
    ),
  );
});

describe("admin configuration resolver", () => {
  it("loads project choices and applied keys in one admin request", async () => {
    requestAtlassian.mockResolvedValue(
      respond([
        {
          key: "generated-id",
          type: "jira:issuePanel",
          data: {
            resource: "panel",
            displayConditions: { projectKey: ["BETA"] },
          },
        },
      ]),
    );
    expect(await call("loadAdmin")).toEqual({
      ok: true,
      value: {
        projects: [
          { key: "ALPHA", name: "Alpha" },
          { key: "BETA", name: "Beta" },
        ],
        projectKeys: ["BETA"],
      },
    });
    expect(requestJira).toHaveBeenCalledTimes(1);
    expect(requestAtlassian).toHaveBeenCalledTimes(1);
  });

  it("records bounded metadata for a successful API request and response", async () => {
    requestAtlassian.mockResolvedValue(respond([]));
    await call("getConfig");
    expect(captured.records).toEqual([
      expect.objectContaining({
        operation: "load configuration",
        method: "GET",
        auth: "app",
        msg: "Atlassian API request started",
      }),
      expect.objectContaining({
        operation: "load configuration",
        method: "GET",
        auth: "app",
        status: 200,
        durationMs: expect.any(Number),
        msg: "Atlassian API request completed",
      }),
    ]);
    expect(JSON.stringify(captured.records)).not.toContain("projectKeys");
  });

  it("records failed API responses without logging their body", async () => {
    requestAtlassian.mockResolvedValue(
      respond({ token: "private-value" }, 503),
    );
    await call("getConfig");
    expect(captured.records).toContainEqual(
      expect.objectContaining({
        operation: "load configuration",
        method: "GET",
        auth: "app",
        status: 503,
        durationMs: expect.any(Number),
        msg: "Atlassian API request failed",
      }),
    );
    expect(JSON.stringify(captured.records)).not.toContain("private-value");
  });
  it("returns a typed problem if Jira project lookup fails", async () => {
    requestJira.mockResolvedValue(respond({ message: "Unavailable" }, 503));
    expect(await call("listProjects")).toMatchObject({
      ok: false,
      problem: { status: 503 },
    });
  });

  it("lists Jira projects for the admin selector across pages", async () => {
    requestJira
      .mockResolvedValueOnce(
        respond({
          values: [{ key: "ALPHA", name: "Alpha" }],
          isLast: false,
          startAt: 0,
          maxResults: 1,
        }),
      )
      .mockResolvedValueOnce(
        respond({ values: [{ key: "BETA", name: "Beta" }], isLast: true }),
      );
    expect(await call("listProjects")).toEqual({
      ok: true,
      value: [
        { key: "ALPHA", name: "Alpha" },
        { key: "BETA", name: "Beta" },
      ],
    });
    expect(requestJira.mock.calls[1]?.[0]).toContain("startAt=1");
  });

  it("ignores projects missing a key or name in a sparse Jira page", async () => {
    requestJira.mockResolvedValue(
      respond({
        values: [
          { key: "ALPHA", name: "Alpha" },
          { name: "No key" },
          { key: "BETA" },
        ],
        isLast: true,
      }),
    );
    expect(await call("listProjects")).toEqual({
      ok: true,
      value: [{ key: "ALPHA", name: "Alpha" }],
    });
  });

  it("fails closed if Jira omits the ADMINISTER permission entry", async () => {
    requestJira.mockResolvedValue(respond({ permissions: {} }));
    expect(await call("applyConfig", { projectKeys: ["ALPHA"] })).toMatchObject(
      {
        ok: false,
        problem: { status: 403 },
      },
    );
    expect(requestAtlassian).not.toHaveBeenCalled();
  });

  it("returns a typed problem when the SDK throws before returning a promise", async () => {
    requestAtlassian.mockImplementation(() => {
      throw new Error("SDK unavailable");
    });
    expect(await call("getConfig")).toMatchObject({
      ok: false,
      problem: { status: 502 },
    });
  });

  it("returns a typed problem when the module request rejects", async () => {
    requestAtlassian.mockRejectedValue(new Error("network down"));
    expect(await call("getConfig")).toMatchObject({
      ok: false,
      problem: { status: 502 },
    });
    expect(captured.records).toContainEqual(
      expect.objectContaining({
        operation: "load configuration",
        outcome: "rejected",
        durationMs: expect.any(Number),
        msg: "Atlassian API request failed",
      }),
    );
    expect(JSON.stringify(captured.records)).not.toContain("network down");
  });

  it("returns a typed problem when configuration cannot be loaded", async () => {
    requestAtlassian.mockResolvedValue(
      respond({ message: "Unavailable" }, 503),
    );
    const result = await call("getConfig");
    expect(result).toMatchObject({ ok: false, problem: { status: 503 } });
  });

  it("starts empty without registering a panel", async () => {
    requestAtlassian.mockResolvedValue(respond([]));
    expect(await call("getConfig")).toEqual({
      ok: true,
      value: { projectKeys: [] },
    });
    expect(requestAtlassian).toHaveBeenCalledTimes(1);
    expect(requestAtlassian.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("registers a project-scoped panel on Apply", async () => {
    requestAtlassian
      .mockResolvedValueOnce(respond([]))
      .mockResolvedValueOnce(respond({ key: "generated-id" }, 201));
    expect(
      await call("applyConfig", { projectKeys: ["ALPHA", "BETA"] }),
    ).toEqual({ ok: true, value: { projectKeys: ["ALPHA", "BETA"] } });
    const options = requestAtlassian.mock.calls[1]?.[1];
    expect(options?.method).toBe("POST");
    expect(captured.records).toContainEqual(
      expect.objectContaining({
        operation: "apply configuration",
        method: "POST",
        auth: "app",
        status: 201,
        msg: "Atlassian API request completed",
      }),
    );
    expect(JSON.stringify(captured.records)).not.toContain("ALPHA");
    expect(JSON.stringify(captured.records)).not.toContain("BETA");
    expect(JSON.parse(options?.body)).toMatchObject({
      type: "jira:issuePanel",
      data: {
        resource: "panel",
        render: "native",
        displayConditions: { projectKey: ["ALPHA", "BETA"] },
      },
    });
  });

  it("returns a typed problem when registering the panel fails", async () => {
    requestAtlassian
      .mockResolvedValueOnce(respond([]))
      .mockResolvedValueOnce(respond({ message: "Unavailable" }, 503));
    expect(await call("applyConfig", { projectKeys: ["ALPHA"] })).toMatchObject(
      { ok: false, problem: { status: 503 } },
    );
  });

  it("updates the existing panel instead of creating a duplicate", async () => {
    requestAtlassian
      .mockResolvedValueOnce(
        respond([
          {
            key: "generated-id",
            type: "jira:issuePanel",
            data: { resource: "panel" },
          },
        ]),
      )
      .mockResolvedValueOnce(respond({ key: "generated-id" }));
    expect(await call("applyConfig", { projectKeys: ["BETA"] })).toEqual({
      ok: true,
      value: { projectKeys: ["BETA"] },
    });
    expect(requestAtlassian.mock.calls[1]?.[0]).toContain("/generated-id");
    expect(requestAtlassian.mock.calls[1]?.[1]?.method).toBe("PUT");
  });

  it("rejects unrecognized project keys without changing the panel", async () => {
    requestJira
      .mockResolvedValueOnce(
        respond({ permissions: { ADMINISTER: { havePermission: true } } }),
      )
      .mockResolvedValueOnce(
        respond({ values: [{ key: "ALPHA", name: "Alpha" }], isLast: true }),
      );
    expect(
      await call("applyConfig", { projectKeys: ["FORGED"] }),
    ).toMatchObject({
      ok: false,
      problem: { status: 400, detail: "Select valid Jira projects" },
    });
    expect(requestAtlassian).not.toHaveBeenCalled();
  });

  it("does not change any module for a non-admin", async () => {
    requestJira.mockResolvedValue(
      respond({ permissions: { ADMINISTER: { havePermission: false } } }),
    );
    expect(await call("applyConfig", { projectKeys: ["ALPHA"] })).toMatchObject(
      {
        ok: false,
        problem: {
          status: 403,
          detail: "Only Jira administrators can apply configuration",
        },
      },
    );
    expect(requestAtlassian).not.toHaveBeenCalled();
  });

  it("removes the panel when the applied list is empty", async () => {
    requestAtlassian
      .mockResolvedValueOnce(
        respond([
          {
            key: "generated-id",
            type: "jira:issuePanel",
            data: { resource: "panel" },
          },
        ]),
      )
      .mockResolvedValueOnce(respond(null, 204));
    expect(await call("applyConfig", { projectKeys: [] })).toEqual({
      ok: true,
      value: { projectKeys: [] },
    });
    expect(requestAtlassian.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });

  it("loads applied project keys from the registered panel", async () => {
    requestAtlassian.mockResolvedValue(
      respond([
        {
          key: "generated-id",
          type: "jira:issuePanel",
          data: {
            resource: "panel",
            title: "Peek-a-boo",
            displayConditions: { projectKey: ["ALPHA", "BETA"] },
          },
        },
      ]),
    );
    expect(await call("getConfig")).toEqual({
      ok: true,
      value: { projectKeys: ["ALPHA", "BETA"] },
    });
  });
});
