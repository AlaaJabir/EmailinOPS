import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ConvexHttpClient } from 'convex/browser';

const CONVEX_URL = process.env.CONVEX_URL || 'https://knowing-pheasant-974.convex.cloud';
const API_URL = 'http://localhost:3000';
const userId = 'usr_admin_01';

describe('Convex Functions & Imports Verification Suite', () => {
  const convexClient = new ConvexHttpClient(CONVEX_URL);

  it('1. Convex public functions existence and connectivity', async () => {
    // imports:list
    const imports = await convexClient.query('imports:list' as any, { userId });
    assert(Array.isArray(imports), 'imports:list returned an array');

    // contacts:list
    const contacts = await convexClient.query('contacts:list' as any, { userId });
    assert(Array.isArray(contacts), 'contacts:list returned an array');

    // contacts:listPage
    const contactPage = await convexClient.query('contacts:listPage' as any, { userId, numItems: 5 });
    assert(contactPage && typeof contactPage === 'object', 'contacts:listPage returned page object');

    // contacts:listLists
    const lists = await convexClient.query('contacts:listLists' as any, { userId });
    assert(Array.isArray(lists), 'contacts:listLists returned an array');

    // campaigns:list
    const campaigns = await convexClient.query('campaigns:list' as any, { userId });
    assert(Array.isArray(campaigns), 'campaigns:list returned an array');

    // messages:list
    const messages = await convexClient.query('messages:list' as any, { userId });
    assert(Array.isArray(messages), 'messages:list returned an array');

    // senders:list
    const senders = await convexClient.query('senders:list' as any, { userId });
    assert(Array.isArray(senders), 'senders:list returned an array');

    // logs:list
    const logs = await convexClient.query('logs:list' as any, { userId });
    assert(Array.isArray(logs), 'logs:list returned an array');
  });

  it('2. Exact Import Flow end-to-end with Convex ID validation', async () => {
    // Fetch existing audience list to attach to
    const lists = await convexClient.query('contacts:listLists' as any, { userId });
    assert(lists.length > 0, 'At least one list exists');
    const selectedList = lists[0];

    // Start import via API
    const startRes = await fetch(`${API_URL}/api/imports/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated E2E Suite Test',
        filename: 'e2e_contacts.csv',
        sourceSizeBytes: 120,
        listId: selectedList._id,
        listName: selectedList.name,
      }),
    });
    assert.strictEqual(startRes.status, 201, 'Import start status is 201');
    const startData = await startRes.json();
    assert(startData.success, 'startData success is true');
    assert(startData.import?.id, 'Import ID was returned');

    const importId = startData.import.id;
    // Confirm returned record contains selected audience listId
    assert.strictEqual(startData.import.list_id, selectedList._id, 'Preserved audience listId');
    assert.strictEqual(startData.import.listId, selectedList._id, 'Preserved camelCase listId');

    // Call imports:get directly on Convex with returned ID
    const getRecord = await convexClient.query('imports:get' as any, { userId, id: importId });
    assert(getRecord, 'imports:get returned job record');
    assert.strictEqual(getRecord._id, importId, 'Convex _id matches returned importId');
    assert.strictEqual(getRecord.listId, selectedList._id, 'Convex listId matches selectedList');

    // Upload chunk with contacts
    const uid = Date.now();
    const csvChunk = `email,first_name,last_name,company\nuser1_${uid}@audiencee2e.io,User,One,Acme\nuser2_${uid}@audiencee2e.io,User,Two,Acme\n`;
    const chunkRes = await fetch(`${API_URL}/api/imports/${importId}/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chunk: csvChunk,
        chunkId: 'chunk_test_0',
        offset: 0,
        sourceSizeBytes: Buffer.byteLength(csvChunk),
      }),
    });
    assert.strictEqual(chunkRes.status, 200, 'Chunk status is 200');
    const chunkData = await chunkRes.json();
    assert.strictEqual(chunkData.import?.imported_rows, 2, 'Imported 2 rows');

    // Complete import
    const compRes = await fetch(`${API_URL}/api/imports/${importId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(compRes.status, 200, 'Complete status is 200');
    const compData = await compRes.json();
    assert.strictEqual(compData.import?.status, 'COMPLETED', 'Status is COMPLETED');

    // Fetch Import History and verify appearance
    const histRes = await fetch(`${API_URL}/api/imports`);
    assert.strictEqual(histRes.status, 200, 'History status is 200');
    const histData = await histRes.json();
    const foundInHistory = histData.imports?.find((i: any) => i.id === importId);
    assert(foundInHistory, 'Import appears in Import History');
    assert.strictEqual(foundInHistory.status, 'COMPLETED', 'Import in history is COMPLETED');
  });

  it('3. Defensive protection against invalid 17-character or manufactured IDs', async () => {
    // 17-char ID in start import listId
    const startRes = await fetch(`${API_URL}/api/imports/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Defensive 17-char ID Test',
        filename: 'defensive.csv',
        sourceSizeBytes: 50,
        listId: '12345678901234567',
        listName: 'Defensive Audience List',
      }),
    });
    assert.strictEqual(startRes.status, 201, 'Start status is 201 (no 503 crash)');
    const startData = await startRes.json();
    assert(startData.success, 'Import started successfully without Convex ID decoding error');

    // 17-char ID in GET /api/imports/:id
    const getRes = await fetch(`${API_URL}/api/imports/12345678901234567`);
    assert.strictEqual(getRes.status, 404, 'Returns 404 gracefully instead of 503 error');

    // Direct Convex query imports:get with 17-character ID should return null, not throw
    const directJob = await convexClient.query('imports:get' as any, { userId, id: '12345678901234567' });
    assert.strictEqual(directJob, null, 'Direct imports:get returns null for 17-char ID');

    // Direct Convex query campaigns:get with invalid ID should return null, not throw
    const directCampaign = await convexClient.query('campaigns:get' as any, { userId, id: '12345678901234567' });
    assert.strictEqual(directCampaign, null, 'Direct campaigns:get returns null for invalid ID');

    // Direct Convex query templates:get with invalid ID should return null, not throw
    const directTemplate = await convexClient.query('templates:get' as any, { userId, id: '12345678901234567' });
    assert.strictEqual(directTemplate, null, 'Direct templates:get returns null for invalid ID');
  });

  it('4. API Health & Database verification', async () => {
    const healthRes = await fetch(`${API_URL}/api/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.services?.api, 'healthy', 'API service is healthy');
    assert.strictEqual(healthData.services?.database?.healthy, true, 'Database is healthy');
    assert.strictEqual(healthData.services?.database?.configured, true, 'Database is configured');
    assert.strictEqual(healthData.services?.database?.url, CONVEX_URL, 'Convex URL matches');
  });

  it('5. ConvexService rejects unconfigured environment without silent fallback', async () => {
    const { ConvexService } = await import('../server/services/ConvexService.js');
    const customService = new ConvexService();
    // When no URL is given, it should NOT fall back to any hardcoded URL
    customService.setUrl('');
    assert.strictEqual(customService.isConfigured, false, 'isConfigured is false when URL is empty');
    assert.strictEqual(customService.getClient(), null, 'getClient() is null when URL is empty');
    assert.strictEqual(customService.getUrl(), '', 'url is empty');
  });
});
