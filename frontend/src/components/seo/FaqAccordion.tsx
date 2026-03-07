'use client';
// src/components/seo/FaqAccordion.tsx

import { useState } from 'react';

interface Props {
  items: Array<{ q: string; a: string }>;
}

export function FaqAccordion({ items }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:48 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden',
          transition:'box-shadow .2s',
          boxShadow: open === i ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
        }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'16px 20px', textAlign:'left', background: open===i ? '#f8fafc' : 'white',
              border:'none', cursor:'pointer', fontFamily:"'Georgia',serif",
              transition:'background .15s',
            }}
          >
            <span style={{ fontWeight:600, color:'#111827', paddingRight:16, fontSize:15, lineHeight:1.5 }}>
              {item.q}
            </span>
            <span style={{
              flexShrink:0, width:22, height:22, borderRadius:'50%',
              background: open===i ? '#1a3a5c' : '#f3f4f6',
              color: open===i ? 'white' : '#9ca3af',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:16, lineHeight:1, fontWeight:300,
              transition:'all .2s',
            }}>
              {open === i ? '−' : '+'}
            </span>
          </button>

          {open === i && (
            <div style={{
              padding:'0 20px 18px', color:'#4b5563', lineHeight:1.8,
              fontSize:15, fontFamily:"'Georgia',serif",
              borderTop:'1px solid #f3f4f6',
            }}>
              <p style={{ margin:'14px 0 0' }}>{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}