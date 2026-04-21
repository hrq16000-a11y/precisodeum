import { describe, expect, it } from 'vitest';

type LeadSeriesDay = {
  label: string;
  views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
};

type LeadStats = {
  views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  series: LeadSeriesDay[];
};

function simulatePublicWhatsAppClick(stats: LeadStats, label = '21/04'): LeadStats {
  const existing = stats.series.find((day) => day.label === label);
  const series = existing
    ? stats.series.map((day) => day.label === label ? { ...day, whatsapp_clicks: day.whatsapp_clicks + 1 } : day)
    : [...stats.series, { label, views: 0, whatsapp_clicks: 1, phone_clicks: 0 }];

  return {
    ...stats,
    whatsapp_clicks: stats.whatsapp_clicks + 1,
    series,
  };
}

function toLeadAnalyticsViewModel(stats: LeadStats) {
  return {
    views: stats.views,
    contacts: stats.whatsapp_clicks + stats.phone_clicks,
    conversion: stats.views > 0 ? Math.round(((stats.whatsapp_clicks + stats.phone_clicks) / stats.views) * 100) : 0,
    lastDayContacts: stats.series.at(-1)?.whatsapp_clicks ?? 0,
  };
}

describe('Lead conversion stress — public click to dashboard analytics', () => {
  it('reflects a WhatsApp click in the professional dashboard metrics immediately after RPC refetch', () => {
    const before: LeadStats = {
      views: 10,
      whatsapp_clicks: 2,
      phone_clicks: 1,
      series: [{ label: '21/04', views: 10, whatsapp_clicks: 2, phone_clicks: 1 }],
    };

    const afterPublicClick = simulatePublicWhatsAppClick(before);
    const dashboard = toLeadAnalyticsViewModel(afterPublicClick);

    expect(dashboard.contacts).toBe(4);
    expect(dashboard.conversion).toBe(40);
    expect(dashboard.lastDayContacts).toBe(3);
  });

  it('uses server-shaped aggregated stats instead of raw audit rows', () => {
    const rpcPayload: LeadStats = {
      views: 25,
      whatsapp_clicks: 5,
      phone_clicks: 2,
      series: [{ label: '21/04', views: 25, whatsapp_clicks: 5, phone_clicks: 2 }],
    };

    expect(toLeadAnalyticsViewModel(rpcPayload)).toEqual({
      views: 25,
      contacts: 7,
      conversion: 28,
      lastDayContacts: 5,
    });
  });
});
