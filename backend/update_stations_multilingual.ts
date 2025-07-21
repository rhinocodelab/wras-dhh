import { dbRun, dbGet, dbAll } from './database.js';

interface TranslationResponse {
  original_text: string;
  translations: {
    Marathi: string;
    Hindi: string;
    Gujarati: string;
  };
  success: boolean;
}

async function translateStationName(stationName: string): Promise<{
  hindi: string;
  marathi: string;
  gujarati: string;
}> {
  try {
    console.log(`🔄 Translating: "${stationName}"`);
    
    const response = await fetch('http://localhost:5001/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: stationName,
        source_language: 'en'
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status} ${response.statusText}`);
    }

    const result: TranslationResponse = await response.json();
    
    if (!result.success) {
      throw new Error('Translation failed');
    }

    console.log(`✅ Translated "${stationName}" to:`);
    console.log(`   Hindi: ${result.translations.Hindi}`);
    console.log(`   Marathi: ${result.translations.Marathi}`);
    console.log(`   Gujarati: ${result.translations.Gujarati}`);

    return {
      hindi: result.translations.Hindi,
      marathi: result.translations.Marathi,
      gujarati: result.translations.Gujarati
    };
  } catch (error) {
    console.error(`❌ Error translating "${stationName}":`, error);
    // Return original name as fallback
    return {
      hindi: stationName,
      marathi: stationName,
      gujarati: stationName
    };
  }
}

async function updateStationsMultilingual() {
  try {
    console.log('🔄 Starting multilingual station name update...');
    
    // Get all stations
    const stations = await dbAll('SELECT id, station_name FROM stations ORDER BY station_name');
    console.log(`📊 Found ${stations.length} stations to update`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const station of stations) {
      try {
        console.log(`\n🔄 Processing station ${station.id}: ${station.station_name}`);
        
        // Translate the station name
        const translations = await translateStationName(station.station_name);
        
        // Update the database
        await dbRun(
          'UPDATE stations SET station_name_hi = ?, station_name_mr = ?, station_name_gu = ? WHERE id = ?',
          [translations.hindi, translations.marathi, translations.gujarati, station.id]
        );
        
        console.log(`✅ Updated station: ${station.station_name}`);
        successCount++;
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error updating station ${station.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Update completed!`);
    console.log(`✅ Successfully updated: ${successCount} stations`);
    console.log(`❌ Errors: ${errorCount} stations`);
    
    // Show sample results
    console.log(`\n📋 Sample updated stations:`);
    const sampleStations = await dbAll(`
      SELECT id, station_name, station_name_hi, station_name_mr, station_name_gu 
      FROM stations 
      ORDER BY station_name 
      LIMIT 5
    `);
    
    for (const station of sampleStations) {
      console.log(`\n${station.station_name}:`);
      console.log(`  Hindi: ${station.station_name_hi}`);
      console.log(`  Marathi: ${station.station_name_mr}`);
      console.log(`  Gujarati: ${station.station_name_gu}`);
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  }
}

// Run update if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateStationsMultilingual()
    .then(() => {
      console.log('🎉 Multilingual update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Update failed:', error);
      process.exit(1);
    });
}

export { updateStationsMultilingual }; 