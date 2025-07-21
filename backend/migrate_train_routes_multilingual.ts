import { dbRun, dbGet, dbAll } from './database.js';

async function migrateTrainRoutesMultilingual() {
  try {
    console.log('🔄 Starting train routes multilingual migration...');
    
    // Check if the new columns already exist
    const tableInfo = await dbAll("PRAGMA table_info(train_routes)");
    const existingColumns = tableInfo.map((col: any) => col.name);
    
    console.log('📋 Existing columns:', existingColumns);
    
    const newColumns = [
      'train_name_hi',
      'train_name_mr', 
      'train_name_gu'
    ];
    
    const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col));
    
    if (columnsToAdd.length === 0) {
      console.log('✅ All multilingual columns already exist');
      return;
    }
    
    console.log('➕ Adding new columns:', columnsToAdd);
    
    // Add new columns
    for (const column of columnsToAdd) {
      await dbRun(`ALTER TABLE train_routes ADD COLUMN ${column} TEXT`);
      console.log(`✅ Added column: ${column}`);
    }
    
    // Get all existing train routes
    const trainRoutes = await dbAll('SELECT id, train_name FROM train_routes');
    console.log(`📊 Found ${trainRoutes.length} existing train routes to update`);
    
    // For now, we'll set the multilingual names to the same as English
    // In a real scenario, you might want to use the translation API
    for (const trainRoute of trainRoutes) {
      await dbRun(
        'UPDATE train_routes SET train_name_hi = ?, train_name_mr = ?, train_name_gu = ? WHERE id = ?',
        [trainRoute.train_name, trainRoute.train_name, trainRoute.train_name, trainRoute.id]
      );
      console.log(`🔄 Updated train route: ${trainRoute.train_name}`);
    }
    
    console.log('✅ Train routes multilingual migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTrainRoutesMultilingual()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateTrainRoutesMultilingual }; 