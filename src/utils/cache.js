/**
 * In-Memory TTL Cache for NexBill Backend
 * Provides fast caching for read-heavy operations (reports, dashboards, invoice listings)
 * with targeted invalidation on data mutations to guarantee consistency.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
    // Periodically evict expired keys every 60 seconds
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired();
    }, 60 * 1000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Retrieve a value by key. Returns null if missing or expired.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Set a value with a Time-To-Live in seconds (default: 3 minutes).
   */
  set(key, value, ttlSeconds = 180) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete an exact key.
   */
  del(key) {
    this.store.delete(key);
  }

  /**
   * Delete all keys that start with a given prefix.
   */
  delByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Delete all keys containing a specific business ID.
   */
  flushBusiness(businessId) {
    const pattern = `:${businessId}:`;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Invalidate all sales, reports, and dashboard caches for a business.
   */
  invalidateSales(businessId) {
    this.delByPrefix(`sales:${businessId}:`);
    this.delByPrefix(`report:${businessId}:`);
    this.delByPrefix(`dashboard:${businessId}:`);
  }

  /**
   * Invalidate all purchase, reports, and dashboard caches for a business.
   */
  invalidatePurchases(businessId) {
    this.delByPrefix(`purchase:${businessId}:`);
    this.delByPrefix(`report:${businessId}:`);
    this.delByPrefix(`dashboard:${businessId}:`);
  }

  /**
   * Invalidate all reports and dashboards for a business.
   */
  invalidateReports(businessId) {
    this.delByPrefix(`report:${businessId}:`);
    this.delByPrefix(`dashboard:${businessId}:`);
  }

  /**
   * Invalidate party lists/dropdowns.
   */
  invalidateParties(businessId) {
    this.delByPrefix(`party:${businessId}:`);
    this.delByPrefix(`report:${businessId}:`);
  }

  /**
   * Invalidate inventory/stock caches.
   */
  invalidateInventory(businessId) {
    this.delByPrefix(`inventory:${businessId}:`);
    this.delByPrefix(`report:${businessId}:`);
    this.delByPrefix(`dashboard:${businessId}:`);
  }

  /**
   * Purge expired keys.
   */
  purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear entire cache.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Debug stats.
   */
  getStats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

const cache = new MemoryCache();
export default cache;
export { cache };

