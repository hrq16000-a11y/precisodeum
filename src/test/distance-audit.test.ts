import { describe, it, expect, beforeEach } from 'vitest';
import { calculateAuditedDistanceKm, resetGeoDiscrepancyStats, getGeoDiscrepancyStats } from '@/lib/distanceAudit';

// São José dos Pinhais (Colônia Rio Grande aprox)
const userSJP = { lat: -25.5300, lon: -49.1700, city: 'São José dos Pinhais' };
// Centro de Fazenda Rio Grande (~15km de SJP)
const fazendaRioGrande = { lat: -25.6520, lon: -49.3070 };

describe('distanceAudit', () => {
  beforeEach(() => resetGeoDiscrepancyStats());

  it('source=direct quando provider está na mesma cidade do usuário', () => {
    const audit = calculateAuditedDistanceKm(userSJP.lat, userSJP.lon, {
      latitude: -25.5350, longitude: -49.1750, city: 'São José dos Pinhais',
    }, userSJP.city);
    expect(audit.source).toBe('direct');
    expect(audit.suspicious).toBe(false);
    expect(audit.distanceKm).toBeLessThan(2);
  });

  it('source=unavailable quando provider não tem coords', () => {
    const audit = calculateAuditedDistanceKm(userSJP.lat, userSJP.lon, {
      latitude: null, longitude: null, city: 'São José dos Pinhais',
    }, userSJP.city);
    expect(audit.source).toBe('unavailable');
    expect(audit.distanceKm).toBe(Infinity);
  });

  it('marca suspicious + corrige por centro quando coords do provider estão erradas', () => {
    // Provider declara cidade Fazenda Rio Grande mas suas coords estão dentro de SJP.
    // Isso é exatamente o bug reportado: ele aparece "mais perto" que vizinhos legítimos.
    const audit = calculateAuditedDistanceKm(userSJP.lat, userSJP.lon, {
      latitude: userSJP.lat + 0.005,
      longitude: userSJP.lon + 0.005,
      city: 'Fazenda Rio Grande',
    }, userSJP.city);
    expect(audit.suspicious).toBe(true);
    expect(audit.source).toBe('city-center');
    // Distância corrigida deve refletir ~15km até Fazenda Rio Grande, não <1km.
    expect(audit.distanceKm).toBeGreaterThan(8);
  });

  it('telemetria conta discrepâncias por par cidade-cidade', () => {
    calculateAuditedDistanceKm(userSJP.lat, userSJP.lon, {
      latitude: userSJP.lat + 0.005, longitude: userSJP.lon + 0.005, city: 'Fazenda Rio Grande',
    }, userSJP.city);
    calculateAuditedDistanceKm(userSJP.lat, userSJP.lon, {
      latitude: userSJP.lat + 0.006, longitude: userSJP.lon + 0.006, city: 'Fazenda Rio Grande',
    }, userSJP.city);
    const stats = getGeoDiscrepancyStats();
    const counts = Object.values(stats.counters);
    expect(counts.some((n) => n >= 2)).toBe(true);
  });

  it('NÃO marca como suspeito quando provider está corretamente na sua cidade declarada', () => {
    const audit = calculateAuditedDistanceKm(userSJP.lat, userSJP.lon, {
      latitude: fazendaRioGrande.lat, longitude: fazendaRioGrande.lon, city: 'Fazenda Rio Grande',
    }, userSJP.city);
    expect(audit.suspicious).toBe(false);
    expect(audit.source).toBe('direct');
    expect(audit.distanceKm).toBeGreaterThan(8);
  });
});
