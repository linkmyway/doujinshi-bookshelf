/**
 * Two-tier recommendation inbox.
 *
 * Tier A "formal recommendation": passes every gate (hard exclusion
 * lines, work-page native-tag verification, art-style gate). Cap 3/day,
 * new-work window 30 days.
 *
 * Tier B "candidate dispatch": passes every hard line and ≥1 verified
 * native tag, but is held only by curator confidence — borderline art
 * (cover attached for the owner to judge), single-tag hit, older
 * high-fit work, untested author. A written doubt is mandatory.
 *
 * Verdicts are training samples: keep = strong positive, delete =
 * negative; both feed the next screening round's filter weights.
 */

export interface CandidateInput {
  tier: "A" | "B";
  authorName: string;
  circle?: string;
  title: string;
  pages: number;
  hitTags: string[]; // native tags ∩ curator set, verified on the work page
  warningTags?: string[];
  rationale: string;
  doubt?: string; // required for tier B
  sourceSite: string;
  sourceId: string;
  sourceUrl: string;
  storeOnly?: boolean;
}

export interface CandidateStore {
  findBySource(sourceSite: string, sourceId: string): Promise<{ id: number } | null>;
  insert(c: CandidateInput & { coverSrc: string }): Promise<number>;
  get(id: number): Promise<CandidateRecord | null>;
  markJudged(id: number, status: "kept" | "deleted", shelvedBookId?: number): Promise<void>;
  /** Find or create the author section; returns its id. */
  ensureAuthorSection(name: string): Promise<number>;
  addBook(b: {
    authorId: number;
    title: string;
    circle: string;
    pages: number;
    tags: string[];
    links: { site: string; language: string; url: string }[];
  }): Promise<number>;
  /** Cover bytes are fetched server-side at intake and stored as an
   *  owned blob — cards render the blob, never the remote host. */
  fetchCoverAsBlob(coverUrl: string): Promise<string>;
}

export interface CandidateRecord extends CandidateInput {
  id: number;
  status: "pending" | "kept" | "deleted";
  shelvedBookId: number | null;
}

export async function addCandidate(
  store: CandidateStore,
  input: CandidateInput,
  coverUrl: string,
): Promise<{ id: number; deduped: boolean }> {
  if (input.tier === "B" && !input.doubt?.trim()) {
    throw new Error("tier B candidates must state their doubt");
  }
  if (input.hitTags.length === 0) {
    throw new Error("a candidate must hit at least one verified native tag");
  }
  // Intake dedupe: the same source work never enters the strip twice.
  const existing = await store.findBySource(input.sourceSite, input.sourceId);
  if (existing) return { id: existing.id, deduped: true };

  const coverSrc = await store.fetchCoverAsBlob(coverUrl);
  const id = await store.insert({ ...input, coverSrc });
  return { id, deduped: false };
}

export async function judgeCandidate(
  store: CandidateStore,
  candidateId: number,
  verdict: "keep" | "delete",
): Promise<{ shelvedBookId?: number }> {
  const c = await store.get(candidateId);
  if (!c || c.status !== "pending") return {}; // judging is idempotent

  if (verdict === "delete") {
    await store.markJudged(candidateId, "deleted");
    return {};
  }

  // keep → formal shelving: into the author's section (created when the
  // author is new), carrying ONLY the hit taste tags (the shelf's card
  // projection), with the candidate's source link.
  const authorId = await store.ensureAuthorSection(c.authorName);
  const bookId = await store.addBook({
    authorId,
    title: c.title,
    circle: c.circle ?? "",
    pages: c.pages,
    tags: c.hitTags,
    links: [{ site: c.sourceSite, language: "", url: c.sourceUrl }],
  });
  await store.markJudged(candidateId, "kept", bookId);
  return { shelvedBookId: bookId };
}
