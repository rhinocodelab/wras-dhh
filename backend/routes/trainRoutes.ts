import express from 'express';
import { dbRun, dbGet, dbAll } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';

// Function to translate text using the FastAPI translation service
async function translateTrainName(englishName: string): Promise<{ hi: string; mr: string; gu: string }> {
  try {
    const response = await axios.post('http://localhost:5001/translate', {
      text: englishName,
      source_language: 'en'
    });

    if (response.data.success) {
      return {
        hi: response.data.translations.Hindi || englishName,
        mr: response.data.translations.Marathi || englishName,
        gu: response.data.translations.Gujarati || englishName
      };
    } else {
      console.error('Translation failed:', response.data);
      return {
        hi: englishName,
        mr: englishName,
        gu: englishName
      };
    }
  } catch (error) {
    console.error('Error translating train name:', error);
    // Return English name as fallback for all languages
    return {
      hi: englishName,
      mr: englishName,
      gu: englishName
    };
  }
}

const router = express.Router();

// Get all train routes with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;
    
    console.log('Fetching train routes with pagination and search:', { page, limit, offset, search });
    
    // Build search condition
    let searchCondition = '';
    let searchParams: any[] = [];
    
    if (search.trim()) {
      searchCondition = 'WHERE tr.train_number LIKE ? OR tr.train_name LIKE ?';
      const searchTerm = `%${search.trim()}%`;
      searchParams = [searchTerm, searchTerm];
    }
    
    // Get total count with search
    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM train_routes tr ${searchCondition}`,
      searchParams
    );
    const total = totalResult.count;
    
    // Get paginated routes with search
    const routes = await dbAll(`
      SELECT 
        tr.*,
        s1.station_name as start_station_name,
        s1.station_name_hi as start_station_name_hi,
        s1.station_name_mr as start_station_name_mr,
        s1.station_name_gu as start_station_name_gu,
        s1.station_code as start_station_code,
        s2.station_name as end_station_name,
        s2.station_name_hi as end_station_name_hi,
        s2.station_name_mr as end_station_name_mr,
        s2.station_name_gu as end_station_name_gu,
        s2.station_code as end_station_code
      FROM train_routes tr
      JOIN stations s1 ON tr.start_station_id = s1.id
      JOIN stations s2 ON tr.end_station_id = s2.id
      ${searchCondition}
      ORDER BY tr.train_number
      LIMIT ? OFFSET ?
    `, [...searchParams, limit, offset]);
    
    console.log('Found routes:', routes.length);
    console.log('Total routes:', total);
    
    res.json({
      routes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching train routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all train routes without pagination (for bulk operations)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching all train routes without pagination');
    
    const routes = await dbAll(`
      SELECT 
        tr.*,
        s1.station_name as start_station_name,
        s1.station_name_hi as start_station_name_hi,
        s1.station_name_mr as start_station_name_mr,
        s1.station_name_gu as start_station_name_gu,
        s1.station_code as start_station_code,
        s2.station_name as end_station_name,
        s2.station_name_hi as end_station_name_hi,
        s2.station_name_mr as end_station_name_mr,
        s2.station_name_gu as end_station_name_gu,
        s2.station_code as end_station_code
      FROM train_routes tr
      JOIN stations s1 ON tr.start_station_id = s1.id
      JOIN stations s2 ON tr.end_station_id = s2.id
      ORDER BY tr.train_number
    `);
    
    console.log('Found routes:', routes.length);
    
    res.json({ routes });
  } catch (error) {
    console.error('Error fetching all train routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new train route
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { train_number, train_name, train_name_hi, train_name_mr, train_name_gu, start_station_id, end_station_id } = req.body;

    if (!train_number || !train_name || !start_station_id || !end_station_id) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (start_station_id === end_station_id) {
      return res.status(400).json({ error: 'Start and end stations cannot be the same' });
    }

    // Check if train number already exists
    const existingTrain = await dbGet('SELECT * FROM train_routes WHERE train_number = ?', [train_number]);
    if (existingTrain) {
      return res.status(400).json({ error: 'Train number already exists' });
    }

    // Verify stations exist
    const startStation = await dbGet('SELECT * FROM stations WHERE id = ?', [start_station_id]);
    const endStation = await dbGet('SELECT * FROM stations WHERE id = ?', [end_station_id]);
    
    if (!startStation || !endStation) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }

    // If multilingual names are not provided, translate the English name
    let finalHindiName = train_name_hi;
    let finalMarathiName = train_name_mr;
    let finalGujaratiName = train_name_gu;

    if (!train_name_hi || !train_name_mr || !train_name_gu) {
      console.log(`Translating train name: ${train_name}`);
      const translations = await translateTrainName(train_name);
      
      finalHindiName = train_name_hi || translations.hi;
      finalMarathiName = train_name_mr || translations.mr;
      finalGujaratiName = train_name_gu || translations.gu;
      
      console.log(`Translation results for ${train_name}:`, {
        hindi: finalHindiName,
        marathi: finalMarathiName,
        gujarati: finalGujaratiName
      });
    }

    const result = await dbRun(
      'INSERT INTO train_routes (train_number, train_name, train_name_hi, train_name_mr, train_name_gu, start_station_id, end_station_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [train_number, train_name, finalHindiName, finalMarathiName, finalGujaratiName, start_station_id, end_station_id]
    );

    const newRoute = await dbGet(`
      SELECT 
        tr.*,
        s1.station_name as start_station_name,
        s1.station_code as start_station_code,
        s2.station_name as end_station_name,
        s2.station_code as end_station_code
      FROM train_routes tr
      JOIN stations s1 ON tr.start_station_id = s1.id
      JOIN stations s2 ON tr.end_station_id = s2.id
      WHERE tr.id = ?
    `, [result.lastID]);

    res.status(201).json(newRoute);
  } catch (error) {
    console.error('Error creating train route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update train route
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { train_number, train_name, train_name_hi, train_name_mr, train_name_gu, start_station_id, end_station_id } = req.body;

    if (!train_number || !train_name || !start_station_id || !end_station_id) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (start_station_id === end_station_id) {
      return res.status(400).json({ error: 'Start and end stations cannot be the same' });
    }

    // Check if train number already exists for different route
    const existingTrain = await dbGet('SELECT * FROM train_routes WHERE train_number = ? AND id != ?', [train_number, id]);
    if (existingTrain) {
      return res.status(400).json({ error: 'Train number already exists' });
    }

    // Verify stations exist
    const startStation = await dbGet('SELECT * FROM stations WHERE id = ?', [start_station_id]);
    const endStation = await dbGet('SELECT * FROM stations WHERE id = ?', [end_station_id]);
    
    if (!startStation || !endStation) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }

    // If multilingual names are not provided, translate the English name
    let finalHindiName = train_name_hi;
    let finalMarathiName = train_name_mr;
    let finalGujaratiName = train_name_gu;

    if (!train_name_hi || !train_name_mr || !train_name_gu) {
      console.log(`Translating train name for update: ${train_name}`);
      const translations = await translateTrainName(train_name);
      
      finalHindiName = train_name_hi || translations.hi;
      finalMarathiName = train_name_mr || translations.mr;
      finalGujaratiName = train_name_gu || translations.gu;
      
      console.log(`Translation results for ${train_name}:`, {
        hindi: finalHindiName,
        marathi: finalMarathiName,
        gujarati: finalGujaratiName
      });
    }

    await dbRun(
      'UPDATE train_routes SET train_number = ?, train_name = ?, train_name_hi = ?, train_name_mr = ?, train_name_gu = ?, start_station_id = ?, end_station_id = ? WHERE id = ?',
      [train_number, train_name, finalHindiName, finalMarathiName, finalGujaratiName, start_station_id, end_station_id, id]
    );

    const updatedRoute = await dbGet(`
      SELECT 
        tr.*,
        s1.station_name as start_station_name,
        s1.station_code as start_station_code,
        s2.station_name as end_station_name,
        s2.station_code as end_station_code
      FROM train_routes tr
      JOIN stations s1 ON tr.start_station_id = s1.id
      JOIN stations s2 ON tr.end_station_id = s2.id
      WHERE tr.id = ?
    `, [id]);

    res.json(updatedRoute);
  } catch (error) {
    console.error('Error updating train route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete train route
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM train_routes WHERE id = ?', [id]);
    res.json({ message: 'Train route deleted successfully' });
  } catch (error) {
    console.error('Error deleting train route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear all train routes
router.delete('/', authenticateToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM train_routes');
    res.json({ message: 'All train routes cleared successfully' });
  } catch (error) {
    console.error('Error clearing train routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;