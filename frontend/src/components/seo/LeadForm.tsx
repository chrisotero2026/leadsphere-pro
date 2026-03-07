'use client';
// src/components/seo/LeadForm.tsx
// 2-step lead capture form embedded in every SEO landing page.

import { useState, FormEvent } from 'react';
import { captureLeadPublic } from '@/lib/seoApi';

interface Props {
  pageId:    string;
  ctaText?:  string;
  ctaSubtext?:string;
  city?:     string;
  stateCode?:string;
  zipCode?:  string;
}

type Step = 1 | 2;

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent transition-shadow font-sans';
const errCls   = 'text-xs text-red-500 mt-0.5 font-sans';

export function LeadForm({ pageId, ctaText = 'Get My Cash Offer', ctaSubtext, city, stateCode, zipCode }: Props) {
  const [step,      setStep]      = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const [f1, setF1] = useState({ firstName:'', lastName:'', phone:'', email:'' });
  const [f2, setF2] = useState({ address:'', propertyType:'', estimatedValue:'', urgency:'IMMEDIATE' });
  const [errs, setErrs] = useState<Record<string,string>>({});

  const validate1 = () => {
    const e: Record<string,string> = {};
    if (!f1.firstName.trim()) e.firstName = 'Required';
    if (!f1.lastName.trim())  e.lastName  = 'Required';
    if (!f1.phone.replace(/\D/g,'').match(/^\d{10}$/)) e.phone = 'Enter a valid 10-digit phone number';
    if (!f1.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Enter a valid email';
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate1()) setStep(2); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await captureLeadPublic({
        pageId,
        ...f1,
        ...f2,
        city, state: stateCode, zipCode,
        estimatedValue: f2.estimatedValue ? Number(f2.estimatedValue) : undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  if (submitted) return (
    <div style={{ background:'white', borderRadius:20, boxShadow:'0 20px 60px rgba(0,0,0,0.18)', padding:32, textAlign:'center' }}>
      <div style={{ width:64, height:64, background:'#d1fae5', borderRadius:'50%',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <svg width="28" height="28" fill="none" stroke="#059669" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <h3 style={{ fontSize:22, fontWeight:800, color:'#111827', margin:'0 0 8px', fontFamily:"'Georgia',serif" }}>
        You're All Set!
      </h3>
      <p style={{ color:'#6b7280', fontSize:14, lineHeight:1.7, margin:'0 0 20px', fontFamily:'system-ui' }}>
        A local specialist will contact you within <strong>24 hours</strong> with your personalized cash offer for your {city} property.
      </p>
      <div style={{ background:'#f9fafb', borderRadius:12, padding:16, textAlign:'left' }}>
        {['No obligation to accept','Fair market-based offer','Close on your timeline'].map(t => (
          <div key={t} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontFamily:'system-ui', fontSize:13, color:'#4b5563' }}>
            <svg width="14" height="14" fill="none" stroke="#059669" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            {t}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ background:'white', borderRadius:20, boxShadow:'0 20px 60px rgba(0,0,0,0.18)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1a3a5c,#24527a)', padding:'18px 24px' }}>
        <h2 style={{ color:'white', fontWeight:700, fontSize:17, margin:'0 0 2px', fontFamily:'system-ui' }}>
          {ctaText}
        </h2>
        {ctaSubtext && (
          <p style={{ color:'#93c5fd', fontSize:12, margin:0, fontFamily:'system-ui' }}>{ctaSubtext}</p>
        )}
        {/* Step progress */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12 }}>
          {([1, 2] as const).map(s => (
            <span key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{
                width:24, height:24, borderRadius:'50%', fontWeight:700, fontSize:12,
                display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui',
                background: s < step ? '#4ade80' : s === step ? 'white' : 'rgba(255,255,255,0.2)',
                color: s < step ? 'white' : s === step ? '#1a3a5c' : 'rgba(255,255,255,0.5)',
              }}>
                {s < step ? '✓' : s}
              </span>
              <span style={{ fontSize:11, color: s === step ? 'white' : '#93c5fd', fontFamily:'system-ui' }}>
                {s === 1 ? 'Contact' : 'Property'}
              </span>
              {s < 2 && <span style={{ width:24, height:1, background:'rgba(255,255,255,0.2)' }}/>}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding:24, fontFamily:'system-ui' }}>
        {/* Step 1 */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {(['firstName','lastName'] as const).map(field => (
                <div key={field}>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>
                    {field === 'firstName' ? 'First Name' : 'Last Name'} *
                  </label>
                  <input className={inputCls}
                    placeholder={field === 'firstName' ? 'John' : 'Smith'}
                    value={f1[field]}
                    onChange={e => setF1(p => ({...p,[field]:e.target.value}))}/>
                  {errs[field] && <p className={errCls}>{errs[field]}</p>}
                </div>
              ))}
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Phone *</label>
              <input className={inputCls} type="tel" placeholder="(703) 555-0100"
                value={f1.phone} onChange={e => setF1(p => ({...p,phone:e.target.value}))}/>
              {errs.phone && <p className={errCls}>{errs.phone}</p>}
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Email *</label>
              <input className={inputCls} type="email" placeholder="john@email.com"
                value={f1.email} onChange={e => setF1(p => ({...p,email:e.target.value}))}/>
              {errs.email && <p className={errCls}>{errs.email}</p>}
            </div>
            <button type="button" onClick={handleNext}
              style={{ width:'100%', padding:'13px', background:'#1a3a5c', color:'white',
                fontWeight:700, fontSize:15, borderRadius:12, border:'none', cursor:'pointer' }}>
              Next Step →
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Property Address</label>
              <input className={inputCls} placeholder={`123 Main St, ${city ?? ''}`}
                value={f2.address} onChange={e => setF2(p => ({...p,address:e.target.value}))}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Property Type</label>
              <select className={inputCls} value={f2.propertyType}
                onChange={e => setF2(p => ({...p,propertyType:e.target.value}))}>
                <option value="">Select type…</option>
                <option value="SINGLE_FAMILY">Single Family</option>
                <option value="MULTI_FAMILY">Multi-Family</option>
                <option value="CONDO">Condo / Co-op</option>
                <option value="TOWNHOUSE">Townhouse</option>
                <option value="LAND">Vacant Land</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Estimated Value</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontWeight:600 }}>$</span>
                <input className={inputCls} type="number" style={{ paddingLeft:24 }}
                  placeholder="450,000"
                  value={f2.estimatedValue}
                  onChange={e => setF2(p => ({...p,estimatedValue:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:8 }}>How soon do you need to sell? *</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { v:'IMMEDIATE',    l:'ASAP',          s:'Within 30 days' },
                  { v:'THREE_MONTHS', l:'1–3 Months',    s:'Flexible' },
                  { v:'SIX_MONTHS',   l:'3–6 Months',    s:'Planning ahead' },
                  { v:'EXPLORING',    l:'Just Looking',  s:'Getting info' },
                ].map(opt => (
                  <label key={opt.v} style={{ cursor:'pointer' }}>
                    <input type="radio" name="urgency" value={opt.v}
                      checked={f2.urgency === opt.v}
                      onChange={() => setF2(p => ({...p,urgency:opt.v}))}
                      style={{ display:'none' }}/>
                    <div style={{
                      border: f2.urgency === opt.v ? '2px solid #1a3a5c' : '2px solid #e5e7eb',
                      background: f2.urgency === opt.v ? '#f0f4ff' : 'white',
                      borderRadius:10, padding:'10px 12px', textAlign:'center', transition:'all .15s',
                    }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#111827' }}>{opt.l}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{opt.s}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca',
                borderRadius:10, fontSize:12, color:'#dc2626' }}>
                {error}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button type="button" onClick={() => setStep(1)}
                style={{ flex:1, padding:'12px', border:'1px solid #e5e7eb', background:'white',
                  color:'#6b7280', fontWeight:600, fontSize:13, borderRadius:12, cursor:'pointer' }}>
                ← Back
              </button>
              <button type="submit" disabled={loading}
                style={{ flex:2, padding:'12px', background:'#1a3a5c', color:'white',
                  fontWeight:700, fontSize:14, borderRadius:12, border:'none', cursor:'pointer',
                  opacity: loading ? 0.7 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"
                      style={{ animation:'spin 1s linear infinite' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Submitting…
                  </>
                ) : ctaText}
              </button>
            </div>
          </div>
        )}

        {/* Trust signals */}
        <div style={{ marginTop:14, display:'flex', justifyContent:'center', gap:20,
          fontSize:11, color:'#9ca3af', borderTop:'1px solid #f3f4f6', paddingTop:12 }}>
          <span>🔒 100% Secure</span>
          <span>⭐ No Obligation</span>
          <span>⚡ 24hr Response</span>
        </div>
      </form>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}