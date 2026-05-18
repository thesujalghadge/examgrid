import type { ConnectionOptions } from "bullmq";
import { getIntelligenceEnv } from "@/intelligence/config/env";

let connection: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!connection) {
    const url = new URL(getIntelligenceEnv().redisUrl);
    connection = {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      maxRetriesPerRequest: null,
    };
  }
  return connection;
}

export function isRedisConfigured(): boolean {
  return Boolean(getIntelligenceEnv().redisUrl);
}
