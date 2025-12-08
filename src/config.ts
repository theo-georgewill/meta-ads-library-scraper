export const DATA_DIR = "data";

export const META_ADS_BASE_URL =
  "https://www.facebook.com/ads/library/";

export function buildPageUrl(pageId: string): string {
  const params = new URLSearchParams({
    active_status: "all", // active + inactive
    ad_type: "all",
    country: "ALL",
    is_targeted_country: "false",
    media_type: "all",
    search_type: "page",
    view_all_page_id: pageId
  });

  return `${META_ADS_BASE_URL}?${params.toString()}`;
}
