/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 */
export * from './types';
export * from './observability';
export * from './buildDashboardProfileOperation';
export * from './buildPersistFirstServiceOperation';
export * from './buildBetFinalizeOperation';
export * from './buildProfileTypeSwitchOperation';
export * from './executeOperation';
export * from './liveExecutionGate';
export * from './operationRegistry';
export * from './detectUnsafeWrites';
