// import express from 'express';
// import dotenv from 'dotenv';
// import connectDB from './config/db.js';
// import { notFound, errorHandler } from './middleware/errorMiddleware.js';
// import morgan from 'morgan';
// import logger from './config/logger.js';
// import cors from 'cors';

// import authRoutes from './routes/authRoutes.js';
// import userRoutes from './routes/userRoutes.js';
// import tileRoutes from './routes/tileRoutes.js';
// import companyRoutes from './routes/companyRoutes.js';
// import bookingRoutes from './routes/bookingRoutes.js';
// import dispatchRoutes from './routes/dispatchRoutes.js';
// import restockRoutes from './routes/restockRoutes.js';
// import uploadRoutes from './routes/uploadRoutes.js';

// dotenv.config();
// connectDB();

// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const stream = {
//   write: (message) => logger.http(message.trim( )),
// };
// app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream }));

// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/tiles', tileRoutes);
// app.use('/api/companies', companyRoutes);
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/dispatches', dispatchRoutes);
// app.use('/api/restocks', restockRoutes);
// app.use('/api/uploads', uploadRoutes); // Correct plural path

// app.use(notFound);
// app.use(errorHandler);

// const PORT = process.env.PORT || 5001;

// app.listen(PORT, () => {
//   logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
// });

import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import morgan from 'morgan';
import logger from './config/logger.js';
import cors from 'cors';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tileRoutes from './routes/tileRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import dispatchRoutes from './routes/dispatchRoutes.js';
import restockRoutes from './routes/restockRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import asyncHandler from './utils/asyncHandler.js';

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging Middleware
const stream = {
  write: (message) => logger.http(message.trim( )),
};
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream }));

// --- API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tiles', tileRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/restocks', restockRoutes);

// --- THIS IS THE CORRECTED ROUTE ---
// It now correctly uses the plural '/uploads' to match the frontend.
app.use('/api/uploads', uploadRoutes);

app.get("/",asyncHandler(async (req, res) => {
  res.send("hello from meganea")
}));
// -----------------------------------

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
