import { describe, it, expect } from 'vitest';
import { compareVersions } from '@/lib/appVersion';

describe('compareVersions', () => {
  it('detects lower / higher / equal', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('handles uneven segments', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
  });

  it('tolerates invalid input', () => {
    expect(compareVersions('', '0.0.0')).toBe(0);
    expect(compareVersions('abc', '1.0.0')).toBe(-1);
  });

  it('force gate triggers when current < min', () => {
    const current = '1.0.0';
    const min = '1.2.0';
    expect(compareVersions(current, min) < 0).toBe(true);
  });

  it('suggest gate triggers when current < latest but >= min', () => {
    const current = '1.2.0';
    const min = '1.0.0';
    const latest = '1.3.0';
    expect(compareVersions(current, min) >= 0).toBe(true);
    expect(compareVersions(current, latest) < 0).toBe(true);
  });
});
