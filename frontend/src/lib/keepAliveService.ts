import * as cron from 'node-cron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { log } from './logger';

// Multiple API sources for reliability
const API_SOURCES = [
  {
    name: 'Dog CEO',
    url: 'https://dog.ceo/api/breeds/image/random',
    extractUrl: (data: Record<string, unknown>) => data.message as string,
  },
  {
    name: 'Random Fox',
    url: 'https://randomfox.ca/floof/',
    extractUrl: (data: Record<string, unknown>) => data.image as string,
  },
  {
    name: 'The Cat API',
    url: 'https://api.thecatapi.com/v1/images/search',
    extractUrl: (data: unknown) => Array.isArray(data) ? (data[0] as Record<string, unknown>)?.url as string : null,
  },
];

let isRunning = false;
let cronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Fetches a random image from multiple API sources with retry logic
 */
async function fetchImageFromAPIs(): Promise<{ url: string; source: string } | null> {
  for (const source of API_SOURCES) {
    try {
      log.info(`[Keep-Alive] Attempting to fetch from ${source.name}`);

      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        log.warn(`[Keep-Alive] ${source.name} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const imageUrl = source.extractUrl(data);

      if (imageUrl && typeof imageUrl === 'string') {
        log.info(`[Keep-Alive] Successfully fetched from ${source.name}`, { imageUrl });
        return { url: imageUrl, source: source.name };
      } else {
        log.warn(`[Keep-Alive] ${source.name} returned invalid data`);
      }
    } catch (error) {
      log.error(`[Keep-Alive] Error fetching from ${source.name}`, { error: String(error) });
    }
  }

  log.error('[Keep-Alive] All API sources failed');
  return null;
}

/**
 * Cleans up old photo entries (older than 7 days)
 */
async function cleanupOldPhotos(supabase: SupabaseClient): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('refresh_photos')
      .delete()
      .lt('fetched_at', cutoffDate.toISOString())
      .select();

    if (error) {
      log.error('[Keep-Alive] Error cleaning up old photos', { error: error.message });
    } else if (data && data.length > 0) {
      log.info(`[Keep-Alive] Cleaned up ${data.length} old photo entries`);
    }
  } catch (error) {
    log.error('[Keep-Alive] Photo cleanup error', { error: String(error) });
  }
}

/**
 * Cleans up expired sessions and used/expired password reset tokens
 */
async function cleanupExpiredAuth(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();

  try {
    // Delete expired sessions
    const { data: expiredSessions, error: sessionError } = await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (sessionError) {
      log.error('[Keep-Alive] Error cleaning up expired sessions', { error: sessionError.message });
    } else if (expiredSessions && expiredSessions.length > 0) {
      log.info(`[Keep-Alive] Cleaned up ${expiredSessions.length} expired sessions`);
    }

    // Delete expired password reset tokens (tokens expire in 1 hour, cleanup runs daily)
    const { data: expiredTokens, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (tokenError) {
      log.error('[Keep-Alive] Error cleaning up expired tokens', { error: tokenError.message });
    } else if (expiredTokens && expiredTokens.length > 0) {
      log.info(`[Keep-Alive] Cleaned up ${expiredTokens.length} expired reset tokens`);
    }

    // Delete expired and unused registration codes
    const { data: expiredCodes, error: codeError } = await supabase
      .from('registration_codes')
      .delete()
      .eq('is_used', false)
      .lt('expires_at', now)
      .select('id');

    if (codeError) {
      log.error('[Keep-Alive] Error cleaning up expired registration codes', { error: codeError.message });
    } else if (expiredCodes && expiredCodes.length > 0) {
      log.info(`[Keep-Alive] Cleaned up ${expiredCodes.length} expired registration codes`);
    }
  } catch (error) {
    log.error('[Keep-Alive] Auth cleanup error', { error: String(error) });
  }
}

/**
 * Main keep-alive function that fetches and saves data.
 * @param forceRun - If true, always fetch a photo regardless of last fetch time (used on startup).
 *                   If false, only fetch if it's been more than 12 hours since the last fetch (used by cron).
 */
async function keepDatabaseActive(forceRun = false): Promise<void> {
  if (isRunning) {
    log.info('[Keep-Alive] Skipping - already running');
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.error('[Keep-Alive] Missing required environment variables');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  log.info('[Keep-Alive] Starting keep-alive process', { forceRun });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Always run auth cleanup
    await cleanupExpiredAuth(supabase);

    // Check last fetch time for photo keep-alive
    const { data: lastPhoto } = await supabase
      .from('refresh_photos')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    const now = new Date();
    const lastFetchTime = lastPhoto ? new Date(lastPhoto.fetched_at) : null;
    const hoursSinceLastFetch = lastFetchTime
      ? (now.getTime() - lastFetchTime.getTime()) / (1000 * 60 * 60)
      : Infinity;

    log.info(`[Keep-Alive] Hours since last photo fetch: ${hoursSinceLastFetch === Infinity ? 'never' : hoursSinceLastFetch.toFixed(2)}`);

    // On startup (forceRun), always fetch to guarantee DB activity.
    // On cron runs, skip if fetched within the last 12 hours to avoid excessive writes.
    if (!forceRun && hoursSinceLastFetch < 12) {
      log.info(`[Keep-Alive] Skipping photo fetch - last fetch was ${hoursSinceLastFetch.toFixed(2)} hours ago (cron will retry later)`);
      isRunning = false;
      return;
    }

    log.info(`[Keep-Alive] Fetching new photo...${forceRun ? ' (startup)' : ' (scheduled)'}`);

    // Fetch image from APIs
    const result = await fetchImageFromAPIs();

    if (!result) {
      log.error('[Keep-Alive] Failed to fetch image from all sources');
      isRunning = false;
      return;
    }

    // Clean up old photos first
    await cleanupOldPhotos(supabase);

    // Insert new photo
    const { error: insertError } = await supabase
      .from('refresh_photos')
      .insert({
        image_url: result.url,
        source_name: result.source,
        fetched_at: now.toISOString(),
      })
      .select();

    if (insertError) {
      log.error('[Keep-Alive] Error inserting photo data', { error: insertError.message });
    } else {
      log.info(`[Keep-Alive] Successfully saved new image from ${result.source}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(`[Keep-Alive] Completed in ${duration}s`);

  } catch (error) {
    log.error('[Keep-Alive] Fatal error', { error: String(error) });
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the cron job - runs every 24 hours
 */
export function startKeepAlive(): void {
  if (cronJob) {
    log.info('[Keep-Alive] Cron job already running');
    return;
  }

  log.info('[Keep-Alive] Starting keep-alive service');
  // Always fetch on startup to guarantee DB activity
  keepDatabaseActive(true).catch((err) => log.error('[Keep-Alive] Initial run error', { error: String(err) }));

  // Schedule to run every 24 hours at 12:00 AM Arizona Time
  cronJob = cron.schedule('0 0 0 * * *', () => {
    log.info('[Keep-Alive] Scheduled execution triggered');
    keepDatabaseActive(false).catch((err) => log.error('[Keep-Alive] Scheduled run error', { error: String(err) }));
  }, {
    timezone: "America/Phoenix"
  });

  log.info('[Keep-Alive] Cron job scheduled - will run daily at 12:00 AM Arizona Time');
}

/**
 * Stops the cron job
 */
export function stopKeepAlive(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    log.info('[Keep-Alive] Cron job stopped');
  }
}
