import { RawAd } from "../types";

export function extractAdsFromPayload(payload: any): RawAd[] {
  const ads: RawAd[] = [];

  // NEW 2023–2025 format
  const edges =
    payload?.data?.ad_library_main?.search_results_connection?.edges || [];

  for (const edge of edges) {
    const collated = edge?.node?.collated_results || [];
    for (const entry of collated) {
      ads.push(entry as RawAd);
    }
  }

  // Fallback older formats
  const fallback =
    payload?.data?.ad_library?.ad_results ||
    payload?.data?.ad_library_page?.ad_results ||
    [];

  for (const ad of fallback) {
    ads.push(ad as RawAd);
  }

  return ads;
}

export function getAdId(ad: RawAd): string | null {
  return (
    ad.ad_archive_id || // new format
    ad.adid ||          // old formats
    ad.id ||
    null
  );
}

//
export function getPageId(ad: RawAd): string | null {
  const id =
    ad.page_id ??
    ad.pageId ??
    ad.page?.id ??
    ad.snapshot?.page_id ??
    null;

  if (id === null || id === undefined) return null;

  return String(id); 
}
