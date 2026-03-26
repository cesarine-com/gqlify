import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import { MongodbDataSource } from '../src/mongodbDataSource';
import { createMutation, setupDb, cleanCollections, teardownDb } from './helpers';

describe('MongodbDataSource - Map operations', function() {
  this.timeout(30000);

  let client: MongoClient;
  let db: Db;
  let dataSource: MongodbDataSource;

  before(async () => {
    ({ client, db } = await setupDb());
  });

  beforeEach(() => {
    dataSource = new MongodbDataSource(db, 'settings/app');
  });

  afterEach(async () => {
    await cleanCollections(db);
  });

  after(async () => {
    await teardownDb(db, client);
  });

  it('should update and get map', async () => {
    const mutation = createMutation({ theme: 'dark', lang: 'it' });
    await dataSource.updateMap(mutation);

    const map = await dataSource.getMap();
    expect(map).to.exist;
    expect(map.theme).to.equal('dark');
    expect(map.lang).to.equal('it');
  });

  it('should upsert map on update', async () => {
    await dataSource.updateMap(createMutation({ val: 1 }));
    await dataSource.updateMap(createMutation({ val: 2 }));

    const items = await db.collection('settings').find({ key: 'app' }).toArray();
    expect(items).to.have.lengthOf(1);
    expect(items[0].val).to.equal(2);
  });
});
