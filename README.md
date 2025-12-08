# Meta Ads Library Scraper

A production-style Node.js + TypeScript scraper for the **Meta (Facebook) Ads Library** using **Puppeteer + Stealth** and **GraphQL interception**.

> Built by **Theo Georgewill**

This project automates the process of:

* Fetching ads from the Meta Ads Library for a given `page_id`
* Storing each ad as structured JSON on disk
* Keeping the local data in sync with the live library via incremental sync
* Detecting breaking changes via unit tests against real GraphQL-like fixtures

It is designed to look, feel, and behave like something you would confidently run in a real system.

---

## Features

* **Puppeteer + Stealth**
  * Uses `puppeteer-extra` and `puppeteer-extra-plugin-stealth` to reduce bot detection.

* **GraphQL response interception**
  * Listens to network responses and extracts ads from Facebook's internal GraphQL API.

* **Modern API support (2023–2025)**
  * Handles the latest `ad_library_main → search_results_connection → edges → node → collated_results` structure.

* **Fallback support for older formats**
  * Also reads legacy `ad_library` / `ad_library_page` formats if present.

* **Local JSON database**
  * Stores ads under `data/{page_id}/ads/{ad_archive_id}.json`.
  * Stores page metadata in `data/{page_id}/page-meta.json`.

* **Initial sync + incremental sync**
  * Initial sync pulls all ads (active + inactive) for a page.
  * Incremental sync fetches only new/updated ads and keeps fields like `is_active` and `end_date` up-to-date.

* **Unit tests**
  * Tests for extracting ads from GraphQL payloads.
  * Tests for saving/loading ads from the local DB.

---

## Tech Stack

* **Runtime:** Node.js
* **Language:** TypeScript
* **Automation:** Puppeteer, puppeteer-extra, stealth plugin
* **Testing:** Jest + ts-jest
* **Storage:** Local JSON files grouped by `page_id`

---

## Project Structure

```text
meta-ads-library-scraper/
├─ data/                      # Output data (generated at runtime)
│  └─ {page_id}/
│     ├─ ads/                 # One JSON file per ad
│     └─ page-meta.json       # Metadata for that page
├─ src/
│  ├─ cli/
│  │  ├─ initialSyncCli.ts    # CLI wrapper for initial sync
│  │  └─ incrementalSyncCli.ts# CLI wrapper for incremental sync
│  ├─ db/
│  │  └─ localDb.ts           # JSON-based local DB helpers
│  ├─ scraper/
│  │  ├─ scrapeCore.ts        # Puppeteer + GraphQL interception + scroll loop
│  │  ├─ initialSync.ts       # initialSync(url, max?) implementation
│  │  ├─ incrementalSync.ts   # incrementalSync(pageId) implementation
│  │  └─ extractAds.ts        # extractAdsFromPayload, getAdId, getPageId
│  ├─ tests/
│  │  ├─ fixtures/
│  │  │  └─ sampleGraphResponse.json  # Realistic GraphQL fixture
│  │  ├─ extractAds.test.ts   # Tests payload extraction logic
│  │  └─ localDb.test.ts      # Tests local DB read/write
│  ├─ config.ts               # Constants + URL builder
│  └─ types.ts                # RawAd, ScrapedAd, PageMeta
├─ jest.config.cjs            # Jest configuration
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## Configuration

```ts
// src/config.ts
export const DATA_DIR = "data";

export const META_ADS_BASE_URL =
  "https://www.facebook.com/ads/library/";

export function buildPageUrl(pageId: string): string {
  const params = new URLSearchParams({
    active_status: "all",        // active + inactive
    ad_type: "all",
    country: "ALL",
    is_targeted_country: "false",
    media_type: "all",
    search_type: "page",
    view_all_page_id: pageId
  });

  return `${META_ADS_BASE_URL}?${params.toString()}`;
}
```

This ensures that **all ads (active + inactive)** for a page are visible in the Ads Library UI and therefore available to the scraper.

---

## Running Tests

### Install dependencies

```bash
npm install
```

### Run all tests

```bash
npm test
```

You should see something like:

```text
 PASS  src/tests/localDb.test.ts
 PASS  src/tests/extractAds.test.ts

Test Suites: 2 passed, 2 total
Tests:       2 passed, 2 total
```

The tests verify:
* `extractAdsFromPayload()` correctly extracts ads from a realistic Meta GraphQL response structure.
* `getAdId()` and `getPageId()` return the correct identifiers (including handling numeric IDs).
* `saveAd()` writes JSON files grouped by `page_id`.
* `loadExistingAdIds()` correctly reads back saved IDs as a `Set`.

These tests act as **early warning** if Meta/Facebook changes their GraphQL response format.

---

## Initial Sync

The **initial sync** pulls ads for a given Ads Library URL and populates the local JSON database.

### CLI usage

```bash
npm run initialSync -- "<ADS_LIBRARY_URL>" [max]
```

Example:

```bash
npm run initialSync -- \
  "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&search_type=page&view_all_page_id=380039845369159" \
  0
```

* The `max` argument is optional.

  * `max` omitted or `0` → no explicit limit (scrolls until Facebook stops returning new ads or UI is exhausted).
  * `max = 200` → stop after 200 new ads.

### Flow

1. Launches Puppeteer with Stealth.
2. Opens `https://www.facebook.com`.
3. **Pauses for manual login** (you log in in the Puppeteer browser).
4. After login, you press **ENTER** in the terminal.
5. The scraper navigates to the Ads Library URL.
6. Listens for GraphQL `/graphql` responses.
7. Filters responses that contain ad-library data.
8. Extracts ads from `collated_results` (and legacy fallbacks).
9. Saves each ad under `data/{pageId}/ads/{ad_archive_id}.json`.
10. Updates `data/{pageId}/page-meta.json` with `lastSynced` and `adCount`.

---

## Incremental Sync

The **incremental sync** keeps the local JSON database in sync with the live Meta Ads Library **without refetching everything**.

### CLI usage

```bash
npm run incrementalSync -- "<PAGE_ID>"
```

Example:

```bash
npm run incrementalSync -- "380039845369159"
```

### Behaviour

* Reads `data/{pageId}/page-meta.json` and existing ad IDs in `data/{pageId}/ads/`.

* Calls the scraper with `existingAdIds` populated.

* For each ad returned from Facebook:
  * If it is **new** (not in `existingAdIds`):
    * Save a new JSON file for that ad.
  * If it already exists:
    * Update selected fields in the stored JSON (e.g. `is_active`, `end_date`, etc.).

* Updates `lastSynced` and `adCount` in `page-meta.json`.

---

## How Ad Extraction Works

The core extraction logic is in `src/scraper/extractAds.ts`.

### 1. Extract ads from payload

```ts
export function extractAdsFromPayload(payload: any): RawAd[] {
  const ads: RawAd[] = [];

  // Modern 2023–2025 structure
  const edges =
    payload?.data?.ad_library_main?.search_results_connection?.edges || [];

  for (const edge of edges) {
    const collated = edge?.node?.collated_results || [];
    for (const entry of collated) {
      ads.push(entry as RawAd);
    }
  }

  // Fallbacks for older structures
  const fallback =
    payload?.data?.ad_library?.ad_results ||
    payload?.data?.ad_library_page?.ad_results ||
    [];

  for (const ad of fallback) {
    ads.push(ad as RawAd);
  }

  return ads;
}
```

### 2. Normalize IDs

```ts
export function getAdId(ad: RawAd): string | null {
  return (
    ad.ad_archive_id || // new format
    ad.adid ||          // old formats
    ad.id ||            // very old format
    null
  );
}

export function getPageId(ad: RawAd): string | null {
  const id =
    ad.page_id ??
    ad.pageId ??
    ad.page?.id ??
    ad.snapshot?.page_id ??
    null;

  if (id === null || id === undefined) return null;

  return String(id); // normalize to string
}
```

These helpers make the scraper resilient to slight differences in Facebook's data types (e.g. numeric vs string IDs) and older/alternative shapes.

---

## Types & Data Model

Key types are defined in `src/types.ts`:

```ts
export interface RawAd {
  ad_archive_id?: string;
  adArchiveID?: string;
  adid?: string;
  id?: string;

  page_id?: string | number;
  pageId?: string | number;
  page?: { id?: string | number };

  snapshot?: {
    page_id?: string | number;
    [key: string]: any;
  };

  is_active?: boolean;
  end_date?: string | number | null;

  [key: string]: any;
}

export interface ScrapedAd {
  id: string;      // normalized ad ID
  pageId: string;  // normalized page ID
  raw: RawAd;      // full raw payload
}

export interface PageMeta {
  pageId: string;
  lastSynced: string; // ISO timestamp
  adCount: number;
}
```

This allows the scraper to:

* Preserve the full raw ad payload.
* Normalize the key fields (`id`, `pageId`) for indexing and file naming.
* Track metadata per page for incremental sync.

---

## Manual Login & Ethics

* The scraper requires **manual Facebook login** inside the Puppeteer window.
* It does **not** attempt to bypass authentication or security.
* It only reads data visible in the official **Ads Library**, which is a public transparency tool.
* This project is intended for educational and technical evaluation purposes.

Always ensure your usage complies with Meta/Facebook's Terms of Service and local laws.

---

## Design & Engineering Decisions

* **GraphQL interception instead of DOM scraping**
  * More stable, less brittle than selecting DOM nodes.
  * Direct access to structured ad JSON.

* **Stealth plugin & browser flags**
  * Reduces the chance of being blocked as an automated browser.

* **Per-ad JSON files**
  * Makes diffing, debugging and manual inspection easy.
  * Allows future migration to a real database with a simple import script.

* **Incremental sync**
  * Avoids re-scraping thousands of ads on each run.
  * Keeps `is_active`/`end_date`/other fields up to date.

* **Tests around GraphQL fixtures**
  * If Facebook changes fields or structure, tests will fail quickly.
  * Makes it easy to update the extractor without guessing.

---

## Possible Improvements

* Add retry/backoff logic for transient network errors.
* Add rate limiting and/or proxy support.
* Add support for multiple pages in a batch run.
* Export data into a relational DB or analytics warehouse.
* Add CI (GitHub Actions) to run tests on every push.

---

## Author

Built by **Theo Georgewill**.