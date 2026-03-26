import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import { MongodbDataSourceGroup } from '../src/index';
import { MongodbDataSource } from '../src/mongodbDataSource';
import { Mutation } from '@gqlify-legacy/server';

function createMutation(data: Record<string, any>): Mutation {
  const payload = { ...data };
  return {
    getData: () => payload,
    addField: (name: string, value: any) => { payload[name] = value; },
    getArrayOperations: () => [],
  };
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'gqlify_integration_test';

describe('MongoDB Integration Tests', function() {
  this.timeout(30000);

  let client: MongoClient;
  let db: Db;

  before(async () => {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
  });

  afterEach(async () => {
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      await db.collection(col.name).drop();
    }
  });

  after(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe('MongodbDataSourceGroup', () => {
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

  describe('MongodbDataSource - CRUD', () => {
    let dataSource: MongodbDataSource;
    const collectionName = 'users';
    const graphQlContext = { user: { id: 'test-user-1' } };

    beforeEach(() => {
      dataSource = new MongodbDataSource(db, collectionName);
    });

    it('should create a document and return it with an id', async () => {
      const mutation = createMutation({ name: 'Alice', age: 30 });
      const result = await dataSource.create(mutation, graphQlContext);

      expect(result).to.exist;
      expect(result.id).to.be.a('string');
      expect(result.name).to.equal('Alice');
      expect(result.age).to.equal(30);
      expect(result.createdAt).to.be.instanceOf(Date);
      expect(result.updatedAt).to.be.instanceOf(Date);
    });

    it('should find a document by id', async () => {
      const mutation = createMutation({ name: 'Bob', age: 25 });
      const created = await dataSource.create(mutation, graphQlContext);

      const found = await dataSource.findOneById(created.id);
      expect(found).to.exist;
      expect(found.name).to.equal('Bob');
      expect(found.id).to.equal(created.id);
    });

    it('should find a document using where clause', async () => {
      const mutation = createMutation({ name: 'Charlie', age: 35 });
      await dataSource.create(mutation, graphQlContext);

      const found = await dataSource.findOne({
        where: { name: { eq: 'Charlie' } },
      });
      expect(found).to.exist;
      expect(found.name).to.equal('Charlie');
    });

    it('should list documents with find()', async () => {
      await dataSource.create(createMutation({ name: 'A', age: 20 }), graphQlContext);
      await dataSource.create(createMutation({ name: 'B', age: 30 }), graphQlContext);
      await dataSource.create(createMutation({ name: 'C', age: 40 }), graphQlContext);

      const result = await dataSource.find();
      expect(result.data).to.have.lengthOf(3);
      expect(result.total).to.equal(3);
    });

    it('should filter documents with where in find()', async () => {
      await dataSource.create(createMutation({ name: 'Young', age: 20 }), graphQlContext);
      await dataSource.create(createMutation({ name: 'Old', age: 50 }), graphQlContext);

      const result = await dataSource.find({
        where: { age: { gte: 30 } },
      });
      expect(result.data).to.have.lengthOf(1);
      expect(result.data[0].name).to.equal('Old');
    });

    it('should order documents with orderBy', async () => {
      await dataSource.create(createMutation({ name: 'B', age: 30 }), graphQlContext);
      await dataSource.create(createMutation({ name: 'A', age: 20 }), graphQlContext);
      await dataSource.create(createMutation({ name: 'C', age: 40 }), graphQlContext);

      const result = await dataSource.find({
        orderBy: { field: 'age', value: 1 },
      });
      expect(result.data[0].name).to.equal('A');
      expect(result.data[1].name).to.equal('B');
      expect(result.data[2].name).to.equal('C');
    });

    it('should update a document', async () => {
      const mutation = createMutation({ name: 'Dave', age: 28 });
      const created = await dataSource.create(mutation, graphQlContext);

      const updateMutation = createMutation({ age: 29 });
      await dataSource.update(
        { id: { eq: created.id } },
        updateMutation,
        graphQlContext,
      );

      const updated = await dataSource.findOneById(created.id);
      expect(updated.age).to.equal(29);
      expect(updated.name).to.equal('Dave');
    });

    it('should delete a document', async () => {
      const mutation = createMutation({ name: 'Eve', age: 22 });
      const created = await dataSource.create(mutation, graphQlContext);

      await dataSource.delete({ id: { eq: created.id } }, graphQlContext);

      const found = await dataSource.findOneById(created.id);
      expect(found).to.be.undefined;
    });
  });

  describe('MongodbDataSource - Regex filter', () => {
    let dataSource: MongodbDataSource;
    const graphQlContext = { user: { id: 'test-user-1' } };

    beforeEach(() => {
      dataSource = new MongodbDataSource(db, 'search_test');
    });

    it('should filter with regex operator', async () => {
      await dataSource.create(createMutation({ name: 'Alessandro' }), graphQlContext);
      await dataSource.create(createMutation({ name: 'Alberto' }), graphQlContext);
      await dataSource.create(createMutation({ name: 'Marco' }), graphQlContext);

      const result = await dataSource.find({
        where: { name: { regex: 'ale' } },
      });
      expect(result.data).to.have.lengthOf(1);
      expect(result.data[0].name).to.equal('Alessandro');
    });
  });

  describe('MongodbDataSource - Relations', () => {
    let dataSource: MongodbDataSource;
    const graphQlContext = { user: { id: 'test-user-1' } };

    beforeEach(() => {
      dataSource = new MongodbDataSource(db, 'posts');
    });

    it('should find one by relation (foreign key)', async () => {
      await dataSource.create(
        createMutation({ title: 'Post 1', authorId: 'author-1' }),
        graphQlContext,
      );
      await dataSource.create(
        createMutation({ title: 'Post 2', authorId: 'author-2' }),
        graphQlContext,
      );

      const result = await dataSource.findOneByRelation('authorId', 'author-1');
      expect(result).to.have.lengthOf(1);
      expect(result[0].title).to.equal('Post 1');
    });

    it('should find many from one relation', async () => {
      await dataSource.create(
        createMutation({ title: 'Post A', categoryId: 'cat-1' }),
        graphQlContext,
      );
      await dataSource.create(
        createMutation({ title: 'Post B', categoryId: 'cat-1' }),
        graphQlContext,
      );
      await dataSource.create(
        createMutation({ title: 'Post C', categoryId: 'cat-2' }),
        graphQlContext,
      );

      const result = await dataSource.findManyFromOneRelation('categoryId', 'cat-1');
      expect(result).to.have.lengthOf(2);
    });
  });

  describe('MongodbDataSource - Many to Many', () => {
    let dataSource: MongodbDataSource;
    const graphQlContext = { user: { id: 'test-user-1' } };

    beforeEach(() => {
      dataSource = new MongodbDataSource(db, 'tags');
    });

    it('should add and retrieve many-to-many relations', async () => {
      const tag1 = await dataSource.create(createMutation({ name: 'js' }), graphQlContext);
      const tag2 = await dataSource.create(createMutation({ name: 'ts' }), graphQlContext);

      await dataSource.addIdToManyRelation('posts', 'tags', 'post-1', tag1.id, graphQlContext);
      await dataSource.addIdToManyRelation('posts', 'tags', 'post-1', tag2.id, graphQlContext);

      const result = await dataSource.findManyFromManyRelation('posts', 'tags', 'post-1');
      expect(result).to.have.lengthOf(2);
      const names = result.map(r => r.name);
      expect(names).to.include('js');
      expect(names).to.include('ts');
    });

    it('should remove id from many-to-many relation', async () => {
      const tag1 = await dataSource.create(createMutation({ name: 'go' }), graphQlContext);
      const tag2 = await dataSource.create(createMutation({ name: 'rust' }), graphQlContext);

      await dataSource.addIdToManyRelation('articles', 'tags', 'art-1', tag1.id, graphQlContext);
      await dataSource.addIdToManyRelation('articles', 'tags', 'art-1', tag2.id, graphQlContext);

      await dataSource.removeIdFromManyRelation('articles', 'tags', 'art-1', tag1.id, graphQlContext);

      const result = await dataSource.findManyFromManyRelation('articles', 'tags', 'art-1');
      expect(result).to.have.lengthOf(1);
      expect(result[0].name).to.equal('rust');
    });
  });

  describe('MongodbDataSource - Activity Log', () => {
    let dataSource: MongodbDataSource;
    const graphQlContext = { user: { id: 'test-user-1' } };

    beforeEach(() => {
      dataSource = new MongodbDataSource(db, 'logged_items');
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

  describe('MongodbDataSource - Map operations', () => {
    let dataSource: MongodbDataSource;

    beforeEach(() => {
      dataSource = new MongodbDataSource(db, 'settings/app');
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
});
