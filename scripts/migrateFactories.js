import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const migrateFactories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const result = await mongoose.connection.db.collection('factories').updateMany(
      { status: { $exists: false } },
      { 
        $set: { 
          status: 'Active',
          contactNumber: '',
          email: '',
          notes: ''
        } 
      }
    );
    
    console.log(`✅ Migration complete!`);
    console.log(`📊 Modified ${result.modifiedCount} factories`);
    
    // Verify
    const factories = await mongoose.connection.db.collection('factories').find({}).toArray();
    console.log('\n📋 All Factories:');
    factories.forEach(f => {
      console.log(`  - ${f.name}: status=${f.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateFactories();