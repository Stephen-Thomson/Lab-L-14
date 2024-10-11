import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import bodyparser from 'body-parser';
import { fileURLToPath } from 'url';
import { Engine, KnexStorage } from '@bsv/overlay';
import { LookupService } from '../../lookup-service/src/LookupService.js';
import { UHRPTopicManager } from '../../topic-manager/src/UHRPTopicManager.js';
import { MongoClient } from 'mongodb';
import Knex from 'knex';

// Get the __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }));
app.use(bodyparser.raw({ limit: '1gb', type: 'application/octet-stream' }));

const connectionString = process.env.MYSQL_CONNECTION;

// Load environment variables
const {
  PORT = 8081,
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

// Set up Knex for MySQL storage using the connection string from the .env file
const knexInstance = Knex({
  client: 'mysql2',
  connection: connectionString,
});

// Initialize the Topic Manager and Overlay Services Engine
let engine: Engine; // Use `Engine` class from `@bsv/overlay`

// Topic Manager and Lookup Service setup
const initializeOverlayService = async () => {
  const topicManager = new UHRPTopicManager();

  // Listen for admissibility events emitted by TopicManager
  topicManager.on('admissibility', async (eventData: any) => {
    console.log('Admissibility event received:', eventData);
    await lookupService.handleAdmissibilityEvent(eventData);
  });

  // Create the overlay engine
  engine = new Engine(
    { 'tm_uhrp': topicManager },
    { 'ls_uhrp': lookupService },
    new KnexStorage(knexInstance),
    'scripts only',
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
    console.log('Incoming request payload (raw buffer):', req.body); // Log the raw buffer payload
    console.log('Request headers:', req.headers);

    let parsedPayload;
    if (Buffer.isBuffer(req.body)) {
      // Convert the Buffer to a number array
      const beefAsNumberArray = Array.from(req.body);

      // Construct the parsed payload with beef as number array and topics as an array
      parsedPayload = {
        beef: beefAsNumberArray, // Use the number array representation of the buffer
        topics: ['tm_uhrp'], // Ensure topics are provided correctly
      };
    } else {
      throw new Error('Invalid buffer format: Expected a Buffer');
    }

    console.log('Parsed request payload:', parsedPayload); // Log the parsed payload

    const result = await engine.submit(parsedPayload); // Submit through the overlay engine
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
