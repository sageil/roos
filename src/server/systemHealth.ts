import os from "node:os";
import type { AppInstanceHealth, ComponentHealth, SystemHealthResponse } from "../shared/types.js";
import { getEffectiveAppSettings } from "./appSettingsStore.js";
import { config } from "./config.js";
import { checkPostgres } from "./postgresStore.js";

type InstanceTarget = {
  name: string;
  url: string;
};

export type LocalInstanceHealth = {
  ok: boolean;
  name: string;
  hostname: string;
  pid: number;
  uptimeSeconds: number;
  checkedAt: string;
};

const nowIso = () => new Date().toISOString();

export const localInstanceHealth = (): LocalInstanceHealth => ({
  ok: true,
  name: config.appInstanceName,
  hostname: os.hostname(),
  pid: process.pid,
  uptimeSeconds: Math.round(process.uptime()),
  checkedAt: nowIso()
});

export const parseInstanceTargets = (value: string, fallbackPort = config.port): InstanceTarget[] => {
  const configured = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const separator = entry.indexOf("=");
      if (separator === -1) {
        return {
          name: `instance-${index + 1}`,
          url: entry
        };
      }

      return {
        name: entry.slice(0, separator).trim() || `instance-${index + 1}`,
        url: entry.slice(separator + 1).trim()
      };
    })
    .filter((target) => target.url.length > 0);

  return configured.length > 0
    ? configured
    : [{ name: config.appInstanceName, url: `http://127.0.0.1:${fallbackPort}/api/instance-health` }];
};

const checkInstance = async (target: InstanceTarget): Promise<AppInstanceHealth> => {
  const checkedAt = nowIso();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(target.url, { signal: controller.signal });
    const body = await response.json() as Partial<LocalInstanceHealth>;

    return {
      name: target.name,
      url: target.url,
      status: response.ok && body.ok ? "online" : "offline",
      checkedAt,
      uptimeSeconds: body.uptimeSeconds,
      hostname: body.hostname,
      pid: body.pid,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name: target.name,
      url: target.url,
      status: "offline",
      checkedAt,
      error: error instanceof Error ? error.message : "Instance check failed."
    };
  } finally {
    clearTimeout(timeout);
  }
};

const component = (
  name: string,
  status: ComponentHealth["status"],
  details: string
): ComponentHealth => ({
  name,
  status,
  details,
  checkedAt: nowIso()
});

export const buildSystemHealth = async (): Promise<SystemHealthResponse> => {
  const settings = await getEffectiveAppSettings();
  const components: ComponentHealth[] = [];

  try {
    await checkPostgres();
    components.push(component("PostgreSQL", "online", "Database connection and migrations are available."));
    components.push(component("pgvector", "online", "Vector extension health check passed."));
  } catch (error) {
    components.push(component(
      "PostgreSQL",
      "offline",
      error instanceof Error ? error.message : "Database health check failed."
    ));
    components.push(component("pgvector", "offline", "Vector extension could not be verified."));
  }

  components.push(component(
    "LLM provider",
    settings.openaiBaseUrl || settings.openaiApiKey ? "online" : "degraded",
    `${settings.llmModel} via ${settings.llmApiStyle}`
  ));
  components.push(component(
    "Embedding provider",
    settings.embeddingBaseUrl || settings.embeddingApiKey ? "online" : "degraded",
    settings.embeddingModel
  ));

  const instances = await Promise.all(parseInstanceTargets(config.appInstanceUrls).map(checkInstance));
  const ok = components.every((item) => item.status === "online") &&
    instances.length > 0 &&
    instances.every((instance) => instance.status === "online");

  return {
    ok,
    generatedAt: nowIso(),
    components,
    instances,
    models: {
      llm: settings.llmModel,
      embedding: settings.embeddingModel,
      llmApiStyle: settings.llmApiStyle
    }
  };
};
