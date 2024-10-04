import dotenv from 'dotenv';
import express from 'express';
import bodyparser from 'body-parser';
import { Engine, TopicManager } from '@bsv/overlay'; // Correct class imported
import { LookupService } from '../../lookup-service/src/LookupService.js';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }));
app.use(bodyparser.raw({ limit: '1gb', type: 'application/octet-stream' }));

// Load environment variables
const {
  PORT = 8080,
  DB_CONNECTION = 'mongodb://localhost:27017/fileCommitmentsDB', // MongoDB connection
  SERVER_PRIVATE_KEY, // Ensure this key is configured
} = process.env;

let db: any;
let lookupService: LookupService;

// MongoDB connection setup
const connectToMongoDB = async () => {
  const client = new MongoClient(DB_CONNECTION, { useUnifiedTopology: true });
  await client.connect();
  db = client.db();
  lookupService = new LookupService(db); // Instantiate your LookupService with the MongoDB instance
  console.log('Connected to MongoDB');
};

// Initialize UHRP Topic Manager and Overlay Services Engine
let engine: Engine; // Use `Engine` instead of `OverlayServicesEngine`
const initializeOverlayService = async () => {
  engine = new Engine({
    privateKey: SERVER_PRIVATE_KEY, // Use the private key from .env
  });

  // Register the UHRP Topic Manager
  const uhrpTopicManager = new TopicManager({
    topicName: 'tm_uhrp', // Topic for UHRP
    lookupServiceName: 'ls_uhrp', // Lookup service for UHRP
    lookupService, // Reference the instantiated lookup service
  });

  // Register Topic Manager to engine
  engine.addTopicManager(uhrpTopicManager);
  console.log('Overlay service initialized');
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
    const result = await lookupService.findByUHRPUrl(query.uhrpUrl); // Adjust for query as needed
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
