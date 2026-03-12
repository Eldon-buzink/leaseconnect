'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CarImage } from '@/app/components/CarImage';

interface VariantRow {
  id: number;
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
  autodisk_id: string;
  fuel_type?: string | null;
  transmission?: string | null;
}

type MatchCountRow = {
  canonical_vehicle_id: number;
  normalized_offer: { supplier_id?: string } | { supplier_id?: string }[];
};

function dedupeSupplierCount(rows: MatchCountRow[]): Record<number, { count: number; suppliers: string[] }> {
  const supplierSets: Record<number, Set<string>> = {};
  rows.forEach((r) => {
    const offer = Array.isArray(r.normalized_offer) ? r.normalized_offer[0] : r.normalized_offer;
    const supplier = offer?.supplier_id;
    if (!supplier) return;
    if (!supplierSets[r.canonical_vehicle_id]) supplierSets[r.canonical_vehicle_id] = new Set();
    supplierSets[r.canonical_vehicle_id].add(supplier);
  });
  const result: Record<number, { count: number; suppliers: string[] }> = {};
  Object.entries(supplierSets).forEach(([idStr, set]) => {
    const suppliers = Array.from(set).sort();
    result[Number(idStr)] = { count: suppliers.length, suppliers };
  });
  return result;
}

export default function ModelPage() {
  const params = useParams();
  const router = useRouter();
  const make = decodeURIComponent(String(params.make ?? ''));
  const model = decodeURIComponent(String(params.model ?? ''));

  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [countsByVariant, setCountsByVariant] = useState<Record<number, { count: number; suppliers: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!make || !model) return;
    loadVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, model]);

  async function loadVariants() {
    try {
      setLoading(true);
      setError(null);

      const { data: cvRows, error: cvError } = await supabase
        .from('canonical_vehicles')
        .select('id, make, model, trim, year, autodisk_id, fuel_type, transmission')
        .eq('make', make)
        .eq('model', model)
        .order('trim');

      if (cvError) throw cvError;
      const list = (cvRows || []) as VariantRow[];
      setVariants(list);

      const ids = list.map((v) => v.id);
      if (ids.length === 0) {
        setCountsByVariant({});
        return;
      }

      const { data: matchRows } = await supabase
        .from('matches')
        .select('canonical_vehicle_id, normalized_offer:normalized_offers(supplier_id)')
        .in('canonical_vehicle_id', ids);

      const byVariant = dedupeSupplierCount(((matchRows || []) as unknown) as MatchCountRow[]);
      setCountsByVariant(byVariant);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load variants');
      setVariants([]);
      setCountsByVariant({});
    } finally {
      setLoading(false);
    }
  }

  const title = `${make} ${model}`.trim() || 'Model';
  const variantCount = variants.length;

  const supplierUnionCount = useMemo(() => {
    const s = new Set<string>();
    Object.values(countsByVariant).forEach((c) => c.suppliers.forEach((x) => s.add(x)));
    return s.size;
  }, [countsByVariant]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <div className="error">Supabase not configured.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <nav className="car-page-breadcrumb">
          <Link href="/">Zoeken</Link>
          <span className="car-page-breadcrumb-sep">›</span>
          <span>{title}</span>
        </nav>
        <div className="loading">Loading variants...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <nav className="car-page-breadcrumb">
          <Link href="/">Zoeken</Link>
          <span className="car-page-breadcrumb-sep">›</span>
          <span>{title}</span>
        </nav>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <nav className="car-page-breadcrumb">
        <Link href="/">Zoeken</Link>
        <span className="car-page-breadcrumb-sep">›</span>
        <span>{title}</span>
      </nav>

      <header className="car-page-header">
        <Link href="/" className="car-page-back-btn">← Back</Link>
        <div className="car-page-hero">
          <div className="car-page-hero-text">
            <h1 className="car-page-title">{title}</h1>
            <p className="car-page-subtitle">
              {variantCount} variant{variantCount !== 1 ? 's' : ''} · {supplierUnionCount} supplier{supplierUnionCount !== 1 ? 's' : ''}
            </p>
          </div>
          <CarImage make={make} model={model} className="car-page-hero-img" />
        </div>
      </header>

      {variants.length === 0 ? (
        <div className="deal-section">
          <p className="deal-muted">No variants found.</p>
        </div>
      ) : (
        <div className="car-page-deals-section">
          <p className="car-page-deals-count">Uitvoeringen</p>
          <table className="deal-table model-page-variants-table">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Year</th>
                <th>Fuel</th>
                <th>Transmission</th>
                <th className="th-center">Suppliers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const c = countsByVariant[v.id];
                const supplierCount = c?.count ?? 0;
                const supplierPreview = (c?.suppliers ?? []).slice(0, 3).join(', ');
                return (
                  <tr key={v.id}>
                    <td>{v.trim || '—'}</td>
                    <td>{v.year ?? '—'}</td>
                    <td>{v.fuel_type ?? '—'}</td>
                    <td>{v.transmission ?? '—'}</td>
                    <td className="td-center">
                      {supplierCount}
                      {supplierPreview ? <span className="model-page-suppliers-preview"> · {supplierPreview}{supplierCount > 3 ? ', …' : ''}</span> : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-bekijk-deals"
                        onClick={() => router.push(`/car/${v.id}`)}
                      >
                        Bekijk deals
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

