import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config";
import { PageMeta, ScrapedAd } from "../types";

function pageDir(pageId: string) {
  return path.join(process.cwd(), DATA_DIR, pageId);
}

function adsDir(pageId: string) {
  return path.join(pageDir(pageId), "ads");
}

function metaPath(pageId: string) {
  return path.join(pageDir(pageId), "page-meta.json");
}

export async function ensurePageDirs(pageId: string) {
  await fs.mkdir(adsDir(pageId), { recursive: true });
}

export async function saveAd(ad: ScrapedAd) {
  await ensurePageDirs(ad.pageId);
  const filePath = path.join(adsDir(ad.pageId), `${ad.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(ad.raw, null, 2), "utf-8");
}

export async function loadExistingAdIds(pageId: string): Promise<Set<string>> {
  try {
    const dir = adsDir(pageId);
    const files = await fs.readdir(dir);
    const ids = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export async function loadPageMeta(pageId: string): Promise<PageMeta | null> {
  try {
    const raw = await fs.readFile(metaPath(pageId), "utf-8");
    return JSON.parse(raw) as PageMeta;
  } catch {
    return null;
  }
}

export async function savePageMeta(
  pageId: string,
  adCount: number
): Promise<void> {
  await ensurePageDirs(pageId);
  const meta: PageMeta = {
    pageId,
    lastSynced: new Date().toISOString(),
    adCount
  };
  await fs.writeFile(metaPath(pageId), JSON.stringify(meta, null, 2), "utf-8");
}
