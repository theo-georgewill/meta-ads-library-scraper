import fs from "fs/promises";
import path from "path";
import { saveAd, loadExistingAdIds } from "../db/localDb";
import { DATA_DIR } from "../config";
import { ScrapedAd } from "../types";

describe("localDb", () => {
  const pageId = "test_page";
  const adId = "test_ad";

  // Cleanup after test
  afterAll(async () => {
    const dir = path.join(process.cwd(), DATA_DIR, pageId);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("saves and loads ad ids", async () => {
    const ad: ScrapedAd = {
      id: adId,
      pageId,
      raw: {
        ad_archive_id: adId,   
        page_id: pageId,
        is_active: true
      }
    };

    await saveAd(ad);

    const ids = await loadExistingAdIds(pageId);

    expect(ids.has(adId)).toBe(true);
  });
});
