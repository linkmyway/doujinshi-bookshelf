/**
 * In-space reader with a two-tier failover chain:
 *   L1 primary gallery API  →  L2 mirror (pre-mapped ids)
 *
 * Hard rule — session lock: within one reading session for one book the
 * source may only escalate DOWN (primary → mirror), never back up.
 * A fresh session starts at the primary again. Books without a mirror
 * mapping degrade to a "retry later" result instead of an error.
 *
 * Page images are relayed through the server and never stored.
 */

export type SourceTier = "primary" | "mirror";

export interface PageImage {
  /** Relayed data URL (or proxied URL) for one page. Relay only. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface ReaderInfo {
  pageCount: number;
  /** Per-page dimensions, so the reader knows the book's shape upfront. */
  dimensions: { width: number; height: number }[];
  tier: SourceTier;
}

export type ReaderError =
  | { kind: "rate_limited"; retryAfterSec?: number } // HTTP 429 upstream
  | { kind: "unavailable" }; // both tiers failed / no mapping

export interface PrimaryApi {
  /** Resolve a gallery id to its shape via the primary API (v2). */
  getGallery(galleryId: string): Promise<{
    pageCount: number;
    mediaId: string;
    pages: { path: string; width: number; height: number }[];
  }>;
  /** Fetch one page's original bytes (correct Referer set server-side). */
  fetchPage(mediaId: string, path: string): Promise<Uint8Array>;
  fetchThumb(mediaId: string, path: string): Promise<Uint8Array>;
}

export interface MirrorApi {
  /** Derive and fetch one page from the mirror (see CF-HITOMI-PLAN:
   *  obfuscated path derivation, ~50 min derivation cache,
   *  refresh-once-on-404, configurable CDN host, AVIF decode). */
  fetchPage(mirrorGalleryId: number, page: number): Promise<Uint8Array>;
  getPageCount(mirrorGalleryId: number): Promise<number>;
}

/** Per-book mirror mapping, prepared offline: primary id → mirror id. */
export type MirrorMap = Map<string, { mirrorId: number; confidence: "exact" | "probable" }>;

const base64 = (bytes: Uint8Array, mime = "image/jpeg") =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

export class ReaderSession {
  /** The locked tier for this (book, session). Only ever moves down. */
  private tier: SourceTier = "primary";
  private info: ReaderInfo | null = null;

  constructor(
    private readonly primaryId: string,
    private readonly mirror: MirrorMap,
    private readonly primary: PrimaryApi,
    private readonly mirrorApi: MirrorApi,
  ) {}

  private async escalate(): Promise<boolean> {
    if (this.tier !== "primary") return false;
    const m = this.mirror.get(this.primaryId);
    // "probable" mappings that live only inside a compilation are
    // manual-only and must not be used by automatic failover.
    if (!m || m.confidence !== "exact") return false;
    this.tier = "mirror"; // locked for the rest of the session
    return true;
  }

  async getInfo(): Promise<ReaderInfo | ReaderError> {
    if (this.info) return this.info;
    try {
      const g = await this.primary.getGallery(this.primaryId);
      this.info = {
        pageCount: g.pageCount,
        dimensions: g.pages.map((p) => ({ width: p.width, height: p.height })),
        tier: "primary",
      };
      return this.info;
    } catch (e) {
      if (isRateLimited(e)) return { kind: "rate_limited" };
      if (await this.escalate()) {
        const m = this.mirror.get(this.primaryId)!;
        const pageCount = await this.mirrorApi.getPageCount(m.mirrorId);
        this.info = { pageCount, dimensions: [], tier: "mirror" };
        return this.info;
      }
      return { kind: "unavailable" };
    }
  }

  /** Page is 1-based. */
  async getPage(page: number): Promise<PageImage | ReaderError> {
    const info = await this.getInfo();
    if ("kind" in info) return info;
    try {
      if (this.tier === "primary") {
        const g = await this.primary.getGallery(this.primaryId);
        const p = g.pages[page - 1];
        const bytes = await this.primary.fetchPage(g.mediaId, p.path);
        return { dataUrl: base64(bytes), width: p.width, height: p.height };
      }
      const m = this.mirror.get(this.primaryId)!;
      const bytes = await this.mirrorApi.fetchPage(m.mirrorId, page);
      const dim = info.dimensions[page - 1] ?? { width: 0, height: 0 };
      return { dataUrl: base64(bytes, "image/avif"), ...dim };
    } catch (e) {
      if (isRateLimited(e)) return { kind: "rate_limited" };
      // Mid-session failure on the primary escalates once, then retries
      // this page on the mirror. On the mirror there is nowhere to go.
      if (this.tier === "primary" && (await this.escalate())) {
        return this.getPage(page);
      }
      return { kind: "unavailable" };
    }
  }
}

function isRateLimited(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status?: number }).status === 429
  );
}
