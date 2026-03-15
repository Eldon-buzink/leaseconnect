'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DealDetailPanel, type MatchDetail, type OtherMatch } from '@/app/components/DealDetailPanel';
import { CarImage } from '@/app/components/CarImage';

interface Match {
  id: number;
  normalized_offer_id: number;
  canonical_vehicle_id: number;
  match_type: string;
  confidence_score: number;
  match_algorithm: string;
  status: string;
  matched_at: string;
  review_notes?: string | null;
  normalized_offer: {
    supplier_id: string;
    supplier_offer_id: string;
    make: string;
    model: string;
    trim: string;
    year: number;
    fuel_type?: string | null;
    transmission?: string | null;
  };
  canonical_vehicle: {
    make: string;
    model: string;
    trim: string;
    year: number;
    autodisk_id: string;
    fuel_type?: string | null;
    transmission?: string | null;
  };
}

interface Stats {
  total: number;
  approved: number;
  review: number;
  pending: number;
  rejected: number;
  deterministic: number;
  scored: number;
  override: number;
}

interface ModelRow {
  make: string;
  model: string;
  yearMin: number | null;
  yearMax: number | null;
  variantCount: number;
  supplierCount: number;
  suppliers: string[]; // for display only (top N)
  statusCounts: { approved: number; review: number; pending: number; rejected: number };
  matchTypeCounts: { deterministic: number; scored: number; override: number };
}

function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [makeFilter, setMakeFilter] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [fuelFilter, setFuelFilter] = useState<string>('');
  const [transmissionFilter, setTransmissionFilter] = useState<string>('');
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [transmissions, setTransmissions] = useState<string[]>([]);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'cars' | 'review'>('cars');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsList, setModelsList] = useState<ModelRow[]>([]);
  const [dealModalMatchId, setDealModalMatchId] = useState<number | null>(null);
  const [dealModalData, setDealModalData] = useState<{ match: MatchDetail; otherMatches: OtherMatch[] } | null>(null);
  const [dealModalLoading, setDealModalLoading] = useState(false);
  const [dealModalError, setDealModalError] = useState<string | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    // Update dependent model dropdown when make changes.
    (async () => {
      try {
        const { data: cvRows } = await supabase.from('canonical_vehicles').select('make, model');
        const all = cvRows || [];
        const filteredModels = all
          .filter((r: { make?: string }) => !makeFilter || r.make === makeFilter)
          .map((r: { model?: string }) => r.model)
          .filter(Boolean);
        setModels([...new Set(filteredModels)].sort() as string[]);
        if (modelFilter && !filteredModels.includes(modelFilter)) setModelFilter('');
      } catch {
        // ignore
      }
    })();
  }, [makeFilter]);

  const viewFromUrl = searchParams.get('view');
  useEffect(() => {
    if (viewFromUrl === 'review') {
      setViewMode('review');
      setFilter('review');
    } else {
      setViewMode('cars');
    }
  }, [viewFromUrl]);

  useEffect(() => {
    if (viewMode === 'review') loadData();
    else loadModelsData();
  }, [viewMode, filter, makeFilter, modelFilter, supplierFilter, fuelFilter, transmissionFilter]);

  useEffect(() => {
    if (!dealModalMatchId) {
      setDealModalData(null);
      setDealModalError(null);
      return;
    }
    let cancelled = false;
    setDealModalLoading(true);
    setDealModalError(null);
    (async () => {
      try {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select(`
            id, normalized_offer_id, canonical_vehicle_id, match_type, confidence_score, status, review_notes,
            normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission),
            canonical_vehicle:canonical_vehicles(id, make, model, trim, year, autodisk_id, fuel_type, transmission)
          `)
          .eq('id', dealModalMatchId)
          .single();
        if (cancelled) return;
        if (matchError || !matchData) {
          setDealModalError(matchError?.message || 'Deal not found');
          setDealModalData(null);
          return;
        }
        const match = matchData as unknown as MatchDetail;
        const canonicalVehicleId = match.canonical_vehicle_id;
        const { data: others } = await supabase
          .from('matches')
          .select(`
            id, match_type, confidence_score, status,
            normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year)
          `)
          .eq('canonical_vehicle_id', canonicalVehicleId)
          .neq('id', dealModalMatchId)
          .order('confidence_score', { ascending: false })
          .limit(20);
        if (cancelled) return;
        setDealModalData({ match, otherMatches: (others || []) as unknown as OtherMatch[] });
      } catch (e) {
        if (!cancelled) setDealModalError(e instanceof Error ? e.message : 'Failed to load deal');
      } finally {
        if (!cancelled) setDealModalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dealModalMatchId]);

  async function loadFilterOptions() {
    try {
      const { data, error } = await supabase
        .from('normalized_offers')
        .select('supplier_id, fuel_type, transmission');
      if (error) return;
      const rows = data || [];
      setSuppliers([...new Set(rows.map((r) => r.supplier_id).filter(Boolean))].sort());
      setFuelTypes([...new Set(rows.map((r) => r.fuel_type).filter(Boolean))].sort());
      setTransmissions([...new Set(rows.map((r) => r.transmission).filter(Boolean))].sort());

      const { data: cvRows } = await supabase
        .from('canonical_vehicles')
        .select('make, model');
      const all = cvRows || [];
      const distinctMakes = [...new Set(all.map((r: { make?: string }) => r.make).filter(Boolean))].sort() as string[];
      setMakes(distinctMakes);
      const filteredModels = all
        .filter((r: { make?: string }) => !makeFilter || r.make === makeFilter)
        .map((r: { model?: string }) => r.model)
        .filter(Boolean);
      setModels([...new Set(filteredModels)].sort() as string[]);
    } catch {
      // ignore
    }
  }

  async function loadModelsData() {
    try {
      setModelsLoading(true);
      setError(null);

      let cvQuery = supabase
        .from('canonical_vehicles')
        .select('id, make, model, trim, year')
        .order('make')
        .order('model')
        .order('trim');
      if (makeFilter) cvQuery = cvQuery.eq('make', makeFilter);
      if (modelFilter) cvQuery = cvQuery.eq('model', modelFilter);
      const { data: cvRows, error: cvError } = await cvQuery.limit(2000);
      if (cvError) throw cvError;

      const vehicles = (cvRows || []) as { id: number; make: string; model: string; trim: string | null; year: number | null }[];
      const vehicleIds = vehicles.map((v) => v.id);
      const modelKeyByVehicleId = new Map<number, string>();
      vehicles.forEach((v) => modelKeyByVehicleId.set(v.id, `${v.make}||${v.model}`));

      const hasOfferFilter = supplierFilter || fuelFilter || transmissionFilter;
      const selectMatches = hasOfferFilter
        ? `canonical_vehicle_id, status, match_type, normalized_offer:normalized_offers!inner(supplier_id)`
        : `canonical_vehicle_id, status, match_type, normalized_offer:normalized_offers(supplier_id)`;
      let matchQuery = supabase.from('matches').select(selectMatches);
      if (vehicleIds.length > 0) matchQuery = matchQuery.in('canonical_vehicle_id', vehicleIds);
      if (supplierFilter) matchQuery = matchQuery.eq('normalized_offers.supplier_id', supplierFilter);
      if (fuelFilter) matchQuery = matchQuery.eq('normalized_offers.fuel_type', fuelFilter);
      if (transmissionFilter) matchQuery = matchQuery.eq('normalized_offers.transmission', transmissionFilter);
      const { data: matchRows } = await matchQuery;

      const groupMap = new Map<
        string,
        {
          make: string;
          model: string;
          years: number[];
          variantCount: number;
          supplierSet: Set<string>;
          statusCounts: { approved: number; review: number; pending: number; rejected: number };
          matchTypeCounts: { deterministic: number; scored: number; override: number };
        }
      >();
      vehicles.forEach((v) => {
        const key = `${v.make}||${v.model}`;
        const group = groupMap.get(key) ?? {
          make: v.make,
          model: v.model,
          years: [],
          variantCount: 0,
          supplierSet: new Set<string>(),
          statusCounts: { approved: 0, review: 0, pending: 0, rejected: 0 },
          matchTypeCounts: { deterministic: 0, scored: 0, override: 0 },
        };
        group.variantCount += 1;
        if (v.year != null) group.years.push(v.year);
        groupMap.set(key, group);
      });

      (matchRows || []).forEach((r: any) => {
        const vid: number = r.canonical_vehicle_id;
        const key = modelKeyByVehicleId.get(vid);
        if (!key) return;
        const group = groupMap.get(key);
        if (!group) return;
        const offer = Array.isArray(r.normalized_offer) ? r.normalized_offer[0] : r.normalized_offer;
        const supplierId = offer?.supplier_id as string | undefined;
        if (supplierId) group.supplierSet.add(supplierId);

        const status = String(r.status || '');
        if (status === 'approved') group.statusCounts.approved += 1;
        else if (status === 'review') group.statusCounts.review += 1;
        else if (status === 'pending') group.statusCounts.pending += 1;
        else if (status === 'rejected') group.statusCounts.rejected += 1;

        const mt = String(r.match_type || '');
        if (mt === 'deterministic') group.matchTypeCounts.deterministic += 1;
        else if (mt === 'scored') group.matchTypeCounts.scored += 1;
        else if (mt === 'override') group.matchTypeCounts.override += 1;
      });

      const list: ModelRow[] = Array.from(groupMap.values()).map((g) => {
        const yearsSorted = g.years.slice().sort((a, b) => a - b);
        const yearMin = yearsSorted.length ? yearsSorted[0] : null;
        const yearMax = yearsSorted.length ? yearsSorted[yearsSorted.length - 1] : null;
        const suppliersSorted = Array.from(g.supplierSet).sort();
        return {
          make: g.make,
          model: g.model,
          yearMin,
          yearMax,
          variantCount: g.variantCount,
          supplierCount: suppliersSorted.length,
          suppliers: suppliersSorted.slice(0, 3),
          statusCounts: g.statusCounts,
          matchTypeCounts: g.matchTypeCounts,
        };
      });

      list.sort((a, b) => b.supplierCount - a.supplierCount || b.variantCount - a.variantCount || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));

      setModelsList(list);
      setFilteredCount(list.length);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cars');
      setModelsList([]);
    } finally {
      setModelsLoading(false);
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const [totalResult, approvedResult, reviewResult, pendingResult, rejectedResult, deterministicResult, scoredResult, overrideResult] = await Promise.all([
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'review'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('match_type', 'deterministic'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('match_type', 'scored'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('match_type', 'override'),
      ]);
      const errors = [totalResult.error, approvedResult.error, reviewResult.error, pendingResult.error, rejectedResult.error, deterministicResult.error, scoredResult.error, overrideResult.error].filter(Boolean);
      if (errors.length > 0) throw new Error('Stats failed');
      setStats({
        total: totalResult.count || 0,
        approved: approvedResult.count || 0,
        review: reviewResult.count || 0,
        pending: pendingResult.count || 0,
        rejected: rejectedResult.count || 0,
        deterministic: deterministicResult.count || 0,
        scored: scoredResult.count || 0,
        override: overrideResult.count || 0,
      });
    } catch {
      setStats(null);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const statusFilter = viewMode === 'review' ? 'review' : filter;
      const hasOfferFilter = supplierFilter || fuelFilter || transmissionFilter;
      const selectWithJoin = hasOfferFilter
        ? `
          *,
          normalized_offer:normalized_offers!inner(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission),
          canonical_vehicle:canonical_vehicles(make, model, trim, year, autodisk_id, fuel_type, transmission)
        `
        : `
          *,
          normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission),
          canonical_vehicle:canonical_vehicles(make, model, trim, year, autodisk_id, fuel_type, transmission)
        `;

      let query = supabase
        .from('matches')
        .select(selectWithJoin)
        .order('matched_at', { ascending: false })
        .limit(1000);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (supplierFilter) query = query.eq('normalized_offers.supplier_id', supplierFilter);
      if (fuelFilter) query = query.eq('normalized_offers.fuel_type', fuelFilter);
      if (transmissionFilter) query = query.eq('normalized_offers.transmission', transmissionFilter);

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error('Query error:', queryError);
        // Handle case where table doesn't exist or no matches
        if (queryError.code === 'PGRST116' || queryError.message?.includes('does not exist')) {
          console.log('No matches table or no matches found');
          setMatches([]);
        } else {
          throw queryError;
        }
      }

      const rows = data || [];
      setMatches(rows);

      if (rows.length === 0) {
        setFilteredCount(0);
      } else {
        try {
          let countQuery = supabase.from('matches').select('*', { count: 'exact', head: true });
          if (statusFilter !== 'all') countQuery = countQuery.eq('status', statusFilter);
          if (supplierFilter) countQuery = countQuery.eq('normalized_offers.supplier_id', supplierFilter);
          if (fuelFilter) countQuery = countQuery.eq('normalized_offers.fuel_type', fuelFilter);
          if (transmissionFilter) countQuery = countQuery.eq('normalized_offers.transmission', transmissionFilter);
          const { count: countResult } = await countQuery;
          setFilteredCount(countResult ?? rows.length);
        } catch {
          setFilteredCount(rows.length);
        }
      }

      await loadStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      console.error('Error loading data:', err);
      // Don't block UI if it's just "no matches" - that's expected
      if (!errorMessage.includes('matches')) {
        setLoading(false);
      } else {
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateMatchStatus(matchId: number, newStatus: string) {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: newStatus })
        .eq('id', matchId);

      if (error) throw error;

      // Optimistically update local state so UI reacts immediately
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: newStatus } : m))
      );

      // Reload data to get accurate stats from database
      await loadData();
    } catch (err) {
      alert('Failed to update status: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function getScoreClass(score: number): string {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.6) return 'score-medium';
    return 'score-low';
  }

  function truncate(str: string | null | undefined, max: number): string {
    if (!str) return '';
    return str.length <= max ? str : str.slice(0, max) + '…';
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <div className="header">
          <h1>Leaseconnect</h1>
        </div>
        <div className="error" style={{ maxWidth: '560px' }}>
          <strong>Supabase not configured.</strong>
          <p style={{ marginTop: '8px', marginBottom: '0' }}>
            Create <code>.env.local</code> with <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. See the README.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>{viewMode === 'cars' ? 'Inventory' : 'Review queue'}</h1>
        <p>{viewMode === 'cars' ? 'Models and variants with supplier coverage and mapping status' : 'Work queue for uncertain mappings that need review'}</p>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {stats && (
        <div className="stats-bar">
          <span className="stats-bar-item">
            <span className="stats-bar-value">{stats.total.toLocaleString()}</span>
            <span className="stats-bar-label">Total matches</span>
          </span>
          <span className="stats-bar-item">
            <span className="stats-bar-value">{stats.approved.toLocaleString()}</span>
            <span className="stats-bar-label">Approved {stats.total > 0 ? `(${((stats.approved / stats.total) * 100).toFixed(0)}%)` : ''}</span>
          </span>
          <span className="stats-bar-item">
            <span className="stats-bar-value">{stats.review.toLocaleString()}</span>
            <span className="stats-bar-label">Review queue</span>
          </span>
          <span className="stats-bar-item">
            <span className="stats-bar-value">Det {stats.deterministic} · Scored {stats.scored} · Over {stats.override}</span>
            <span className="stats-bar-label">Match types</span>
          </span>
        </div>
      )}

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <h3 className="sidebar-title">Filters</h3>
          {viewMode === 'review' && (
          <div className="sidebar-section">
            <span className="sidebar-label">Status</span>
            <div className="sidebar-tabs">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({stats?.total ?? 0})
              </button>
              <button
                className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
                onClick={() => setFilter('approved')}
              >
                Approved ({stats?.approved ?? 0})
              </button>
              <button
                className={`filter-tab ${filter === 'review' ? 'active' : ''}`}
                onClick={() => setFilter('review')}
              >
                Review ({stats?.review ?? 0})
              </button>
              <button
                className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
              >
                Pending ({stats?.pending ?? 0})
              </button>
            </div>
          </div>
          )}
          {viewMode === 'cars' && (
            <>
              <div className="sidebar-section">
                <span className="sidebar-label">Make</span>
                <select
                  value={makeFilter}
                  onChange={(e) => setMakeFilter(e.target.value)}
                  className="filter-select filter-select-full"
                >
                  <option value="">All makes</option>
                  {makes.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="sidebar-section">
                <span className="sidebar-label">Model</span>
                <select
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="filter-select filter-select-full"
                >
                  <option value="">All models</option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="sidebar-section">
            <span className="sidebar-label">Supplier</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="filter-select filter-select-full"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="sidebar-section">
            <span className="sidebar-label">Fuel</span>
            <select
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
              className="filter-select filter-select-full"
            >
              <option value="">All</option>
              {fuelTypes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="sidebar-section">
            <span className="sidebar-label">Transmission</span>
            <select
              value={transmissionFilter}
              onChange={(e) => setTransmissionFilter(e.target.value)}
              className="filter-select filter-select-full"
            >
              <option value="">All</option>
              {transmissions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {(filter !== 'all' || makeFilter || modelFilter || supplierFilter || fuelFilter || transmissionFilter) && (
            <button
              type="button"
              className="clear-filters"
              onClick={() => { setFilter('all'); setMakeFilter(''); setModelFilter(''); setSupplierFilter(''); setFuelFilter(''); setTransmissionFilter(''); }}
            >
              Clear filters
            </button>
          )}
        </aside>

        <main className="dashboard-main">
      {viewMode === 'cars' ? (
        <>
          <div className="table-container table-container-header-only">
            <div className="table-header">
              <h2>Models</h2>
              <div className="table-header-right">
                <span className="result-count">
                  {filteredCount != null ? `${filteredCount.toLocaleString()} model${filteredCount !== 1 ? 's' : ''}` : ''}
                </span>
                <button onClick={() => loadModelsData()} className="btn-refresh">Refresh</button>
              </div>
            </div>
          </div>
          {modelsLoading ? (
            <div className="dashboard-list-area">
              <div className="loading">Loading cars...</div>
            </div>
          ) : modelsList.length === 0 ? (
            <div className="dashboard-list-area">
              <div className="loading">
                No cars found.{' '}
                {!supplierFilter && !fuelFilter && !transmissionFilter && (
                  <span>Run <code>npm run load-autodisk</code> to load canonical vehicles.</span>
                )}
              </div>
            </div>
          ) : (
            <div className="dashboard-list-area">
            <div className="model-list">
                {modelsList.map((row) => {
                  const href = `/model/${encodeURIComponent(row.make)}/${encodeURIComponent(row.model)}`;
                  const yearsLabel =
                    row.yearMin != null && row.yearMax != null
                      ? row.yearMin === row.yearMax
                        ? String(row.yearMin)
                        : `${row.yearMin}–${row.yearMax}`
                      : '—';
                  const suppliersLabel =
                    row.suppliers.length > 0
                      ? `${row.suppliers.join(', ')}${row.supplierCount > row.suppliers.length ? ', …' : ''}`
                      : '—';
                  const review = row.statusCounts.review;
                  const approved = row.statusCounts.approved;
                  const det = row.matchTypeCounts.deterministic;
                  const scored = row.matchTypeCounts.scored;
                  const ov = row.matchTypeCounts.override;

                  return (
                    <div key={`${row.make}||${row.model}`} className="model-row-card">
                      <Link href={href} className="model-row-link">
                        <div className="model-row-left">
                          <CarImage make={row.make} model={row.model} year={row.yearMax ?? row.yearMin} className="model-row-img" />
                        </div>
                        <div className="model-row-main">
                          <div className="model-row-title">
                            <strong>{row.make} {row.model}</strong>
                            <span className="model-row-years">({yearsLabel})</span>
                          </div>
                          <div className="model-row-meta">
                            <span>{row.variantCount} variants</span>
                            <span className="model-row-sep">·</span>
                            <span>{row.supplierCount} supplier{row.supplierCount !== 1 ? 's' : ''}</span>
                            {suppliersLabel !== '—' && (
                              <>
                                <span className="model-row-sep">·</span>
                                <span className="model-row-suppliers">{suppliersLabel}</span>
                              </>
                            )}
                          </div>
                          <div className="model-row-badges">
                            <span className="badge badge-approved">{approved} approved</span>
                            <span className="badge badge-review">{review} review</span>
                            <span className="model-row-types">Det {det} · Scored {scored} · Over {ov}</span>
                          </div>
                        </div>
                        <div className="model-row-cta">
                          <span className="btn-bekijk-deals">Bekijk uitvoeringen</span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="review-queue-layout">
          <div className="table-container table-container-header-only">
            <div className="table-header">
              <h2>Review queue</h2>
              <div className="table-header-right">
                <span className="result-count">
                  {filteredCount !== null
                    ? `${filteredCount.toLocaleString()} match${filteredCount !== 1 ? 'es' : ''}`
                    : stats != null
                      ? `${(stats.total).toLocaleString()} matches`
                      : ''}
                </span>
                <button onClick={() => loadData()} className="btn-refresh">Refresh</button>
              </div>
            </div>
          </div>
        {loading ? (
          <div className="dashboard-list-area">
            <div className="loading">Loading matches...</div>
          </div>
        ) : matches.length === 0 ? (
          <div className="dashboard-list-area">
            <div className="loading">
              No matches found.{' '}
              {stats?.total === 0 && (
                <span>
                  Run <code>npm run rematch-all</code> to generate matches.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="dashboard-list-area">
            <div className="review-table-wrapper">
              <table className="table-matches table-matches-cards">
            <thead>
              <tr>
                <th className="th-thumb">Car</th>
                <th>Supplier Offer</th>
                <th>Canonical Vehicle</th>
                <th>Confidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <React.Fragment key={match.id}>
                <tr
                  className={`tr-clickable${expandedId === match.id ? ' tr-expanded' : ''}`}
                  onClick={() => setExpandedId(expandedId === match.id ? null : match.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(expandedId === match.id ? null : match.id);
                    }
                  }}
                >
                  <td className="td-thumb">
                    {match.canonical_vehicle && (
                      <CarImage
                        make={match.canonical_vehicle.make}
                        model={match.canonical_vehicle.model}
                        year={match.canonical_vehicle.year ?? undefined}
                        className="match-row-img"
                      />
                    )}
                  </td>
                  <td>
                    <div className="deal-line-cell deal-line-cell-with-icon">
                      <span className="row-expand-icon" aria-hidden>
                        {expandedId === match.id ? '▼' : '▶'}
                      </span>
                      <div className="deal-line-inner">
                        <div className="deal-line-main">
                          {match.normalized_offer?.make || 'N/A'}{' '}
                          {match.normalized_offer?.model || 'N/A'}
                          {match.normalized_offer?.trim && (
                            <> · {truncate(match.normalized_offer.trim, 32)}</>
                          )}
                          {match.normalized_offer?.year != null && (
                            <> ({match.normalized_offer.year})</>
                          )}
                        </div>
                        <div className="deal-line-meta">{match.normalized_offer?.supplier_id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="deal-line-cell">
                      <div className="deal-line-main">
                        {match.canonical_vehicle?.make || 'N/A'}{' '}
                        {match.canonical_vehicle?.model || 'N/A'}
                        {match.canonical_vehicle?.trim && (
                          <> · {truncate(match.canonical_vehicle.trim, 32)}</>
                        )}
                        {match.canonical_vehicle?.year != null && (
                          <> ({match.canonical_vehicle.year})</>
                        )}
                      </div>
                      <div className="deal-line-meta">ID: {match.canonical_vehicle?.autodisk_id}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`score ${getScoreClass(match.confidence_score)}`}>
                      {(match.confidence_score * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="actions-cell">
                      <button type="button" className="btn-view-deal" onClick={() => setDealModalMatchId(match.id)}>
                        View deal
                      </button>
                      {match.status === 'review' && (
                        <>
                        <button
                          onClick={() => updateMatchStatus(match.id, 'approved')}
                          className="btn-approve"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateMatchStatus(match.id, 'rejected')}
                          className="btn-reject"
                        >
                          Reject
                        </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === match.id && (
                  <tr className="review-expanded-row">
                    <td colSpan={5}>
                      <div className="review-key-details">
                        <div className="review-key-details-grid">
                          <div className="review-key-details-section">
                            <h4 className="review-key-details-heading">Supplier offer</h4>
                            <dl className="review-key-details-list">
                              <dt>Make / model</dt>
                              <dd>{match.normalized_offer?.make || '–'} · {match.normalized_offer?.model || '–'}</dd>
                              <dt>Trim</dt>
                              <dd>{match.normalized_offer?.trim || '–'}</dd>
                              <dt>Year</dt>
                              <dd>{match.normalized_offer?.year ?? '–'}</dd>
                              <dt>Fuel / transmission</dt>
                              <dd>{(match.normalized_offer?.fuel_type || '–')} / {(match.normalized_offer?.transmission || '–')}</dd>
                              <dt>Supplier & offer ID</dt>
                              <dd>{match.normalized_offer?.supplier_id || '–'} · {match.normalized_offer?.supplier_offer_id || '–'}</dd>
                            </dl>
                          </div>
                          <div className="review-key-details-section">
                            <h4 className="review-key-details-heading">Canonical vehicle</h4>
                            <dl className="review-key-details-list">
                              <dt>Make / model</dt>
                              <dd>{match.canonical_vehicle?.make || '–'} · {match.canonical_vehicle?.model || '–'}</dd>
                              <dt>Trim</dt>
                              <dd>{match.canonical_vehicle?.trim || '–'}</dd>
                              <dt>Year</dt>
                              <dd>{match.canonical_vehicle?.year ?? '–'}</dd>
                              <dt>Fuel / transmission</dt>
                              <dd>{(match.canonical_vehicle?.fuel_type || '–')} / {(match.canonical_vehicle?.transmission || '–')}</dd>
                              <dt>Autodisk ID</dt>
                              <dd>{match.canonical_vehicle?.autodisk_id || '–'}</dd>
                            </dl>
                          </div>
                          <div className="review-key-details-section">
                            <h4 className="review-key-details-heading">Match info</h4>
                            <dl className="review-key-details-list">
                              <dt>Match type</dt>
                              <dd><span className={`badge badge-${match.match_type}`}>{match.match_type}</span></dd>
                              <dt>Status</dt>
                              <dd><span className={`badge badge-${match.status}`}>{match.status}</span></dd>
                              <dt>Confidence</dt>
                              <dd><span className={`score ${getScoreClass(match.confidence_score)}`}>{(match.confidence_score * 100).toFixed(1)}%</span></dd>
                              {match.matched_at && (
                                <>
                                  <dt>Matched at</dt>
                                  <dd>{new Date(match.matched_at).toLocaleString()}</dd>
                                </>
                              )}
                            </dl>
                          </div>
                        </div>
                        <div className="review-key-details-notes">
                          <h4 className="review-key-details-heading">Why matched</h4>
                          <p>{match.review_notes || 'No explanation available for this match.'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        )}
          </div>
        </>
      )}
        </main>
      </div>

      {dealModalMatchId != null && (
        <div className="modal-overlay" onClick={() => setDealModalMatchId(null)} role="dialog" aria-modal="true" aria-label="Deal detail">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <DealDetailPanel
              match={dealModalData?.match ?? null}
              otherMatches={dealModalData?.otherMatches ?? []}
              loading={dealModalLoading}
              error={dealModalError}
              onClose={() => setDealModalMatchId(null)}
              onViewDeal={(id) => setDealModalMatchId(id)}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="dashboard-main" style={{ padding: 24 }}><p>Loading...</p></div>}>
      <Home />
    </Suspense>
  );
}
