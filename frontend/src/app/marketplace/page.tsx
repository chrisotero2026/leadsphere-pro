'use client';
// src/app/marketplace/page.tsx

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { marketplaceApi } from '@/lib/billingApi';
import { useRouter } from 'next/navigation';
import {
  MapPin, Search, Filter, Star, TrendingUp,
  Zap, Lock, CheckCircle, Loader2, ChevronLeft,
  ChevronRight, DollarSign, Users, ArrowRight, Tag,
} from 'lucide-react';

const TYPE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  TERRITORY:    { label:'Territory', bg:'bg-violet-100', color:'text-violet-700' },
  LEAD_PACKAGE: { label:'Lead Package', bg:'bg-blue-100', color:'text-blue-700' },
  LEAD_CREDIT:  { label:'Lead Credit', bg:'bg-emerald-100', color:'text-emerald-700' },
};

function ListingCard({ listing, onBuy, buying }: { listing: any; onBuy: () => void; buying: boolean }) {
  const typeCfg = TYPE_CFG[listing.type] ?? TYPE_CFG.TERRITORY;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeCfg.bg} ${typeCfg.color}`}>
            {typeCfg.label}
          </span>
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-violet-500"/>
            <span className="text-xs font-semibold text-violet-600">Exclusive</span>
          </div>
        </div>

        <h3 className="font-bold text-gray-900 text-base leading-snug mb-1">{listing.title}</h3>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <MapPin className="w-3 h-3"/>
          {listing.city && <span>{listing.city},</span>}
          <span>{listing.stateCode}</span>
          {listing.zipCode && <span className="font-mono">{listing.zipCode}</span>}
        </div>
      </div>

      {/* Highlights */}
      <div className="p-5 flex-1">
        {listing.leadsPerMonth && (
          <div className="flex items-center gap-2 mb-3 p-2.5 bg-emerald-50 rounded-lg">
            <TrendingUp className="w-4 h-4 text-emerald-500"/>
            <span className="text-sm font-semibold text-emerald-700">~{listing.leadsPerMonth} leads/month</span>
          </div>
        )}

        {listing.highlights?.length > 0 && (
          <ul className="space-y-2">
            {listing.highlights.slice(0, 4).map((h: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0"/>
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-gray-900">${Number(listing.price).toFixed(0)}</span>
              {listing.isRecurring && <span className="text-gray-400 text-xs font-medium">/mo</span>}
            </div>
            {listing.isRecurring && listing.recurringPrice && (
              <p className="text-xs text-gray-400">Auto-renews monthly</p>
            )}
          </div>

          <button onClick={onBuy} disabled={buying}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a] disabled:opacity-60 transition-colors">
            {buying ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
            {buying ? 'Redirecting…' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const router = useRouter();
  const [stateCode, setStateCode] = useState('');
  const [type,      setType]      = useState('');
  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState('priority');
  const [page,      setPage]      = useState(1);
  const [buyingId,  setBuyingId]  = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', stateCode, type, search, sortBy, page],
    queryFn:  () => marketplaceApi.list({
      page, limit: 12,
      ...(stateCode && { stateCode }),
      ...(type      && { type }),
      ...(search    && { search }),
      sortBy,
    }).then(r => r.data),
  });

  const buyMutation = useMutation({
    mutationFn: (listingId: string) => marketplaceApi.purchase(listingId),
    onSuccess: (r) => {
      if (r.data.data?.url) window.location.href = r.data.data.url;
    },
    onError: (err: any) => {
      if (err.response?.status === 401) router.push('/login?redirect=/marketplace');
      else alert(err.response?.data?.error ?? 'Purchase failed');
    },
    onSettled: () => setBuyingId(null),
  });

  const handleBuy = (listingId: string) => {
    setBuyingId(listingId);
    buyMutation.mutate(listingId);
  };

  const listings  = data?.data ?? [];
  const total     = data?.pagination?.total ?? 0;
  const pages     = Math.ceil(total / 12);
  const meta      = data?.meta;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-[#1B3A5C] text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-blue-300"/>
                <span className="text-blue-300 text-sm font-semibold uppercase tracking-wide">Territory Marketplace</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black mb-3">Own Your Market</h1>
              <p className="text-blue-200 text-lg max-w-xl">
                Purchase exclusive territory rights. Every lead from your ZIP goes directly to you — no competition.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'Available', val: meta?.totalActive ?? '…', icon:MapPin },
                { label:'Avg price', val: meta?.priceRange?.avg ? `$${Math.round(Number(meta.priceRange.avg))}` : '…', icon:DollarSign },
                { label:'States',   val: 3, icon:Users },
              ].map(stat => (
                <div key={stat.label} className="bg-white/10 rounded-xl p-4 text-center min-w-[90px]">
                  <stat.icon className="w-5 h-5 text-blue-300 mx-auto mb-1.5"/>
                  <div className="text-2xl font-black">{stat.val}</div>
                  <div className="text-xs text-blue-300">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C]"
              placeholder="Search ZIP, city, or territory name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* State */}
          <div className="flex gap-1">
            {[{l:'All',v:''},{l:'VA',v:'VA'},{l:'MD',v:'MD'},{l:'DC',v:'DC'}].map(s => (
              <button key={s.v} onClick={() => { setStateCode(s.v); setPage(1); }}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  stateCode === s.v
                    ? 'bg-[#1B3A5C] text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s.l}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="priority">Featured first</option>
            <option value="price">Lowest price</option>
            <option value="leads">Most leads</option>
            <option value="newest">Newest</option>
          </select>

          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-400"/>}
          {total > 0 && <span className="text-sm text-gray-400 ml-auto">{total} available</span>}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-gray-300"/>
          </div>
        ) : listings.length === 0 ? (
          <div className="py-24 text-center">
            <MapPin className="w-16 h-16 mx-auto text-gray-200 mb-4"/>
            <p className="text-gray-500 font-semibold text-lg mb-2">No listings found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or check back soon</p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {listings.map((listing: any) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onBuy={() => handleBuy(listing.id)}
                  buying={buyingId === listing.id}
                />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="w-5 h-5"/>
                </button>
                <span className="text-sm text-gray-500 font-medium">
                  Page {page} of {pages}
                </span>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="w-5 h-5"/>
                </button>
              </div>
            )}
          </>
        )}

        {/* Trust bar */}
        <div className="mt-16 border-t border-gray-200 pt-10">
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
            {[
              { icon:'🔒', title:'Exclusive Rights', desc:'Your territory, only yours — no other buyers.' },
              { icon:'⚡', title:'Instant Setup',    desc:'Leads route to you the moment your payment clears.' },
              { icon:'↩️', title:'30-Day Guarantee', desc:"Not getting leads? We'll refund your first month." },
            ].map(t => (
              <div key={t.title} className="p-5">
                <div className="text-3xl mb-2">{t.icon}</div>
                <div className="font-bold text-gray-900 mb-1">{t.title}</div>
                <div className="text-sm text-gray-500">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
