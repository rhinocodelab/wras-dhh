import express from 'express';
import { dbRun, dbGet, dbAll } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';

// Function to translate text using the FastAPI translation service
async function translateStationName(englishName: string): Promise<{ hi: string; mr: string; gu: string }> {
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
    console.error('Error translating station name:', error);
    // Return English name as fallback for all languages
    return {
      hi: englishName,
      mr: englishName,
      gu: englishName
    };
  }
}

const router = express.Router();

// Get all stations with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;
    
    console.log('Fetching stations with pagination and search:', { page, limit, offset, search });
    
    // Build search condition
    let searchCondition = '';
    let searchParams: any[] = [];
    
    if (search.trim()) {
      searchCondition = 'WHERE station_name LIKE ? OR station_code LIKE ?';
      const searchTerm = `%${search.trim()}%`;
      searchParams = [searchTerm, searchTerm];
    }
    
    console.log('Search condition:', searchCondition);
    console.log('Search params:', searchParams);
    
    // Get total count with search
    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM stations ${searchCondition}`,
      searchParams
    );
    const total = totalResult.count;
    
    // Get paginated stations with search
    const stations = await dbAll(
      `SELECT * FROM stations ${searchCondition} ORDER BY station_name LIMIT ? OFFSET ?`,
      [...searchParams, limit, offset]
    );
    
    console.log('Found stations:', stations.length);
    console.log('Total stations:', total);
    
    res.json({
      stations,
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
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all stations without pagination (for bulk operations)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching all stations without pagination');
    
    const stations = await dbAll('SELECT * FROM stations ORDER BY station_name');
    
    console.log('Found stations:', stations.length);
    
    res.json({ stations });
  } catch (error) {
    console.error('Error fetching all stations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new station
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { station_name, station_code, station_name_hi, station_name_mr, station_name_gu } = req.body;

    if (!station_name || !station_code) {
      return res.status(400).json({ error: 'Station name and code are required' });
    }

    // Check if station code already exists
    const existingStation = await dbGet('SELECT * FROM stations WHERE station_code = ?', [station_code]);
    if (existingStation) {
      return res.status(400).json({ error: 'Station code already exists' });
    }

    // If multilingual names are not provided, translate the English name
    let finalHindiName = station_name_hi;
    let finalMarathiName = station_name_mr;
    let finalGujaratiName = station_name_gu;

    if (!station_name_hi || !station_name_mr || !station_name_gu) {
      console.log(`Translating station name: ${station_name}`);
      const translations = await translateStationName(station_name);
      
      finalHindiName = station_name_hi || translations.hi;
      finalMarathiName = station_name_mr || translations.mr;
      finalGujaratiName = station_name_gu || translations.gu;
      
      console.log(`Translation results for ${station_name}:`, {
        hindi: finalHindiName,
        marathi: finalMarathiName,
        gujarati: finalGujaratiName
      });
    }

    const result = await dbRun(
      'INSERT INTO stations (station_name, station_code, station_name_hi, station_name_mr, station_name_gu) VALUES (?, ?, ?, ?, ?)',
      [station_name, station_code.toUpperCase(), finalHindiName, finalMarathiName, finalGujaratiName]
    );

    const newStation = await dbGet('SELECT * FROM stations WHERE id = ?', [result.lastID]);
    res.status(201).json(newStation);
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update station
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { station_name, station_code, station_name_hi, station_name_mr, station_name_gu } = req.body;

    if (!station_name || !station_code) {
      return res.status(400).json({ error: 'Station name and code are required' });
    }

    // Check if station code already exists for different station
    const existingStation = await dbGet('SELECT * FROM stations WHERE station_code = ? AND id != ?', [station_code, id]);
    if (existingStation) {
      return res.status(400).json({ error: 'Station code already exists' });
    }

    // If multilingual names are not provided, translate the English name
    let finalHindiName = station_name_hi;
    let finalMarathiName = station_name_mr;
    let finalGujaratiName = station_name_gu;

    if (!station_name_hi || !station_name_mr || !station_name_gu) {
      console.log(`Translating station name for update: ${station_name}`);
      const translations = await translateStationName(station_name);
      
      finalHindiName = station_name_hi || translations.hi;
      finalMarathiName = station_name_mr || translations.mr;
      finalGujaratiName = station_name_gu || translations.gu;
      
      console.log(`Translation results for ${station_name}:`, {
        hindi: finalHindiName,
        marathi: finalMarathiName,
        gujarati: finalGujaratiName
      });
    }

    await dbRun(
      'UPDATE stations SET station_name = ?, station_code = ?, station_name_hi = ?, station_name_mr = ?, station_name_gu = ? WHERE id = ?',
      [station_name, station_code.toUpperCase(), finalHindiName, finalMarathiName, finalGujaratiName, id]
    );

    const updatedStation = await dbGet('SELECT * FROM stations WHERE id = ?', [id]);
    res.json(updatedStation);
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete station
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if station is used in train routes
    const routesUsingStation = await dbAll(
      'SELECT * FROM train_routes WHERE start_station_id = ? OR end_station_id = ?',
      [id, id]
    );

    if (routesUsingStation.length > 0) {
      return res.status(400).json({ error: 'Cannot delete station as it is used in train routes' });
    }

    await dbRun('DELETE FROM stations WHERE id = ?', [id]);
    res.json({ message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear all stations
router.delete('/', authenticateToken, async (req, res) => {
  try {
    // Check if any stations are used in train routes
    const routesUsingStations = await dbAll('SELECT COUNT(*) as count FROM train_routes');
    
    if (routesUsingStations[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot clear stations as they are used in train routes. Please clear train routes first.' 
      });
    }

    await dbRun('DELETE FROM stations');
    res.json({ message: 'All stations cleared successfully' });
  } catch (error) {
    console.error('Error clearing stations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;