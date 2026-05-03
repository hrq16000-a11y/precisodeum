/**
 * deviceInfo — extrai modelo/SO/navegador do user agent para enriquecer
 * relatórios de erro do wizard. Heurística leve (sem libs externas).
 */

export interface DeviceInfo {
  os: 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'Other';
  osVersion: string | null;
  model: string | null;
  browser: string;
  browserVersion: string | null;
  isMobile: boolean;
  userAgent: string;
}

export function parseDeviceInfo(ua?: string): DeviceInfo {
  const userAgent = (ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')) || '';
  const u = userAgent;

  let os: DeviceInfo['os'] = 'Other';
  let osVersion: string | null = null;
  let model: string | null = null;

  if (/Android/i.test(u)) {
    os = 'Android';
    osVersion = (u.match(/Android\s+([\d.]+)/) || [])[1] || null;
    // Modelo: " ; <Model> Build/" ou " ; <Model>)"
    model = (u.match(/Android[^;]*;\s*[^;]*;\s*([^;)]+?)\s*(?:Build|\))/) || [])[1]
      || (u.match(/;\s*([^;)]+?)\s+Build/) || [])[1]
      || null;
  } else if (/iPhone|iPad|iPod/i.test(u)) {
    os = 'iOS';
    osVersion = ((u.match(/OS\s+([\d_]+)/) || [])[1] || '').replace(/_/g, '.') || null;
    model = (u.match(/(iPhone|iPad|iPod)/) || [])[1] || null;
  } else if (/Windows NT/i.test(u)) {
    os = 'Windows';
    osVersion = (u.match(/Windows NT\s+([\d.]+)/) || [])[1] || null;
  } else if (/Mac OS X/i.test(u)) {
    os = 'macOS';
    osVersion = ((u.match(/Mac OS X\s+([\d_.]+)/) || [])[1] || '').replace(/_/g, '.') || null;
  } else if (/Linux/i.test(u)) {
    os = 'Linux';
  }

  let browser = 'Other';
  let browserVersion: string | null = null;
  if (/Edg\//.test(u)) { browser = 'Edge'; browserVersion = (u.match(/Edg\/([\d.]+)/) || [])[1] || null; }
  else if (/OPR\/|Opera/.test(u)) { browser = 'Opera'; browserVersion = (u.match(/(?:OPR|Opera)\/([\d.]+)/) || [])[1] || null; }
  else if (/Chrome\//.test(u) && !/Chromium/.test(u)) { browser = 'Chrome'; browserVersion = (u.match(/Chrome\/([\d.]+)/) || [])[1] || null; }
  else if (/Firefox\//.test(u)) { browser = 'Firefox'; browserVersion = (u.match(/Firefox\/([\d.]+)/) || [])[1] || null; }
  else if (/Safari\//.test(u) && /Version\//.test(u)) { browser = 'Safari'; browserVersion = (u.match(/Version\/([\d.]+)/) || [])[1] || null; }

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(u);

  return { os, osVersion, model, browser, browserVersion, isMobile, userAgent };
}

/** Resumo curto e legível: "Chrome 124 · Android 14 · SM-G991B". */
export function deviceSummary(info?: DeviceInfo): string {
  const i = info ?? parseDeviceInfo();
  const parts = [
    `${i.browser}${i.browserVersion ? ' ' + i.browserVersion.split('.')[0] : ''}`,
    `${i.os}${i.osVersion ? ' ' + i.osVersion : ''}`,
  ];
  if (i.model) parts.push(i.model);
  return parts.join(' · ');
}
