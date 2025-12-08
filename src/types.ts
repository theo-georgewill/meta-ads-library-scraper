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
  end_date?: string | null;
  [key: string]: any;
}

export interface ScrapedAd {
  id: string;
  pageId: string;
  raw: RawAd;
}

export interface PageMeta {
  pageId: string;
  lastSynced: string; // ISO timestamp
  adCount: number;
}
