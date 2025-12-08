import { scrapeWithPuppeteer } from "./scrapeCore";
import { saveAd, savePageMeta } from "../db/localDb";
import { buildPageUrl } from "../config";
import { getPageId } from "./extractAds";

export async function initialSync(
  url: string,
  max?: number
): Promise<void> {
  // Extract pageId from URL so we can store meta
  const u = new URL(url);
  const pageId = u.searchParams.get("view_all_page_id");
  if (!pageId) {
    throw new Error("URL must contain view_all_page_id query param");
  }

  const existing = new Set<string>();

  const { totalNew, totalSeen } = await scrapeWithPuppeteer({
    url,
    existingAdIds: existing,
    maxNewAds: max ?? Infinity,
    onAd: async (ad) => {
      await saveAd(ad);
    }
  });

  await savePageMeta(pageId, existing.size);

  console.log(
    `[initialSync] Done. pageId=${pageId}, newAds=${totalNew}, totalSeen=${totalSeen}`
  );
}

// Small helper if you want to call with just pageId in code.
export async function initialSyncByPageId(
  pageId: string,
  max?: number
): Promise<void> {
  const url = buildPageUrl(pageId);
  return initialSync(url, max);
}
