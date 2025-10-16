// scripts/add-gw5-data.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// User mapping (CSV name to user_id) - only existing users
const userMapping = {
  'Jof': '4542c037-5b38-40d0-b189-847b8f17c222',
  'Thomas Bird': '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
  'william middleton': '42b48136-040e-42a3-9b0a-dc9550dd1cae', // Will Middleton
  'CarlIos': 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  'Gregory': '8588ee74-34de-4c16-98cb-89078b1ae5ba', // gregory
  'Ben': '8e53f3fb-3842-423c-84d4-192496939632', // Ben New
  'SP': '9c0bcf50-370d-412d-8826-95371a72b4fe',
  'Phil Bolton': 'f09b62e6-792c-4fe1-a6ba-583d802781df',
  'Paul': 'a6f396b0-e370-4a6f-8ca8-102d1db8ee9d', // Paul N
};

// GW5 Fixtures and Results (from the image description)
const gw5Data = [
  {
    fixture_index: 0,
    home_team: 'Liverpool',
    home_code: 'LIV',
    away_team: 'Everton',
    away_code: 'EVE',
    kickoff_time: '2025-09-20T12:30:00Z',
    result: 'H' // Liverpool 2-1 Everton
  },
  {
    fixture_index: 1,
    home_team: 'Brighton & Hove Albion',
    home_code: 'BHA',
    away_team: 'Tottenham Hotspur',
    away_code: 'TOT',
    kickoff_time: '2025-09-20T15:00:00Z',
    result: 'D' // Brighton & Hove Albion 2-2 Tottenham Hotspur
  },
  {
    fixture_index: 2,
    home_team: 'Burnley',
    home_code: 'BUR',
    away_team: 'Nottingham Forest',
    away_code: 'NFO',
    kickoff_time: '2025-09-20T15:00:00Z',
    result: 'D' // Burnley 1-1 Nottingham Forest
  },
  {
    fixture_index: 3,
    home_team: 'West Ham United',
    home_code: 'WHU',
    away_team: 'Crystal Palace',
    away_code: 'CRY',
    kickoff_time: '2025-09-20T15:00:00Z',
    result: 'A' // Crystal Palace 2-1 West Ham United
  },
  {
    fixture_index: 4,
    home_team: 'Wolverhampton Wanderers',
    home_code: 'WOL',
    away_team: 'Leeds United',
    away_code: 'LEE',
    kickoff_time: '2025-09-20T15:00:00Z',
    result: 'A' // Leeds United 3-1 Wolverhampton Wanderers
  },
  {
    fixture_index: 5,
    home_team: 'Manchester United',
    home_code: 'MUN',
    away_team: 'Chelsea',
    away_code: 'CHE',
    kickoff_time: '2025-09-20T17:30:00Z',
    result: 'H' // Manchester United 2-1 Chelsea
  },
  {
    fixture_index: 6,
    home_team: 'Fulham',
    home_code: 'FUL',
    away_team: 'Brentford',
    away_code: 'BRE',
    kickoff_time: '2025-09-20T20:00:00Z',
    result: 'H' // Fulham 3-1 Brentford
  },
  {
    fixture_index: 7,
    home_team: 'AFC Bournemouth',
    home_code: 'BOU',
    away_team: 'Newcastle United',
    away_code: 'NEW',
    kickoff_time: '2025-09-21T14:00:00Z',
    result: 'D' // AFC Bournemouth 0-0 Newcastle United
  },
  {
    fixture_index: 8,
    home_team: 'Sunderland',
    home_code: 'SUN',
    away_team: 'Aston Villa',
    away_code: 'AVL',
    kickoff_time: '2025-09-21T14:00:00Z',
    result: 'D' // Sunderland 1-1 Aston Villa
  },
  {
    fixture_index: 9,
    home_team: 'Arsenal',
    home_code: 'ARS',
    away_team: 'Manchester City',
    away_code: 'MCI',
    kickoff_time: '2025-09-21T16:30:00Z',
    result: 'D' // Arsenal 1-1 Manchester City
  },
];

async function addGw5Data() {
  console.log('🔍 TRIPLE-CHECKING AND ADDING GW5 DATA...\n');

  try {
    // Check if GW5 already exists
    const { data: existingGw5, error: gw5Error } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', 5);
    
    if (gw5Error) throw gw5Error;
    
    if (existingGw5.length > 0) {
      console.log(`⚠️  GW5 already has ${existingGw5.length} fixtures. Clearing them first...`);
      
      // Clear existing GW5 data
      await supabase.from('picks').delete().eq('gw', 5);
      await supabase.from('gw_submissions').delete().eq('gw', 5);
      await supabase.from('gw_results').delete().eq('gw', 5);
      await supabase.from('fixtures').delete().eq('gw', 5);
      console.log('✅ Existing GW5 data cleared');
    }

    // Add GW5 fixtures
    console.log('\n🏟️ Adding GW5 fixtures...');
    const fixtureRows = gw5Data.map(f => ({
      gw: 5,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      home_code: f.home_code,
      away_team: f.away_team,
      away_code: f.away_code,
      kickoff_time: f.kickoff_time,
    }));

    const { error: fixtureError } = await supabase
      .from('fixtures')
      .insert(fixtureRows);
    
    if (fixtureError) throw fixtureError;
    console.log(`✅ Added ${fixtureRows.length} GW5 fixtures`);

    // Add GW5 results
    console.log('\n🏆 Adding GW5 results...');
    const resultRows = gw5Data.map(f => ({
      gw: 5,
      fixture_index: f.fixture_index,
      result: f.result,
      decided_at: new Date().toISOString(),
    }));

    const { error: resultError } = await supabase
      .from('gw_results')
      .insert(resultRows);
    
    if (resultError) throw resultError;
    console.log(`✅ Added ${resultRows.length} GW5 results`);

    // Read CSV and add user picks
    console.log('\n📄 Reading GW5 CSV file...');
    const csvPath = path.join(__dirname, 'GW5.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`✅ Found ${records.length} player records in CSV`);

    // Process each user's picks
    console.log('\n👥 Processing user picks...');
    const allPicks = [];
    const submissions = [];

    for (const record of records) {
      const playerName = record['Who are you?'] || record['Player Name'];
      const userId = userMapping[playerName];

      if (!userId) {
        console.log(`⚠️  Skipping unknown player: ${playerName}`);
        continue;
      }

      console.log(`\n👤 Processing ${playerName} (${userId}):`);
      
      const userPicks = [];
      let correctPredictions = 0;

      for (let i = 0; i < gw5Data.length; i++) {
        const fixture = gw5Data[i];
        
        // Get CSV pick (column index starts from 2, so i+2)
        const csvColumnIndex = i + 2;
        const csvPickText = record[Object.keys(record)[csvColumnIndex]];
        
        // Convert CSV pick text to H/D/A
        let pick = null;
        if (csvPickText.includes('Win')) {
          if (csvPickText.includes(fixture.home_team)) {
            pick = 'H';
          } else if (csvPickText.includes(fixture.away_team)) {
            pick = 'A';
          }
        } else if (csvPickText === 'Draw') {
          pick = 'D';
        }

        if (pick) {
          userPicks.push({
            user_id: userId,
            gw: 5,
            fixture_index: i,
            pick: pick,
          });

          // Check if this pick was correct
          if (pick === fixture.result) {
            correctPredictions++;
          }

          const pickText = pick === 'H' ? 'Home Win' : pick === 'A' ? 'Away Win' : 'Draw';
          const actualResult = fixture.result === 'H' ? 'Home Win' : fixture.result === 'A' ? 'Away Win' : 'Draw';
          const isCorrect = pick === fixture.result;
          
          console.log(`   ${i + 1}. ${fixture.home_team} vs ${fixture.away_team}: ${pickText} ${isCorrect ? '✅' : '❌'} (Actual: ${actualResult})`);
        }
      }

      allPicks.push(...userPicks);
      submissions.push({
        user_id: userId,
        gw: 5,
        submitted_at: new Date().toISOString()
      });

      console.log(`   📊 ${playerName}: ${correctPredictions}/${userPicks.length} correct (${Math.round((correctPredictions/userPicks.length)*100)}%)`);
    }

    // Insert all picks
    console.log(`\n📝 Inserting ${allPicks.length} picks...`);
    const { error: picksError } = await supabase
      .from('picks')
      .insert(allPicks);
    
    if (picksError) throw picksError;
    console.log('✅ All picks inserted');

    // Insert submissions
    console.log(`\n📋 Inserting ${submissions.length} submissions...`);
    const { error: submissionsError } = await supabase
      .from('gw_submissions')
      .insert(submissions);
    
    if (submissionsError) throw submissionsError;
    console.log('✅ All submissions inserted');

    // Update meta table to current_gw = 5
    console.log('\n⚙️ Updating meta table...');
    const { error: metaUpdateError } = await supabase
      .from('meta')
      .upsert({ id: 1, current_gw: 5 });
    
    if (metaUpdateError) throw metaUpdateError;
    console.log('✅ Meta table updated to current_gw = 5');

    console.log('\n🎉 GW5 DATA SUCCESSFULLY ADDED!');

  } catch (error) {
    console.error('❌ Error adding GW5 data:', error);
  }
}

addGw5Data();
