import { Redis } from "@upstash/redis";
import IORedis from "ioredis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

function createUpstashRedis(): Redis {
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
    );
  }
  return new Redis({ url, token });
}

let upstashClient: Redis | null = null;

export function getRedis(): Redis {
  if (!upstashClient) {
    upstashClient = createUpstashRedis();
  }
  return upstashClient;
}

export function getRedisConnection(): Redis {
  return getRedis();
}

const LOCAL_REDIS = "redis://127.0.0.1:6379";

let bullmqConnection: IORedis | null = null;

export function getBullMQConnection(): IORedis {
  if (!bullmqConnection) {
    let redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      redisUrl = LOCAL_REDIS;
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          "[BullMQ] REDIS_URL not set; using local Redis at 127.0.0.1:6379. Start Redis locally or set REDIS_URL (e.g. Upstash Redis Connect URL)."
        );
      }
    }
    if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
      throw new Error(
        "REDIS_URL must be the Redis Connect (TCP) URL, not the REST URL. In Upstash dashboard open your Redis → Redis Connect and copy the URL (starts with rediss://). For local dev use redis://127.0.0.1:6379."
      );
    }
    bullmqConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return bullmqConnection;
}
