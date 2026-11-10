/**
 * book-3d.ts — the computable half of the CSS 3D book effect.
 * Pairs with book-3d.css in this folder (the stylesheet extracted
 * from production). The production component (React) renders:
 *
 *   <div className="book-stage">
 *     <span className="book-contact" />
 *     <button className="book-open-btn" onClick={swingThenOpen}>
 *       <span className="book3d" style={{ "--book-d": `${halfDepth}px` }}>
 *         <span className="book3d-face book3d-spine"
 *               style={{ background: spineBackground(paletteFor(book)) }} />
 *         <span className="book3d-face book3d-pages" />
 *         <span className="book3d-face book3d-bottom" />
 *         <span className="book3d-face book3d-front">{cover}</span>
 *       </span>
 *     </button>
 *   </div>
 *
 * Interaction states are pure transform changes on .book3d
 * (BOOK3D_STATE_TRANSFORMS mirrors the CSS): rest leans at
 * rotateY(13deg) so the spine shows; a tap adds .book3d-pulled for
 * ~170ms (the book swings out, page block toward the reader) and
 * only then opens the detail sheet; the random draw flashes covers
 * with .book3d-flash and lands the winner on .book3d-final.
 */

export interface CoverPalette {
  /** Spine / placeholder-cover background (a CSS gradient). */
  bg: string;
  ink: string;
  sub: string;
}

/**
 * Deep cloth-binding tones. A book's palette is picked
 * deterministically (paletteForSeed), so a book keeps its colour
 * across renders, sorts and sessions — no stored colour field.
 */
export const COVER_PALETTES: CoverPalette[] = [
  { bg: "linear-gradient(150deg,#8a3030,#5f1f1f)", ink: "#f3e3c2", sub: "#d9b98c" },
  { bg: "linear-gradient(150deg,#476b4f,#2e4a35)", ink: "#eef0d8", sub: "#bcc9a4" },
  { bg: "linear-gradient(150deg,#33506e,#20374f)", ink: "#e8eef2", sub: "#a9bfd2" },
  { bg: "linear-gradient(150deg,#8a5f24,#5f4118)", ink: "#f7ead0", sub: "#dec493" },
  { bg: "linear-gradient(150deg,#5d4470,#3e2c4e)", ink: "#efe6f5", sub: "#c3aed6" },
  { bg: "linear-gradient(150deg,#2f5d5a,#1d403e)", ink: "#e2f0ea", sub: "#a3c8bd" },
  { bg: "linear-gradient(150deg,#7c3450,#522336)", ink: "#f7e3ea", sub: "#d9a7ba" },
  { bg: "linear-gradient(150deg,#4c4c60,#30303f)", ink: "#eceaf2", sub: "#b3b0c4" },
];

/**
 * Deterministic palette pick: a Java-style string hash of the seed
 * modulo the palette size.
 *
 * @example
 * paletteForSeed("114:Some Title") === paletteForSeed("114:Some Title")
 * // → true, on every machine and every render.
 */
export function paletteForSeed(seed: string): CoverPalette {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(h) % COVER_PALETTES.length]!;
}

/** The seed is `id:title` — stable for the life of the book. */
export function paletteFor(book: { id: number; title: string }): CoverPalette {
  return paletteForSeed(`${book.id}:${book.title}`);
}

/**
 * The spine face's inline background: a lighting gradient (dark
 * edges, a lit band at 45%) laid over the palette's cloth tone.
 * The finer sheen lives in CSS (.book3d-spine::after).
 */
export function spineBackground(palette: CoverPalette): string {
  return `linear-gradient(90deg, rgba(0,0,0,0.44), rgba(255,255,255,0.13) 45%, rgba(0,0,0,0.36)), ${palette.bg}`;
}

/**
 * Half-thickness of the 3D book in px — the value written to the
 * --book-d custom property. Total depth runs 16px for a slim
 * volume to 34px for the fattest: depth = clamp(16, 12 + pages/8,
 * 34). Books with an unknown page count get a neutral 19px total.
 *
 * @example
 * halfDepthForPages(36)  // → 8.25  (16.5px total)
 * halfDepthForPages(200) // → 17    (34px total, clamped)
 * halfDepthForPages(null) // → 9.5  (19px total)
 */
export function halfDepthForPages(pages: number | null | undefined): number {
  return pages != null ? Math.min(34, Math.max(16, 12 + pages / 8)) / 2 : 9.5;
}

/** The .book3d transform per interaction state (mirrors book-3d.css). */
export const BOOK3D_STATE_TRANSFORMS = {
  rest: "perspective(850px) rotateY(13deg)",
  hover: "perspective(850px) rotateY(20deg) translateY(-4px)",
  active: "perspective(850px) rotateY(7deg) scale(0.97)",
  pulled: "perspective(850px) rotateY(-21deg) translateY(-9px) scale(1.06)",
  flash: "perspective(850px) rotateY(24deg) scale(1.05)",
} as const;

export type Book3dState = keyof typeof BOOK3D_STATE_TRANSFORMS;
