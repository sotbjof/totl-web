import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct results extracted from all 7 result images
const correctResults = {
  gw1: ['H', 'D', 'D', 'H', 'H', 'A', 'D', 'H', 'A', 'H'],
  gw2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'],
  gw3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'],
  gw4: ['H', 'D', 'H', 'D', 'H', 'H', 'A', 'D', 'A', 'H'],
  gw5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'],
  gw6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'],
  gw7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']
};

// CSV name to database username mapping
const nameMapping = {
  'Matthew Bird': 'Matthew Bird',
  'Sim': 'Sim',
  'David70': 'David Bird',
  'Phil Bolton': 'Phil Bolton',
  'Paul': 'Paul N',
  'Gregory': 'gregory',
  'SP': 'SP',
  'Carlios': 'Carl',
  'Jof': 'Jof',
  'william middleton': 'Will Middleton',
  'Ben': 'Ben New',
  'Thomas Bird': 'ThomasJamesBird'
};

// CSV data for all gameweeks (manually extracted)
const csvData = {
  gw1: {
    fixtures: [
      'Liverpool v AFC Bournemouth',
      'Aston Villa v Newcastle United',
      'Brighton & Hove Albion v Fulham',
      'Sunderland v West Ham United',
      'Tottenham Hotspur v Burnley',
      'Wolverhampton Wanderers v Manchester City',
      'Chelsea v Crystal Palace',
      'Nottingham Forest v Brentford',
      'Manchester United v Arsenal',
      'Leeds United v Everton'
    ],
    picks: {
      'David70': ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'A'],
      'william middleton': ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A', 'A'],
      'Thomas Bird': ['H', 'H', 'H', 'A', 'H', 'H', 'A', 'A', 'A', 'D'],
      'Jof': ['H', 'H', 'D', 'H', 'H', 'H', 'H', 'H', 'D', 'H'],
      'Carlios': ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'D', 'A'],
      'Paul': ['D', 'H', 'A', 'H', 'H', 'H', 'H', 'H', 'A', 'D'],
      'SP': ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'A', 'A'],
      'Sim': ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'A'],
      'Ben': ['D', 'A', 'H', 'A', 'D', 'H', 'D', 'H', 'A', 'A'],
      'Matthew Bird': ['H', 'H', 'D', 'A', 'H', 'H', 'A', 'H', 'A', 'D'],
      'Phil Bolton': ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'A', 'H'],
      'Gregory': ['H', 'H', 'D', 'A', 'H', 'H', 'D', 'H', 'D', 'A']
    }
  },
  gw2: {
    fixtures: [
      'West Ham United v Chelsea',
      'Manchester City v Tottenham Hotspur',
      'AFC Bournemouth v Wolverhampton Wanderers',
      'Brentford v Aston Villa',
      'Burnley v Sunderland',
      'Arsenal v Leeds United',
      'Crystal Palace v Nottingham Forest',
      'Everton v Brighton & Hove Albion',
      'Fulham v Manchester United',
      'Newcastle United v Liverpool'
    ],
    picks: {
      'Jof': ['A', 'H', 'H', 'H', 'D', 'H', 'D', 'H', 'H', 'H'],
      'Sim': ['A', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
      'Thomas Bird': ['A', 'D', 'H', 'H', 'D', 'H', 'A', 'H', 'A', 'H'],
      'william middleton': ['A', 'H', 'H', 'D', 'H', 'H', 'D', 'H', 'D', 'H'],
      'Carlios': ['A', 'A', 'H', 'H', 'D', 'H', 'D', 'A', 'H', 'D'],
      'David70': ['A', 'H', 'H', 'H', 'H', 'H', 'D', 'D', 'D', 'H'],
      'Matthew Bird': ['D', 'H', 'D', 'D', 'H', 'H', 'A', 'D', 'D', 'H'],
      'Gregory': ['A', 'H', 'H', 'H', 'H', 'H', 'D', 'A', 'H', 'H'],
      'Ben': ['A', 'H', 'H', 'D', 'D', 'H', 'H', 'A', 'H', 'H'],
      'SP': ['A', 'D', 'H', 'H', 'D', 'H', 'A', 'D', 'D', 'H'],
      'Phil Bolton': ['A', 'H', 'H', 'A', 'H', 'H', 'A', 'H', 'H', 'H'],
      'Paul': ['A', 'H', 'H', 'A', 'H', 'H', 'A', 'H', 'D', 'H']
    }
  },
  gw3: {
    fixtures: [
      'Chelsea v Fulham',
      'Manchester United v Burnley',
      'Sunderland v Brentford',
      'Tottenham Hotspur v AFC Bournemouth',
      'Wolverhampton Wanderers v Everton',
      'Leeds United v Newcastle United',
      'Brighton & Hove Albion v Manchester City',
      'Nottingham Forest v West Ham United',
      'Liverpool v Arsenal',
      'Aston Villa v Crystal Palace'
    ],
    picks: {
      'Thomas Bird': ['H', 'A', 'A', 'H', 'D', 'A', 'H', 'A', 'H', 'D'],
      'Sim': ['H', 'H', 'H', 'H', 'A', 'D', 'H', 'A', 'A', 'A'],
      'Jof': ['H', 'D', 'D', 'D', 'A', 'A', 'H', 'A', 'H', 'H'],
      'Phil Bolton': ['H', 'H', 'H', 'H', 'A', 'D', 'H', 'A', 'A', 'H'],
      'Matthew Bird': ['H', 'A', 'H', 'A', 'D', 'A', 'H', 'D', 'A', 'A'],
      'David70': ['H', 'H', 'H', 'H', 'A', 'A', 'H', 'A', 'H', 'A'],
      'Gregory': ['H', 'H', 'A', 'D', 'D', 'A', 'D', 'A', 'D', 'D'],
      'william middleton': ['H', 'D', 'D', 'H', 'A', 'A', 'H', 'A', 'D', 'D'],
      'Ben': ['H', 'A', 'A', 'H', 'A', 'A', 'D', 'A', 'D', 'D'],
      'Paul': ['D', 'A', 'H', 'D', 'A', 'A', 'D', 'A', 'A', 'H'],
      'SP': ['H', 'D', 'D', 'H', 'A', 'D', 'D', 'A', 'A', 'D'],
      'CarlIos': ['H', 'D', 'A', 'H', 'A', 'A', 'H', 'A', 'A', 'H']
    }
  },
  gw4: {
    fixtures: [
      'Arsenal v Nottingham Forest',
      'Everton v Aston Villa',
      'AFC Bournemouth v Brighton & Hove Albion',
      'Crystal Palace v Sunderland',
      'Fulham v Leeds United',
      'Newcastle United v Wolverhampton Wanderers',
      'West Ham United v Tottenham Hotspur',
      'Brentford v Chelsea',
      'Burnley v Liverpool',
      'Manchester City v Manchester United'
    ],
    picks: {
      'william middleton': ['H', 'H', 'H', 'H', 'H', 'H', 'D', 'H', 'H', 'H'],
      'Carlios': ['H', 'D', 'H', 'D', 'H', 'H', 'A', 'H', 'H', 'H'],
      'Thomas Bird': ['H', 'H', 'H', 'H', 'D', 'D', 'A', 'A', 'H', 'H'],
      'Ben': ['H', 'H', 'D', 'H', 'H', 'H', 'A', 'D', 'D', 'D'],
      'Paul': ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'H', 'D'],
      'Phil Bolton': ['H', 'H', 'H', 'H', 'H', 'H', 'A', 'H', 'H', 'H'],
      'David70': ['H', 'H', 'H', 'H', 'H', 'H', 'D', 'H', 'H', 'H'],
      'Sim': ['H', 'D', 'H', 'H', 'A', 'H', 'A', 'H', 'H', 'H'],
      'Matthew Bird': ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
      'Jof': ['H', 'D', 'H', 'H', 'D', 'H', 'A', 'H', 'H', 'H'],
      'SP': ['H', 'H', 'H', 'H', 'H', 'H', 'A', 'H', 'H', 'D'],
      'Gregory': ['H', 'H', 'H', 'H', 'H', 'D', 'A', 'H', 'H', 'D']
    }
  },
  gw5: {
    fixtures: [
      'Liverpool v Everton',
      'Brighton & Hove Albion v Tottenham Hotspur',
      'Burnley v Nottingham Forest',
      'West Ham United v Crystal Palace',
      'Wolverhampton Wanderers v Leeds United',
      'Manchester United v Chelsea',
      'Fulham v Brentford',
      'AFC Bournemouth v Newcastle United',
      'Sunderland v Aston Villa',
      'Arsenal v Manchester City'
    ],
    picks: {
      'Carlios': ['H', 'A', 'H', 'H', 'D', 'H', 'A', 'A', 'H', 'D'],
      'David70': ['H', 'D', 'H', 'A', 'D', 'H', 'H', 'H', 'H', 'A'],
      'Thomas Bird': ['H', 'A', 'A', 'A', 'A', 'H', 'A', 'H', 'H', 'A'],
      'Gregory': ['H', 'A', 'D', 'D', 'H', 'D', 'H', 'D', 'H', 'A'],
      'Jof': ['H', 'H', 'H', 'A', 'H', 'H', 'D', 'H', 'D', 'A'],
      'Paul': ['H', 'H', 'H', 'D', 'A', 'H', 'H', 'H', 'H', 'A'],
      'Phil Bolton': ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'H', 'H', 'A'],
      'Matthew Bird': ['H', 'A', 'A', 'A', 'A', 'H', 'H', 'H', 'H', 'A'],
      'Sim': ['H', 'A', 'A', 'A', 'D', 'H', 'A', 'H', 'H', 'A'],
      'william middleton': ['H', 'A', 'H', 'D', 'H', 'H', 'H', 'H', 'D', 'A'],
      'Ben': ['D', 'H', 'H', 'A', 'A', 'H', 'A', 'A', 'H', 'A'],
      'SP': ['D', 'D', 'D', 'A', 'D', 'H', 'H', 'D', 'H', 'A']
    }
  },
  gw6: {
    fixtures: [
      'Brentford v Manchester United',
      'Chelsea v Brighton & Hove Albion',
      'Crystal Palace v Liverpool',
      'Leeds United v AFC Bournemouth',
      'Manchester City v Burnley',
      'Nottingham Forest v Sunderland',
      'Tottenham Hotspur v Wolverhampton Wanderers',
      'Aston Villa v Fulham',
      'Newcastle United v Arsenal',
      'Everton v West Ham United'
    ],
    picks: {
      'Carlios': ['D', 'H', 'H', 'H', 'H', 'D', 'H', 'H', 'A', 'H'],
      'Thomas Bird': ['H', 'D', 'H', 'H', 'H', 'A', 'H', 'H', 'A', 'H'],
      'Jof': ['H', 'D', 'D', 'H', 'H', 'A', 'H', 'D', 'A', 'H'],
      'Matthew Bird': ['H', 'H', 'H', 'H', 'H', 'D', 'H', 'H', 'A', 'H'],
      'Sim': ['H', 'H', 'H', 'A', 'H', 'H', 'H', 'H', 'A', 'H'],
      'Paul': ['H', 'A', 'A', 'H', 'H', 'D', 'H', 'H', 'A', 'H'],
      'william middleton': ['H', 'H', 'H', 'A', 'H', 'A', 'H', 'D', 'D', 'H'],
      'Phil Bolton': ['H', 'H', 'H', 'A', 'H', 'D', 'H', 'H', 'A', 'H'],
      'David70': ['H', 'H', 'A', 'D', 'H', 'D', 'H', 'H', 'A', 'H'],
      'Ben': ['H', 'D', 'A', 'H', 'H', 'D', 'H', 'H', 'A', 'H'],
      'Gregory': ['H', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A', 'D'],
      'SP': ['H', 'D', 'H', 'H', 'H', 'H', 'H', 'H', 'A', 'H']
    }
  },
  gw7: {
    fixtures: [
      'AFC Bournemouth v Fulham',
      'Leeds United v Tottenham Hotspur',
      'Arsenal v West Ham United',
      'Manchester United v Sunderland',
      'Chelsea v Liverpool',
      'Aston Villa v Burnley',
      'Everton v Crystal Palace',
      'Newcastle United v Nottingham Forest',
      'Wolverhampton Wanderers v Brighton & Hove Albion',
      'Brentford v Manchester City'
    ],
    picks: {
      'Thomas Bird': ['H', 'A', 'H', 'H', 'H', 'H', 'A', 'H', 'H', 'H'],
      'Jof': ['H', 'A', 'H', 'D', 'H', 'H', 'A', 'H', 'H', 'H'],
      'Carlios': ['H', 'A', 'H', 'D', 'D', 'H', 'D', 'H', 'H', 'H'],
      'Phil Bolton': ['H', 'A', 'H', 'H', 'D', 'H', 'A', 'H', 'H', 'H'],
      'Paul': ['H', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'],
      'Sim': ['H', 'A', 'H', 'H', 'H', 'H', 'A', 'H', 'H', 'H'],
      'Ben': ['H', 'A', 'H', 'H', 'H', 'D', 'A', 'H', 'H', 'H'],
      'David70': ['H', 'A', 'H', 'D', 'D', 'H', 'D', 'H', 'H', 'A'],
      'Matthew Bird': ['H', 'A', 'H', 'D', 'H', 'D', 'A', 'H', 'D', 'A'],
      'Gregory': ['H', 'D', 'H', 'H', 'D', 'H', 'A', 'H', 'H', 'H'],
      'SP': ['H', 'D', 'H', 'D', 'D', 'H', 'D', 'H', 'H', 'H']
    }
  }
};

async function fixAllData() {
  console.log('Starting comprehensive data fix...');
  
  // Get all user IDs
  const { data: users } = await supabase
    .from('users')
    .select('id, name');
  
  if (!users) {
    console.log('No users found');
    return;
  }
  
  const userIds = {};
  users.forEach(user => {
    userIds[user.name] = user.id;
  });
  
  console.log('Found users:', Object.keys(userIds));
  
  // Fix each gameweek
  for (const [gwKey, data] of Object.entries(csvData)) {
    const gwNumber = parseInt(gwKey.replace('gw', ''));
    console.log(`\n=== Processing GW${gwNumber} ===`);
    
    // Update results
    console.log('Updating results...');
    const { error: deleteResultsError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteResultsError) {
      console.log(`Error deleting GW${gwNumber} results:`, deleteResultsError);
      continue;
    }
    
    for (let i = 0; i < correctResults[gwKey].length; i++) {
      const { error: resultError } = await supabase
        .from('gw_results')
        .insert({
          gw: gwNumber,
          fixture_index: i,
          result: correctResults[gwKey][i]
        });
      
      if (resultError) {
        console.log(`Error inserting result ${i} for GW${gwNumber}:`, resultError);
      }
    }
    
    console.log(`GW${gwNumber} results updated`);
    
    // Update picks for each user
    console.log('Updating picks...');
    for (const [csvName, picks] of Object.entries(data.picks)) {
      const dbName = nameMapping[csvName];
      if (!dbName || !userIds[dbName]) {
        console.log(`Skipping ${csvName} - no mapping or user not found`);
        continue;
      }
      
      const userId = userIds[dbName];
      console.log(`Updating picks for ${dbName} (${csvName})...`);
      
      // Delete existing picks
      const { error: deletePicksError } = await supabase
        .from('picks')
        .delete()
        .eq('user_id', userId)
        .eq('gw', gwNumber);
      
      if (deletePicksError) {
        console.log(`Error deleting picks for ${dbName}:`, deletePicksError);
        continue;
      }
      
      // Insert new picks
      for (let i = 0; i < picks.length; i++) {
        const { error: pickError } = await supabase
          .from('picks')
          .insert({
            user_id: userId,
            gw: gwNumber,
            fixture_index: i,
            pick: picks[i]
          });
        
        if (pickError) {
          console.log(`Error inserting pick ${i} for ${dbName}:`, pickError);
        }
      }
      
      // Update submission
      const { error: submissionError } = await supabase
        .from('gw_submissions')
        .upsert({
          user_id: userId,
          gw: gwNumber,
          submitted_at: new Date().toISOString()
        });
      
      if (submissionError) {
        console.log(`Error updating submission for ${dbName}:`, submissionError);
      }
      
      console.log(`${dbName} picks updated successfully`);
    }
    
    console.log(`GW${gwNumber} completed`);
  }
  
  console.log('\n=== ALL DATA FIXED SUCCESSFULLY ===');
  console.log('All results and picks have been updated with correct data from CSV files and result images.');
}

fixAllData().catch(console.error);

