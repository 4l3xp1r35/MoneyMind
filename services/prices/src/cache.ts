import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: Redis | null = null;

function getClient(): Redis | null {
  if (!client) {
    try {
      client = new Redis(REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null, // don't retry — cache is optional
      });
      client.on("error", (err: Error) => {
        console.warn("[cache] Redis unavailable:", err.message);
        client = null;
      });
    } catch {
      return null;
    }
  }
  return client;
}

export async function getFromCache(key: string): Promise<string | null> {
  try {
    return (await getClient()?.get(key)) ?? null;
  } catch {
    return null;
  }
}

export async function setCache(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  try {
    await getClient()?.setex(key, ttlSeconds, value);
  } catch {
    // cache miss is acceptable
  }
}
