import * as cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

// Multiple API sources for reliability
const API_SOURCES = [
  {
    name: 'Dog CEO',
    url: 'https://dog.ceo/api/breeds/image/random',
    extractUrl: (data: any) => data.message,
  },
  {
    name: 'Random Fox',
    url: 'https://randomfox.ca/floof/',
    extractUrl: (data: any) => data.image,
  },
  {
    name: 'The Cat API',
    url: 'https://api.thecatapi.com/v1/images/search',
    extractUrl: (data: any) => Array.isArray(data) ? data[0]?.url : null,
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
      console.log(`[Keep-Alive] Attempting to fetch from ${source.name}...`);

      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.error(`[Keep-Alive] ${source.name} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const imageUrl = source.extractUrl(data);

      if (imageUrl && typeof imageUrl === 'string') {
        console.log(`[Keep-Alive] Successfully fetched from ${source.name}: ${imageUrl}`);
        return { url: imageUrl, source: source.name };
      } else {
        console.error(`[Keep-Alive] ${source.name} returned invalid data`);
      }
    } catch (error) {
      console.error(`[Keep-Alive] Error fetching from ${source.name}:`, error);
    }
  }

  console.error('[Keep-Alive] All API sources failed');
  return null;
}

/**
 * Cleans up old entries (older than 7 days)
 */
async function cleanupOldData(supabase: any): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const { data, error } = await supabase
      .from('refresh_photos')
      .delete()
      .lt('fetched_at', cutoffDate.toISOString())
      .select();

    if (error) {
      console.error('[Keep-Alive] Error cleaning up old data:', error);
    } else if (data && data.length > 0) {
      console.log(`[Keep-Alive] Cleaned up ${data.length} old entries`);
    }
  } catch (error) {
    console.error('[Keep-Alive] Cleanup error:', error);
  }
}

/**
 * Main keep-alive function that fetches and saves data
 */
async function keepDatabaseActive(): Promise<void> {
  if (isRunning) {
    console.log('[Keep-Alive] Skipping - already running');
    return;
  }

  // Check if required environment variables are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Keep-Alive] Missing required environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in frontend/.env');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log(`[Keep-Alive] Starting keep-alive process at ${new Date().toISOString()}`);

  try {
    // Initialize Supabase client
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

    // Check last fetch time
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
      : 25;

    console.log(`[Keep-Alive] Hours since last fetch: ${hoursSinceLastFetch.toFixed(2)}`);

    // Only fetch if it's been more than 24 hours
    if (hoursSinceLastFetch < 24) {
      console.log(`[Keep-Alive] Skipping - last fetch was ${hoursSinceLastFetch.toFixed(2)} hours ago`);
      isRunning = false;
      return;
    }

    // Fetch image from APIs
    const result = await fetchImageFromAPIs();

    if (!result) {
      console.error('[Keep-Alive] Failed to fetch image from all sources');
      isRunning = false;
      return;
    }

    // Clean up old data first
    await cleanupOldData(supabase);

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
      console.error('[Keep-Alive] Error inserting data:', insertError);
    } else {
      console.log(`[Keep-Alive] Successfully saved new image from ${result.source} to database`);

      // Verify database count
      const { count } = await supabase
        .from('refresh_photos')
        .select('*', { count: 'exact', head: true });

      console.log(`[Keep-Alive] Total entries in database: ${count}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Keep-Alive] Completed in ${duration}s`);

  } catch (error) {
    console.error('[Keep-Alive] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the cron job - runs every 24 hours
 */
export function startKeepAlive(): void {
  if (cronJob) {
    console.log('[Keep-Alive] Cron job already running');
    return;
  }

  // Run immediately on startup
  console.log('[Keep-Alive] Starting keep-alive service...');
  keepDatabaseActive().catch(console.error);

  // Schedule to run every 24 hours at 12:00 AM Arizona Time
  // Format: second minute hour day month weekday
  cronJob = cron.schedule('0 0 0 * * *', () => {
    console.log('[Keep-Alive] Scheduled execution triggered');
    keepDatabaseActive().catch(console.error);
  }, {
    timezone: "America/Phoenix" // Arizona Time (no DST)
  });

  console.log('[Keep-Alive] Cron job scheduled - will run daily at 12:00 AM Arizona Time');
}

/**
 * Stops the cron job
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function stopKeepAlive(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[Keep-Alive] Cron job stopped');
  }
}

/**
 * Force run the keep-alive process (for testing)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function forceRun(): Promise<void> {
  console.log('[Keep-Alive] Force running keep-alive...');
  return keepDatabaseActive();
}