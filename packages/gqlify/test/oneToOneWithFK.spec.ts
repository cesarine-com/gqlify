/**
 * OneToOneWithFK test
 */
import chai from 'chai';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
import { MongodbDataSourceGroup } from '@gqlify-legacy/mongodb';
import MemoryDataSource from '../src/dataSource/memoryDataSource';
import { sdl, testSuits } from './testsuites/oneToOneWithFK';
import { createGqlifyApp, prepareConfig } from './testsuites/utils';
import { DataSource } from '../src';
import { forEach } from 'lodash';

const {serviceAccount, mongoUri} = prepareConfig();

describe('Relation tests on fixtures/oneToOneWithFK.graphql on Memory Data Source', function() {
  before(async () => {
    const dataSources: Record<string, DataSource> = {};
    const {graphqlRequest, close} = createGqlifyApp(sdl, {
      memory: args => {
        dataSources[args.key] = new MemoryDataSource();
        return dataSources[args.key];
      },
    });
    (this as any).graphqlRequest = graphqlRequest;
    (this as any).close = close;
    (this as any).dataSources = dataSources;
  });

  after(async () => {
    await (this as any).close();
  });

  afterEach(async () => {
    forEach((this as any).dataSources, dataSource =>
      (dataSource as any).defaultData = []);
  });

  testSuits.call(this);
});

describe('Tests on fixtures/oneToOneWithFK.graphql with MongoDB Data Source', function() {
  this.timeout(20000);

  before(async () => {
    const mongodbDataSourceGroup = new MongodbDataSourceGroup(mongoUri, 'gqlify');
    await mongodbDataSourceGroup.initialize();

    const {graphqlRequest, close} = createGqlifyApp(sdl, {
      memory: args => mongodbDataSourceGroup.getDataSource(args.key),
    });
    (this as any).graphqlRequest = graphqlRequest;
    (this as any).close = close;
    (this as any).mongodb = (mongodbDataSourceGroup as any).db;
  });

  afterEach(async () => {
    const listCollectionsQuery = await (this as any).mongodb.listCollections();
    const collections = await listCollectionsQuery.toArray();
    await Promise.all(collections.map(async collection => {
      await (this as any).mongodb.collection(collection.name).deleteMany({});
    }));
  });

  after(async () => {
    await (this as any).close();
  });

  testSuits.call(this);
});
