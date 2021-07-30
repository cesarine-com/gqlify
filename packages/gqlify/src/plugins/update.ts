import Model from '../dataModel/model';
import {Context, Plugin} from './interface';
import WhereInputPlugin from './whereInput';
import BaseTypePlugin from './baseType';
import ObjectField from '../dataModel/objectField';
import {upperFirst, forEach, get, reduce} from 'lodash';
import {ListMutable, MapMutable} from '../dataSource/interface';
import {RelationField} from '../dataModel';
import CreatePlugin from './create';
import {Hook, UpdateContext} from '../hooks/interface';
import {MutationFactory} from './mutation';

const createObjectInputField = (
  prefix: string,
  field: ObjectField,
  context: Context,
) => {
  const {root} = context;
  const content: string[] = [];
  forEach(field.getFields(), (nestedField, name) => {
    if (nestedField.isScalar()) {
      content.push(`${name}: ${nestedField.getTypename()}`);
      return;
    }

    if (nestedField instanceof ObjectField) {
      const fieldWithPrefix = `${prefix}${upperFirst(name)}`;
      const typeFields = createObjectInputField(
        fieldWithPrefix,
        nestedField,
        context,
      );
      const objectInputName = `${fieldWithPrefix}UpdateInput`;
      root.addInput(`input ${objectInputName} {${typeFields.join(' ')}}`);
      content.push(`${name}: ${objectInputName}`);
      return;
    }

    // skip relation field
  });
  return content;
};

const createInputField = (
  model: Model,
  context: Context,
  getCreateInputName: (model: Model) => string,
  getWhereInputName: (model: Model) => string,
  getWhereUniqueInputName: (model: Model) => string,
  getMutationFactoryFromModel: (model: Model) => MutationFactory,
) => {
  const {root} = context;
  const capName = model.getNamings().capitalSingular;
  const fields = model.getFields();
  const content: string[] = [];
  const mutationFactory = getMutationFactoryFromModel(model);
  forEach(fields, (field, name) => {
    if (field.isAutoGenerated()) {
      return;
    }

    if (field.isScalar()) {
      let fieldType: string;
      if (field.isList()) {
        // wrap with set field
        const fieldWithPrefix = `${capName}${upperFirst(name)}`;
        const listOperationInput = `${fieldWithPrefix}UpdateInput`;
        root.addInput(
          `input ${listOperationInput} {set: [${field.getTypename()}]}`,
        );
        fieldType = listOperationInput;
        mutationFactory.markArrayField(name);
      } else {
        fieldType = field.getTypename();
      }
      content.push(`${name}: ${fieldType}`);
      return;
    }

    if (field instanceof ObjectField) {
      // create input for nested object
      const fieldWithPrefix = `${
        model.getNamings().capitalSingular
      }${upperFirst(name)}`;
      const typeFields = createObjectInputField(
        fieldWithPrefix,
        field,
        context,
      );
      const objectInputName = `${fieldWithPrefix}UpdateInput`;
      root.addInput(`input ${objectInputName} {${typeFields.join(' ')}}`);

      let fieldType: string;
      if (field.isList()) {
        // wrap with set field
        const listOperationInput = `${fieldWithPrefix}UpdateListInput`;
        root.addInput(
          `input ${listOperationInput} {set: [${objectInputName}]}`,
        );
        fieldType = listOperationInput;
        mutationFactory.markArrayField(name);
      } else {
        fieldType = objectInputName;
      }

      content.push(`${name}: ${fieldType}`);
      return;
    }

    // relation
    // add create, connect, disconnect, delete for relation
    const isRelation = field instanceof RelationField;
    const isList = field.isList();
    if (isRelation && !isList) {
      // to-one
      const relationTo = (field as RelationField).getRelationTo();
      const relationInputName = `${capName}UpdateOneInput`;
      root.addInput(`input ${relationInputName} {
        create: ${getCreateInputName(relationTo)}
        connect: ${getWhereUniqueInputName(relationTo)}
        disconnect: Boolean
        delete: Boolean
      }`);
      content.push(`${name}: ${relationInputName}`);
      return;
    }

    if (isRelation && isList) {
      // to-many
      const relationTo = (field as RelationField).getRelationTo();
      const relationInputName = `${capName}UpdateManyInput`;
      const whereUnique = getWhereUniqueInputName(relationTo);
      root.addInput(`input ${relationInputName} {
        create: [${getCreateInputName(relationTo)}]
        connect: [${whereUnique}]
        disconnect: [${whereUnique}]
        delete: [${whereUnique}]
      }`);
      content.push(`${name}: ${relationInputName}`);
      return;
    }
  });

  return content;
};

export default class UpdatePlugin implements Plugin {
  private whereInputPlugin: WhereInputPlugin;
  private baseTypePlugin: BaseTypePlugin;
  private createPlugin: CreatePlugin;
  private hook: Hook;

  constructor({hook}: {hook: Hook}) {
    this.hook = hook;
  }

  public setPlugins(plugins: Plugin[]) {
    this.whereInputPlugin = plugins.find(
      plugin => plugin instanceof WhereInputPlugin,
    ) as WhereInputPlugin;
    this.baseTypePlugin = plugins.find(
      plugin => plugin instanceof BaseTypePlugin,
    ) as BaseTypePlugin;
    this.createPlugin = plugins.find(
      plugin => plugin instanceof CreatePlugin,
    ) as CreatePlugin;
  }

  public visitModel(model: Model, context: Context) {
    const {root} = context;
    // object
    if (model.isObjectType()) {
      const objectMutationName = this.getInputName(model);
      const objectInputName = this.generateUpdateInput(model, context);
      const objectReturnType = this.createObjectReturnType(model, context);
      root.addMutation(
        `${objectMutationName}(data: ${objectInputName}!): ${objectReturnType}`,
      );
      return;
    }

    // list
    // const modelType = this.baseTypePlugin.getTypename(model);
    const returnType = this.createUniqueReturnType(model, context);

    // update
    const mutationName = this.getInputName(model);
    const inputName = this.generateUpdateInput(model, context);
    const whereUniqueInput = this.whereInputPlugin.getWhereUniqueInputName(
      model,
    );
    root.addMutation(
      `${mutationName}(where: ${whereUniqueInput}, data: ${inputName}!): ${returnType}`,
    );
  }

  public resolveInMutation({
    model,
    dataSource,
  }: {
    model: Model;
    dataSource: ListMutable & MapMutable;
  }) {
    const mutationName = this.getInputName(model);
    const wrapUpdate = get(this.hook, [model.getName(), 'wrapUpdate']);

    // object
    if (model.isObjectType()) {
      return {
        [mutationName]: async (root, args, context) => {
          const data = {...args.data};

          // no relationship or other hooks
          if (!wrapUpdate) {
            await dataSource.updateMap(this.createMutation(model, data));
            return {success: true};
          }

          const updateContext: UpdateContext = {
            where: args.where,
            data,
            response: {},
            graphqlContext: context,
          };
          await wrapUpdate(updateContext, async ctx => {
            await dataSource.updateMap(this.createMutation(model, ctx.data));
          });
          return {success: true};
        },
      };
    }

    // list
    return {
      [mutationName]: async (root, args, context) => {
        const whereUnique = this.whereInputPlugin.parseUniqueWhere(args.where);
        // args may not have `hasOwnProperty`.
        // https://github.com/Canner/gqlify/issues/29
        const data = {...args.data};

        // no relationship or other hooks
        if (!wrapUpdate) {
          await dataSource.update(
            whereUnique,
            this.createMutation(model, data),
            context,
          );
          return args.where;
        }

        // wrap
        // put mutationFactory to context
        // so hooks can access it
        // todo: find a better way to share the mutationFactory
        const updateContext: UpdateContext = {
          where: args.where,
          data,
          response: {},
          graphqlContext: context,
        };
        await wrapUpdate(updateContext, async ctx => {
          await dataSource.update(
            whereUnique,
            this.createMutation(model, ctx.data),
            context,
          );
        });
        return args.where;
      },
    };
  }

  private generateUpdateInput(model: Model, context: Context) {
    const inputName = `${model.getNamings().capitalSingular}UpdateInput`;
    const input = `input ${inputName} {
      ${createInputField(
        model,
        context,
        this.createPlugin.getCreateInputName,
        this.whereInputPlugin.getWhereInputName,
        this.whereInputPlugin.getWhereUniqueInputName,
        model.getUpdateMutationFactory,
      )}
    }`;
    context.root.addInput(input);
    return inputName;
  }

  private getInputName(model: Model) {
    return `update${model.getNamings().capitalSingular}`;
  }

  private createUniqueReturnType(model: Model, context: Context) {
    const uniqueFields = model.getUniqueFields();
    const typename = this.getReturnTypename(model);
    const fields = reduce(
      uniqueFields,
      (arr, field, name) => {
        arr.push(`${name}: ${field.getTypename()}`);
        return arr;
      },
      [],
    ).join(' ');
    const type = `type ${typename} {
      ${fields}
    }`;
    context.root.addObjectType(type);
    return typename;
  }

  private createObjectReturnType(model: Model, context: Context) {
    const typename = this.getReturnTypename(model);
    const type = `type ${typename} {
      success: Boolean
    }`;
    context.root.addObjectType(type);
    return typename;
  }

  private getReturnTypename(model: Model) {
    return `${model.getNamings().capitalSingular}UpdateResponse`;
  }

  private createMutation = (model: Model, payload: any) => {
    const mutationFactory = model.getUpdateMutationFactory();
    return mutationFactory.createMutation(payload);
  };
}
