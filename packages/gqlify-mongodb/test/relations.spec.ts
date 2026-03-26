import { expect } from 'chai';
import { MongoClient, Db } from 'mongodb';
import { MongodbDataSource } from '../src/mongodbDataSource';
import { createMutation, setupDb, cleanCollections, teardownDb } from './helpers';

describe('MongodbDataSource - Relations', function() {
  this.timeout(30000);

  let client: MongoClient;
  let db: Db;
  const graphQlContext = { user: { id: 'test-user-1' } };

  before(async () => {
    ({ client, db } = await setupDb());
  });

  afterEach(async () => {
    await cleanCollections(db);
  });

  after(async () => {
    await teardownDb(db, client);
  });

  describe('One-to-One / One-to-Many', () => {
    let dataSource: MongodbDataSource;

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
      expect(result).to.exist;
      expect(result.title).to.equal('Post 1');
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

  describe('Many-to-Many', () => {
    let dataSource: MongodbDataSource;

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
});
