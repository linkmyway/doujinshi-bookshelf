/**
 * Data model for the bookshelf (Drizzle-style table definitions).
 *
 * Invariants that matter:
 * - books.releaseDate is the colophon date of that edition; all ordering
 *   keys off it, never off upload/shelving dates.
 * - books.tags is the *card* projection: source-native tags intersected
 *   with the curator's fixed tag set.
 * - links.site is a closed enum; a book's links are replaced wholesale
 *   on update (read-modify-write with the full current record).
 */
import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Canonical name (romaji/English). Display names in other scripts are
   *  a frontend mapping, not data. */
  name: text("name").notNull(),
});

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id")
    .notNull()
    .references(() => authors.id),
  title: text("title").notNull(), // original-language title
  circle: text("circle").notNull().default(""),
  parody: text("parody").notNull().default(""),
  pages: integer("pages").notNull().default(0),
  /** YYYY-MM-DD from the edition's colophon (奥付); null = unverified. */
  releaseDate: text("release_date"),
  /** Card tags only — see file header. JSON array of English tag names. */
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  rating: integer("rating"), // owner's 1–5, null = unrated
  coverUrl: text("cover_url").notNull().default(""),
  /** Horizontal focal point (0–100, CSS object-position %) used to crop a
   *  landscape cover into the portrait shelf frame; null = centre crop. */
  coverFocusX: real("cover_focus_x"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id),
  site: text("site", {
    enum: ["dlsite", "nhentai", "ehentai", "other"],
  }).notNull(),
  language: text("language").notNull().default(""),
  url: text("url").notNull(),
});

/** Recommendation-inbox candidate (two-tier system). */
export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** A = fully vetted recommendation; B = passes every hard rule but is
   *  held only by curator confidence — `doubt` is then mandatory. */
  tier: text("tier", { enum: ["A", "B"] }).notNull(),
  authorName: text("author_name").notNull(),
  circle: text("circle").notNull().default(""),
  title: text("title").notNull(),
  pages: integer("pages").notNull().default(0),
  /** Tags from the work page's native tag list that hit the curator set. */
  hitTags: text("hit_tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  warningTags: text("warning_tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  rationale: text("rationale").notNull(),
  doubt: text("doubt").notNull().default(""), // required when tier = B
  /** Cover fetched server-side at intake and stored as an owned blob;
   *  cards never hotlink the remote host. */
  coverSrc: text("cover_src").notNull().default(""),
  sourceSite: text("source_site").notNull(),
  sourceId: text("source_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  /** True when the work can only be judged from its cover/store page. */
  storeOnly: integer("store_only", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["pending", "kept", "deleted"] })
    .notNull()
    .default("pending"),
  /** Set when status = kept: the shelf book this candidate became. */
  shelvedBookId: integer("shelved_book_id"),
  judgedAt: text("judged_at"),
  createdAt: text("created_at").notNull(),
});
