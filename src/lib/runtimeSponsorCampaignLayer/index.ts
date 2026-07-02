/**
 * Phase 1.9.16 — Sponsor Campaign Abstraction Layer.
 * Semantic grouping only. READ-ONLY / DETERMINISTIC / NON-DECISIONAL.
 */
export * from './sponsorCampaignModel';
export {
  buildCampaigns,
  buildNodeToCampaignMap,
} from './sponsorCampaignBuilder';
export {
  resolveCampaignsFromMesh,
  correlateDecisionWithCampaigns,
  listCampaignsByLifecycle,
  type ResolveCampaignsOptions,
} from './sponsorCampaignResolver';
export {
  signCampaignPayload,
  deepFreeze as sponsorCampaignDeepFreeze,
  assertCampaignSnapshotLocked,
  clamp01 as sponsorCampaignClamp01,
} from './sponsorCampaignSnapshot';
export { buildCampaignIndex } from './sponsorCampaignIndex';
