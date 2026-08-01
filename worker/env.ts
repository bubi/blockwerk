export interface Env {
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** Local-only, set via .dev.vars — wrangler deploy never reads that file. */
  DEV_ACCESS_EMAIL?: string;
}
