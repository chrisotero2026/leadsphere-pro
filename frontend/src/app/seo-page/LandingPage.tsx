// src/app/[state]/[city]/[zip]/[service]/page.tsx
//
// This is the PUBLIC landing page served to visitors and indexed by Google.
// Uses Next.js App Router with ISR (Incremental Static Regeneration).
// Each unique [state]/[city]/[zip]/[service] combo maps to one DB record.

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LeadForm } from '@/components/seo/LeadForm';
import { FaqAccordion } from '@/components/seo/FaqAccordion';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://leadsphere.com';

async function fetchPage(state: string, city: string, zip: string, service: string) {
  const path = `/${state}/${city}/${zip}/${service}`;
  try {
    const res = await fetch(`${API}/seo/public/page${path}`, {
      next: { revalidate: 86400 }, // re-validate once per day (ISR)
    });
    if (!res.ok) return null;
    return (await res.json()).data ?? null;
  } catch { return null; }
}

// ── Metadata (for Google) ─────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { state: string; city: string; zip: string; service: string };
}): Promise<Metadata> {
  const p = await fetchPage(params.state, params.city, params.zip, params.service);
  if (!p) return { title: 'Page Not Found' };
  return {
    title:       p.title,
    description: p.metaDescription,
    alternates:  { canonical: `${SITE}${p.fullPath}` },
    openGraph: {
      title:       p.title,
      description: p.metaDescription,
      url:         `${SITE}${p.fullPath}`,
      type:        'website',
    },
    robots: { index: true, follow: true },
  };
}

// ── Page component ────────────────────────────────────────────────

export default async function SeoLandingPage({
  params,
}: {
  params: { state: string; city: string; zip: string; service: string };
}) {
  const page = await fetchPage(params.state, params.city, params.zip, params.service);
  if (!page) notFound();

  const faq = Array.isArray(page.faqJson) ? page.faqJson : [];
  const loc = page.location ?? {};

  return (
    <>
      {/* JSON-LD schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(page.schemaJson) }}
      />

      <div className="min-h-screen bg-white" style={{ fontFamily:"'Georgia', serif" }}>

        {/* ── Nav ──────────────────────────────────────── */}
        <nav style={{ borderBottom:'1px solid #e5e7eb', position:'sticky', top:0, zIndex:50,
          background:'rgba(255,255,255,0.97)', backdropFilter:'blur(8px)' }}>
          <div style={{ maxWidth:1100, margin:'0 auto', padding:'12px 20px',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, background:'#1a3a5c', borderRadius:8,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="18" height="18" fill="white" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                </svg>
              </div>
              <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:17 }}>LeadSphere</span>
            </div>
            <a href="#lead-form" style={{ background:'#1a3a5c', color:'white', fontFamily:'system-ui',
              padding:'8px 20px', borderRadius:999, fontSize:13, fontWeight:700, textDecoration:'none' }}>
              {page.ctaText ?? 'Get Cash Offer'}
            </a>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────── */}
        <section style={{
          background:'linear-gradient(135deg, #1a3a5c 0%, #24527a 50%, #1a3a5c 100%)',
          color:'white', overflow:'hidden', position:'relative',
        }}>
          {/* Grid texture */}
          <div style={{
            position:'absolute', inset:0, opacity:0.07,
            backgroundImage:'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)',
            backgroundSize:'44px 44px',
          }}/>

          <div style={{ position:'relative', maxWidth:1100, margin:'0 auto',
            padding:'60px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48,
            alignItems:'center' }}>

            {/* Copy */}
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8,
                background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)',
                borderRadius:999, padding:'6px 14px', fontSize:12, color:'#93c5fd', marginBottom:20 }}>
                <span style={{ width:8, height:8, background:'#4ade80', borderRadius:'50%',
                  display:'inline-block', animation:'pulse 2s infinite' }}/>
                Serving {loc.city}, {loc.stateCode}
              </div>

              <h1 style={{ fontSize:42, fontWeight:800, lineHeight:1.2, margin:'0 0 16px',
                fontFamily:"'Georgia', serif" }}>
                {page.heroHeadline}
              </h1>

              <p style={{ fontSize:18, color:'#bfdbfe', lineHeight:1.7, margin:'0 0 32px' }}>
                {page.heroSubheadline}
              </p>

              <div style={{ display:'flex', flexWrap:'wrap', gap:'12px 24px', fontSize:13, color:'#93c5fd' }}>
                {['✓ Close in 7 days','✓ No repairs needed','✓ Zero commissions','✓ Fair cash offers'].map(t => (
                  <span key={t} style={{ fontWeight:600, fontFamily:'system-ui' }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Lead form */}
            <div id="lead-form">
              <LeadForm
                pageId={page.id}
                ctaText={page.ctaText}
                ctaSubtext={page.ctaSubtext}
                city={loc.city}
                stateCode={loc.stateCode}
                zipCode={loc.zipCode}
              />
            </div>
          </div>
        </section>

        {/* ── Body content ─────────────────────────────── */}
        <main style={{ maxWidth:780, margin:'0 auto', padding:'60px 20px' }}>
          <h2 style={{ fontSize:32, fontWeight:800, color:'#1a3a5c',
            fontFamily:"'Georgia', serif", marginBottom:36 }}>
            {page.h1}
          </h2>

          {/* Rendered HTML body */}
          <article
            style={{ color:'#374151', lineHeight:1.85, fontSize:16 }}
            className="seo-body"
            dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
          />

          {/* Mid-page CTA */}
          <div style={{
            margin:'60px 0', background:'linear-gradient(135deg,#1a3a5c,#24527a)',
            borderRadius:20, padding:36, textAlign:'center', color:'white',
          }}>
            <h2 style={{ fontSize:26, fontWeight:800, margin:'0 0 8px', fontFamily:"'Georgia',serif" }}>
              Ready to Sell Your {loc.city} Home?
            </h2>
            <p style={{ color:'#93c5fd', margin:'0 0 24px', fontFamily:'system-ui', fontSize:15 }}>
              Get a no-obligation cash offer within 24 hours.
            </p>
            <a href="#lead-form" style={{
              display:'inline-block', background:'white', color:'#1a3a5c',
              fontWeight:700, padding:'12px 32px', borderRadius:999,
              fontFamily:'system-ui', fontSize:15, textDecoration:'none',
            }}>
              {page.ctaText}
            </a>
          </div>

          {/* FAQ */}
          {faq.length > 0 && (
            <>
              <h2 style={{ fontSize:26, fontWeight:800, color:'#1a3a5c',
                fontFamily:"'Georgia',serif", margin:'0 0 24px' }}>
                Frequently Asked Questions — {loc.city}
              </h2>
              <FaqAccordion items={faq}/>
            </>
          )}
        </main>

        {/* ── Footer ───────────────────────────────────── */}
        <footer style={{ borderTop:'1px solid #f3f4f6', background:'#f9fafb', padding:'32px 20px' }}>
          <div style={{ maxWidth:1100, margin:'0 auto', display:'flex',
            flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, background:'#1a3a5c', borderRadius:6,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" fill="white" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                </svg>
              </div>
              <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:15 }}>LeadSphere Properties</span>
            </div>
            <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', fontFamily:'system-ui' }}>
              © {new Date().getFullYear()} LeadSphere Properties · Licensed in {loc.stateCode ?? 'VA, MD, DC'} · Not affiliated with any government agency
            </p>
            <div style={{ display:'flex', gap:16, fontSize:12, color:'#9ca3af', fontFamily:'system-ui' }}>
              <a href="/privacy" style={{ color:'#9ca3af', textDecoration:'none' }}>Privacy</a>
              <a href="/terms"   style={{ color:'#9ca3af', textDecoration:'none' }}>Terms</a>
              <a href="/contact" style={{ color:'#9ca3af', textDecoration:'none' }}>Contact</a>
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        .seo-body h2 { color:#1a3a5c; font-size:1.5rem; font-weight:700; margin:2.5rem 0 1rem; padding-bottom:.5rem; border-bottom:2px solid #f0f4f8; }
        .seo-body h3 { color:#1a3a5c; font-size:1.15rem; font-weight:600; margin:1.5rem 0 .5rem; }
        .seo-body p  { margin:0 0 1rem; }
        .seo-body ul { margin:0 0 1rem; padding-left:1.5rem; }
        .seo-body li { margin-bottom:.5rem; }
        .seo-body strong { color:#1a3a5c; }
        .seo-body .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; margin:1.5rem 0; }
        .seo-body .step { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; }
        .seo-body .step-num { width:36px; height:36px; background:#1a3a5c; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; margin-bottom:.75rem; }
        @media (max-width:640px) {
          section > div { grid-template-columns:1fr !important; padding:40px 16px !important; }
          .seo-body .steps { grid-template-columns:1fr !important; }
        }
        @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:.5 } }
      `}</style>
    </>
  );
}
