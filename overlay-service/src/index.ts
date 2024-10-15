import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import bodyparser from 'body-parser';
import { fileURLToPath } from 'url';
import { Engine, KnexStorage, TaggedBEEF } from '@bsv/overlay';
import { UHRPLookupService } from '../../lookup-service/src/UHRPLookupService.js';
import { UHRPTopicManager } from '../../topic-manager/src/UHRPTopicManager.js';
import { MongoClient } from 'mongodb';
import Knex from 'knex';
import knexfile from '../knexfile.js';

// Get the __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }));
app.use(bodyparser.raw({ limit: '1gb', type: 'application/octet-stream' }));

// Load environment variables with validation
const { PORT = 8081, MONGODB_CONNECTION, MYSQL_CONNECTION, HOSTING_DOMAIN } = process.env;

if (!MONGODB_CONNECTION) {
  throw new Error('MONGODB_CONNECTION environment variable is required but not set.');
}

let db: any;
let lookupService: UHRPLookupService;

// MongoDB connection setup
const connectToMongoDB = async () => {
  try {
    const client = new MongoClient(MONGODB_CONNECTION as string); // Ensure type safety
    await client.connect();
    db = client.db();

    lookupService = new UHRPLookupService({
      saveRecord: async (record) => await db.collection('commitments').insertOne(record),
      getRecord: async (query) => await db.collection('commitments').findOne(query),
      deleteRecord: async (id) => await db.collection('commitments').deleteOne({ _id: id }),
    });

    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

// Set up Knex for MySQL storage
const knexInstance = Knex(knexfile.devlopment);

let engine: Engine;

const initializeOverlayService = async () => {
  const topicManager = new UHRPTopicManager();
  await knexInstance.migrate.latest();

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
  req.method === 'OPTIONS' ? res.sendStatus(200) : next();
});

// Submit transactions
app.post('/submit', async (req, res) => {
  try {
    console.log('Incoming request payload (raw buffer):', req.body);
    if (!Buffer.isBuffer(req.body)) {
      throw new Error('Invalid buffer format: Expected a Buffer');
    }

    const topicsHeader = req.headers['x-topics'];
    let topics: string[] = [];

    if (Array.isArray(topicsHeader)) {
      topics = topicsHeader.map((topic) => JSON.parse(topic));
    } else if (typeof topicsHeader === 'string') {
      topics = JSON.parse(topicsHeader);
    }

    const taggedBEEF: TaggedBEEF = {
      beef: Array.from(req.body),
      topics,
    };

    console.log('Parsed request payload:', taggedBEEF);

    const result = await engine.submit(taggedBEEF);
    res.status(200).json(result);
  } catch (error) {
    console.error('Submit error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(400).json({ status: 'error', message });
  }
});

// Lookup commitments
app.post('/lookup', async (req, res) => {
  try {
    const { uhrpUrl } = req.body;
    if (!uhrpUrl) {
      return res.status(400).json({ error: 'UHRPUrl query parameter is required.' });
    }

    const result = await engine.lookup({
      service: 'ls_uhrp',
      query: { UHRPUrl: uhrpUrl },
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Lookup error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({ status: 'error', message });
  }
});

// Start MongoDB and Express Server
const startServer = async () => {
  try {
    await connectToMongoDB();
    await initializeOverlayService();
    app.listen(PORT, () => console.log(`Overlay service running on port ${PORT}`));
  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
};

startServer().catch(console.error);
