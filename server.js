

// import express from 'express';
// import dotenv from 'dotenv';
// import connectDB from './config/db.js';
// import { notFound, errorHandler } from './middleware/errorMiddleware.js';
// import morgan from 'morgan';
// import logger from './config/logger.js';
// import cors from 'cors';

// // Import routes
// import authRoutes from './routes/authRoutes.js';
// import userRoutes from './routes/userRoutes.js';
// import tileRoutes from './routes/tileRoutes.js';
// import companyRoutes from './routes/companyRoutes.js';
// import bookingRoutes from './routes/bookingRoutes.js';
// import dispatchRoutes from './routes/dispatchRoutes.js';
// import restockRoutes from './routes/restockRoutes.js';
// import uploadRoutes from './routes/uploadRoutes.js';
// import dashboardRoutes from './routes/dashboardRoutes.js'; // <-- ADD THIS

// import factoryRoutes from './routes/factoryRoutes.js';
// import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
// import indiaTileRoutes from './routes/indiaTileRoutes.js'; // Add this import
// import palletRoutes from './routes/palletRoutes.js'; // <-- ADD THIS IMPORT
// import loadingPlanRoutes from './routes/loadingPlanRoutes.js'; // <-- 1. ADD THIS IMPORT
// import containerRoutes from './routes/containerRoutes.js'; // --- 1. IMPORT THE NEW ROUTE ---


// import asyncHandler from './utils/asyncHandler.js';

// dotenv.config();
// connectDB();

// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Logging Middleware
// const stream = {
//   write: (message) => logger.http(message.trim( )),
// };
// app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream }));

// // --- API ROUTES ---
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/tiles', tileRoutes);
// app.use('/api/companies', companyRoutes);
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/dispatches', dispatchRoutes);
// app.use('/api/restocks', restockRoutes);
// app.use('/api/dashboard', dashboardRoutes); // <-- ADD THIS

// app.use('/api/factories', factoryRoutes);
// app.use('/api/purchase-orders', purchaseOrderRoutes);
// app.use('/api/india-tiles', indiaTileRoutes); // Add this line
// app.use('/api/pallets', palletRoutes); // <-- ADD THIS LINE
// app.use('/api/loading-plans', loadingPlanRoutes); // <-- 2. ADD THIS LINE
// app.use('/api/containers', containerRoutes); // --- 2. USE THE NEW ROUTE ---






// // --- THIS IS THE CORRECTED ROUTE ---
// // It now correctly uses the plural '/uploads' to match the frontend.
// app.use('/api/uploads', uploadRoutes);

// app.get("/",asyncHandler(async (req, res) => {
//   res.send("hello from meganea")
// }));
// // -----------------------------------

// // Error Handling Middleware
// app.use(notFound);
// app.use(errorHandler);

// const PORT = process.env.PORT || 5001;

// app.listen(PORT, () => {
//   logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
// });


// FILE: backend/src/server.js
// Updated server.js with report routes added

import express from 'express';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import { notFound, errorHandler } from './src/middleware/errorMiddleware.js';
import morgan from 'morgan';
import logger from './src/config/logger.js';
import cors from 'cors';

// Import routes
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import tileRoutes from './src/routes/tileRoutes.js';
import companyRoutes from './src/routes/companyRoutes.js';
import bookingRoutes from './src/routes/bookingRoutes.js';
import dispatchRoutes from './src/routes/dispatchRoutes.js';
import restockRoutes from './src/routes/restockRoutes.js';
import uploadRoutes from './src/routes/uploadRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import factoryRoutes from './src/routes/factoryRoutes.js';
import purchaseOrderRoutes from './src/routes/purchaseOrderRoutes.js';
import indiaTileRoutes from './src/routes/indiaTileRoutes.js';
import palletRoutes from './src/routes/palletRoutes.js';
import loadingPlanRoutes from './src/routes/loadingPlanRoutes.js';
import containerRoutes from './src/routes/containerRoutes.js';
import reportRoutes from './src/routes/reportRoutes.js'; // <-- ADD THIS IMPORT
import dubaiDispatchRoutes from './src/routes/dubaiDispatchRoutes.js';
import reconciliationRoutes from './src/routes/reconciliationRoutes.js';


import asyncHandler from './src/utils/asyncHandler.js';

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging Middleware
const stream = {
  write: (message) => logger.http(message.trim()),
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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/factories', factoryRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/india-tiles', indiaTileRoutes);
app.use('/api/pallets', palletRoutes);
app.use('/api/loading-plans', loadingPlanRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/reports', reportRoutes); // <-- ADD THIS LINE
app.use('/api/uploads', uploadRoutes);
app.use('/api/dubai-dispatches', dubaiDispatchRoutes);
app.use('/api/reconciliation', reconciliationRoutes);

app.get("/", asyncHandler(async (req, res) => {
  res.send("hello from meganea")
}));

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});