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

let bullmqConnection: IORedis | null = null;

export function getBullMQConnection(): IORedis {
  if (!bullmqConnection) {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      throw new Error(
        "REDIS_URL must be set for BullMQ. Use the Redis Connect (TCP) URL from Upstash, e.g. rediss://default:PASSWORD@xxx.upstash.io:6379"
      );
    }
    if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
      throw new Error(
        "REDIS_URL must be the Redis Connect (TCP) URL, not the REST URL. In Upstash dashboard open your Redis → Redis Connect and copy the URL (starts with rediss://). Replace REDIS_URL in .env with that value."
      );
    }
    bullmqConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return bullmqConnection;
}
