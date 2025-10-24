import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import morgan from 'morgan'; // <-- Import morgan
import logger from './config/logger.js'; // <-- Import winston logger
import cors from 'cors'; // <-- 1. Import the cors package

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tileRoutes from './routes/tileRoutes.js';
import partyRoutes from './routes/partyRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import dispatchRoutes from './routes/dispatchRoutes.js';
import restockRoutes from './routes/restockRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

dotenv.config();
connectDB();

const app = express();

// Body parser middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- LOGGING MIDDLEWARE ---
// Use morgan for HTTP request logging. We can pipe its output to Winston.
const stream = {
  write: (message) => logger.http(message.trim( )),
};
// Use 'combined' format for production-like logs, or 'dev' for colorful dev logs
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream }));


// --- API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tiles', tileRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/restocks', restockRoutes);
app.use('/api/uploads', uploadRoutes);

// --- ERROR HANDLING MIDDLEWARE ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
