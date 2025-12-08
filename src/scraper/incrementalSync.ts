import { scrapeWithPuppeteer } from "./scrapeCore";
import {
  loadExistingAdIds,
  saveAd,
  savePageMeta
} from "../db/localDb";
import { buildPageUrl } from "../config";

export async function incrementalSync(pageId: string): Promise<void> {
  const url = buildPageUrl(pageId);
  const existing = await loadExistingAdIds(pageId);
  const existingCount = existing.size;

  console.log(
    `[incrementalSync] Starting. pageId=${pageId}, existingAds=${existingCount}`
  );

  const { totalNew, totalSeen } = await scrapeWithPuppeteer({
    url,
    existingAdIds: existing,
    maxNewAds: Infinity, // stop when no new ads after several scrolls
    onAd: async (ad, isNew) => {
      // Always save: this keeps is_active/end_date in sync
      await saveAd(ad);
    }
  });

  await savePageMeta(pageId, existing.size);

  console.log(
    `[incrementalSync] Done. pageId=${pageId}, newAds=${totalNew}, totalSeen=${totalSeen}`
  );
}
