const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// Load env vars
dotenv.config({ path: './.env' });

// Connect to database
connectDB();

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Route files
const authRoutes = require('./routes/authRoutes');
const tileRoutes = require('./routes/tileRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const restockRoutes = require('./routes/restockRoutes');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/tiles', tileRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/restock-requests', restockRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
