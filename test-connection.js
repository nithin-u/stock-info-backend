const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('Testing MongoDB Atlas connection...');
    console.log('URI:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connection successful!');
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Available collections:', collections.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testConnection();
