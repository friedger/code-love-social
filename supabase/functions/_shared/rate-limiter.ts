/**
 * Simple in-memory rate limiter for Edge Functions
 * 
 * Note: This uses in-memory storage which resets when the function cold starts.
 * For production with high traffic, consider Upstash Redis for persistent rate limiting.
 * 
 * The in-memory approach still provides protection against:
 * - Rapid-fire attacks within a single function instance
 * - Most brute force attempts
 * - Casual abuse
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage (shared within a single function instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Prefix for the rate limit key (e.g., "auth", "comments") */
  prefix: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check and update rate limit for an identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();
  
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  let entry = rateLimitStore.get(key);
  
  // If no entry or expired, create new one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
    
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment count
  entry.count++;
  
  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get the client IP from request headers
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  );
}

/**
 * Create a rate limit exceeded response
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded. Please try again later.",
      limit: result.limit,
      remaining: result.remaining,
      resetAt: new Date(result.resetAt).toISOString(),
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.resetAt.toString(),
      },
    }
  );
}

// ============= Pre-configured rate limits =============

export const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  authLogin: { limit: 10, windowSeconds: 900, prefix: "auth:login" }, // 10 per 15 min
  authCallback: { limit: 15, windowSeconds: 3600, prefix: "auth:callback" }, // 15 per hour
  authSession: { limit: 100, windowSeconds: 300, prefix: "auth:session" }, // 100 per 5 min
  authLogout: { limit: 20, windowSeconds: 3600, prefix: "auth:logout" }, // 20 per hour
  
  // Comment write operations - per user
  commentCreate: { limit: 30, windowSeconds: 3600, prefix: "comments:create" }, // 30 per hour
  commentDelete: { limit: 30, windowSeconds: 3600, prefix: "comments:delete" }, // 30 per hour
  commentReaction: { limit: 100, windowSeconds: 3600, prefix: "comments:reaction" }, // 100 per hour
  
  // Comment read operations - per IP (more generous)
  commentRead: { limit: 300, windowSeconds: 3600, prefix: "comments:read" }, // 300 per hour
  
  // Social operations - per user
  socialFollow: { limit: 50, windowSeconds: 3600, prefix: "social:follow" }, // 50 per hour
  socialUnfollow: { limit: 50, windowSeconds: 3600, prefix: "social:unfollow" }, // 50 per hour
  socialFollows: { limit: 100, windowSeconds: 3600, prefix: "social:follows" }, // 100 per hour
  socialRelationship: { limit: 200, windowSeconds: 3600, prefix: "social:relationship" }, // 200 per hour
  
  // Chainhook webhook - per IP
  chainhook: { limit: 100, windowSeconds: 3600, prefix: "chainhook" }, // 100 per hour
} as const;
