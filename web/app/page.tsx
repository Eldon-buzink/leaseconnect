'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Match {
  id: number;
  normalized_offer_id: number;
  canonical_vehicle_id: number;
  match_type: string;
  confidence_score: number;
  match_algorithm: string;
  status: string;
  matched_at: string;
  normalized_offer: {
    supplier_id: string;
    supplier_offer_id: string;
    make: string;
    model: string;
    trim: string;
    year: number;
  };
  canonical_vehicle: {
    make: string;
    model: string;
    trim: string;
    year: number;
    autodisk_id: string;
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

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Build query - use left join (no !inner) to handle empty matches
      let query = supabase
        .from('matches')
        .select(
          `
          *,
          normalized_offer:normalized_offers(supplier_id, supplier_offer_id, make, model, trim, year),
          canonical_vehicle:canonical_vehicles(make, model, trim, year, autodisk_id)
        `
        )
        .order('matched_at', { ascending: false })
        .limit(1000);

      // Apply filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

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

      setMatches(data || []);
      
      // If no matches, that's OK - just show empty state
      if (!data || data.length === 0) {
        console.log('No matches found in database');
      }

      // Load stats (handle gracefully if table doesn't exist)
      const { data: statsData, error: statsError } = await supabase
        .from('matches')
        .select('status, match_type');

      if (statsError) {
        // If table doesn't exist, use empty stats
        if (statsError.code === 'PGRST116' || statsError.message?.includes('does not exist')) {
          console.log('Matches table does not exist yet');
          setStats({
            total: 0,
            approved: 0,
            review: 0,
            pending: 0,
            rejected: 0,
            deterministic: 0,
            scored: 0,
            override: 0,
          });
        } else {
          throw statsError;
        }
      } else {
        const statsCalc: Stats = {
          total: statsData?.length || 0,
          approved: statsData?.filter((m) => m.status === 'approved').length || 0,
          review: statsData?.filter((m) => m.status === 'review').length || 0,
          pending: statsData?.filter((m) => m.status === 'pending').length || 0,
          rejected: statsData?.filter((m) => m.status === 'rejected').length || 0,
          deterministic: statsData?.filter((m) => m.match_type === 'deterministic').length || 0,
          scored: statsData?.filter((m) => m.match_type === 'scored').length || 0,
          override: statsData?.filter((m) => m.match_type === 'override').length || 0,
        };

        setStats(statsCalc);
      }
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

      // Reload data
      loadData();
    } catch (err) {
      alert('Failed to update status: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function getScoreClass(score: number): string {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.6) return 'score-medium';
    return 'score-low';
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
        <h1>🚗 Leaseconnect Dashboard</h1>
        <p>Vehicle offer matching results and review queue</p>
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

      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({stats?.total || 0})
        </button>
        <button
          className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
          onClick={() => setFilter('approved')}
        >
          Approved ({stats?.approved || 0})
        </button>
        <button
          className={`filter-tab ${filter === 'review' ? 'active' : ''}`}
          onClick={() => setFilter('review')}
        >
          Review ({stats?.review || 0})
        </button>
        <button
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({stats?.pending || 0})
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>Matches</h2>
          <button onClick={loadData} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
        {loading ? (
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
          <table>
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
              {matches.map(match => (
                <tr key={match.id}>
                  <td>
                    <div>
                      <strong>
                        {match.normalized_offer?.make || 'N/A'}{' '}
                        {match.normalized_offer?.model || 'N/A'}
                      </strong>
                      {match.normalized_offer?.trim && <span> {match.normalized_offer.trim}</span>}
                      {match.normalized_offer?.year && (
                        <span> ({match.normalized_offer.year})</span>
                      )}
                      <br />
                      <small style={{ color: '#999' }}>
                        {match.normalized_offer?.supplier_id} -{' '}
                        {match.normalized_offer?.supplier_offer_id}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>
                        {match.canonical_vehicle?.make || 'N/A'}{' '}
                        {match.canonical_vehicle?.model || 'N/A'}
                      </strong>
                      {match.canonical_vehicle?.trim && (
                        <span> {match.canonical_vehicle.trim}</span>
                      )}
                      {match.canonical_vehicle?.year && (
                        <span> ({match.canonical_vehicle.year})</span>
                      )}
                      <br />
                      <small style={{ color: '#999' }}>
                        ID: {match.canonical_vehicle?.autodisk_id}
                      </small>
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
                  <td>
                    {match.status === 'review' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => updateMatchStatus(match.id, 'approved')}
                          style={{
                            padding: '4px 8px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateMatchStatus(match.id, 'rejected')}
                          style={{
                            padding: '4px 8px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
