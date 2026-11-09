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

- Weekly automatic backup, five parts: catalogue JSON, a portability
  kit (data + design language, so the shelf can be re-implemented on a
  static blog stack), the bundled covers archive, the mirror mapping,
  and the failover plan. Old backups are kept.
- No unilateral delisting: the owner's designations stand; gates apply
  only at the shelving entrance, never retroactively.
