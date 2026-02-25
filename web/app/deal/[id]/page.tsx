'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DealDetailPanel, type MatchDetail, type OtherMatch } from '@/app/components/DealDetailPanel';

export default function DealPage() {
  const params = useParams();
  const id = Number(params.id);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [otherMatches, setOtherMatches] = useState<OtherMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setError('Invalid deal id');
      setLoading(false);
      return;
    }
    loadDeal();
  }, [id]);

  async function loadDeal() {
    try {
      setLoading(true);
      setError(null);

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(
          `
          id,
          normalized_offer_id,
          canonical_vehicle_id,
          match_type,
          confidence_score,
          status,
          review_notes,
          normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year, fuel_type, transmission),
          canonical_vehicle:canonical_vehicles(id, make, model, trim, year, autodisk_id, fuel_type, transmission)
        `
        )
        .eq('id', id)
        .single();

      if (matchError || !matchData) {
        setError(matchError?.message || 'Deal not found');
        setMatch(null);
        setLoading(false);
        return;
      }

      setMatch(matchData as unknown as MatchDetail);

      const canonicalVehicleId = (matchData as unknown as MatchDetail).canonical_vehicle_id;
      const { data: others } = await supabase
        .from('matches')
        .select(
          `
          id,
          match_type,
          confidence_score,
          status,
          normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year)
        `
        )
        .eq('canonical_vehicle_id', canonicalVehicleId)
        .neq('id', id)
        .order('confidence_score', { ascending: false })
        .limit(20);

      setOtherMatches((others || []) as unknown as OtherMatch[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deal');
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Leaseconnect</h1>
        <p>Canonical vehicles and match review</p>
      </div>
      <nav className="deal-page-nav">
        <Link href="/" className="deal-back">Dashboard</Link>
        <span className="deal-breadcrumb-sep">/</span>
        <span>Deal #{id}</span>
      </nav>
      <div className="dashboard-main deal-page-main">
        <DealDetailPanel
          match={match}
          otherMatches={otherMatches}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}
