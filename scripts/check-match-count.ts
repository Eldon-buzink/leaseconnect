import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatchCounts() {
  console.log('Checking match counts in database...\n');

  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Get counts by status
    const { count: approvedCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: reviewCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'review');

    const { count: pendingCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: rejectedCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected');

    // Get counts by match type
    const { count: deterministicCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('match_type', 'deterministic');

    const { count: scoredCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('match_type', 'scored');

    const { count: overrideCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('match_type', 'override');

    console.log('=== Match Statistics ===');
    console.log(`Total Matches: ${totalCount || 0}`);
    console.log(`\nBy Status:`);
    console.log(`  Approved: ${approvedCount || 0}`);
    console.log(`  Review: ${reviewCount || 0}`);
    console.log(`  Pending: ${pendingCount || 0}`);
    console.log(`  Rejected: ${rejectedCount || 0}`);
    console.log(`\nBy Match Type:`);
    console.log(`  Deterministic: ${deterministicCount || 0}`);
    console.log(`  Scored: ${scoredCount || 0}`);
    console.log(`  Override: ${overrideCount || 0}`);

    // Also check normalized_offers count
    const { count: offersCount } = await supabase
      .from('normalized_offers')
      .select('*', { count: 'exact', head: true });

    console.log(`\nNormalized Offers: ${offersCount || 0}`);

    // Check if there are normalized offers without matches
    const { data: unmatchedOffers } = await supabase
      .from('normalized_offers')
      .select('id')
      .limit(1);

    if (unmatchedOffers && unmatchedOffers.length > 0) {
      console.log(`\nNote: There are ${offersCount || 0} normalized offers, but only ${totalCount || 0} matches.`);
      console.log(`This means ${(offersCount || 0) - (totalCount || 0)} offers don't have matches yet.`);
    }
  } catch (error) {
    console.error('Error checking counts:', error);
    process.exit(1);
  }
}

checkMatchCounts();
