/**
 * templateEngine.service.ts
 *
 * Core variable-interpolation engine.
 * Replaces {{variable}} placeholders with real location data.
 * Zero external dependencies — runs at generation time.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TemplateVars {
  city: string;
  cityLower: string;
  state: string;
  stateCode: string;
  zipCode: string;
  county: string;
  serviceType: string;
  serviceLabel: string;
  company: string;
  phone: string;
  year: string;
  medianValue: string;     // "$450K"
  population: string;      // "52,000"
  cityState: string;       // "Arlington, VA"
  cityStateZip: string;    // "Arlington, VA 22201"
  nearbyCity: string;      // "Washington DC"
}

export interface LocationInput {
  city: string;
  state: string;
  stateCode: string;
  zipCode: string;
  county?: string | null;
  medianHomeValue?: number | null;
  population?: number | null;
}

export interface RenderedPage {
  title: string;
  metaDescription: string;
  h1: string;
  heroHeadline: string;
  heroSubheadline: string;
  bodyHtml: string;
  faqJson: Array<{ q: string; a: string }>;
  schemaJson: Record<string, unknown>;
  ctaText: string;
  ctaSubtext: string | null;
  fullPath: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SERVICE_LABELS: Record<string, string> = {
  SELL_HOUSE_FAST:     'Sell My House Fast',
  CASH_OFFER:          'Cash Home Buyers',
  FORECLOSURE:         'Stop Foreclosure',
  PROBATE:             'Probate Property Sale',
  DIVORCE_SALE:        'Divorce Home Sale',
  FIRST_TIME_BUYER:    'First Time Home Buyer',
  REFINANCE:           'Mortgage Refinance',
  INVESTMENT_PROPERTY: 'Investment Properties',
};

const SERVICE_SLUGS: Record<string, string> = {
  SELL_HOUSE_FAST:     'sell-my-house-fast',
  CASH_OFFER:          'cash-home-buyers',
  FORECLOSURE:         'stop-foreclosure',
  PROBATE:             'probate-property-sale',
  DIVORCE_SALE:        'divorce-home-sale',
  FIRST_TIME_BUYER:    'first-time-home-buyer',
  REFINANCE:           'mortgage-refinance',
  INVESTMENT_PROPERTY: 'investment-properties',
};

const NEARBY: Record<string, string> = {
  VA: 'Washington DC',
  MD: 'Washington DC',
  DC: 'Northern Virginia',
};

// ─── Core interpolation ───────────────────────────────────────────────────────

export function interpolate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    (vars as Record<string, string>)[key] ?? match
  );
}

// ─── Variable builder ─────────────────────────────────────────────────────────

export function buildVars(loc: LocationInput, serviceType: string): TemplateVars {
  return {
    city:         loc.city,
    cityLower:    loc.city.toLowerCase(),
    state:        loc.state,
    stateCode:    loc.stateCode,
    zipCode:      loc.zipCode,
    county:       loc.county ?? `${loc.city} County`,
    serviceType,
    serviceLabel: SERVICE_LABELS[serviceType] ?? serviceType,
    company:      process.env.COMPANY_NAME ?? 'LeadSphere Properties',
    phone:        process.env.COMPANY_PHONE ?? '(703) 555-0100',
    year:         String(new Date().getFullYear()),
    medianValue:  loc.medianHomeValue
                    ? `$${Math.round(loc.medianHomeValue / 1000)}K`
                    : '$450K',
    population:   loc.population ? loc.population.toLocaleString() : '50,000+',
    cityState:    `${loc.city}, ${loc.stateCode}`,
    cityStateZip: `${loc.city}, ${loc.stateCode} ${loc.zipCode}`,
    nearbyCity:   NEARBY[loc.stateCode] ?? 'Washington DC',
  };
}

// ─── URL slug builder ─────────────────────────────────────────────────────────

export function buildPath(loc: LocationInput, serviceType: string): string {
  const state   = loc.stateCode.toLowerCase();
  const city    = loc.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const service = SERVICE_SLUGS[serviceType] ?? serviceType.toLowerCase().replace(/_/g, '-');
  return `/${state}/${city}/${loc.zipCode}/${service}`;
}

// ─── Full page renderer ───────────────────────────────────────────────────────

export function renderPage(
  template: {
    titleTemplate: string;
    metaDescTemplate: string;
    h1Template: string;
    heroHeadlineTemplate: string;
    heroSubheadlineTemplate: string;
    bodyTemplate: string;
    faqTemplate: Array<{ q: string; a: string }>;
    ctaText: string;
    ctaSubtext?: string | null;
    serviceType: string;
  },
  vars: TemplateVars
): RenderedPage {
  const faq = (template.faqTemplate as Array<{ q: string; a: string }>).map(item => ({
    q: interpolate(item.q, vars),
    a: interpolate(item.a, vars),
  }));

  const siteUrl = process.env.SITE_URL ?? 'https://leadsphere.com';
  const fullPath = buildPath(
    { city: vars.city, state: vars.state, stateCode: vars.stateCode, zipCode: vars.zipCode },
    vars.serviceType
  );

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        name: vars.company,
        description: interpolate(template.metaDescTemplate, vars),
        telephone: vars.phone,
        address: {
          '@type': 'PostalAddress',
          addressLocality: vars.city,
          addressRegion: vars.stateCode,
          postalCode: vars.zipCode,
          addressCountry: 'US',
        },
        url: `${siteUrl}${fullPath}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return {
    title:          interpolate(template.titleTemplate,           vars),
    metaDescription:interpolate(template.metaDescTemplate,       vars),
    h1:             interpolate(template.h1Template,              vars),
    heroHeadline:   interpolate(template.heroHeadlineTemplate,    vars),
    heroSubheadline:interpolate(template.heroSubheadlineTemplate, vars),
    bodyHtml:       interpolate(template.bodyTemplate,            vars),
    faqJson:        faq,
    schemaJson:     schema,
    ctaText:        template.ctaText,
    ctaSubtext:     template.ctaSubtext ?? null,
    fullPath,
  };
}
