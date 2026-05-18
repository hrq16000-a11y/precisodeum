import { describe, it } from 'vitest';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import { calculateGuaranteeLevel } from '@/lib/contracts/guarantees';
import { assertArchitecturalIntegrity } from '@/lib/contracts/assertArchitecturalIntegrity';

describe('debug', () => {
  it('dump', () => {
    for (const r of OPERATION_REGISTRY) {
      if (r.readiness !== 'READY') continue;
      const g = calculateGuaranteeLevel(r.flow)!;
      // eslint-disable-next-line no-console
      console.log(r.flow, 'overall=', g.overall, JSON.stringify(g.levels), 'boundary=', r.boundary, 'ownership=', r.ownership, 'steps=', r.steps.length, 'rollback=', r.supportsRollback, 'atomic=', r.supportsAtomic);
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(assertArchitecturalIntegrity(), null, 2));
  });
});
