# Implementation method

## Data model

```
authors    (id, name)
books      (id, authorId, title, circle, parody, pages, releaseDate,
            tags[], favorite, rating, coverUrl, coverFocusX)
links      (id, bookId, site, language, url)
candidates (id, tier, hitTags[], warningTags[], rationale, doubt,
            coverSrc, sourceSite, sourceId, sourceUrl, storeOnly,
            status, shelvedBookId)
```

Rules that matter more than the schema:

- `releaseDate` is the date printed in the work's own colophon. Sorting,
  "new release" windows, and series ordering all key off it — never off
  upload or shelving dates.
- `tags` on a book are the *card* tags: a filtered projection of the
  source site's native tag list, intersected with the curator's fixed
  tag set. A work matching none of the set does not get shelved.
- `updatebook`-style writes replace the whole record including links;
  callers must pass the full current record (read-modify-write), which
  prevents partial updates from silently dropping links.

## Server actions (pattern)

- Catalogue reads are one aggregate call (`getshelf`) returning sections
  with books and links, ordered server-side.
- All mutations are discrete actions (add/update/delete book, favorite,
  rating, release date, cover focus). There is deliberately **no**
  management UI in the app; mutations are executed by the curator agent
  through these actions, so every change is intentional and auditable.

## Verification discipline

- A link is stored only after the curator personally verifies it against
  the source's API (title, language, native tags). Keyword search hits
  are *candidates*, never evidence — one early misfire came from
  shelving on a keyword hit whose work-page tags did not contain the
  claimed tag.
- Delegated link research is untrusted until re-verified the same way.

## Reader and failover

- Pages are relayed through the server from the primary source's API
  (correct `Referer`, current API version); page images are never
  stored.
- A per-book mirror mapping (primary id → mirror id) is prepared
  offline in advance, so failover is a lookup, not a search.
- **Session lock**: within one reading session for one book, the source
  may only escalate downward (primary → mirror), never back up. A fresh
  session starts at the primary again. Books without a mirror mapping
  degrade to a "retry later" prompt.
- Mirror image URLs are derived (obfuscated path derivation with a
  short-lived cached derivation script, refresh-once-on-404); the CDN
  host is a configuration value, not a constant.

## Recommendation inbox (two tiers)

- Tier A: passes every gate — hard exclusion lines, native-tag
  verification, art-style gate. Capped per day; new-work window 30 days.
- Tier B: passes every hard line and ≥1 verified native tag, but is held
  only by curator confidence — borderline art (cover attached for the
  owner to judge), single-tag hits, older high-fit works (labelled as
  such), untested authors. Each carries a mandatory written doubt.
- The strip renders only when non-empty; candidates persist until
  judged; judging is also possible from inside the reader.
- `keep` shelves the work (new author → new section automatically) and
  counts as a strong positive sample; `delete` counts as a negative
  sample. Both feed the next screening round's filter weights.

## Covers

- Portrait covers are used as-is; landscape covers store a focal point
  (`coverFocusX`, a horizontal percentage) instead of a blind centre
  crop — landscape doujinshi covers are often composites (real cover on
  one side, sample panels on the other), so saliency-based auto-crops
  get a human-verified focal table.
- Cover bytes are bundled with the client, never hotlinked. Candidate
  covers are fetched server-side at intake and stored as owned blobs.

## Operations

- Daily GitHub sync instead of backups (the backup regime was retired
  on 2026-11-10: the space itself is a closed platform and cannot be
  backed up): current data and implementation materials are written
  into the private archive + this public repo every night — catalogue
  via the live actions, the covers bundle, the portability kit, the
  mirror mapping and the failover plan all ride the same sync.
- No unilateral delisting: the owner's designations stand; gates apply
  only at the shelving entrance, never retroactively.

## CSS 3D book effect

- Pure CSS 3D — no WebGL, no image assets. `.book3d` is a
  preserve-3d solid of four faces: the front cover at
  `translateZ(d)`, the spine on the left (`rotateY(-90deg)`), the
  page block on the right (`rotateY(90deg)`) and along the bottom
  (`rotateX(-90deg)`). `--book-d` is the half-thickness, driven by
  page count: total depth `clamp(16, 12 + pages/8, 34)` px, or 19px
  when the page count is unknown.
- Stage chain: the grid shares one `perspective: 1500px` (a whole
  row reads as one viewpoint); each `.book-stage` carries its own
  1100px perspective. Ancestry contract: no filter,
  backdrop-filter, transform or overflow clipping may sit between
  the stage and the book — any of them flattens preserve-3d and
  the book silently collapses into a flat card.
- Spine colour is a deterministic palette: a string hash of
  `id:title` modulo 8 deep cloth tones, never stored, stable
  across renders. Page edges are a `repeating-linear-gradient`
  (2px paper / 1px seam), not an image.
- Every state is a single transform on the book itself: resting
  `rotateY(13deg)` (spine showing), tap adds `.book3d-pulled`
  (-21deg swing-out, ~170ms before the detail opens), the random
  draw uses flash / final states. The tap target never transforms,
  so the preserve-3d chain survives mid-gesture. The ground
  contact shadow sits outside the 3D element, flat on the stage.
- Reference code: `reference/book-3d.css` (the production
  stylesheet, extracted) and `reference/book-3d.ts` (thickness,
  palette, state transforms) — byte-identical in the private
  archive and this public repo, updated together.
- Under `prefers-reduced-motion` all of it turns off and the
  books degrade to flat static covers.

## Features and implementation, in detail

Feature by feature: what it does, how it is built, and where its edges
are. Where this section and earlier summaries differ, this section
governs.

### Author-sectioned shelf

- What: the whole collection is presented in author sections (the
  shelf displays a Japanese name per author from a front-end mapping;
  the database keeps the English/romaji name canonical), each section
  holding that author's books.
- How: one aggregate read returns everything (sections, books, links,
  favourite/rating state). Ordering is a server-side rule: sections
  A–Z by author; inside a section, series form volume blocks, and
  blocks and standalones sort by **colophon release date**, newest
  first (unknown dates sort last). There is no separate "add author"
  action — a kept candidate creates its section automatically (see
  the inbox below).
- Edges: all catalogue change goes through server actions executed by
  the curator; the app has no management UI.

### Cover grid and card discipline

- What: a cover grid (3 per row on mobile); a card shows only the
  Japanese title, author, page count and a small tag set.
- How: card tags are a **card-layer filter** — the book's full native
  tag set lives in metadata, but cards render only the curator-defined
  tag subset (two near-synonym tags are merged under one display tag).
  Editions of the same work (original + translation) merge into one
  book with per-language links.
- Edges: screening gates (art style, adult presentation) are enforced
  before shelving by verifying each work page's native tags — never
  at the card layer, and never by keyword hit alone.

### Cover images

- What: one vertical cover per book; landscape composites are never
  used raw as covers.
- How: cover binaries are bundled into the client as local assets,
  never hotlinked. Vertical sources use the true cover; landscape
  sources are cropped to the vertical cover area via a stored focus
  value (`coverFocusX`) — landscape promo images are usually a
  "true cover + sample pages" composite and automatic saliency
  cropping picks the wrong side, so the focus table is human-verified
  per book. Books without cover art get a colour plaque from the
  deterministic palette (see the 3D section).
- Edges: the stored cover URL doubles as the local-cover match key;
  because `updatebook` replaces the whole record, callers must pass
  the cover fields explicitly (three books once lost their covers
  this way; a migration restored them and a "book with no cover
  source" alarm now guards the shelf).

### Book detail

- What: tapping a book swings it out in 3D, then opens a detail sheet:
  a larger 3D book, title, circle, parody, pages, release date, card
  tags, links, favourite and rating controls.
- How: the detail book reuses the same `.book3d` system as the grid
  (its own `.book-stage` perspective), larger, with a wider ground
  shadow. Links follow the current one-source rule for display;
  historical rows keep their site enum. Favourite and rating are
  small dedicated mutations, reconciled by invalidating the shelf
  query.
- Edges: the detail never shows the full native tag set or the
  (deliberately emptied) free-text notes.

### In-space reader

- What: full-screen reading — tap zones / swipe / keyboard paging, a
  preloading window in both directions, double-tap zoom, thumbnail
  placeholders first.
- How: pages are never stored; server actions relay them —
  `getreaderinfo` (page count + per-page paths), `getreaderpage`
  (fetches through the primary source's current API version with the
  correct Referer), `getreaderthumb`. The preload window slides with
  reading direction. Single-page mode uses the owner's page-turn
  ruling — left button = previous page, right = next page (not manga
  direction), keyboard in sync — and the page frame's top edge sits
  directly under the top bar.
- Edges: reading position is **not** persisted (the owner explicitly
  declined it). A source rate-limit (429) yields a "retry later"
  prompt, never a retry storm.

### Reader failover (primary → mirror)

- What: when the primary source can't serve a book mid-session, the
  same session continues on the mirror source.
- How: each book carries a pre-mapped mirror gallery id (a
  human-verified mapping, graded exact/probable). All page fetches go
  through one fetch layer: primary first, mirror on failure. The
  mirror side follows its worker plan: configurable CDN host, the
  URL-derivation script cached ~50 minutes with a single refresh on
  404, the reader Referer applied server-side, AVIF pages decoded
  natively by the browser.
- **Session lock (hard rule)**: within one book and one session the
  source may only escalate downward, never back up; a new session
  starts from the primary again. Unmapped books fall back to a
  "retry later" prompt — no third source is improvised.
- Edges: the mapping is maintained by hand, book by book (machine
  guesses are candidates only); a book that exists only inside a
  compilation gallery is recorded as manual-only and the reader never
  auto-matches it.

### Random draw

- What: a home-screen button draws one book at random — a highlight
  sweeps over covers, lands on the winner and swings it out in 3D.
- How: a pure front-end state machine: a flash state lights random
  covers in sequence (only an outline overlay's opacity animates,
  plus the book's flash transform), and the final state runs the
  draw-pulse keyframes (out to −28deg, settling at the −21deg pulled
  pose). The draw never auto-opens the detail; the owner taps.
- Edges: transform/opacity only; disabled under reduced motion.

### Recommendation inbox

- What: a candidate strip at the front of the homepage: the curator's
  new finds queue there; the owner reads and taps keep/delete; only
  keeps join the shelf.
- How: `addcandidate` stores the candidate — **its cover is fetched
  server-side at intake and stored as an owned blob**, so cards never
  hotlink source images. Entries carry a tier badge (A fully vetted /
  B passes all hard rules with one stated doubt), a one-line
  rationale, mandatory B-tier doubt text, warning tags and the
  discovery channel; store-only finds are marked. `judgecandidate`:
  keep shelves the work into its author section (creating the section
  for a new author) and records the shelved book id so re-judging
  never double-shelves; delete keeps the entry as a negative sample.
  Judging also works from the reader's bottom bar. Candidates never
  expire; an empty queue renders nothing.
- Edges: verdicts are training samples — keeps and deletes feed the
  daily screening's filter weights. Works presenting minors never
  enter even the strip; that gate sits before `addcandidate`.

### Author directory and navigation

- What: a bottom-sheet author directory (tap a name to jump to its
  section) and a back-to-top button.
- How: directory rows close the sheet and scroll to the section
  anchor. Back-to-top exists on the home view only — never over the
  detail sheet or the reader. The list view stays flat (3D is a
  grid-view treatment only).
- Edges: navigation positioning uses anchors + geometry, not
  per-frame callbacks (WebView throttling freezes those).

### Favourites and ratings

- What: a heart toggle (frosted-glass orb on the cover's corner) and
  a star rating in the detail.
- How: two narrow mutations touching only their field; state renders
  on the card (orb filled vs. greyed) and as a pill badge for the
  rating. There is no separate favourites page — favourite is a state
  on the book, not an information-architecture level.
- Edges: ratings clear by tapping the same star again (null).

### The action surface (UI-less catalogue management)

- What: every catalogue change there is.
- How: the server actions are the whole surface — shelf read, add /
  full-replace update / delete, favourite, rating, release date,
  cover focus, the candidate trio and the reader trio. The front-end
  has no add/edit/delete controls at all (the inbox's keep/delete is
  a verdict, not management).
- Edges: actions are invoked only through the published action
  channel by the curator. Bypassing them (direct database or file
  edits) is forbidden — link verification, cover storage and dedupe
  all live inside the actions.
