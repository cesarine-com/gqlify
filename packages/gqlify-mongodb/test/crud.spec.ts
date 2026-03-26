import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import { MongodbDataSource } from '../src/mongodbDataSource';
import { createMutation, setupDb, cleanCollections, teardownDb } from './helpers';

describe('MongodbDataSource - CRUD', function() {
  this.timeout(30000);

  let client: MongoClient;
  let db: Db;
  let dataSource: MongodbDataSource;
  const graphQlContext = { user: { id: 'test-user-1' } };

  before(async () => {
    ({ client, db } = await setupDb());
  });

  beforeEach(() => {
    dataSource = new MongodbDataSource(db, 'users');
  });

  afterEach(async () => {
    await cleanCollections(db);
  });

  after(async () => {
    await teardownDb(db, client);
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
