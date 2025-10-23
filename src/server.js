import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Import Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tileRoutes from './routes/tileRoutes.js';
import partyRoutes from './routes/partyRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import dispatchRoutes from './routes/dispatchRoutes.js';
import restockRoutes from './routes/restockRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Body parser for JSON

// API Routes
app.get('/api', (req, res) => {
  res.send('Meganea Server is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tiles', tileRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/restocks', restockRoutes);
app.use('/api/upload', uploadRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5500;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
