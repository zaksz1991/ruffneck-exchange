export type RnxAttribution = {
  attribution_source?: string;
  attribution_medium?: string;
  attribution_campaign?: string;
  attribution_referrer_host?: string;
  attribution_landing_path?: string;
};

const CONSENT_KEY = 'rnx_analytics_consent_v1';
const ATTRIBUTION_KEY = 'rnx_first_touch_v1';

function clean(value: string | null | undefined, max = 100): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/[^a-zA-Z0-9 _.:/-]/g, '').replace(/\s+/g, ' ').slice(0, max);
  if (!cleaned || /@/.test(cleaned) || /\b\d{7,}\b/.test(cleaned)) return undefined;
  return cleaned;
}

function currentAttribution(): RnxAttribution {
  const url = new URL(window.location.href);
  let referrerHost: string | undefined;
  if (document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.hostname && ref.hostname !== window.location.hostname) referrerHost = clean(ref.hostname, 120);
    } catch { /* ignore invalid referrers */ }
  }
  const utmSource = clean(url.searchParams.get('utm_source'));
  const source = utmSource || (referrerHost ? 'referral' : 'direct');
  const medium = clean(url.searchParams.get('utm_medium')) || (source === 'referral' ? 'referral' : 'none');
  return {
    attribution_source: source,
    attribution_medium: medium,
    attribution_campaign: clean(url.searchParams.get('utm_campaign')),
    attribution_referrer_host: referrerHost,
    attribution_landing_path: clean(url.pathname, 180) || '/',
  };
}

export function saveFirstTouchAttribution(): void {
  try {
    if (localStorage.getItem(CONSENT_KEY) !== 'accepted') return;
    if (localStorage.getItem(ATTRIBUTION_KEY)) return;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(currentAttribution()));
  } catch { /* storage may be unavailable; attribution is optional */ }
}

export function readConsentedAttribution(): RnxAttribution {
  try {
    if (localStorage.getItem(CONSENT_KEY) !== 'accepted') return {};
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return currentAttribution();
    const parsed = JSON.parse(raw) as RnxAttribution;
    return {
      attribution_source: clean(parsed.attribution_source),
      attribution_medium: clean(parsed.attribution_medium),
      attribution_campaign: clean(parsed.attribution_campaign),
      attribution_referrer_host: clean(parsed.attribution_referrer_host, 120),
      attribution_landing_path: clean(parsed.attribution_landing_path, 180),
    };
  } catch { return {}; }
}

export function clearStoredAttribution(): void {
  try { localStorage.removeItem(ATTRIBUTION_KEY); } catch { /* ignore */ }
}
