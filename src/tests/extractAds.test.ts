import sample from "./fixtures/sampleGraphResponse.json";
import {
  extractAdsFromPayload,
  getAdId,
  getPageId
} from "../scraper/extractAds";

describe("extractAdsFromPayload", () => {
  it("extracts ads from GraphQL response", () => {
    const ads = extractAdsFromPayload(sample);
    expect(ads.length).toBe(2);

    const a1 = ads[0];
    expect(getAdId(a1)).toBe("111");
    expect(getPageId(a1)).toBe("282592881929497");
    expect(a1.is_active).toBe(true);
  });
});
