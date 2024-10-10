import dotenv from 'dotenv';
import express from 'express';
import bodyparser from 'body-parser';
import { Engine, KnexStorage } from '@bsv/overlay';
import { LookupService } from '../../lookup-service/src/LookupService.js';
import { UHRPTopicManager } from '../../topic-manager/src/UHRPTopicManager.js';
import { TopicManager } from '../../commitment-ui/src/TopicManager.js';
import { MongoClient } from 'mongodb';
import Knex from 'knex';

dotenv.config();

const app = express();
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }));
app.use(bodyparser.raw({ limit: '1gb', type: 'application/octet-stream' }));

// Load environment variables
const {
  PORT = 8081, // Use the PORT specified in the .env file or default to 8081
  DB_CONNECTION = 'mongodb://localhost:27017/fileCommitmentsDB', // MongoDB connection
  SERVER_PRIVATE_KEY,
  HOSTING_DOMAIN,
} = process.env;

let db: any;
let lookupService: LookupService;

// MongoDB connection setup
const connectToMongoDB = async () => {
  const client = new MongoClient(DB_CONNECTION);
  await client.connect();
  db = client.db();
  lookupService = new LookupService(db); // Instantiate LookupService with the MongoDB instance
  console.log('Connected to MongoDB');
};

// Set up Knex for MySQL storage
const knexInstance = Knex({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'your-password',
    database: 'overlay_storage',
  },
});

// Initialize the Topic Manager and Overlay Services Engine
let engine: Engine; // Use `Engine` class from `@bsv/overlay`

const initializeOverlayService = async () => {
  // Instantiate the UHRP Topic Manager (using the correct implementation)
  const topicManager = new UHRPTopicManager();

  // Create the engine with the required parameters
  engine = new Engine(
    { 'tm_uhrp': topicManager },
    { 'ls_uhrp': lookupService },
    new KnexStorage(knexInstance),
    "scripts only",
    HOSTING_DOMAIN
  );

  console.log('Overlay service initialized with UHRP Topic Manager');
};


// Middleware for CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Expose-Headers', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Submit transactions
app.post('/submit', async (req, res) => {
  try {
    const result = await engine.submit(req.body); // Submit through the overlay engine
    res.status(200).json(result);
  } catch (error) {
    console.error('Submit error:', error);
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

// Lookup file storage commitments
app.post('/lookup', async (req, res) => {
  try {
    const query = req.body; // Expecting UHRP URL or retention period query
    const result = await lookupService.findByUHRPUrl(query.uhrpUrl);
    res.status(200).json(result);
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

// Start MongoDB and Express Server
const startServer = async () => {
  try {
    await connectToMongoDB(); // Ensure MongoDB is connected
    await initializeOverlayService(); // Initialize the overlay service

    app.listen(PORT, () => {
      console.log(`Overlay service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
