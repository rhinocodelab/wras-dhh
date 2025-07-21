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

async function translateTrainName(trainName: string): Promise<{
  hindi: string;
  marathi: string;
  gujarati: string;
}> {
  try {
    console.log(`🔄 Translating: "${trainName}"`);
    
    const response = await fetch('http://localhost:5001/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: trainName,
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

    console.log(`✅ Translated "${trainName}" to:`);
    console.log(`   Hindi: ${result.translations.Hindi}`);
    console.log(`   Marathi: ${result.translations.Marathi}`);
    console.log(`   Gujarati: ${result.translations.Gujarati}`);

    return {
      hindi: result.translations.Hindi,
      marathi: result.translations.Marathi,
      gujarati: result.translations.Gujarati
    };
  } catch (error) {
    console.error(`❌ Error translating "${trainName}":`, error);
    // Return original name as fallback
    return {
      hindi: trainName,
      marathi: trainName,
      gujarati: trainName
    };
  }
}

async function updateTrainRoutesMultilingual() {
  try {
    console.log('🔄 Starting multilingual train route name update...');
    
    // Get all train routes
    const trainRoutes = await dbAll('SELECT id, train_name FROM train_routes ORDER BY train_name');
    console.log(`📊 Found ${trainRoutes.length} train routes to update`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const trainRoute of trainRoutes) {
      try {
        console.log(`\n🔄 Processing train route ${trainRoute.id}: ${trainRoute.train_name}`);
        
        // Translate the train name
        const translations = await translateTrainName(trainRoute.train_name);
        
        // Update the database
        await dbRun(
          'UPDATE train_routes SET train_name_hi = ?, train_name_mr = ?, train_name_gu = ? WHERE id = ?',
          [translations.hindi, translations.marathi, translations.gujarati, trainRoute.id]
        );
        
        console.log(`✅ Updated train route: ${trainRoute.train_name}`);
        successCount++;
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error updating train route ${trainRoute.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Update completed!`);
    console.log(`✅ Successfully updated: ${successCount} train routes`);
    console.log(`❌ Errors: ${errorCount} train routes`);
    
    // Show sample results
    console.log(`\n📋 Sample updated train routes:`);
    const sampleTrainRoutes = await dbAll(`
      SELECT id, train_name, train_name_hi, train_name_mr, train_name_gu 
      FROM train_routes 
      ORDER BY train_name 
      LIMIT 5
    `);
    
    for (const trainRoute of sampleTrainRoutes) {
      console.log(`\n${trainRoute.train_name}:`);
      console.log(`  Hindi: ${trainRoute.train_name_hi}`);
      console.log(`  Marathi: ${trainRoute.train_name_mr}`);
      console.log(`  Gujarati: ${trainRoute.train_name_gu}`);
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  }
}

// Run update if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateTrainRoutesMultilingual()
    .then(() => {
      console.log('🎉 Multilingual update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Update failed:', error);
      process.exit(1);
    });
}

export { updateTrainRoutesMultilingual }; 