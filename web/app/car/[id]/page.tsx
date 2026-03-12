'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CarImage } from '@/app/components/CarImage';

interface CanonicalVehicle {
  id: number;
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
  autodisk_id: string;
  fuel_type?: string | null;
  transmission?: string | null;
}

interface MatchRow {
  id: number;
  match_type: string;
  confidence_score: number;
  status: string;
  normalized_offer: {
    supplier_id: string;
    supplier_offer_id: string;
    make: string;
    model: string;
    trim: string | null;
    year: number | null;
    fuel_type?: string | null;
    transmission?: string | null;
  };
}

interface VariantRow {
  id: number;
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
}

function getScoreClass(score: number): string {
  if (score >= 0.8) return 'score-high';
  if (score >= 0.6) return 'score-medium';
  return 'score-low';
}

function pickBestDealsBySupplier(rows: MatchRow[]): MatchRow[] {
  const statusPriority: Record<string, number> = {
    approved: 3,
    review: 2,
    pending: 1,
    rejected: 0,
  };

  const bySupplier = new Map<string, MatchRow>();

  rows.forEach((row) => {
    const offerAny: any = row.normalized_offer;
    const supplierId: string | undefined = Array.isArray(offerAny)
      ? offerAny[0]?.supplier_id
      : offerAny?.supplier_id;

    if (!supplierId) return;

    const existing = bySupplier.get(supplierId);
    if (!existing) {
      bySupplier.set(supplierId, row);
      return;
    }

    const currentScore = statusPriority[row.status] ?? 0;
    const existingScore = statusPriority[existing.status] ?? 0;

    if (currentScore > existingScore) {
      bySupplier.set(supplierId, row);
      return;
    }

    if (currentScore < existingScore) {
      return;
    }

    if (row.confidence_score > existing.confidence_score) {
      bySupplier.set(supplierId, row);
    }
  });

  return Array.from(bySupplier.values());
}

export default function CarPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [vehicle, setVehicle] = useState<CanonicalVehicle | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [deals, setDeals] = useState<MatchRow[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [transmissions, setTransmissions] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');
  const [transmissionFilter, setTransmissionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setError('Invalid car id');
      setLoading(false);
      return;
    }
    loadCarAndDeals();
  }, [id]);

  useEffect(() => {
    if (!vehicle) return;
    loadDeals();
  }, [vehicle?.id, supplierFilter, fuelFilter, transmissionFilter]);

  async function loadCarAndDeals() {
    try {
      setLoading(true);
      setError(null);

      const { data: cvData, error: cvError } = await supabase
        .from('canonical_vehicles')
        .select('id, make, model, trim, year, autodisk_id, fuel_type, transmission')
        .eq('id', id)
        .single();

      if (cvError || !cvData) {
        setError(cvError?.message || 'Car not found');
        setVehicle(null);
        setDeals([]);
        setVariants([]);
        setLoading(false);
        return;
      }

      setVehicle(cvData as CanonicalVehicle);

      const make = (cvData as CanonicalVehicle).make;
      const model = (cvData as CanonicalVehicle).model;

      const { data: variantData } = await supabase
        .from('canonical_vehicles')
        .select('id, make, model, trim, year')
        .eq('make', make)
        .eq('model', model)
        .order('trim');

      setVariants((variantData || []).filter((v: VariantRow) => v.id !== id) as VariantRow[]);

      const { data: filterData } = await supabase
        .from('normalized_offers')
        .select('supplier_id, fuel_type, transmission');
      const rows = filterData || [];
      setSuppliers([...new Set(rows.map((r: { supplier_id?: string }) => r.supplier_id).filter(Boolean))].sort() as string[]);
      setFuelTypes([...new Set(rows.map((r: { fuel_type?: string }) => r.fuel_type).filter(Boolean))].sort() as string[]);
      setTransmissions([...new Set(rows.map((r: { transmission?: string }) => r.transmission).filter(Boolean))].sort() as string[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load car');
      setVehicle(null);
      setDeals([]);
      setVariants([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDeals() {
    if (!vehicle) return;
    try {
      const hasFilter = supplierFilter || fuelFilter || transmissionFilter;
      const select = hasFilter
        ? `id, match_type, confidence_score, status, normalized_offer:normalized_offers!inner(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission)`
        : `id, match_type, confidence_score, status, normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission)`;
      let q = supabase
        .from('matches')
        .select(select)
        .eq('canonical_vehicle_id', vehicle.id)
        .order('confidence_score', { ascending: false });
      if (supplierFilter) q = q.eq('normalized_offers.supplier_id', supplierFilter);
      if (fuelFilter) q = q.eq('normalized_offers.fuel_type', fuelFilter);
      if (transmissionFilter) q = q.eq('normalized_offers.transmission', transmissionFilter);
      const { data } = await q;
      const raw = (data || []) as unknown as MatchRow[];
      const bestPerSupplier = pickBestDealsBySupplier(raw);
      setDeals(bestPerSupplier);
    } catch {
      setDeals([]);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <div className="error">Supabase not configured.</div>
      </div>
    );
  }

  if (loading && !vehicle) {
    return (
      <div className="container">
        <div className="car-page-header">
          <Link href="/" className="deal-back">← Back</Link>
        </div>
        <div className="loading">Loading car...</div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="container">
        <div className="car-page-header">
          <Link href="/" className="deal-back">← Back</Link>
        </div>
        <div className="error">{error || 'Car not found'}</div>
      </div>
    );
  }

  const carTitle = `${vehicle.make} ${vehicle.model}`.trim();
  const carSubtitle = [vehicle.trim, vehicle.fuel_type, vehicle.transmission].filter(Boolean).join(' · ') || null;
  const hasFilters = supplierFilter || fuelFilter || transmissionFilter;
  const modelHref = `/model/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}`;
  const variantOptions: VariantRow[] = [
    { id: vehicle.id, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, year: vehicle.year },
    ...variants,
  ].sort((a, b) => String(a.trim ?? '').localeCompare(String(b.trim ?? '')) || (a.year ?? 0) - (b.year ?? 0));
  const currentVariantLabel = vehicle.trim || (vehicle.year != null ? String(vehicle.year) : 'Variant');

  return (
    <div className="container">
      <nav className="car-page-breadcrumb">
        <Link href="/">Zoeken</Link>
        <span className="car-page-breadcrumb-sep">›</span>
        <Link href={modelHref}>{carTitle}</Link>
        <span className="car-page-breadcrumb-sep">›</span>
        <span>{currentVariantLabel}</span>
      </nav>

      <header className="car-page-header">
        <Link href="/" className="car-page-back-btn">← Back</Link>
        <div className="car-page-hero">
          <div className="car-page-hero-text">
            <h1 className="car-page-title">{carTitle}</h1>
            {carSubtitle && <p className="car-page-subtitle">{carSubtitle}</p>}
          </div>
          <CarImage make={vehicle.make} model={vehicle.model} trim={vehicle.trim} year={vehicle.year} fuelType={vehicle.fuel_type} className="car-page-hero-img" />
        </div>
      </header>

      <div className="car-page-filters">
        <span className="car-page-filters-label">Variant</span>
        <select
          value={vehicle.id}
          onChange={(e) => router.push(`/car/${Number(e.target.value)}`)}
          className="filter-select car-page-filter-select"
        >
          {variantOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.trim || 'Variant'}{v.year != null ? ` (${v.year})` : ''}
            </option>
          ))}
        </select>

        <span className="car-page-filters-label" style={{ marginLeft: 8 }}>Deal filters</span>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="filter-select car-page-filter-select"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={fuelFilter}
          onChange={(e) => setFuelFilter(e.target.value)}
          className="filter-select car-page-filter-select"
        >
          <option value="">All fuel types</option>
          {fuelTypes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={transmissionFilter}
          onChange={(e) => setTransmissionFilter(e.target.value)}
          className="filter-select car-page-filter-select"
        >
          <option value="">All transmissions</option>
          {transmissions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" className="clear-filters" onClick={() => { setSupplierFilter(''); setFuelFilter(''); setTransmissionFilter(''); }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="car-page-deals-section">
        <p className="car-page-deals-count">
          {deals.length} deal{deals.length !== 1 ? 's' : ''} gevonden
        </p>
        {deals.length === 0 ? (
          <p className="deal-muted">No deals match the current filters.</p>
        ) : (
          <table className="deal-table car-page-deals-table">
            <thead>
              <tr>
                <th>Leasemaatschappij</th>
                <th>Soort deal</th>
                <th>Originele naam</th>
                <th className="th-center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((m) => {
                const offer = Array.isArray(m.normalized_offer) ? m.normalized_offer[0] : m.normalized_offer;
                const originalName = offer ? [offer.make, offer.model, offer.trim].filter(Boolean).join(' ') || offer.supplier_offer_id : '—';
                return (
                  <tr key={m.id}>
                    <td>{offer?.supplier_id ?? '—'}</td>
                    <td><span className={`badge badge-${m.match_type}`}>{m.match_type}</span></td>
                    <td className="deal-original-name">{originalName}</td>
                    <td className="td-center"><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                    <td>
                      <Link href={`/deal/${m.id}`} className="btn-view-deal btn-view-deal-link">
                        Bekijk deal →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
