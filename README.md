# Doujinshi Bookshelf — a curated personal collection shelf

## 中文说明

个人同人志收藏书架的实现方法开源版：作者分区书架、封面网格、内置阅读器与推荐收件箱是怎么做出来的。

- 实现文档：[`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md)（架构、数据模型、阅读器故障转移、两层推荐制、强制产品规则）
- 参考代码：[`reference/`](reference/)（数据模型、会话锁定的两级故障转移阅读器、两层候选裁决；`npm install && npm run typecheck` 可直接验）
- 本仓只有方法与脱敏说明；真实藏书数据、封面与个人信息不在本仓（存放在私有存档仓）

## 效果图 / Screenshots

运行中界面的实拍（2026-11-09）；封面图已作薄码处理，只保留版式与氛围：

![桌面端](docs/images/desktop.png)

![移动端](docs/images/mobile.png)

A personal web app for curating a doujinshi collection: author-sectioned
shelves, verified source links, an in-app reader with a two-source failover
chain, and a recommendation inbox where new finds wait for the owner's
keep/delete verdict before they join the shelf.

This repository open-sources the **implementation method** — architecture,
data model, and the operational rules that make the curation trustworthy.
The owner's collection data is **not** included (it lives in a private
archive); sample structures below are illustrative only.

## What it does

- **Shelves by author**, series grouped in volume order, newest first by
  verified release date (colophon date, never upload date).
- **Card discipline**: cards show only a small curator-defined tag set;
  everything else is metadata, not decoration.
- **Verified links only**: every link is checked against the source site's
  API before it is stored; nothing enters the catalogue unverified.
- **In-app reader** with a two-tier failover (primary gallery source →
  mirror source), locked per book per session so a reading session never
  flaps between sources.
- **Recommendation inbox**: a two-tier candidate strip on the homepage —
  tier A "fully vetted", tier B "passes every hard rule, one stated doubt" —
  each candidate persists until the owner judges it; verdicts feed back
  into the screening filters as training samples.
- **No in-app management UI** by design: the catalogue changes only
  through server actions executed by the curator agent.

## Design

- Light lavender palette (fixed; the shelf is never dark), CSS 3D book
  covers in a grid, mobile-first (3 covers per row), author directory as a
  bottom sheet.
- Hard mobile lessons baked in: no View Transitions (they froze the
  owner's WebView), and sandbox probes never substitute for the owner's
  real-device verdict.

## Implementation

See [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) for the data model,
the server-action surface, the reader/failover design, the candidate
inbox, and the operational rules (verification discipline, no unilateral
delisting, weekly five-part backup).

## Stack

React 19 + TypeScript, Tailwind CSS 4, TanStack React Query, Drizzle ORM,
server actions on a hosted full-stack space platform.

## Reference code

The [`reference/`](reference/) folder contains a reference
implementation of the core mechanisms, written from the documented
method (the production app runs on a hosted platform whose source is
not exportable).
