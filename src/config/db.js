import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Auto-detect transaction support (since standalone MongoDB does not support transactions)
    let transactionsSupported = true;
    const checkSession = await mongoose.startSession();
    try {
      checkSession.startTransaction();
      // Execute a mock query in the check transaction to force database contact
      await mongoose.connection.db.collection('test_transaction_support').findOne({}, { session: checkSession });
      await checkSession.commitTransaction();
    } catch (error) {
      if (
        error.message.includes('Transaction numbers are only allowed') ||
        error.code === 20 ||
        error.code === 251
      ) {
        transactionsSupported = false;
        console.warn('MongoDB transactions are not supported by this server (running in standalone mode). Bypassing transactions.');
      }
    } finally {
      checkSession.endSession();
    }

    // If transactions are not supported, monkey-patch mongoose.startSession to mock transaction methods
    if (!transactionsSupported) {
      const originalStartSession = mongoose.startSession;
      mongoose.startSession = async function (...args) {
        const session = await originalStartSession.apply(this, args);
        session.startTransaction = () => {};
        session.commitTransaction = async () => {};
        session.abortTransaction = async () => {};
        return session;
      };
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
