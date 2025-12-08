import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { HTTPResponse } from "puppeteer";

import { ScrapedAd, RawAd } from "../types";
import { extractAdsFromPayload, getAdId, getPageId } from "./extractAds";

puppeteer.use(StealthPlugin());

export interface ScrapeOptions {
  url: string;
  existingAdIds?: Set<string>;
  maxNewAds?: number;
  onAd: (ad: ScrapedAd, isNew: boolean) => Promise<void>;
}

export async function scrapeWithPuppeteer(
  opts: ScrapeOptions
): Promise<{ totalNew: number; totalSeen: number }>
{
  const { url, existingAdIds = new Set(), maxNewAds = Infinity, onAd } = opts;

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1400,900",
      "--lang=en-US,en",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    ],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120_000);

  // Anti-bot masking
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "media", "font"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  let totalNew = 0;
  let totalSeen = 0;
  let newCountMarker = 0;
  let stop = false;

  // INTERCEPT GRAPHQL RESPONSES
  page.on("response", async (res: HTTPResponse) => {
    if (stop) return;

    try {
      const url = res.url();
      if (!url.includes("/graphql")) return;
      if (res.status() < 200 || res.status() >= 300) return;

      let json: any;
      try {
        json = await (res as any).json();
      } catch {
        return;
      }

      const rawAds: RawAd[] = extractAdsFromPayload(json);
      if (!rawAds.length) return;

      for (const raw of rawAds) {
        const adId = getAdId(raw);
        const pageId = getPageId(raw);
        if (!adId || !pageId) continue;

        totalSeen++;

        const isNew = !existingAdIds.has(adId);
        if (isNew) {
          existingAdIds.add(adId);
          totalNew++;
          newCountMarker++;
        }

        await onAd({ id: adId, pageId, raw }, isNew);

        if (totalNew >= maxNewAds) {
          stop = true;
          break;
        }
      }
    } catch (err: any) {
      console.error("[graphql error]", err.message);
    }
  });

  try {
    console.log("[scrape] Go to facebook.com");
    await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded" });

    console.log("Login manually, then press ENTER in the terminal.");
    await new Promise((resolve) => process.stdin.once("data", resolve));

    console.log("[scrape] Opening Ads Library URL…");
    await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await page.waitForSelector('div[role="dialog"] button', { timeout: 8000 });
      await page.click('div[role="dialog"] button');
    } catch {}

    await page.waitForSelector("div.x78zum5", { timeout: 60000 });
    console.log("[scrape] Ads Library UI detected. Starting scroll…");

    let staleScrolls = 0;
    const MAX_STALE_SCROLLS = 18;

    while (!stop && staleScrolls < MAX_STALE_SCROLLS) {
      const before = newCountMarker;

      await page.evaluate(async () => {
        function sleep(ms: number) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        let totalScroll = 0;
        const step = 250;

        async function smoothScroll() {
          while (true) {
            const scrollHeightBefore = document.body.scrollHeight;

            window.scrollBy(0, step);
            totalScroll += step;
            await sleep(150);

            // wait for FB to load more ads
            await sleep(400);

            const scrollHeightAfter = document.body.scrollHeight;

            // break if no new content loaded
            if (scrollHeightAfter <= scrollHeightBefore) break;
          }
        }

        await smoothScroll();
      });


      await new Promise((r) => setTimeout(r, 2500));

      if (newCountMarker === before) {
        staleScrolls++;
      } else {
        staleScrolls = 0;
      }

      console.log(`[scrape] seen=${totalSeen}, new=${totalNew}, stale=${staleScrolls}`);
    }

  } catch (err) {
    console.error("[scrape fatal]", err);
  } finally {
    await browser.close();
  }

  return { totalNew, totalSeen };
}
