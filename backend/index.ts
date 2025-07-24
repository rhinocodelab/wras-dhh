import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database.js';
import authRoutes from './routes/auth.js';
import stationRoutes from './routes/stations.js';
import trainRouteRoutes from './routes/trainRoutes.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Frontend development server
    'http://localhost:3000',  // Frontend production server
    'http://localhost:5001',  // API server
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5001',
    'http://192.168.1.92:5173',  // Network IP for development
    'http://192.168.1.92:3000',  // Network IP for production
    'http://192.168.1.92:3001',  // Network IP for backend
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Disposition', 'Content-Length'],
  maxAge: 3600, // Cache preflight requests for 1 hour
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/train-routes', trainRouteRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'WRAS-DHH Server is running' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log('WRAS-DHH Server running on port ' + PORT);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();