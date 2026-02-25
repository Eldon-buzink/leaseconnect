'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DealDetailPanel, type MatchDetail, type OtherMatch } from '@/app/components/DealDetailPanel';

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

interface CarRow {
  id: number;
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
  autodisk_id: string;
  matchCount: number;
  suppliers: string[];
}

function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [fuelFilter, setFuelFilter] = useState<string>('');
  const [transmissionFilter, setTransmissionFilter] = useState<string>('');
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [transmissions, setTransmissions] = useState<string[]>([]);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'cars' | 'review'>('cars');
  const [cars, setCars] = useState<CarRow[]>([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [expandedCarId, setExpandedCarId] = useState<number | null>(null);
  const [carMatches, setCarMatches] = useState<Match[]>([]);
  const [carMatchesLoading, setCarMatchesLoading] = useState(false);
  const [dealModalMatchId, setDealModalMatchId] = useState<number | null>(null);
  const [dealModalData, setDealModalData] = useState<{ match: MatchDetail; otherMatches: OtherMatch[] } | null>(null);
  const [dealModalLoading, setDealModalLoading] = useState(false);
  const [dealModalError, setDealModalError] = useState<string | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

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
    else loadCarsData();
  }, [viewMode, filter, supplierFilter, fuelFilter, transmissionFilter]);

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
    } catch {
      // ignore
    }
  }

  async function loadCarsData() {
    try {
      setCarsLoading(true);
      setError(null);
      const hasOfferFilter = supplierFilter || fuelFilter || transmissionFilter;
      const selectMatches = hasOfferFilter
        ? `canonical_vehicle_id, normalized_offer:normalized_offers!inner(supplier_id)`
        : `canonical_vehicle_id, normalized_offer:normalized_offers(supplier_id)`;
      let matchQuery = supabase.from('matches').select(selectMatches);
      if (supplierFilter) matchQuery = matchQuery.eq('normalized_offers.supplier_id', supplierFilter);
      if (fuelFilter) matchQuery = matchQuery.eq('normalized_offers.fuel_type', fuelFilter);
      if (transmissionFilter) matchQuery = matchQuery.eq('normalized_offers.transmission', transmissionFilter);
      const { data: matchRows } = await matchQuery;
      const countByVehicle: Record<number, { count: number; suppliers: Set<string> }> = {};
      (matchRows || []).forEach((r: { canonical_vehicle_id: number; normalized_offer: { supplier_id?: string } | { supplier_id?: string }[] }) => {
        const id = r.canonical_vehicle_id;
        const offer = Array.isArray(r.normalized_offer) ? r.normalized_offer[0] : r.normalized_offer;
        if (!countByVehicle[id]) countByVehicle[id] = { count: 0, suppliers: new Set() };
        countByVehicle[id].count++;
        if (offer?.supplier_id) countByVehicle[id].suppliers.add(offer.supplier_id);
      });
      const vehicleIds = Object.keys(countByVehicle).map(Number);
      let cvQuery = supabase.from('canonical_vehicles').select('id, make, model, trim, year, autodisk_id').order('make').order('model');
      if (vehicleIds.length > 0 && hasOfferFilter) {
        cvQuery = cvQuery.in('id', vehicleIds);
      } else {
        cvQuery = cvQuery.limit(1500);
      }
      const { data: cvRows, error: cvError } = await cvQuery;
      if (cvError) throw cvError;
      const list: CarRow[] = (cvRows || []).map((cv: { id: number; make: string; model: string; trim: string | null; year: number | null; autodisk_id: string }) => {
        const info = countByVehicle[cv.id];
        const matchCount = info?.count ?? 0;
        const suppliers = info ? [...info.suppliers].sort() : [];
        return { ...cv, matchCount, suppliers };
      });
      if (!hasOfferFilter) {
        list.sort((a, b) => b.matchCount - a.matchCount);
      }
      setCars(list);
      setFilteredCount(list.length);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cars');
      setCars([]);
    } finally {
      setCarsLoading(false);
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

  async function loadMatchesForCar(canonicalVehicleId: number) {
    setCarMatchesLoading(true);
    try {
      const hasOfferFilter = supplierFilter || fuelFilter || transmissionFilter;
      const selectWithJoin = hasOfferFilter
        ? `*, normalized_offer:normalized_offers!inner(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission), canonical_vehicle:canonical_vehicles(make, model, trim, year, autodisk_id, fuel_type, transmission)`
        : `*, normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission), canonical_vehicle:canonical_vehicles(make, model, trim, year, autodisk_id, fuel_type, transmission)`;
      let q = supabase.from('matches').select(selectWithJoin).eq('canonical_vehicle_id', canonicalVehicleId).order('confidence_score', { ascending: false });
      if (supplierFilter) q = q.eq('normalized_offers.supplier_id', supplierFilter);
      if (fuelFilter) q = q.eq('normalized_offers.fuel_type', fuelFilter);
      if (transmissionFilter) q = q.eq('normalized_offers.transmission', transmissionFilter);
      const { data } = await q;
      setCarMatches((data || []) as Match[]);
    } catch {
      setCarMatches([]);
    } finally {
      setCarMatchesLoading(false);
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
            Create <code>web/.env.local</code> with <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. See <code>web/.env.local.example</code> or the docs.
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
        <h1>{viewMode === 'cars' ? 'Cars' : 'Review'}</h1>
        <p>{viewMode === 'cars' ? 'Canonical vehicles and offer counts' : 'Matches that need your approval'}</p>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Matches</h3>
            <div className="value">{stats.total.toLocaleString()}</div>
            <div className="label">All matches found</div>
          </div>
          <div className="stat-card">
            <h3>Approved</h3>
            <div className="value">{stats.approved.toLocaleString()}</div>
            <div className="label">
              {stats.total > 0 ? `${((stats.approved / stats.total) * 100).toFixed(1)}%` : '0%'}
            </div>
          </div>
          <div className="stat-card">
            <h3>Review Queue</h3>
            <div className="value">{stats.review.toLocaleString()}</div>
            <div className="label">Needs manual review</div>
          </div>
          <div className="stat-card">
            <h3>Match Types</h3>
            <div className="value">{stats.deterministic + stats.scored + stats.override}</div>
            <div className="label">
              Det: {stats.deterministic} | Scored: {stats.scored} | Override: {stats.override}
            </div>
          </div>
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
          {(filter !== 'all' || supplierFilter || fuelFilter || transmissionFilter) && (
            <button
              type="button"
              className="clear-filters"
              onClick={() => { setFilter('all'); setSupplierFilter(''); setFuelFilter(''); setTransmissionFilter(''); }}
            >
              Clear filters
            </button>
          )}
        </aside>

        <main className="dashboard-main">
      <div className="table-container">
        <div className="table-header">
          <h2>{viewMode === 'cars' ? 'Canonical vehicles' : 'Matches'}</h2>
          <div className="table-header-right">
            <span className="result-count">
              {viewMode === 'cars'
                ? (filteredCount != null ? `${filteredCount.toLocaleString()} car${filteredCount !== 1 ? 's' : ''}` : '')
                : filteredCount !== null
                  ? `${filteredCount.toLocaleString()} match${filteredCount !== 1 ? 'es' : ''}`
                  : stats != null
                    ? `${(stats.total).toLocaleString()} matches`
                    : ''}
            </span>
            <button
              onClick={() => viewMode === 'cars' ? loadCarsData() : loadData()}
              className="btn-refresh"
            >
              Refresh
            </button>
          </div>
        </div>
        {viewMode === 'cars' ? (
          carsLoading ? (
            <div className="loading">Loading cars...</div>
          ) : cars.length === 0 ? (
            <div className="loading">
              No cars found.{' '}
              {!supplierFilter && !fuelFilter && !transmissionFilter && (
                <span>Run <code>npm run load-autodisk</code> to load canonical vehicles.</span>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="th-image">Image</th>
                  <th>Car</th>
                  <th>Autodisk ID</th>
                  <th>Offers</th>
                  <th>Suppliers</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => (
                  <React.Fragment key={car.id}>
                    <tr
                      className="tr-clickable"
                      onClick={() => {
                        const next = expandedCarId === car.id ? null : car.id;
                        setExpandedCarId(next);
                        if (next) loadMatchesForCar(next);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const next = expandedCarId === car.id ? null : car.id;
                          setExpandedCarId(next);
                          if (next) loadMatchesForCar(next);
                        }
                      }}
                    >
                      <td className="td-image">
                        <div className="car-img-placeholder" aria-hidden>Image</div>
                      </td>
                      <td>
                        <div className="deal-line-cell deal-line-cell-with-icon">
                          <span className="row-expand-icon" aria-hidden>
                            {expandedCarId === car.id ? '▼' : '▶'}
                          </span>
                          <div className="deal-line-inner">
                            <div className="deal-line-main">
                              {car.make} {car.model}
                              {car.trim && <> · {car.trim}</>}
                              {car.year != null && <> ({car.year})</>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{car.autodisk_id}</td>
                      <td>{car.matchCount}</td>
                      <td>{car.suppliers.length ? car.suppliers.join(', ') : '—'}</td>
                    </tr>
                    {expandedCarId === car.id && (
                      <tr>
                        <td colSpan={5}>
                          <div className="car-offers-expanded">
                            {carMatchesLoading ? (
                              <div className="loading">Loading offers...</div>
                            ) : carMatches.length === 0 ? (
                              <p className="deal-muted">No offers for this car.</p>
                            ) : (
                              <table className="deal-table">
                                <thead>
                                  <tr>
                                    <th>Supplier</th>
                                    <th>Offer</th>
                                    <th>Match type</th>
                                    <th>Confidence</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {carMatches.map((m) => (
                                    <tr key={m.id}>
                                      <td>{m.normalized_offer?.supplier_id}</td>
                                      <td>{m.normalized_offer?.make} {m.normalized_offer?.model} {m.normalized_offer?.trim && ` · ${m.normalized_offer.trim}`}</td>
                                      <td><span className={`badge badge-${m.match_type}`}>{m.match_type}</span></td>
                                      <td><span className={`score ${getScoreClass(m.confidence_score)}`}>{(m.confidence_score * 100).toFixed(1)}%</span></td>
                                      <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                                      <td onClick={(e) => e.stopPropagation()}>
                                        <div className="actions-cell">
                                          <button type="button" className="btn-view-deal" onClick={(e) => { e.stopPropagation(); setDealModalMatchId(m.id); }}>View deal</button>
                                          {m.status === 'review' && (
                                            <>
                                              <button type="button" className="btn-approve" onClick={() => updateMatchStatus(m.id, 'approved')}>Approve</button>
                                              <button type="button" className="btn-reject" onClick={() => updateMatchStatus(m.id, 'rejected')}>Reject</button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )
        ) : loading ? (
          <div className="loading">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="loading">
            No matches found.{' '}
            {stats?.total === 0 && (
              <span>
                Run <code>npm run rematch-all</code> to generate matches.
              </span>
            )}
          </div>
        ) : (
          <table className="table-matches">
            <thead>
              <tr>
                <th>Supplier Offer</th>
                <th>Canonical Vehicle</th>
                <th>Match Type</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <React.Fragment key={match.id}>
                <tr
                  className="tr-clickable"
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
                    <span className={`badge badge-${match.match_type}`}>{match.match_type}</span>
                  </td>
                  <td>
                    <span className={`score ${getScoreClass(match.confidence_score)}`}>
                      {(match.confidence_score * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${match.status}`}>{match.status}</span>
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
                  <tr>
                    <td colSpan={6}>
                      <div style={{ fontSize: '11px', color: '#555', paddingTop: '8px' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Key details:</strong>
                        </div>
                        <div>
                          <strong>Make/Model:</strong>{' '}
                          {match.normalized_offer?.make || '–'} /{' '}
                          {match.canonical_vehicle?.make || '–'} |{' '}
                          {match.normalized_offer?.model || '–'} /{' '}
                          {match.canonical_vehicle?.model || '–'}
                        </div>
                        <div>
                          <strong>Trim:</strong>{' '}
                          {match.normalized_offer?.trim || '–'} /{' '}
                          {match.canonical_vehicle?.trim || '–'}
                        </div>
                        <div>
                          <strong>Year:</strong>{' '}
                          {match.normalized_offer?.year ?? '–'} /{' '}
                          {match.canonical_vehicle?.year ?? '–'}
                        </div>
                        <div style={{ marginTop: '6px' }}>
                          <strong>Why matched:</strong>{' '}
                          {match.review_notes || 'No explanation available for this match.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
