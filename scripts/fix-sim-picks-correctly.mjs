import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct Sim picks based on CSV data - converting text predictions to H/A/D
const simPicksCorrect = {
  gw1: ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'A'], // Liverpool Win, Aston Villa Win, Brighton Win, West Ham Win, Tottenham Win, Man City Win, Chelsea Win, Forest Win, Arsenal Win, Everton Win
  gw2: ['A', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'], // West Ham Win, Man City Win, Bournemouth Win, Brentford Win, Burnley Win, Arsenal Win, Palace Win, Everton Win, Fulham Win, Newcastle Win
  gw3: ['H', 'H', 'H', 'H', 'A', 'D', 'H', 'A', 'A', 'A'], // Chelsea Win, Man Utd Win, Sunderland Win, Tottenham Win, Everton Win, Draw, Brighton Win, West Ham Win, Liverpool Win, Palace Win
  gw4: ['H', 'D', 'H', 'H', 'A', 'H', 'A', 'H', 'H', 'H'], // Arsenal Win, Draw, Bournemouth Win, Palace Win, Fulham Win, Newcastle Win, Tottenham Win, Chelsea Win, Liverpool Win, Man City Win
  gw5: ['H', 'A', 'A', 'A', 'D', 'H', 'A', 'H', 'H', 'A'], // Liverpool Win, Tottenham Win, Forest Win, Palace Win, Leeds Win, Man Utd Win, Brentford Win, Newcastle Win, Villa Win, Arsenal Win
  gw6: ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'H'], // Brentford Win, Chelsea Win, Palace Win, Leeds Win, Man City Win, Forest Win, Tottenham Win, Villa Win, Arsenal Win, Everton Win
  gw7: ['H', 'A', 'H', 'H', 'H', 'H', 'A', 'H', 'H', 'H']  // Bournemouth Win, Tottenham Win, Arsenal Win, Man Utd Win, Chelsea Win, Villa Win, Palace Win, Newcastle Win, Brighton Win, Man City Win
};

async function fixSimPicksCorrectly() {
  console.log('Fixing Sim\'s picks with correct CSV conversion...');
  
  // Get Sim's user ID
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'Sim')
    .single();
  
  if (!user) {
    console.log('Sim not found');
    return;
  }
  
  console.log('Sim ID:', user.id);
  
  // Fix each gameweek
  for (const [gwKey, picks] of Object.entries(simPicksCorrect)) {
    const gwNumber = parseInt(gwKey.replace('gw', ''));
    console.log(`\nFixing GW${gwNumber}...`);
    console.log('Correct picks:', picks);
    
    // Delete existing picks for the GW
    const { error: deletePicksError } = await supabase
      .from('picks')
      .delete()
      .eq('user_id', user.id)
      .eq('gw', gwNumber);
    
    if (deletePicksError) {
      console.error(`Error deleting GW${gwNumber} picks:`, deletePicksError);
      continue;
    }
    
    // Insert new picks
    for (let i = 0; i < picks.length; i++) {
      const { error: pickError } = await supabase
        .from('picks')
        .insert({
          user_id: user.id,
          gw: gwNumber,
          fixture_index: i,
          pick: picks[i]
        });
      
      if (pickError) {
        console.error(`Error inserting pick ${i} for GW${gwNumber}:`, pickError);
      }
    }
    
    console.log(`GW${gwNumber} fixed successfully`);
  }
  
  console.log('\nSim\'s picks have been corrected!');
}

fixSimPicksCorrectly().catch(console.error);

