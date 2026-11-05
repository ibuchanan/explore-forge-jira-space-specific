import api, { type Response, route } from "@forge/api";
import Resolver from "@forge/resolver";
import type {
  components,
  operations,
} from "@forge-ahead/atlassian-api-types/jira-platform-3";
import {
  ok,
  type ProblemDetails,
  problemResult,
  type Result,
  ResultAsync,
  StandardError,
  toProblemDetails,
  validateHttpResponse,
} from "@forge-ahead/errors";
import { createForgeLogger } from "@forge-ahead/logging";

const resolver = new Resolver();
const logger = createForgeLogger({ name: "space-allowlist" });

type RequestLog = {
  operation: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  auth: "user" | "app";
};

async function observedRequest(
  request: () => Promise<Response>,
  meta: RequestLog,
): Promise<Response> {
  const start = performance.now();
  logger.info(meta, "Atlassian API request started");
  try {
    const response = await request();
    const fields = {
      ...meta,
      status: response.status,
      durationMs: Math.round(performance.now() - start),
    };
    if (response.ok) logger.info(fields, "Atlassian API request completed");
    else logger.warn(fields, "Atlassian API request failed");
    return response;
  } catch (error) {
    logger.warn(
      {
        ...meta,
        durationMs: Math.round(performance.now() - start),
        outcome: "rejected",
      },
      "Atlassian API request failed",
    );
    throw error;
  }
}

type Panel = {
  key: string;
  type: string;
  data: { resource?: string; displayConditions?: { projectKey?: string[] } };
};

function fetchResult<T>(
  request: () => Promise<Response>,
  meta: RequestLog,
): ResultAsync<T, ProblemDetails> {
  const context = meta.operation;
  return ResultAsync.fromPromise(observedRequest(request, meta), (error) =>
    toProblemDetails(error, 502, context),
  )
    .andThen((response) => validateHttpResponse(response, context))
    .andThen((response) =>
      ResultAsync.fromPromise(response.json() as Promise<T>, (error) =>
        toProblemDetails(error, 502, `decode ${context}`),
      ),
    );
}

function getPanel(): ResultAsync<Panel | undefined, ProblemDetails> {
  return fetchResult<Panel[]>(
    () =>
      api
        .asApp()
        .requestAtlassian(
          route`/forge/installation/v2/dynamic/module/?limit=100`,
          { method: "GET" },
        ),
    { operation: "load configuration", method: "GET", auth: "app" },
  ).map((modules) =>
    modules.find(
      (module) =>
        module.type === "jira:issuePanel" && module.data.resource === "panel",
    ),
  );
}

type Project = Required<Pick<components["schemas"]["Project"], "key" | "name">>;
type ProjectPage =
  operations["searchProjects"]["responses"][200]["content"]["application/json"];
type MyPermissions =
  operations["getMyPermissions"]["responses"][200]["content"]["application/json"];

async function listProjects(): Promise<Result<Project[], ProblemDetails>> {
  const projects: Project[] = [];
  let startAt = 0;
  while (true) {
    const page = await fetchResult<ProjectPage>(
      () =>
        api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/search?startAt=${startAt}&maxResults=100`,
          ),
      { operation: "load projects", method: "GET", auth: "user" },
    );
    if (page.isErr()) return problemResult(page.error);
    const values = page.value.values ?? [];
    for (const { key, name } of values) {
      if (key && name) projects.push({ key, name });
    }
    if (
      page.value.isLast ||
      values.length === 0 ||
      (page.value.isLast === undefined &&
        values.length < (page.value.maxResults ?? 100))
    )
      return ok(projects);
    startAt =
      (page.value.startAt ?? startAt) +
      (page.value.maxResults ?? values.length);
  }
}

resolver.define("listProjects", async () => {
  const result = await listProjects();
  return result.match(
    (value) => ({ ok: true as const, value }),
    (problem) => ({ ok: false as const, problem }),
  );
});

resolver.define("getConfig", async () => {
  const result = await getPanel();
  return result.match(
    (panel) => ({
      ok: true as const,
      value: { projectKeys: panel?.data.displayConditions?.projectKey ?? [] },
    }),
    (problem) => ({ ok: false as const, problem }),
  );
});

resolver.define("loadAdmin", async () => {
  const [projects, panel] = await Promise.all([listProjects(), getPanel()]);
  if (projects.isErr()) return { ok: false as const, problem: projects.error };
  if (panel.isErr()) return { ok: false as const, problem: panel.error };
  return {
    ok: true as const,
    value: {
      projects: projects.value,
      projectKeys: panel.value?.data.displayConditions?.projectKey ?? [],
    },
  };
});

function requestResult(
  request: () => Promise<Response>,
  meta: RequestLog,
): ResultAsync<void, ProblemDetails> {
  const context = meta.operation;
  return ResultAsync.fromPromise(observedRequest(request, meta), (error) =>
    toProblemDetails(error, 502, context),
  )
    .andThen((response) => validateHttpResponse(response, context))
    .map(() => undefined);
}

async function applyConfig(payload: {
  projectKeys: string[];
}): Promise<Result<{ projectKeys: string[] }, ProblemDetails>> {
  const permissions = await fetchResult<MyPermissions>(
    () =>
      api
        .asUser()
        .requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`),
    {
      operation: "check Jira administrator permission",
      method: "GET",
      auth: "user",
    },
  );
  if (permissions.isErr()) return problemResult(permissions.error);
  if (!permissions.value.permissions?.["ADMINISTER"]?.havePermission) {
    return StandardError.getOrDefault(403).error(
      "Only Jira administrators can apply configuration",
    );
  }
  if (
    !Array.isArray(payload?.projectKeys) ||
    !payload.projectKeys.every((key) => typeof key === "string")
  ) {
    return StandardError.getOrDefault(400).error("Select valid Jira projects");
  }
  if (payload.projectKeys.length > 0) {
    const projects = await listProjects();
    if (projects.isErr()) return problemResult(projects.error);
    const valid = new Set(projects.value.map(({ key }) => key));
    if (payload.projectKeys.some((key) => !valid.has(key))) {
      return StandardError.getOrDefault(400).error(
        "Select valid Jira projects",
      );
    }
  }
  const panel = await getPanel();
  if (panel.isErr()) return problemResult(panel.error);
  if (payload.projectKeys.length === 0) {
    const existing = panel.value;
    if (existing) {
      const deleted = await requestResult(
        () =>
          api
            .asApp()
            .requestAtlassian(
              route`/forge/installation/v2/dynamic/module/${existing.key}`,
              { method: "DELETE" },
            ),
        { operation: "remove panel", method: "DELETE", auth: "app" },
      );
      if (deleted.isErr()) return problemResult(deleted.error);
    }
    return ok({ projectKeys: [] });
  }
  const existing = panel.value;
  const saved = await requestResult(
    () =>
      api
        .asApp()
        .requestAtlassian(
          existing
            ? route`/forge/installation/v2/dynamic/module/${existing.key}`
            : route`/forge/installation/v2/dynamic/module/`,
          {
            method: existing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "jira:issuePanel",
              data: {
                ...(existing && { key: existing.key }),
                resource: "panel",
                render: "native",
                title: "Peek-a-boo",
                icon: "https://developer.atlassian.com/platform/forge/images/icons/issue-panel-icon.svg",
                displayConditions: { projectKey: payload.projectKeys },
              },
            }),
          },
        ),
    {
      operation: "apply configuration",
      method: existing ? "PUT" : "POST",
      auth: "app",
    },
  );
  return saved.match(
    () => ok({ projectKeys: payload.projectKeys }),
    (problem) => problemResult(problem),
  );
}

resolver.define<{ projectKeys: string[] }>(
  "applyConfig",
  async ({ payload }) => {
    const result = await applyConfig(payload);
    return result.match(
      (value) => ({ ok: true as const, value }),
      (problem) => ({ ok: false as const, problem }),
    );
  },
);

export const handler = resolver.getDefinitions();
