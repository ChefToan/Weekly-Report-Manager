import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getRedisClient } from './redis';

export type CacheScope = 'residents' | 'interactions' | 'stats' | 'reports-weekly';

const DEFAULT_TTLS: Record<CacheScope, number> = {
  residents: 60,
  interactions: 45,
  stats: 20,
  'reports-weekly': 30,
};

function key(parts: Array<string | number | undefined | null>) {
  return parts.filter(Boolean).join(':');
}

export async function getVersion(scope: CacheScope, userId: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;
  try {
    const v = await redis.get(key(['v', scope, userId]));
    return v ? parseInt(v, 10) : 0;
  } catch (error) {
    console.error('Redis getVersion error:', error);
    return 0;
  }
}

export async function bumpVersion(scope: CacheScope, userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.incr(key(['v', scope, userId]));
  } catch (error) {
    console.error('Redis bumpVersion error:', error);
  }
}

export async function getCachedJSON<T>(scope: CacheScope, parts: Array<string | number>, ttl?: number): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const k = key(['cache', scope, ...parts]);
    const data = await redis.get(k);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Redis getCachedJSON error:', error);
    return null;
  }
}

export async function setCachedJSON(scope: CacheScope, parts: Array<string | number>, value: unknown, ttl?: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const k = key(['cache', scope, ...parts]);
    const expire = ttl ?? DEFAULT_TTLS[scope];
    await redis.setex(k, expire, JSON.stringify(value));
  } catch (error) {
    console.error('Redis setCachedJSON error:', error);
  }
}

export function makeETag(parts: Array<string | number>): string {
  const h = crypto.createHash('sha1');
  h.update(parts.filter(Boolean).join('|'));
  return 'W/"' + h.digest('hex') + '"';
}

export function cacheHeaders(scope: CacheScope) {
  const ttl = DEFAULT_TTLS[scope];
  return {
    'Cache-Control': `private, max-age=${ttl}, stale-while-revalidate=${ttl * 4}`,
  } as Record<string, string>;
}

export function attachHeaders(res: NextResponse, headers: Record<string, string>) {
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

