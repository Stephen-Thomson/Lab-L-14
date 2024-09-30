import * as React from 'react';
import { TopicManager } from '../TopicManager';
import { publishCommitment } from '../utils/publishCommitment';
import CommitmentForm from '../components/CommitmentForm';
import { PrivateKey, PublicKey, Hash } from '@bsv/sdk';
import crypto from 'crypto';
import { render, fireEvent, screen } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';
import supertest from 'supertest';

// Mock fetch for publishCommitment tests
fetchMock.enableMocks();

// Constants and mock data for testing
const UHRP_PROTOCOL_ADDRESS = '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG';
const VALID_HASH = crypto.createHash('sha256').update('some valid input').digest('hex');
const VALID_URL = 'https://valid.url';
const VALID_TIMESTAMP = Math.floor(Date.now() / 1000) + 1000;
const VALID_FILE_SIZE = '1024';
const privateKeyHex = 'bf4d159ac007184e0d458b7d6e3deb0e645269f55f13ba10f24e654ffc194daa';
const privateKey = PrivateKey.fromString(privateKeyHex, 'hex');
const pubKey = PublicKey.fromPrivateKey(privateKey);

const signCommitment = (fields: (string | Buffer)[]): Buffer => {
  const message = Buffer.concat(fields.map(field => (typeof field === 'string' ? Buffer.from(field, 'utf8') : field)));
  const sha256Message = Hash.sha256(Array.from(message));
  const signature = privateKey.sign(sha256Message);
  return Buffer.from(signature.toDER());
};

// Helper function to generate mock outputScript
const createOutputScript = (fields: (string | Buffer)[]): Buffer => {
  return Buffer.concat(fields.map(field => {
    const fieldBuffer = typeof field === 'string' ? Buffer.from(field, 'utf8') : field;
    return Buffer.concat([Buffer.from([fieldBuffer.length]), fieldBuffer]);
  }));
};

// Test cases for Topic Manager commitment validation
describe('Topic Manager Commitment Validation', () => {
  let VALID_SIGNATURE_BUFFER: Buffer;

  beforeAll(() => {
    const fields = [
      UHRP_PROTOCOL_ADDRESS,
      pubKey.toString(),
      Buffer.from(VALID_HASH, 'hex'),
      'advertise',
      VALID_URL,
      VALID_TIMESTAMP.toString(),
      VALID_FILE_SIZE
    ];
    VALID_SIGNATURE_BUFFER = signCommitment(fields);
  });

  it('should admit a valid storage commitment', () => {
    const validOutputScript = createOutputScript([
      UHRP_PROTOCOL_ADDRESS,
      pubKey.toString(),
      Buffer.from(VALID_HASH, 'hex'),
      'advertise',
      VALID_URL,
      VALID_TIMESTAMP.toString(),
      VALID_FILE_SIZE,
      VALID_SIGNATURE_BUFFER
    ]);

    const isValid = TopicManager.evaluateCommitment(validOutputScript, pubKey);
    expect(isValid).toBe(true);
  });

  it('should reject an invalid protocol address', () => {
    const invalidOutputScript = createOutputScript([
      'invalid_protocol',
      pubKey.toString(),
      VALID_HASH,
      'advertise',
      VALID_URL,
      VALID_TIMESTAMP.toString(),
      VALID_FILE_SIZE,
      VALID_SIGNATURE_BUFFER
    ]);

    const isValid = TopicManager.evaluateCommitment(invalidOutputScript, pubKey);
    expect(isValid).toBe(false);
  });

  it('should reject an expired timestamp', () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 1000; // Past timestamp
    const expiredOutputScript = createOutputScript([
      UHRP_PROTOCOL_ADDRESS,
      pubKey.toString(),
      Buffer.from(VALID_HASH, 'hex'),
      'advertise',
      VALID_URL,
      expiredTimestamp.toString(),
      VALID_FILE_SIZE,
      VALID_SIGNATURE_BUFFER
    ]);

    const isValid = TopicManager.evaluateCommitment(expiredOutputScript, pubKey);
    expect(isValid).toBe(false);
  });

  it('should reject an invalid file size', () => {
    const invalidFileSize = '0'; // Invalid file size (0 bytes)
    const invalidOutputScript = createOutputScript([
      UHRP_PROTOCOL_ADDRESS,
      pubKey.toString(),
      Buffer.from(VALID_HASH, 'hex'),
      'advertise',
      VALID_URL,
      VALID_TIMESTAMP.toString(),
      invalidFileSize,
      VALID_SIGNATURE_BUFFER
    ]);

    const isValid = TopicManager.evaluateCommitment(invalidOutputScript, pubKey);
    expect(isValid).toBe(false);
  });

  it('should reject an invalid signature', () => {
    const invalidSignatureBuffer = Buffer.from('invalidsignature');
    const invalidOutputScript = createOutputScript([
      UHRP_PROTOCOL_ADDRESS,
      pubKey.toString(),
      Buffer.from(VALID_HASH, 'hex'),
      'advertise',
      VALID_URL,
      VALID_TIMESTAMP.toString(),
      VALID_FILE_SIZE,
      invalidSignatureBuffer
    ]);

    const isValid = TopicManager.evaluateCommitment(invalidOutputScript, pubKey);
    expect(isValid).toBe(false);
  });
});





