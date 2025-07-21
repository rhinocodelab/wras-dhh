import { dbRun, dbGet, dbAll } from './database.js';

async function migrateStationsMultilingual() {
  try {
    console.log('🔄 Starting stations multilingual migration...');
    
    // Check if the new columns already exist
    const tableInfo = await dbAll("PRAGMA table_info(stations)");
    const existingColumns = tableInfo.map((col: any) => col.name);
    
    console.log('📋 Existing columns:', existingColumns);
    
    const newColumns = [
      'station_name_hi',
      'station_name_mr', 
      'station_name_gu'
    ];
    
    const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col));
    
    if (columnsToAdd.length === 0) {
      console.log('✅ All multilingual columns already exist');
      return;
    }
    
    console.log('➕ Adding new columns:', columnsToAdd);
    
    // Add new columns
    for (const column of columnsToAdd) {
      await dbRun(`ALTER TABLE stations ADD COLUMN ${column} TEXT`);
      console.log(`✅ Added column: ${column}`);
    }
    
    // Get all existing stations
    const stations = await dbAll('SELECT id, station_name FROM stations');
    console.log(`📊 Found ${stations.length} existing stations to update`);
    
    // For now, we'll set the multilingual names to the same as English
    // In a real scenario, you might want to use the translation API
    for (const station of stations) {
      await dbRun(
        'UPDATE stations SET station_name_hi = ?, station_name_mr = ?, station_name_gu = ? WHERE id = ?',
        [station.station_name, station.station_name, station.station_name, station.id]
      );
      console.log(`🔄 Updated station: ${station.station_name}`);
    }
    
    console.log('✅ Stations multilingual migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateStationsMultilingual()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateStationsMultilingual }; 