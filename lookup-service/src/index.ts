import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const dbUrl = process.env.DB_CONNECTION || 'mongodb://localhost:27017';
const dbName = 'fileCommitmentsDB'; // Name of your MongoDB database

let db: any;

// Initialize MongoDB connection
const connectToMongoDB = async () => {
  const client = new MongoClient(dbUrl); // Updated: Removed useNewUrlParser and useUnifiedTopology
  await client.connect();
  db = client.db(dbName);
  console.log(`Connected to database: ${dbName}`);
};

// Start Express server
app.listen(port, () => {
  console.log(`Lookup Service is running on port ${port}`);
  connectToMongoDB().catch(err => console.error('Failed to connect to MongoDB:', err));
});

// Example route for querying file storage commitments
app.get('/lookup/:uhrpUrl', async (req, res) => {
  const uhrpUrl = req.params.uhrpUrl;
  try {
    const result = await db.collection('fileCommitments').findOne({ uhrpUrl });
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: 'File commitment not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching data' });
  }
});
