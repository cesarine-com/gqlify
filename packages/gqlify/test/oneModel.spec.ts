/**
 * OneModel is for simple CRUD test
 */
import chai from 'chai';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
import { MongodbDataSourceGroup } from '@gqlify-legacy/mongodb';
import MemoryDataSource from '../src/dataSource/memoryDataSource';
import { sdl, testSuits } from './testsuites/oneModel';
import { createGqlifyApp, prepareConfig } from './testsuites/utils';
import { DataSource } from '../src';
import { forEach } from 'lodash';

const {serviceAccount, mongoUri} = prepareConfig();

describe('Tests on fixtures/oneModel.graphql with Memory Data Source', function() {
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

describe('Tests on fixtures/oneModel.graphql with Firebase Data Source', function() {
  this.timeout(20000);

  before(async () => {
    const databaseURL = `https://${serviceAccount.project_id}.firebaseio.com`;
    const dataSources: Record<string, DataSource> = {};
    const {graphqlRequest, close} = createGqlifyApp(sdl, {
      memory: args => {
        dataSources[args.key] = new FirebaseDataSource({
          config: {
            credential: admin.credential.cert(serviceAccount),
            databaseURL,
          },
          path: args.key,
        });
        return dataSources[args.key];
      },
    });
    (this as any).graphqlRequest = graphqlRequest;
    (this as any).close = close;
    (this as any).dataSources = dataSources;
    (this as any).firebase = admin.app().database();
  });

  afterEach(async () => {
    await (this as any).firebase.ref('/').remove();
  });

  after(async () => {
    await (this as any).close();
    await admin.app().delete();
  });

  testSuits.call(this);
});

describe('Tests on fixtures/oneModel.graphql with Firestore Data Source', function() {
  this.timeout(20000);

  before(async () => {
    const databaseURL = `https://${serviceAccount.project_id}.firebaseio.com`;
    const dataSources: Record<string, DataSource> = {};
    const {graphqlRequest, close} = createGqlifyApp(sdl, {
      memory: args => {
        dataSources[args.key] = new FirestoreDataSource({
          config: {
            credential: admin.credential.cert(serviceAccount),
            databaseURL,
          },
          collection: args.key,
        });
        return dataSources[args.key];
      },
    });
    (this as any).graphqlRequest = graphqlRequest;
    (this as any).close = close;
    (this as any).dataSources = dataSources;
    (this as any).firestore = admin.app().firestore();
  });

  afterEach(async () => {
    const collectionRef = (this as any).firestore.collection('users');
    const querySnapshot = await collectionRef.get();
    const docPaths = [];
    querySnapshot.forEach(documentSnapshot => {
      docPaths.push(documentSnapshot.ref.path);
    });

    await Promise.all(docPaths.map(async docPath => {
      const docRef = (this as any).firestore.doc(docPath);
      await docRef.delete();
    }));
  });

  after(async () => {
    await (this as any).close();
    await admin.app().delete();
  });

  testSuits.call(this);
});

describe('Tests on fixtures/oneModel.graphql with MongoDB Data Source', function() {
  this.timeout(20000);

  before(async () => {
    const dataSources: Record<string, DataSource> = {};
    const mongodbDataSourceGroup = new MongodbDataSourceGroup(mongoUri, 'gqlify');
    await mongodbDataSourceGroup.initialize();

    const {graphqlRequest, close} = createGqlifyApp(sdl, {
      memory: args => {
        dataSources[args.key] = mongodbDataSourceGroup.getDataSource(args.key);
        return dataSources[args.key];
      },
    });
    (this as any).graphqlRequest = graphqlRequest;
    (this as any).close = close;
    (this as any).dataSources = dataSources;
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
