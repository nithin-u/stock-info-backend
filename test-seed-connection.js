require('dotenv').config();
const mongoose = require('mongoose');

async function testSeedConnection() {
  try {
    console.log('🔄 Testing connection for seeding...');
    console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
    console.log('URI starts with mongodb+srv:', process.env.MONGODB_URI?.startsWith('mongodb+srv://'));
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
    });
    
    console.log('✅ Seed connection test successful!');
    
    // Test basic database operations
    const dbName = mongoose.connection.db.databaseName;
    console.log('📊 Connected to database:', dbName);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Collections found:', collections.length);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected successfully');
    
  } catch (error) {
    console.error('❌ Seed connection test failed:');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('🔍 This is likely a network or authentication issue');
    }
    
    process.exit(1);
  }
}

testSeedConnection();
