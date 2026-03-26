import { MongoClient, Db } from 'mongodb';
import { Mutation } from '@gqlify-legacy/server';

export const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
export const DB_NAME = 'gqlify_integration_test';

export function createMutation(data: Record<string, any>): Mutation {
  const payload = { ...data };
  return {
    getData: () => payload,
    addField: (name: string, value: any) => { payload[name] = value; },
    getArrayOperations: () => [],
  };
}

let client: MongoClient;
let db: Db;

export async function setupDb(): Promise<{ client: MongoClient; db: Db }> {
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return { client, db };
}

export async function cleanCollections(database: Db) {
  const collections = await database.listCollections().toArray();
  for (const col of collections) {
    await database.collection(col.name).drop();
  }
}

export async function teardownDb(database: Db, mongoClient: MongoClient) {
  await database.dropDatabase();
  await mongoClient.close();
}
