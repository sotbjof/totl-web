import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct results from the data you provided
const correctResults = {
  gw1: [
    { home_score: 4, away_score: 2, result: 'H' }, // Liverpool v AFC Bournemouth
    { home_score: 0, away_score: 0, result: 'D' }, // Aston Villa v Newcastle United
    { home_score: 1, away_score: 1, result: 'D' }, // Brighton & Hove Albion v Fulham
    { home_score: 3, away_score: 0, result: 'H' }, // Sunderland v West Ham United
    { home_score: 3, away_score: 0, result: 'H' }, // Tottenham Hotspur v Burnley
    { home_score: 0, away_score: 1, result: 'A' }, // Manchester City v Everton
    { home_score: 1, away_score: 1, result: 'D' }, // Crystal Palace v Arsenal
    { home_score: 2, away_score: 1, result: 'H' }, // Manchester United v Chelsea
    { home_score: 0, away_score: 1, result: 'A' }, // Wolverhampton Wanderers v Brentford
    { home_score: 2, away_score: 1, result: 'H' }  // Leicester City v West Bromwich Albion
  ],
  gw2: [
    { home_score: 1, away_score: 2, result: 'A' }, // Arsenal v Brighton & Hove Albion
    { home_score: 0, away_score: 1, result: 'A' }, // Aston Villa v Liverpool
    { home_score: 2, away_score: 1, result: 'H' }, // Brentford v Crystal Palace
    { home_score: 0, away_score: 1, result: 'A' }, // Burnley v Manchester City
    { home_score: 3, away_score: 1, result: 'H' }, // Chelsea v West Ham United
    { home_score: 2, away_score: 1, result: 'H' }, // Everton v Nottingham Forest
    { home_score: 1, away_score: 1, result: 'D' }, // Fulham v Leicester City
    { home_score: 4, away_score: 0, result: 'H' }, // Manchester United v Southampton
    { home_score: 1, away_score: 1, result: 'D' }, // Newcastle United v Wolverhampton Wanderers
    { home_score: 0, away_score: 1, result: 'A' }  // Tottenham Hotspur v AFC Bournemouth
  ],
  gw3: [
    { home_score: 2, away_score: 1, result: 'H' }, // Arsenal v Manchester City
    { home_score: 3, away_score: 0, result: 'H' }, // Aston Villa v Everton
    { home_score: 4, away_score: 1, result: 'H' }, // Brighton & Hove Albion v Manchester United
    { home_score: 0, away_score: 2, result: 'A' }, // Burnley v Chelsea
    { home_score: 0, away_score: 1, result: 'A' }, // Crystal Palace v Liverpool
    { home_score: 1, away_score: 1, result: 'D' }, // Fulham v Newcastle United
    { home_score: 1, away_score: 0, result: 'H' }, // Leicester City v West Ham United
    { home_score: 0, away_score: 1, result: 'A' }, // Nottingham Forest v Wolverhampton Wanderers
    { home_score: 2, away_score: 1, result: 'H' }, // Southampton v Brentford
    { home_score: 0, away_score: 1, result: 'A' }  // Tottenham Hotspur v AFC Bournemouth
  ],
  gw4: [
    { home_score: 2, away_score: 1, result: 'H' }, // Arsenal v Brighton & Hove Albion
    { home_score: 1, away_score: 0, result: 'H' }, // Aston Villa v Liverpool
    { home_score: 1, away_score: 1, result: 'D' }, // Brentford v Crystal Palace
    { home_score: 0, away_score: 2, result: 'A' }, // Burnley v Manchester City
    { home_score: 2, away_score: 1, result: 'H' }, // Chelsea v West Ham United
    { home_score: 1, away_score: 1, result: 'D' }, // Everton v Nottingham Forest
    { home_score: 0, away_score: 1, result: 'A' }, // Fulham v Leicester City
    { home_score: 3, away_score: 0, result: 'H' }, // Manchester United v Southampton
    { home_score: 1, away_score: 1, result: 'D' }, // Newcastle United v Wolverhampton Wanderers
    { home_score: 0, away_score: 1, result: 'A' }  // Tottenham Hotspur v AFC Bournemouth
  ],
  gw5: [
    { home_score: 1, away_score: 0, result: 'H' }, // Arsenal v Manchester City
    { home_score: 2, away_score: 1, result: 'H' }, // Aston Villa v Everton
    { home_score: 1, away_score: 1, result: 'D' }, // Brighton & Hove Albion v Manchester United
    { home_score: 0, away_score: 1, result: 'A' }, // Burnley v Chelsea
    { home_score: 0, away_score: 1, result: 'A' }, // Crystal Palace v Liverpool
    { home_score: 2, away_score: 1, result: 'H' }, // Fulham v Newcastle United
    { home_score: 1, away_score: 1, result: 'D' }, // Leicester City v West Ham United
    { home_score: 1, away_score: 1, result: 'D' }, // Nottingham Forest v Wolverhampton Wanderers
    { home_score: 0, away_score: 1, result: 'A' }, // Southampton v Brentford
    { home_score: 1, away_score: 1, result: 'D' }  // Tottenham Hotspur v AFC Bournemouth
  ],
  gw6: [
    { home_score: 2, away_score: 1, result: 'H' }, // Arsenal v Brighton & Hove Albion
    { home_score: 0, away_score: 1, result: 'A' }, // Aston Villa v Liverpool
    { home_score: 1, away_score: 0, result: 'H' }, // Brentford v Crystal Palace
    { home_score: 0, away_score: 1, result: 'A' }, // Burnley v Manchester City
    { home_score: 1, away_score: 0, result: 'H' }, // Chelsea v West Ham United
    { home_score: 0, away_score: 1, result: 'A' }, // Everton v Nottingham Forest
    { home_score: 1, away_score: 1, result: 'D' }, // Fulham v Leicester City
    { home_score: 2, away_score: 1, result: 'H' }, // Manchester United v Southampton
    { home_score: 0, away_score: 1, result: 'A' }, // Newcastle United v Wolverhampton Wanderers
    { home_score: 1, away_score: 1, result: 'D' }  // Tottenham Hotspur v AFC Bournemouth
  ],
  gw7: [
    { home_score: 2, away_score: 1, result: 'H' }, // Arsenal v Brighton & Hove Albion
    { home_score: 0, away_score: 1, result: 'A' }, // Aston Villa v Liverpool
    { home_score: 2, away_score: 1, result: 'H' }, // Brentford v Crystal Palace
    { home_score: 0, away_score: 1, result: 'A' }, // Burnley v Manchester City
    { home_score: 2, away_score: 1, result: 'H' }, // Chelsea v West Ham United
    { home_score: 0, away_score: 1, result: 'A' }, // Everton v Nottingham Forest
    { home_score: 1, away_score: 1, result: 'D' }, // Fulham v Leicester City
    { home_score: 2, away_score: 1, result: 'H' }, // Manchester United v Southampton
    { home_score: 0, away_score: 1, result: 'A' }, // Newcastle United v Wolverhampton Wanderers
    { home_score: 1, away_score: 1, result: 'D' }  // Tottenham Hotspur v AFC Bournemouth
  ]
};

async function fixCorrectResults() {
  console.log('Fixing results with correct scores...');
  
  // Fix each gameweek
  for (const [gwKey, results] of Object.entries(correctResults)) {
    const gwNumber = parseInt(gwKey.replace('gw', ''));
    console.log(`\nFixing GW${gwNumber} results...`);
    
    // Delete existing results for this GW
    const { error: deleteError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteError) {
      console.log(`Error deleting GW${gwNumber} results:`, deleteError);
      continue;
    }
    
    // Insert correct results
    for (let i = 0; i < results.length; i++) {
      const { error: resultError } = await supabase
        .from('gw_results')
        .insert({
          gw: gwNumber,
          fixture_index: i,
          home_score: results[i].home_score,
          away_score: results[i].away_score,
          result: results[i].result
        });
      
      if (resultError) {
        console.log(`Error inserting result ${i} for GW${gwNumber}:`, resultError);
      }
    }
    
    console.log(`GW${gwNumber} results fixed successfully`);
  }
  
  console.log('\nAll results have been corrected!');
}

fixCorrectResults().catch(console.error);

