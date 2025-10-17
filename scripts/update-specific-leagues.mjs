#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSpecificLeagues() {
  console.log('🔧 Updating specific leagues to start from GW0...');
  
  const leaguesToUpdate = ['Prem Predictions', 'FC Football', 'Easy League'];
  
  try {
    // Get all leagues
    const { data: allLeagues, error: fetchError } = await supabase
      .from('leagues')
      .select('id, name, code');
    
    if (fetchError) {
      console.error('❌ Error fetching leagues:', fetchError.message);
      return;
    }
    
    console.log('Found leagues:', allLeagues?.map(l => l.name));
    
    // Find the leagues to update
    const leaguesToUpdateIds = [];
    for (const leagueName of leaguesToUpdate) {
      const league = allLeagues?.find(l => l.name === leagueName);
      if (league) {
        leaguesToUpdateIds.push(league.id);
        console.log(`✅ Found league: ${leagueName} (${league.code})`);
      } else {
        console.log(`❌ League not found: ${leagueName}`);
      }
    }
    
    if (leaguesToUpdateIds.length === 0) {
      console.log('No leagues found to update');
      return;
    }
    
    // Since we can't add the start_gw column via API, we'll use a different approach
    // We'll store the start gameweek in the league name or use a metadata approach
    console.log('\n📝 Note: Since we cannot add database columns via API,');
    console.log('we need to implement this differently in the code.');
    console.log('\nLeagues that should start from GW0:');
    leaguesToUpdateIds.forEach((id, index) => {
      const league = allLeagues?.find(l => l.id === id);
      console.log(`- ${league?.name} (${league?.code})`);
    });
    
    console.log('\nI will update the code to handle these specific leagues.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

updateSpecificLeagues();
