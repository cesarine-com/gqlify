import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import { MongodbDataSourceGroup } from '../src/index';
import { MongodbDataSource } from '../src/mongodbDataSource';
import { MONGO_URI, DB_NAME, setupDb, cleanCollections, teardownDb } from './helpers';

describe('MongodbDataSourceGroup', function() {
  this.timeout(30000);

  let client: MongoClient;
  let db: Db;

  before(async () => {
    ({ client, db } = await setupDb());
  });

  afterEach(async () => {
    await cleanCollections(db);
  });

  after(async () => {
    await teardownDb(db, client);
  });

  it('should initialize and connect to MongoDB', async () => {
    const group = new MongodbDataSourceGroup(MONGO_URI, DB_NAME);
    await group.initialize();
    expect(group.getDb()).to.exist;
    expect(group.getClient()).to.exist;
  });

  it('should return a data source for a collection', async () => {
    const group = new MongodbDataSourceGroup(MONGO_URI, DB_NAME);
    await group.initialize();
    const ds = group.getDataSource('testCollection');
    expect(ds).to.be.instanceOf(MongodbDataSource);
  });

  it('should throw if not initialized', () => {
    const group = new MongodbDataSourceGroup(MONGO_URI, DB_NAME);
    expect(() => group.getDataSource('test')).to.throw('Please initialize');
  });
});
