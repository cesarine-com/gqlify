import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import { MongodbDataSource } from '../src/mongodbDataSource';
import { createMutation, setupDb, cleanCollections, teardownDb } from './helpers';

describe('MongodbDataSource - Activity Log', function() {
  this.timeout(30000);

  let client: MongoClient;
  let db: Db;
  let dataSource: MongodbDataSource;
  const graphQlContext = { user: { id: 'test-user-1' } };

  before(async () => {
    ({ client, db } = await setupDb());
  });

  beforeEach(() => {
    dataSource = new MongodbDataSource(db, 'logged_items');
  });

  afterEach(async () => {
    await cleanCollections(db);
  });

  after(async () => {
    await teardownDb(db, client);
  });

  it('should create activity log on create', async () => {
    await dataSource.create(createMutation({ name: 'item1' }), graphQlContext);

    const logs = await db.collection('activityLog').find({ action: 'create' }).toArray();
    expect(logs).to.have.lengthOf(1);
    expect(logs[0].collectionName).to.equal('logged_items');
    expect(logs[0].userId).to.equal('test-user-1');
    expect(logs[0].newValue).to.exist;
  });

  it('should create activity log on update', async () => {
    const created = await dataSource.create(createMutation({ name: 'item2' }), graphQlContext);

    await dataSource.update(
      { id: { eq: created.id } },
      createMutation({ name: 'item2-updated' }),
      graphQlContext,
    );

    const logs = await db.collection('activityLog').find({ action: 'update' }).toArray();
    expect(logs).to.have.lengthOf(1);
    expect(logs[0].oldValue).to.exist;
    expect(logs[0].newValue).to.exist;
    expect(logs[0].newValue.name).to.equal('item2-updated');
  });

  it('should create activity log on delete', async () => {
    const created = await dataSource.create(createMutation({ name: 'item3' }), graphQlContext);

    await dataSource.delete({ id: { eq: created.id } }, graphQlContext);

    const logs = await db.collection('activityLog').find({ action: 'delete' }).toArray();
    expect(logs).to.have.lengthOf(1);
    expect(logs[0].oldValue.name).to.equal('item3');
  });
});
