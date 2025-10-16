#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// User mapping from CSV names to site usernames
const USER_MAPPING = {
  'Thomas Bird': 'ThomasJamesBird',
  'william middleton': 'Will Middleton', 
  'Jof': 'Jof',
  'CarlIos': 'Carl',
  'Phil Bolton': 'Phil Bolton',
  'Paul ': 'Paul N',
  'Ben': 'Ben New',
  'Gregory': 'gregory',
  'SP': 'SP'
}

// Real GW1 fixtures with actual results
const GW1_FIXTURES = [
  {
    fixture_index: 0,
    home_team: 'Liverpool',
    home_code: 'LIV',
    away_team: 'AFC Bournemouth', 
    away_code: 'BOU',
    kickoff_time: '2025-08-15T20:00:00Z',
    result: 'H' // Liverpool 4-2 AFC Bournemouth
  },
  {
    fixture_index: 1,
    home_team: 'Aston Villa',
    home_code: 'AVL',
    away_team: 'Newcastle United',
    away_code: 'NEW', 
    kickoff_time: '2025-08-16T12:30:00Z',
    result: 'D' // Aston Villa 0-0 Newcastle United
  },
  {
    fixture_index: 2,
    home_team: 'Brighton & Hove Albion',
    home_code: 'BHA',
    away_team: 'Fulham',
    away_code: 'FUL',
    kickoff_time: '2025-08-16T15:00:00Z', 
    result: 'D' // Brighton 1-1 Fulham
  },
  {
    fixture_index: 3,
    home_team: 'Sunderland',
    home_code: 'SUN',
    away_team: 'West Ham United',
    away_code: 'WHU',
    kickoff_time: '2025-08-16T15:00:00Z',
    result: 'H' // Sunderland 3-0 West Ham United
  },
  {
    fixture_index: 4,
    home_team: 'Tottenham Hotspur',
    home_code: 'TOT',
    away_team: 'Burnley',
    away_code: 'BUR',
    kickoff_time: '2025-08-16T15:00:00Z',
    result: 'H' // Tottenham 3-0 Burnley
  },
  {
    fixture_index: 5,
    home_team: 'Wolverhampton Wanderers',
    home_code: 'WOL',
    away_team: 'Manchester City',
    away_code: 'MCI',
    kickoff_time: '2025-08-16T17:30:00Z',
    result: 'A' // Wolves 0-4 Manchester City
  },
  {
    fixture_index: 6,
    home_team: 'Chelsea',
    home_code: 'CHE',
    away_team: 'Crystal Palace',
    away_code: 'CRY',
    kickoff_time: '2025-08-17T14:00:00Z',
    result: 'D' // Chelsea 0-0 Crystal Palace
  },
  {
    fixture_index: 7,
    home_team: 'Nottingham Forest',
    home_code: 'NFO',
    away_team: 'Brentford',
    away_code: 'BRE',
    kickoff_time: '2025-08-17T14:00:00Z',
    result: 'H' // Nottingham Forest 3-1 Brentford
  },
  {
    fixture_index: 8,
    home_team: 'Manchester United',
    home_code: 'MUN',
    away_team: 'Arsenal',
    away_code: 'ARS',
    kickoff_time: '2025-08-17T16:30:00Z',
    result: 'A' // Manchester United 0-1 Arsenal
  },
  {
    fixture_index: 9,
    home_team: 'Leeds United',
    home_code: 'LEE',
    away_team: 'Everton',
    away_code: 'EVE',
    kickoff_time: '2025-08-18T20:00:00Z',
    result: 'H' // Leeds United 1-0 Everton
  }
]

async function clearExistingData() {
  console.log('🧹 Clearing existing fake data...')
  
  try {
    // Clear existing fixtures, results, picks, and submissions
    await Promise.all([
      supabase.from('fixtures').delete().neq('id', 0), // Delete all fixtures
      supabase.from('gw_results').delete().neq('id', 0), // Delete all results  
      supabase.from('picks').delete().neq('id', 0), // Delete all picks
      supabase.from('gw_submissions').delete().neq('id', 0), // Delete all submissions
    ])
    
    console.log('✅ Cleared existing data')
  } catch (error) {
    console.error('❌ Error clearing data:', error)
    throw error
  }
}

async function addFixtures() {
  console.log('📅 Adding GW1 fixtures...')
  
  try {
    const fixtureRows = GW1_FIXTURES.map(f => ({
      gw: 1,
      fixture_index: f.fixture_index,
      home_team: f.home_team,
      home_code: f.home_code,
      away_team: f.away_team,
      away_code: f.away_code,
      kickoff_time: f.kickoff_time
    }))
    
    const { error } = await supabase
      .from('fixtures')
      .upsert(fixtureRows, { onConflict: 'gw,fixture_index' })
    
    if (error) throw error
    console.log(`✅ Added ${fixtureRows.length} fixtures`)
  } catch (error) {
    console.error('❌ Error adding fixtures:', error)
    throw error
  }
}

async function addResults() {
  console.log('🏆 Adding GW1 results...')
  
  try {
    const resultRows = GW1_FIXTURES.map(f => ({
      gw: 1,
      fixture_index: f.fixture_index,
      result: f.result,
      decided_at: new Date().toISOString()
    }))
    
    const { error } = await supabase
      .from('gw_results')
      .upsert(resultRows, { onConflict: 'gw,fixture_index' })
    
    if (error) throw error
    console.log(`✅ Added ${resultRows.length} results`)
  } catch (error) {
    console.error('❌ Error adding results:', error)
    throw error
  }
}

async function addUserPicks() {
  console.log('👥 Adding user picks from CSV...')
  
  try {
    // Read the CSV file
    const csvPath = path.join(__dirname, 'GW1.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf8')
    const lines = csvContent.trim().split('\n')
    
    // Skip header row
    const dataLines = lines.slice(1)
    
    const pickRows = []
    
    for (const line of dataLines) {
      const columns = line.split(',')
      if (columns.length < 12) continue // Skip incomplete rows
      
      const playerName = columns[1].trim()
      const siteUsername = USER_MAPPING[playerName]
      
      if (!siteUsername) {
        console.log(`⚠️  Skipping unmapped player: ${playerName}`)
        continue
      }
      
      // Get user ID from username
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', siteUsername)
        .single()
      
      if (userError || !user) {
        console.log(`⚠️  User not found: ${siteUsername}`)
        continue
      }
      
      // Parse picks (columns 2-11 are the fixture picks)
      const pickColumns = columns.slice(2, 12)
      
      pickColumns.forEach((pick, index) => {
        if (index >= GW1_FIXTURES.length) return
        
        const fixture = GW1_FIXTURES[index]
        let pickValue = null
        
        if (pick.includes('Win')) {
          // Determine if it's home or away win based on team name
          if (pick.includes(fixture.home_team)) {
            pickValue = 'H'
          } else if (pick.includes(fixture.away_team)) {
            pickValue = 'A'
          }
        } else if (pick.includes('Draw')) {
          pickValue = 'D'
        }
        
        if (pickValue) {
          pickRows.push({
            user_id: user.id,
            gw: 1,
            fixture_index: fixture.fixture_index,
            pick: pickValue
          })
        }
      })
    }
    
    if (pickRows.length > 0) {
      const { error } = await supabase
        .from('picks')
        .upsert(pickRows, { onConflict: 'user_id,gw,fixture_index' })
      
      if (error) throw error
      console.log(`✅ Added ${pickRows.length} user picks`)
    }
  } catch (error) {
    console.error('❌ Error adding user picks:', error)
    throw error
  }
}

async function addSubmissions() {
  console.log('📝 Adding user submissions...')
  
  try {
    // Get all users who have picks for GW1
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('user_id')
      .eq('gw', 1)
    
    if (picksError) throw picksError
    
    const userIds = [...new Set(picks.map(p => p.user_id))]
    
    const submissionRows = userIds.map(userId => ({
      user_id: userId,
      gw: 1,
      submitted_at: new Date().toISOString()
    }))
    
    const { error } = await supabase
      .from('gw_submissions')
      .upsert(submissionRows, { onConflict: 'user_id,gw' })
    
    if (error) throw error
    console.log(`✅ Added ${submissionRows.length} user submissions`)
  } catch (error) {
    console.error('❌ Error adding submissions:', error)
    throw error
  }
}

async function updateMeta() {
  console.log('⚙️  Updating meta table...')
  
  try {
    const { error } = await supabase
      .from('meta')
      .upsert({ id: 1, current_gw: 1 }, { onConflict: 'id' })
    
    if (error) throw error
    console.log('✅ Updated current_gw to 1')
  } catch (error) {
    console.error('❌ Error updating meta:', error)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting GW1 data migration...')
  
  try {
    await clearExistingData()
    await addFixtures()
    await addResults()
    await addUserPicks()
    await addSubmissions()
    await updateMeta()
    
    console.log('🎉 GW1 data migration completed successfully!')
    console.log('🌐 Check your site at http://localhost:5173 to see the results!')
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

main()
