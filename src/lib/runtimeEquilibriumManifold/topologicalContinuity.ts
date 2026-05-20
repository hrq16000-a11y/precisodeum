import type { ContinuityClass, ManifoldNode, RuntimeContinuityEnvelope } from './manifoldTypes';
export function calculateContinuityStrength(nodes: readonly ManifoldNode[]): number { if (nodes.length === 0) return 1; const avg = nodes.reduce((a, n) => a + Math.abs(n.tension), 0) / nodes.length; return 1 / (1 + avg); }
export function detectContinuityBreak(nodes: readonly ManifoldNode[]): number { const ids = new Set(nodes.map((n) => n.id)); let breaks = 0; for (const n of nodes) for (const nb of n.neighbors) if (!ids.has(nb)) breaks++; return breaks; }
export function detectFracturedContinuity(nodes: readonly ManifoldNode[]): boolean { const ids = new Set(nodes.map((n) => n.id)); const isolated = nodes.filter((n) => n.neighbors.length === 0 || n.neighbors.every((nb) => !ids.has(nb))); return isolated.length > 0 && isolated.length < nodes.length; }
export function calculateTopologicalContinuity(nodes: readonly ManifoldNode[]): RuntimeContinuityEnvelope {
  const breaks = detectContinuityBreak(nodes);
  const fractured = detectFracturedContinuity(nodes);
  const strength = calculateContinuityStrength(nodes);
  let cls: ContinuityClass = 'CONTINUOUS';
  if (nodes.length > 0 && nodes.every((n) => Math.abs(n.tension) >= 8)) cls = 'COLLAPSED';
  else if (fractured) cls = 'FRACTURED';
  else if (breaks > nodes.length) cls = 'DISCONTINUOUS';
  else if (breaks > 0) cls = 'WEAKLY_CONT