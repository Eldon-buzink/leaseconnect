'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface MatchDetail {
  id: number;
  normalized_offer_id: number;
  canonical_vehicle_id: number;
  match_type: string;
  confidence_score: number;
  status: string;
  review_notes: string | null;
  normalized_offer: {
    supplier_id: string;
    supplier_offer_id: string;
    make: string;
    model: string;
    trim: string | null;
    year: number | null;
    fuel_type: string | null;
    transmission: string | null;
  };
  canonical_vehicle: {
    id: number;
    make: string;
    model: string;
    trim: string | null;
    year: number | null;
    autodisk_id: string;
    fuel_type: string | null;
    transmission: string | null;
  };
}

export interface OtherMatch {
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
  };
}

type DealTab = 'details' | 'why-matched' | 'other-offers';

interface DealDetailPanelProps {
  match: MatchDetail | null;
  otherMatches: OtherMatch[];
  loading: boolean;
  error: string | null;
  onClose?: () => void;
  onViewDeal?: (matchId: number) => void;
  compact?: boolean;
}

function getScoreClass(score: number): string {
  if (score >= 0.8) return 'score-high';
  if (score >= 0.6) return 'score-medium';
  return 'score-low';
}

export function DealDetailPanel({
  match,
  otherMatches,
  loading,
  error,
  onClose,
  onViewDeal,
  compact = false,
}: DealDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DealTab>('details');

  if (loading) {
    return (
      <div className="deal-panel deal-panel-loading">
        <div className="loading">Loading deal...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="deal-panel">
        <div className="deal-error">Error: {error}</div>
        {onClose && <button type="button" onClick={onClose} className="deal-back">Close</button>}
      </div>
    );
  }

  const cv = match.canonical_vehicle;
  const offer = match.normalized_offer;
  const carLabel = [cv.make, cv.model].filter(Boolean).join(' ') || 'Vehicle';
  const supplierLabel = offer.supplier_id || 'Supplier';

  return (
    <div className={`deal-panel ${compact ? 'deal-panel-compact' : ''}`}>
      <div className="deal-panel-header">
        {onClose ? (
          <button type="button" onClick={onClose} className="deal-back">
            Close
          </button>
        ) : (
          <Link href="/" className="deal-back">Dashboard</Link>
        )}
        <div className="deal-title-block">
          <h2 className="deal-title">
            {cv.make} {cv.model}
            {cv.year != null && <span className="deal-title-year"> ({cv.year})</span>}
          </h2>
          {cv.trim && <p className="deal-subtitle">{cv.trim}</p>}
        </div>
        <span className="deal-breadcrumb-inline">{carLabel} · {supplierLabel}</span>
      </div>

      <div className="deal-two-col">
        <aside className="deal-sidebar">
          <section className="deal-section deal-deal-card">
            <h3 className="deal-section-title">This deal</h3>
            <dl className="deal-specs">
              <dt>Leasing company</dt>
              <dd className="deal-company">{offer.supplier_id}</dd>
              <dt>Original name</dt>
              <dd className="deal-dd-wrap">{offer.supplier_offer_id}</dd>
              <dt>Match type</dt>
              <dd><span className={`badge badge-${match.match_type}`}>{match.match_type}</span></dd>
              <dt>Confidence</dt>
              <dd>{(match.confidence_score * 100).toFixed(1)}%</dd>
              <dt>Status</dt>
              <dd><span className={`badge badge-${match.status}`}>{match.status}</span></dd>
            </dl>
          </section>
        </aside>

        <main className="deal-main">
          <div className="deal-tabs">
            <button type="button" className={`deal-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
            <button type="button" className={`deal-tab ${activeTab === 'why-matched' ? 'active' : ''}`} onClick={() => setActiveTab('why-matched')}>Why matched</button>
            <button type="button" className={`deal-tab ${activeTab === 'other-offers' ? 'active' : ''}`} onClick={() => setActiveTab('other-offers')}>Other offers</button>
          </div>

          {activeTab === 'details' && (
            <section className="deal-section deal-tab-panel">
              <h3 className="deal-section-title">Vehicle details</h3>
              <div className="deal-details-grid">
                <div>
                  <h4 className="deal-details-subtitle">Canonical vehicle</h4>
                  <dl className="deal-specs">
                    <dt>Make</dt><dd>{cv.make}</dd>
                    <dt>Model</dt><dd>{cv.model}</dd>
                    {cv.trim && (<><dt>Trim</dt><dd>{cv.trim}</dd></>)}
                    {cv.year != null && (<><dt>Year</dt><dd>{cv.year}</dd></>)}
                    {cv.fuel_type && (<><dt>Fuel</dt><dd>{cv.fuel_type}</dd></>)}
                    {cv.transmission && (<><dt>Transmission</dt><dd>{cv.transmission}</dd></>)}
                    <dt>Autodisk ID</dt><dd>{cv.autodisk_id}</dd>
                  </dl>
                </div>
                <div>
                  <h4 className="deal-details-subtitle">Supplier offer</h4>
                  <dl className="deal-specs">
                    <dt>Make / Model</dt><dd>{offer.make} {offer.model}</dd>
                    {offer.trim && (<><dt>Trim</dt><dd>{offer.trim}</dd></>)}
                    {offer.year != null && (<><dt>Year</dt><dd>{offer.year}</dd></>)}
                    {offer.fuel_type && (<><dt>Fuel</dt><dd>{offer.fuel_type}</dd></>)}
                    {offer.transmission && (<><dt>Transmission</dt><dd>{offer.transmission}</dd></>)}
                  </dl>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'why-matched' && (
            <section className="deal-section deal-tab-panel">
              <h3 className="deal-section-title">Why matched</h3>
              {match.review_notes ? (
                <p className="deal-why-text">{match.review_notes}</p>
              ) : (
                <p className="deal-why-text deal-muted">No explanation available.</p>
              )}
            </section>
          )}

          {activeTab === 'other-offers' && (
            <section className="deal-section deal-tab-panel">
              <h3 className="deal-section-title">Other offers for this vehicle</h3>
              {otherMatches.length === 0 ? (
                <p className="deal-muted">No other matched offers.</p>
              ) : (
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Offer</th>
                      <th>Match type</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherMatches.map((m) => (
                      <tr key={m.id}>
                        <td>{m.normalized_offer?.supplier_id}</td>
                        <td>{m.normalized_offer?.make} {m.normalized_offer?.model}</td>
                        <td><span className={`badge badge-${m.match_type}`}>{m.match_type}</span></td>
                        <td>{(m.confidence_score * 100).toFixed(1)}%</td>
                        <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                        <td>
                          {onViewDeal ? (
                            <button type="button" className="btn-view-deal" onClick={() => onViewDeal(m.id)}>View deal</button>
                          ) : (
                            <Link href={`/deal/${m.id}`} className="btn-view-deal" style={{ textDecoration: 'none', display: 'inline-block' }}>View deal</Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
