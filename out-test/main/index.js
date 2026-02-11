"use strict";
const electron = require("electron");
const path = require("path");
const fs$1 = require("node:fs");
const path$1 = require("node:path");
const node_crypto = require("node:crypto");
const langgraph = require("@langchain/langgraph");
const deepagents = require("deepagents");
const chat_models = require("@langchain/core/language_models/chat_models");
const runnables = require("@langchain/core/runnables");
const stream = require("@langchain/core/utils/stream");
const types = require("@langchain/core/utils/types");
const json_schema = require("@langchain/core/utils/json_schema");
const messages = require("@langchain/core/messages");
const tools = require("@langchain/core/tools");
const langgraphCheckpoint = require("@langchain/langgraph-checkpoint");
const zod = require("@langchain/langgraph/zod");
const singletons = require("@langchain/core/singletons");
const uuid$1 = require("uuid");
const base = require("@langchain/core/language_models/base");
const hash = require("@langchain/core/utils/hash");
const context = require("@langchain/core/utils/context");
const stores = require("@langchain/core/stores");
const documents = require("@langchain/core/documents");
const os = require("os");
const fs = require("fs");
const initSqlJs = require("sql.js");
const openai = require("@langchain/openai");
const node_child_process = require("node:child_process");
const node_os = require("node:os");
const tavily = require("@langchain/tavily");
const nodemailer = require("nodemailer");
const imapflow = require("imapflow");
const mailparser = require("mailparser");
const index_js = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js = require("@modelcontextprotocol/sdk/client/stdio.js");
const sse_js = require("@modelcontextprotocol/sdk/client/sse.js");
const fs$2 = require("node:fs/promises");
const events = require("events");
const cronParser = require("cron-parser");
const crypto = require("crypto");
const Store = require("electron-store");
const fs$3 = require("fs/promises");
const node_events = require("node:events");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace$1 = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace$1 = /* @__PURE__ */ _interopNamespaceDefault(fs$1);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path$1);
const fs__namespace$2 = /* @__PURE__ */ _interopNamespaceDefault(fs);
const nodemailer__namespace = /* @__PURE__ */ _interopNamespaceDefault(nodemailer);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs$2);
const fs__namespace$3 = /* @__PURE__ */ _interopNamespaceDefault(fs$3);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, {
    get: all[name],
    enumerable: true
  });
};
var universal_exports = {};
__export(universal_exports, {
  ConfigurableModel: () => ConfigurableModel,
  MODEL_PROVIDER_CONFIG: () => MODEL_PROVIDER_CONFIG,
  _inferModelProvider: () => _inferModelProvider,
  getChatModelByClassName: () => getChatModelByClassName,
  initChatModel: () => initChatModel
});
const MODEL_PROVIDER_CONFIG = {
  openai: {
    package: "@langchain/openai",
    className: "ChatOpenAI"
  },
  anthropic: {
    package: "@langchain/anthropic",
    className: "ChatAnthropic"
  },
  azure_openai: {
    package: "@langchain/openai",
    className: "AzureChatOpenAI"
  },
  cohere: {
    package: "@langchain/cohere",
    className: "ChatCohere"
  },
  "google-vertexai": {
    package: "@langchain/google-vertexai",
    className: "ChatVertexAI"
  },
  "google-vertexai-web": {
    package: "@langchain/google-vertexai-web",
    className: "ChatVertexAI"
  },
  "google-genai": {
    package: "@langchain/google-genai",
    className: "ChatGoogleGenerativeAI"
  },
  ollama: {
    package: "@langchain/ollama",
    className: "ChatOllama"
  },
  mistralai: {
    package: "@langchain/mistralai",
    className: "ChatMistralAI"
  },
  mistral: {
    package: "@langchain/mistralai",
    className: "ChatMistralAI"
  },
  groq: {
    package: "@langchain/groq",
    className: "ChatGroq"
  },
  cerebras: {
    package: "@langchain/cerebras",
    className: "ChatCerebras"
  },
  bedrock: {
    package: "@langchain/aws",
    className: "ChatBedrockConverse"
  },
  deepseek: {
    package: "@langchain/deepseek",
    className: "ChatDeepSeek"
  },
  xai: {
    package: "@langchain/xai",
    className: "ChatXAI"
  },
  fireworks: {
    package: "@langchain/community/chat_models/fireworks",
    className: "ChatFireworks",
    hasCircularDependency: true
  },
  together: {
    package: "@langchain/community/chat_models/togetherai",
    className: "ChatTogetherAI",
    hasCircularDependency: true
  },
  perplexity: {
    package: "@langchain/community/chat_models/perplexity",
    className: "ChatPerplexity",
    hasCircularDependency: true
  }
};
const SUPPORTED_PROVIDERS = Object.keys(MODEL_PROVIDER_CONFIG);
async function getChatModelByClassName(className) {
  const providerEntry = Object.entries(MODEL_PROVIDER_CONFIG).find(([, config$1]) => config$1.className === className);
  if (!providerEntry) return void 0;
  const [, config2] = providerEntry;
  try {
    const module = await import(config2.package);
    return module[config2.className];
  } catch (e) {
    const err = e;
    if ("code" in err && err.code?.toString().includes("ERR_MODULE_NOT_FOUND") && "message" in err && typeof err.message === "string") {
      const msg = err.message.startsWith("Error: ") ? err.message.slice(7) : err.message;
      const attemptedPackage = msg.split("Cannot find package '")[1].split("'")[0];
      throw new Error(`Unable to import ${attemptedPackage}. Please install with \`npm install ${attemptedPackage}\` or \`pnpm install ${attemptedPackage}\``);
    }
    throw e;
  }
}
async function _initChatModelHelper(model, modelProvider, params = {}) {
  const modelProviderCopy = modelProvider || _inferModelProvider(model);
  if (!modelProviderCopy) throw new Error(`Unable to infer model provider for { model: ${model} }, please specify modelProvider directly.`);
  const config2 = MODEL_PROVIDER_CONFIG[modelProviderCopy];
  if (!config2) {
    const supported = SUPPORTED_PROVIDERS.join(", ");
    throw new Error(`Unsupported { modelProvider: ${modelProviderCopy} }.

Supported model providers are: ${supported}`);
  }
  const { modelProvider: _unused, ...passedParams } = params;
  const ProviderClass = await getChatModelByClassName(config2.className);
  return new ProviderClass({
    model,
    ...passedParams
  });
}
function _inferModelProvider(modelName) {
  if (modelName.startsWith("gpt-3") || modelName.startsWith("gpt-4") || modelName.startsWith("gpt-5") || modelName.startsWith("o1") || modelName.startsWith("o3") || modelName.startsWith("o4")) return "openai";
  else if (modelName.startsWith("claude")) return "anthropic";
  else if (modelName.startsWith("command")) return "cohere";
  else if (modelName.startsWith("accounts/fireworks")) return "fireworks";
  else if (modelName.startsWith("gemini")) return "google-vertexai";
  else if (modelName.startsWith("amazon.")) return "bedrock";
  else if (modelName.startsWith("mistral")) return "mistralai";
  else if (modelName.startsWith("sonar") || modelName.startsWith("pplx")) return "perplexity";
  else return void 0;
}
var ConfigurableModel = class ConfigurableModel2 extends chat_models.BaseChatModel {
  _llmType() {
    return "chat_model";
  }
  lc_namespace = ["langchain", "chat_models"];
  _defaultConfig = {};
  /**
  * @default "any"
  */
  _configurableFields = "any";
  /**
  * @default ""
  */
  _configPrefix;
  /**
  * Methods which should be called after the model is initialized.
  * The key will be the method name, and the value will be the arguments.
  */
  _queuedMethodOperations = {};
  /** @internal */
  _modelInstanceCache = /* @__PURE__ */ new Map();
  /** @internal */
  _profile;
  constructor(fields) {
    super(fields);
    this._defaultConfig = fields.defaultConfig ?? {};
    if (fields.configurableFields === "any") this._configurableFields = "any";
    else this._configurableFields = fields.configurableFields ?? ["model", "modelProvider"];
    if (fields.configPrefix) this._configPrefix = fields.configPrefix.endsWith("_") ? fields.configPrefix : `${fields.configPrefix}_`;
    else this._configPrefix = "";
    this._queuedMethodOperations = fields.queuedMethodOperations ?? this._queuedMethodOperations;
    this._profile = fields.profile ?? void 0;
  }
  async _getModelInstance(config2) {
    const cacheKey = this._getCacheKey(config2);
    const cachedModel = this._modelInstanceCache.get(cacheKey);
    if (cachedModel) return cachedModel;
    const params = {
      ...this._defaultConfig,
      ...this._modelParams(config2)
    };
    let initializedModel = await _initChatModelHelper(params.model, params.modelProvider, params);
    for (const [method, args] of Object.entries(this._queuedMethodOperations)) if (method in initializedModel && typeof initializedModel[method] === "function") initializedModel = await initializedModel[method](...args);
    this._modelInstanceCache.set(cacheKey, initializedModel);
    return initializedModel;
  }
  async _generate(messages2, options, runManager) {
    const model = await this._getModelInstance(options);
    return model._generate(messages2, options ?? {}, runManager);
  }
  bindTools(tools2, params) {
    const newQueuedOperations = { ...this._queuedMethodOperations };
    newQueuedOperations.bindTools = [tools2, params];
    return new ConfigurableModel2({
      defaultConfig: this._defaultConfig,
      configurableFields: this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: newQueuedOperations
    });
  }
  withStructuredOutput = (schema, ...args) => {
    const newQueuedOperations = { ...this._queuedMethodOperations };
    newQueuedOperations.withStructuredOutput = [schema, ...args];
    return new ConfigurableModel2({
      defaultConfig: this._defaultConfig,
      configurableFields: this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: newQueuedOperations
    });
  };
  _modelParams(config2) {
    const configurable = config2?.configurable ?? {};
    let modelParams = {};
    for (const [key, value] of Object.entries(configurable)) if (key.startsWith(this._configPrefix)) {
      const strippedKey = this._removePrefix(key, this._configPrefix);
      modelParams[strippedKey] = value;
    }
    if (this._configurableFields !== "any") modelParams = Object.fromEntries(Object.entries(modelParams).filter(([key]) => this._configurableFields.includes(key)));
    return modelParams;
  }
  _removePrefix(str, prefix) {
    return str.startsWith(prefix) ? str.slice(prefix.length) : str;
  }
  /**
  * Bind config to a Runnable, returning a new Runnable.
  * @param {RunnableConfig | undefined} [config] - The config to bind.
  * @returns {RunnableBinding<RunInput, RunOutput, CallOptions>} A new RunnableBinding with the bound config.
  */
  withConfig(config2) {
    const mergedConfig = { ...config2 || {} };
    const modelParams = this._modelParams(mergedConfig);
    const remainingConfig = Object.fromEntries(Object.entries(mergedConfig).filter(([k]) => k !== "configurable"));
    remainingConfig.configurable = Object.fromEntries(Object.entries(mergedConfig.configurable || {}).filter(([k]) => this._configPrefix && !Object.keys(modelParams).includes(this._removePrefix(k, this._configPrefix))));
    const newConfigurableModel = new ConfigurableModel2({
      defaultConfig: {
        ...this._defaultConfig,
        ...modelParams
      },
      configurableFields: Array.isArray(this._configurableFields) ? [...this._configurableFields] : this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: this._queuedMethodOperations
    });
    return new runnables.RunnableBinding({
      config: mergedConfig,
      bound: newConfigurableModel
    });
  }
  async invoke(input, options) {
    const model = await this._getModelInstance(options);
    const config2 = runnables.ensureConfig(options);
    return model.invoke(input, config2);
  }
  async stream(input, options) {
    const model = await this._getModelInstance(options);
    const wrappedGenerator = new stream.AsyncGeneratorWithSetup({
      generator: await model.stream(input, options),
      config: options
    });
    await wrappedGenerator.setup;
    return stream.IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
  }
  async batch(inputs, options, batchOptions) {
    return super.batch(inputs, options, batchOptions);
  }
  async *transform(generator, options) {
    const model = await this._getModelInstance(options);
    const config2 = runnables.ensureConfig(options);
    yield* model.transform(generator, config2);
  }
  async *streamLog(input, options, streamOptions) {
    const model = await this._getModelInstance(options);
    const config2 = runnables.ensureConfig(options);
    yield* model.streamLog(input, config2, {
      ...streamOptions,
      _schemaFormat: "original",
      includeNames: streamOptions?.includeNames,
      includeTypes: streamOptions?.includeTypes,
      includeTags: streamOptions?.includeTags,
      excludeNames: streamOptions?.excludeNames,
      excludeTypes: streamOptions?.excludeTypes,
      excludeTags: streamOptions?.excludeTags
    });
  }
  streamEvents(input, options, streamOptions) {
    const outerThis = this;
    async function* wrappedGenerator() {
      const model = await outerThis._getModelInstance(options);
      const config2 = runnables.ensureConfig(options);
      const eventStream = model.streamEvents(input, config2, streamOptions);
      for await (const chunk of eventStream) yield chunk;
    }
    return stream.IterableReadableStream.fromAsyncGenerator(wrappedGenerator());
  }
  /**
  * Return profiling information for the model.
  *
  * @returns {ModelProfile} An object describing the model's capabilities and constraints
  */
  get profile() {
    if (this._profile) return this._profile;
    const cacheKey = this._getCacheKey({});
    const instance = this._modelInstanceCache.get(cacheKey);
    return instance?.profile ?? {};
  }
  /** @internal */
  _getCacheKey(config2) {
    let toStringify = config2 ?? {};
    if (toStringify.configurable) {
      const { configurable } = toStringify;
      const filtered = {};
      for (const [k, v] of Object.entries(configurable)) if (!k.startsWith("__pregel_")) filtered[k] = v;
      toStringify = {
        ...toStringify,
        configurable: filtered
      };
    }
    return JSON.stringify(toStringify);
  }
};
async function initChatModel(model, fields) {
  let { configurableFields, configPrefix, modelProvider, profile, ...params } = {
    configPrefix: "",
    ...fields ?? {}
  };
  if (modelProvider === void 0 && model?.includes(":")) {
    const [provider, ...remainingParts] = model.split(":");
    const modelComponents = remainingParts.length === 0 ? [provider] : [provider, remainingParts.join(":")];
    if (SUPPORTED_PROVIDERS.includes(modelComponents[0])) [modelProvider, model] = modelComponents;
  }
  let configurableFieldsCopy = Array.isArray(configurableFields) ? [...configurableFields] : configurableFields;
  if (!model && configurableFieldsCopy === void 0) configurableFieldsCopy = ["model", "modelProvider"];
  if (configPrefix && configurableFieldsCopy === void 0) console.warn(`{ configPrefix: ${configPrefix} } has been set but no fields are configurable. Set { configurableFields: [...] } to specify the model params that are configurable.`);
  const paramsCopy = { ...params };
  let configurableModel;
  if (configurableFieldsCopy === void 0) configurableModel = new ConfigurableModel({
    defaultConfig: {
      ...paramsCopy,
      model,
      modelProvider
    },
    configPrefix,
    profile
  });
  else {
    if (model) paramsCopy.model = model;
    if (modelProvider) paramsCopy.modelProvider = modelProvider;
    configurableModel = new ConfigurableModel({
      defaultConfig: paramsCopy,
      configPrefix,
      configurableFields: configurableFieldsCopy,
      profile
    });
  }
  await configurableModel._getModelInstance();
  return configurableModel;
}
var MultipleToolsBoundError = class extends Error {
  constructor() {
    super("The provided LLM already has bound tools. Please provide an LLM without bound tools to createAgent. The agent will bind the tools provided in the 'tools' parameter.");
  }
};
var MultipleStructuredOutputsError = class extends Error {
  toolNames;
  constructor(toolNames) {
    super(`The model has called multiple tools: ${toolNames.join(", ")} to return a structured output. This is not supported. Please provide a single structured output.`);
    this.toolNames = toolNames;
  }
};
var StructuredOutputParsingError = class extends Error {
  toolName;
  errors;
  constructor(toolName, errors) {
    super(`Failed to parse structured output for tool '${toolName}':${errors.map((e) => `
  - ${e}`).join("")}.`);
    this.toolName = toolName;
    this.errors = errors;
  }
};
var ToolInvocationError = class extends Error {
  toolCall;
  toolError;
  constructor(toolError, toolCall) {
    const error = toolError instanceof Error ? toolError : new Error(String(toolError));
    const toolArgs = JSON.stringify(toolCall.args);
    super(`Error invoking tool '${toolCall.name}' with kwargs ${toolArgs} with error: ${error.stack}
 Please fix the error and try again.`);
    this.toolCall = toolCall;
    this.toolError = error;
  }
};
var MiddlewareError = class MiddlewareError2 extends Error {
  static "~brand" = "MiddlewareError";
  constructor(error, middlewareName) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    super(errorMessage);
    this.name = error instanceof Error ? error.name : `${middlewareName[0].toUpperCase() + middlewareName.slice(1)}Error`;
    if (error instanceof Error) this.cause = error;
  }
  /**
  * Wrap an error in a MiddlewareError, unless it's a GraphBubbleUp error
  * (like GraphInterrupt) which should propagate unchanged.
  *
  * @param error - The error to wrap
  * @param middlewareName - The name of the middleware that threw the error
  * @returns The original error if it's a GraphBubbleUp, otherwise a new MiddlewareError
  */
  static wrap(error, middlewareName) {
    if (langgraph.isGraphBubbleUp(error)) return error;
    return new MiddlewareError2(error, middlewareName);
  }
  /**
  * Check if the error is a MiddlewareError.
  * @param error - The error to check
  * @returns Whether the error is a MiddlewareError
  */
  static isInstance(error) {
    return error instanceof Error && "~brand" in error && error["~brand"] === "MiddlewareError";
  }
};
function isBaseChatModel(model) {
  return "invoke" in model && typeof model.invoke === "function" && "_streamResponseChunks" in model;
}
function isConfigurableModel(model) {
  return typeof model === "object" && model != null && "_queuedMethodOperations" in model && "_getModelInstance" in model && typeof model._getModelInstance === "function";
}
const PROVIDER_STRATEGY_DEFAULT_STRICT = true;
let bindingIdentifier = 0;
var ToolStrategy = class ToolStrategy2 {
  constructor(schema, tool, options) {
    this.schema = schema;
    this.tool = tool;
    this.options = options;
  }
  get name() {
    return this.tool.function.name;
  }
  static fromSchema(schema, outputOptions) {
    function getFunctionName(name) {
      return name ?? `extract-${++bindingIdentifier}`;
    }
    if (types.isInteropZodSchema(schema)) {
      const asJsonSchema$1 = json_schema.toJsonSchema(schema);
      const tool$1 = {
        type: "function",
        function: {
          name: getFunctionName(asJsonSchema$1.title),
          strict: false,
          description: asJsonSchema$1.description ?? "Tool for extracting structured output from the model's response.",
          parameters: asJsonSchema$1
        }
      };
      return new ToolStrategy2(asJsonSchema$1, tool$1, outputOptions);
    }
    let functionDefinition;
    if (typeof schema.name === "string" && typeof schema.parameters === "object" && schema.parameters != null) functionDefinition = schema;
    else functionDefinition = {
      name: getFunctionName(schema.title),
      description: schema.description ?? "",
      parameters: schema.schema || schema
    };
    const asJsonSchema = json_schema.toJsonSchema(schema);
    const tool = {
      type: "function",
      function: functionDefinition
    };
    return new ToolStrategy2(asJsonSchema, tool, outputOptions);
  }
  /**
  * Parse tool arguments according to the schema.
  *
  * @throws {StructuredOutputParsingError} if the response is not valid
  * @param toolArgs - The arguments from the tool call
  * @returns The parsed response according to the schema type
  */
  parse(toolArgs) {
    const validator = new json_schema.Validator(this.schema);
    const result = validator.validate(toolArgs);
    if (!result.valid) throw new StructuredOutputParsingError(this.name, result.errors.map((e) => e.error));
    return toolArgs;
  }
};
var ProviderStrategy = class ProviderStrategy2 {
  _schemaType;
  /**
  * The schema to use for the provider strategy
  */
  schema;
  /**
  * Whether to use strict mode for the provider strategy
  */
  strict;
  constructor(schemaOrOptions, strict) {
    if ("schema" in schemaOrOptions && typeof schemaOrOptions.schema === "object" && schemaOrOptions.schema !== null && !("type" in schemaOrOptions)) {
      const options = schemaOrOptions;
      this.schema = options.schema;
      this.strict = options.strict ?? PROVIDER_STRATEGY_DEFAULT_STRICT;
    } else {
      this.schema = schemaOrOptions;
      this.strict = strict ?? PROVIDER_STRATEGY_DEFAULT_STRICT;
    }
  }
  static fromSchema(schema, strict) {
    const asJsonSchema = json_schema.toJsonSchema(schema);
    return new ProviderStrategy2(asJsonSchema, strict);
  }
  /**
  * Parse tool arguments according to the schema. If the response is not valid, return undefined.
  *
  * @param response - The AI message response to parse
  * @returns The parsed response according to the schema type
  */
  parse(response) {
    let textContent;
    if (typeof response.content === "string") textContent = response.content;
    else if (Array.isArray(response.content)) {
      for (const block of response.content) if (typeof block === "object" && block !== null && "type" in block && block.type === "text" && "text" in block && typeof block.text === "string") {
        textContent = block.text;
        break;
      }
    }
    if (!textContent || textContent === "") return;
    try {
      const content = JSON.parse(textContent);
      const validator = new json_schema.Validator(this.schema);
      const result = validator.validate(content);
      if (!result.valid) return;
      return content;
    } catch {
    }
  }
};
function transformResponseFormat(responseFormat, options, model) {
  if (!responseFormat) return [];
  if (typeof responseFormat === "object" && responseFormat !== null && "__responseFormatUndefined" in responseFormat) return [];
  if (Array.isArray(responseFormat)) {
    if (responseFormat.every((item) => item instanceof ToolStrategy || item instanceof ProviderStrategy)) return responseFormat;
    if (responseFormat.every((item) => types.isInteropZodObject(item))) return responseFormat.map((item) => ToolStrategy.fromSchema(item, options));
    if (responseFormat.every((item) => typeof item === "object" && item !== null && !types.isInteropZodObject(item))) return responseFormat.map((item) => ToolStrategy.fromSchema(item, options));
    throw new Error("Invalid response format: list contains mixed types.\nAll items must be either InteropZodObject or plain JSON schema objects.");
  }
  if (responseFormat instanceof ToolStrategy || responseFormat instanceof ProviderStrategy) return [responseFormat];
  const useProviderStrategy = hasSupportForJsonSchemaOutput(model);
  if (types.isInteropZodObject(responseFormat)) return useProviderStrategy ? [ProviderStrategy.fromSchema(responseFormat)] : [ToolStrategy.fromSchema(responseFormat, options)];
  if (typeof responseFormat === "object" && responseFormat !== null && "properties" in responseFormat) return useProviderStrategy ? [ProviderStrategy.fromSchema(responseFormat)] : [ToolStrategy.fromSchema(responseFormat, options)];
  throw new Error(`Invalid response format: ${String(responseFormat)}`);
}
function toolStrategy(responseFormat, options) {
  return transformResponseFormat(responseFormat, options);
}
function providerStrategy(responseFormat) {
  if (typeof responseFormat === "object" && responseFormat !== null && "schema" in responseFormat && !types.isInteropZodSchema(responseFormat) && !("type" in responseFormat)) {
    const { schema, strict: strictFlag } = responseFormat;
    return ProviderStrategy.fromSchema(schema, strictFlag);
  }
  return ProviderStrategy.fromSchema(responseFormat);
}
const CHAT_MODELS_THAT_SUPPORT_JSON_SCHEMA_OUTPUT = ["ChatOpenAI", "ChatXAI"];
const MODEL_NAMES_THAT_SUPPORT_JSON_SCHEMA_OUTPUT = [
  "grok",
  "gpt-5",
  "gpt-4.1",
  "gpt-4o",
  "gpt-oss",
  "o3-pro",
  "o3-mini"
];
function hasSupportForJsonSchemaOutput(model) {
  if (!model) return false;
  if (typeof model === "string") {
    const modelName = model.split(":").pop();
    return MODEL_NAMES_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.some((modelNameSnippet) => modelName.includes(modelNameSnippet));
  }
  if (isConfigurableModel(model)) {
    const configurableModel = model;
    return hasSupportForJsonSchemaOutput(configurableModel._defaultConfig.model);
  }
  if (!isBaseChatModel(model)) return false;
  const chatModelClass = model.getName();
  if (chatModelClass === "FakeToolCallingChatModel") return true;
  if (CHAT_MODELS_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.includes(chatModelClass) && ("model" in model && MODEL_NAMES_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.some((modelNameSnippet) => typeof model.model === "string" && model.model.includes(modelNameSnippet)) || chatModelClass === "FakeToolCallingModel" && "structuredResponse" in model)) return true;
  return false;
}
function countTokensApproximately(messages$1) {
  let totalChars = 0;
  for (const msg of messages$1) {
    let textContent;
    if (typeof msg.content === "string") textContent = msg.content;
    else if (Array.isArray(msg.content)) textContent = msg.content.map((item) => {
      if (typeof item === "string") return item;
      if (item.type === "text" && "text" in item) return item.text;
      return "";
    }).join("");
    else textContent = "";
    if (messages.AIMessage.isInstance(msg) && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) textContent += JSON.stringify(msg.tool_calls);
    if (messages.ToolMessage.isInstance(msg)) textContent += msg.tool_call_id ?? "";
    totalChars += textContent.length;
  }
  return Math.ceil(totalChars / 4);
}
function getHookConstraint(hook) {
  if (!hook || typeof hook === "function") return void 0;
  return hook.canJumpTo;
}
function getHookFunction(arg) {
  if (typeof arg === "function") return arg;
  return arg.hook;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function calculateRetryDelay(config2, retryNumber) {
  const { backoffFactor, initialDelayMs, maxDelayMs, jitter } = config2;
  let delay;
  if (backoffFactor === 0) delay = initialDelayMs;
  else delay = initialDelayMs * backoffFactor ** retryNumber;
  delay = Math.min(delay, maxDelayMs);
  if (jitter && delay > 0) {
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    delay = Math.max(0, delay);
  }
  return delay;
}
const MIDDLEWARE_BRAND = /* @__PURE__ */ Symbol("AgentMiddleware");
function createMiddleware(config2) {
  const middleware = {
    [MIDDLEWARE_BRAND]: true,
    name: config2.name,
    stateSchema: config2.stateSchema,
    contextSchema: config2.contextSchema,
    wrapToolCall: config2.wrapToolCall,
    wrapModelCall: config2.wrapModelCall,
    beforeAgent: config2.beforeAgent,
    beforeModel: config2.beforeModel,
    afterModel: config2.afterModel,
    afterAgent: config2.afterAgent,
    tools: config2.tools
  };
  return middleware;
}
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object2) => {
    const keys = [];
    for (const key in object2) {
      if (Object.prototype.hasOwnProperty.call(object2, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array2, separator = " | ") {
    return array2.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
const getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
const ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue2) {
      return issue2.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue2 of error.issues) {
        if (issue2.code === "invalid_union") {
          issue2.unionErrors.map(processError);
        } else if (issue2.code === "invalid_return_type") {
          processError(issue2.returnTypeError);
        } else if (issue2.code === "invalid_arguments") {
          processError(issue2.argumentsError);
        } else if (issue2.path.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue2.path.length) {
            const el = issue2.path[i];
            const terminal = i === issue2.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue2));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue2) => issue2.message) {
    const fieldErrors = /* @__PURE__ */ Object.create(null);
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
const errorMap = (issue2, _ctx) => {
  let message;
  switch (issue2.code) {
    case ZodIssueCode.invalid_type:
      if (issue2.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue2.expected}, received ${issue2.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue2.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue2.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue2.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue2.options)}, received '${issue2.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue2.validation === "object") {
        if ("includes" in issue2.validation) {
          message = `Invalid input: must include "${issue2.validation.includes}"`;
          if (typeof issue2.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue2.validation.position}`;
          }
        } else if ("startsWith" in issue2.validation) {
          message = `Invalid input: must start with "${issue2.validation.startsWith}"`;
        } else if ("endsWith" in issue2.validation) {
          message = `Invalid input: must end with "${issue2.validation.endsWith}"`;
        } else {
          util.assertNever(issue2.validation);
        }
      } else if (issue2.validation !== "regex") {
        message = `Invalid ${issue2.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue2.type === "array")
        message = `Array must contain ${issue2.exact ? "exactly" : issue2.inclusive ? `at least` : `more than`} ${issue2.minimum} element(s)`;
      else if (issue2.type === "string")
        message = `String must contain ${issue2.exact ? "exactly" : issue2.inclusive ? `at least` : `over`} ${issue2.minimum} character(s)`;
      else if (issue2.type === "number")
        message = `Number must be ${issue2.exact ? `exactly equal to ` : issue2.inclusive ? `greater than or equal to ` : `greater than `}${issue2.minimum}`;
      else if (issue2.type === "bigint")
        message = `Number must be ${issue2.exact ? `exactly equal to ` : issue2.inclusive ? `greater than or equal to ` : `greater than `}${issue2.minimum}`;
      else if (issue2.type === "date")
        message = `Date must be ${issue2.exact ? `exactly equal to ` : issue2.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue2.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue2.type === "array")
        message = `Array must contain ${issue2.exact ? `exactly` : issue2.inclusive ? `at most` : `less than`} ${issue2.maximum} element(s)`;
      else if (issue2.type === "string")
        message = `String must contain ${issue2.exact ? `exactly` : issue2.inclusive ? `at most` : `under`} ${issue2.maximum} character(s)`;
      else if (issue2.type === "number")
        message = `Number must be ${issue2.exact ? `exactly` : issue2.inclusive ? `less than or equal to` : `less than`} ${issue2.maximum}`;
      else if (issue2.type === "bigint")
        message = `BigInt must be ${issue2.exact ? `exactly` : issue2.inclusive ? `less than or equal to` : `less than`} ${issue2.maximum}`;
      else if (issue2.type === "date")
        message = `Date must be ${issue2.exact ? `exactly` : issue2.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue2.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue2.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue2);
  }
  return { message };
};
let overrideErrorMap = errorMap;
function getErrorMap() {
  return overrideErrorMap;
}
const makeIssue = (params) => {
  const { data, path: path2, errorMaps, issueData } = params;
  const fullPath = [...path2, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue2 = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue2);
}
class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
const INVALID = Object.freeze({
  status: "aborted"
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));
class ParseInputLazyPath {
  constructor(parent, value, path2, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path2;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
const handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
let ZodType$1 = class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional$1.create(this, this._def);
  }
  nullable() {
    return ZodNullable$1.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray$1.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion$1.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection$1.create(this, incoming, this._def);
  }
  transform(transform2) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform: transform2 }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault$1({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch$1({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly$1.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT$1(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base642 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base642));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
let ZodString$1 = class ZodString extends ZodType$1 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT$1(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString$1.create = (params) => {
  return new ZodString$1({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder$1(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
let ZodNumber$1 = class ZodNumber extends ZodType$1 {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder$1(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber$1.create = (params) => {
  return new ZodNumber$1({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodBigInt extends ZodType$1 {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
let ZodBoolean$1 = class ZodBoolean extends ZodType$1 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean$1.create = (params) => {
  return new ZodBoolean$1({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodDate extends ZodType$1 {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
class ZodSymbol extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
class ZodUndefined extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
class ZodNull extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
let ZodAny$1 = class ZodAny extends ZodType$1 {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny$1.create = (params) => {
  return new ZodAny$1({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
let ZodUnknown$1 = class ZodUnknown extends ZodType$1 {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown$1.create = (params) => {
  return new ZodUnknown$1({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
let ZodNever$1 = class ZodNever extends ZodType$1 {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever$1.create = (params) => {
  return new ZodNever$1({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
class ZodVoid extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
let ZodArray$1 = class ZodArray extends ZodType$1 {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray$1.create = (schema, params) => {
  return new ZodArray$1({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject$1) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional$1.create(deepPartialify(fieldSchema));
    }
    return new ZodObject$1({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray$1) {
    return new ZodArray$1({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional$1) {
    return ZodOptional$1.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable$1) {
    return ZodNullable$1.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
let ZodObject$1 = class ZodObject extends ZodType$1 {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever$1 && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever$1) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue2, ctx) => {
          const defaultError = this._def.errorMap?.(issue2, ctx).message ?? ctx.defaultError;
          if (issue2.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index2) {
    return new ZodObject({
      ...this._def,
      catchall: index2
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional$1) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject$1.create = (shape, params) => {
  return new ZodObject$1({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever$1.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject$1.strictCreate = (shape, params) => {
  return new ZodObject$1({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever$1.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject$1.lazycreate = (shape, params) => {
  return new ZodObject$1({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever$1.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
let ZodUnion$1 = class ZodUnion extends ZodType$1 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty2 = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty2) {
          dirty2 = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty2) {
        ctx.common.issues.push(...dirty2.ctx.common.issues);
        return dirty2.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion$1.create = (types2, params) => {
  return new ZodUnion$1({
    options: types2,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
function mergeValues$1(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues$1(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index2 = 0; index2 < a.length; index2++) {
      const itemA = a[index2];
      const itemB = b[index2];
      const sharedValue = mergeValues$1(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
let ZodIntersection$1 = class ZodIntersection extends ZodType$1 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues$1(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection$1.create = (left, right, params) => {
  return new ZodIntersection$1({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
class ZodTuple extends ZodType$1 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
let ZodRecord$1 = class ZodRecord extends ZodType$1 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType$1) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString$1.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
class ZodMap extends ZodType$1 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index2) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index2, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index2, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
class ZodSet extends ZodType$1 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
class ZodFunction extends ZodType$1 {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), errorMap].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), errorMap].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown$1.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown$1.create()),
      returns: returns || ZodUnknown$1.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
}
class ZodLazy extends ZodType$1 {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
let ZodLiteral$1 = class ZodLiteral extends ZodType$1 {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral$1.create = (value, params) => {
  return new ZodLiteral$1({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum$1({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
let ZodEnum$1 = class ZodEnum extends ZodType$1 {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum$1.create = createZodEnum;
class ZodNativeEnum extends ZodType$1 {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
class ZodPromise extends ZodType$1 {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
class ZodEffects extends ZodType$1 {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base2 = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base2))
          return INVALID;
        const result = effect.transform(base2.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base2) => {
          if (!isValid(base2))
            return INVALID;
          return Promise.resolve(effect.transform(base2.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
let ZodOptional$1 = class ZodOptional extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional$1.create = (type, params) => {
  return new ZodOptional$1({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
let ZodNullable$1 = class ZodNullable extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable$1.create = (type, params) => {
  return new ZodNullable$1({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
let ZodDefault$1 = class ZodDefault extends ZodType$1 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault$1.create = (type, params) => {
  return new ZodDefault$1({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
let ZodCatch$1 = class ZodCatch extends ZodType$1 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch$1.create = (type, params) => {
  return new ZodCatch$1({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
class ZodNaN extends ZodType$1 {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
class ZodBranded extends ZodType$1 {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class ZodPipeline extends ZodType$1 {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}
let ZodReadonly$1 = class ZodReadonly extends ZodType$1 {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly$1.create = (type, params) => {
  return new ZodReadonly$1({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom$1(check, _params = {}, fatal) {
  if (check)
    return ZodAny$1.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny$1.create();
}
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom$1((data) => data instanceof cls, params);
const stringType = ZodString$1.create;
const numberType = ZodNumber$1.create;
const booleanType = ZodBoolean$1.create;
const anyType = ZodAny$1.create;
ZodUnknown$1.create;
ZodNever$1.create;
const arrayType = ZodArray$1.create;
const objectType = ZodObject$1.create;
const unionType = ZodUnion$1.create;
ZodIntersection$1.create;
ZodTuple.create;
const recordType = ZodRecord$1.create;
const functionType = ZodFunction.create;
const literalType = ZodLiteral$1.create;
const enumType = ZodEnum$1.create;
const promiseType = ZodPromise.create;
ZodOptional$1.create;
ZodNullable$1.create;
var FakeToolCallingModel = class FakeToolCallingModel2 extends chat_models.BaseChatModel {
  toolCalls;
  toolStyle;
  indexRef;
  structuredResponse;
  tools = [];
  constructor({ toolCalls = [], toolStyle = "openai", index: index2 = 0, structuredResponse, indexRef, ...rest } = {}) {
    super(rest);
    this.toolCalls = toolCalls;
    this.toolStyle = toolStyle;
    this.indexRef = indexRef ?? { current: index2 };
    this.structuredResponse = structuredResponse;
  }
  get index() {
    return this.indexRef.current;
  }
  set index(value) {
    this.indexRef.current = value;
  }
  _llmType() {
    return "fake-tool-calling";
  }
  _combineLLMOutput() {
    return [];
  }
  bindTools(tools2) {
    const newInstance = new FakeToolCallingModel2({
      toolCalls: this.toolCalls,
      toolStyle: this.toolStyle,
      structuredResponse: this.structuredResponse,
      indexRef: this.indexRef
    });
    newInstance.tools = [...this.tools, ...tools2];
    return newInstance;
  }
  withStructuredOutput(_schema) {
    return new runnables.RunnableLambda({ func: async () => {
      return this.structuredResponse;
    } });
  }
  async _generate(messages$1, _options, _runManager) {
    const lastMessage = messages$1[messages$1.length - 1];
    let content = lastMessage.content;
    if (messages$1.length > 1) {
      const parts = messages$1.map((m) => m.content).filter(Boolean);
      content = parts.map((part) => {
        if (typeof part === "string") return part;
        else if (typeof part === "object" && "text" in part) return part.text;
        else if (Array.isArray(part)) return part.map((p) => {
          if (typeof p === "string") return p;
          else if (typeof p === "object" && "text" in p) return p.text;
          return "";
        }).join("-");
        else return JSON.stringify(part);
      }).join("-");
    }
    const isStartOfConversation = messages$1.length === 1 || messages$1.length === 2 && messages$1.every(messages.HumanMessage.isInstance);
    if (isStartOfConversation && this.index !== 0) this.index = 0;
    const currentToolCalls = this.toolCalls[this.index] || [];
    const messageId = this.index.toString();
    this.index = (this.index + 1) % Math.max(1, this.toolCalls.length);
    const message = new messages.AIMessage({
      content,
      id: messageId,
      tool_calls: currentToolCalls.length > 0 ? currentToolCalls.map((tc) => ({
        ...tc,
        type: "tool_call"
      })) : void 0
    });
    return {
      generations: [{
        text: content,
        message
      }],
      llmOutput: {}
    };
  }
};
function createAgentState(hasStructuredResponse = true, stateSchema2, middlewareList = []) {
  const stateFields = { jumpTo: new langgraph.UntrackedValue() };
  const inputFields = {};
  const outputFields = {};
  const applySchema = (schema) => {
    if (langgraph.StateSchema.isInstance(schema)) {
      for (const [key, field] of Object.entries(schema.fields)) {
        if (key.startsWith("_")) continue;
        if (!(key in stateFields)) {
          stateFields[key] = field;
          if (langgraph.ReducedValue.isInstance(field)) {
            inputFields[key] = field.inputSchema || field.valueSchema;
            outputFields[key] = field.valueSchema;
          } else {
            inputFields[key] = field;
            outputFields[key] = field;
          }
        }
      }
      return;
    }
    const shape = types.getInteropZodObjectShape(schema);
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (key.startsWith("_")) continue;
      if (!(key in stateFields)) {
        if (types.isZodSchemaV4(fieldSchema)) {
          const meta = zod.schemaMetaRegistry.get(fieldSchema);
          if (meta?.reducer) {
            if (meta.reducer.schema) {
              stateFields[key] = new langgraph.ReducedValue(fieldSchema, {
                inputSchema: meta.reducer.schema,
                reducer: meta.reducer.fn
              });
              inputFields[key] = meta.reducer.schema;
              outputFields[key] = fieldSchema;
            } else {
              stateFields[key] = new langgraph.ReducedValue(fieldSchema, { reducer: meta.reducer.fn });
              inputFields[key] = fieldSchema;
              outputFields[key] = fieldSchema;
            }
            continue;
          }
        }
        stateFields[key] = fieldSchema;
        inputFields[key] = fieldSchema;
        outputFields[key] = fieldSchema;
      }
    }
  };
  if (stateSchema2 && (langgraph.StateSchema.isInstance(stateSchema2) || types.isInteropZodObject(stateSchema2))) applySchema(stateSchema2);
  for (const middleware of middlewareList) if (middleware.stateSchema && (langgraph.StateSchema.isInstance(middleware.stateSchema) || types.isInteropZodObject(middleware.stateSchema))) applySchema(middleware.stateSchema);
  if (hasStructuredResponse) outputFields.structuredResponse = new langgraph.UntrackedValue();
  return {
    state: new langgraph.StateSchema({
      messages: langgraph.MessagesValue,
      ...stateFields
    }),
    input: new langgraph.StateSchema({
      messages: langgraph.MessagesValue,
      ...inputFields
    }),
    output: new langgraph.StateSchema({
      messages: langgraph.MessagesValue,
      ...outputFields
    })
  };
}
const NAME_PATTERN = /<name>(.*?)<\/name>/s;
const CONTENT_PATTERN = /<content>(.*?)<\/content>/s;
function parseMiddlewareState(stateSchema2, state) {
  if (langgraph.StateSchema.isInstance(stateSchema2)) {
    const result = {};
    for (const key of Object.keys(stateSchema2.fields)) if (key in state) result[key] = state[key];
    return result;
  }
  if (types.isInteropZodSchema(stateSchema2)) return types.interopParse(stateSchema2, state);
  throw new Error(`Invalid state schema type: ${typeof stateSchema2}`);
}
function _addInlineAgentName(message) {
  if (!messages.AIMessage.isInstance(message) || messages.AIMessageChunk.isInstance(message)) return message;
  if (!message.name) return message;
  const { name } = message;
  if (typeof message.content === "string") return new messages.AIMessage({
    ...message.lc_kwargs,
    content: `<name>${name}</name><content>${message.content}</content>`,
    name: void 0
  });
  const updatedContent = [];
  let textBlockCount = 0;
  for (const contentBlock of message.content) if (typeof contentBlock === "string") {
    textBlockCount += 1;
    updatedContent.push(`<name>${name}</name><content>${contentBlock}</content>`);
  } else if (typeof contentBlock === "object" && "type" in contentBlock && contentBlock.type === "text") {
    textBlockCount += 1;
    updatedContent.push({
      ...contentBlock,
      text: `<name>${name}</name><content>${contentBlock.text}</content>`
    });
  } else updatedContent.push(contentBlock);
  if (!textBlockCount) updatedContent.unshift({
    type: "text",
    text: `<name>${name}</name><content></content>`
  });
  return new messages.AIMessage({
    ...message.lc_kwargs,
    content: updatedContent,
    name: void 0
  });
}
function _removeInlineAgentName(message) {
  if (!messages.AIMessage.isInstance(message) || !message.content) return message;
  let updatedContent = [];
  let updatedName;
  if (Array.isArray(message.content)) updatedContent = message.content.filter((block) => {
    if (block.type === "text" && typeof block.text === "string") {
      const nameMatch = block.text.match(NAME_PATTERN);
      const contentMatch = block.text.match(CONTENT_PATTERN);
      if (nameMatch && (!contentMatch || contentMatch[1] === "")) {
        updatedName = nameMatch[1];
        return false;
      }
      return true;
    }
    return true;
  }).map((block) => {
    if (block.type === "text" && typeof block.text === "string") {
      const nameMatch = block.text.match(NAME_PATTERN);
      const contentMatch = block.text.match(CONTENT_PATTERN);
      if (!nameMatch || !contentMatch) return block;
      updatedName = nameMatch[1];
      return {
        ...block,
        text: contentMatch[1]
      };
    }
    return block;
  });
  else {
    const content = message.content;
    const nameMatch = content.match(NAME_PATTERN);
    const contentMatch = content.match(CONTENT_PATTERN);
    if (!nameMatch || !contentMatch) return message;
    updatedName = nameMatch[1];
    updatedContent = contentMatch[1];
  }
  return new messages.AIMessage({
    ...Object.keys(message.lc_kwargs ?? {}).length > 0 ? message.lc_kwargs : message,
    content: updatedContent,
    name: updatedName
  });
}
function isClientTool(tool) {
  return runnables.Runnable.isRunnable(tool);
}
function _isChatModelWithBindTools(llm) {
  if (!isBaseChatModel(llm)) return false;
  return "bindTools" in llm && typeof llm.bindTools === "function";
}
const _simpleBindTools = (llm, toolClasses, options = {}) => {
  if (_isChatModelWithBindTools(llm)) return llm.bindTools(toolClasses, options);
  if (runnables.RunnableBinding.isRunnableBinding(llm) && _isChatModelWithBindTools(llm.bound)) {
    const newBound = llm.bound.bindTools(toolClasses, options);
    if (runnables.RunnableBinding.isRunnableBinding(newBound)) return new runnables.RunnableBinding({
      bound: newBound.bound,
      config: {
        ...llm.config,
        ...newBound.config
      },
      kwargs: {
        ...llm.kwargs,
        ...newBound.kwargs
      },
      configFactories: newBound.configFactories ?? llm.configFactories
    });
    return new runnables.RunnableBinding({
      bound: newBound,
      config: llm.config,
      kwargs: llm.kwargs,
      configFactories: llm.configFactories
    });
  }
  return null;
};
function validateLLMHasNoBoundTools(llm) {
  if (typeof llm === "function") return;
  let model = llm;
  if (runnables.RunnableSequence.isRunnableSequence(model)) model = model.steps.find((step) => runnables.RunnableBinding.isRunnableBinding(step)) || model;
  if (isConfigurableModel(model))
    return;
  if (runnables.RunnableBinding.isRunnableBinding(model)) {
    const hasToolsInKwargs = model.kwargs != null && typeof model.kwargs === "object" && "tools" in model.kwargs && Array.isArray(model.kwargs.tools) && model.kwargs.tools.length > 0;
    const hasToolsInConfig = model.config != null && typeof model.config === "object" && "tools" in model.config && Array.isArray(model.config.tools) && model.config.tools.length > 0;
    if (hasToolsInKwargs || hasToolsInConfig) throw new MultipleToolsBoundError();
  }
  if ("tools" in model && model.tools !== void 0 && Array.isArray(model.tools) && model.tools.length > 0) throw new MultipleToolsBoundError();
}
function hasToolCalls(message) {
  return Boolean(messages.AIMessage.isInstance(message) && message.tool_calls && message.tool_calls.length > 0);
}
function normalizeSystemPrompt(systemPrompt) {
  if (systemPrompt == null) return new messages.SystemMessage("");
  if (messages.SystemMessage.isInstance(systemPrompt)) return systemPrompt;
  if (typeof systemPrompt === "string") return new messages.SystemMessage({ content: [{
    type: "text",
    text: systemPrompt
  }] });
  throw new Error(`Invalid systemPrompt type: expected string or SystemMessage, got ${typeof systemPrompt}`);
}
async function bindTools(llm, toolClasses, options = {}) {
  const model = _simpleBindTools(llm, toolClasses, options);
  if (model) return model;
  if (isConfigurableModel(llm)) {
    const model$1 = _simpleBindTools(await llm._getModelInstance(), toolClasses, options);
    if (model$1) return model$1;
  }
  if (runnables.RunnableSequence.isRunnableSequence(llm)) {
    const modelStep = llm.steps.findIndex((step) => runnables.RunnableBinding.isRunnableBinding(step) || isBaseChatModel(step) || isConfigurableModel(step));
    if (modelStep >= 0) {
      const model$1 = _simpleBindTools(llm.steps[modelStep], toolClasses, options);
      if (model$1) {
        const nextSteps = llm.steps.slice();
        nextSteps.splice(modelStep, 1, model$1);
        return runnables.RunnableSequence.from(nextSteps);
      }
    }
  }
  throw new Error(`llm ${llm} must define bindTools method.`);
}
function chainToolCallHandlers(handlers) {
  if (handlers.length === 0) return void 0;
  if (handlers.length === 1) return handlers[0];
  function composeTwo(outer, inner) {
    return async (request, handler) => {
      const innerHandler = async (passedRequest) => {
        return inner(passedRequest, handler);
      };
      return outer(request, innerHandler);
    };
  }
  let result = handlers[handlers.length - 1];
  for (let i = handlers.length - 2; i >= 0; i--) result = composeTwo(handlers[i], result);
  return result;
}
function wrapToolCall(middleware) {
  const middlewareWithWrapToolCall = middleware.filter((m) => m.wrapToolCall);
  if (middlewareWithWrapToolCall.length === 0) return;
  return chainToolCallHandlers(middlewareWithWrapToolCall.map((m) => {
    const originalHandler = m.wrapToolCall;
    const wrappedHandler = async (request, handler) => {
      const originalState = request.state;
      const wrappedInnerHandler = async (passedRequest) => {
        const mergedState = {
          ...originalState,
          ...passedRequest.state
        };
        return handler({
          ...passedRequest,
          state: mergedState
        });
      };
      try {
        const result = await originalHandler({
          ...request,
          state: {
            messages: originalState.messages,
            ...m.stateSchema ? parseMiddlewareState(m.stateSchema, { ...originalState }) : {}
          }
        }, wrappedInnerHandler);
        if (!messages.ToolMessage.isInstance(result) && !langgraph.isCommand(result)) throw new Error(`Invalid response from "wrapToolCall" in middleware "${m.name}": expected ToolMessage or Command, got ${typeof result}`);
        return result;
      } catch (error) {
        throw MiddlewareError.wrap(error, m.name);
      }
    };
    return wrappedHandler;
  }));
}
function $constructor(name, initializer2, params) {
  function init(inst, def) {
    if (!inst._zod) {
      Object.defineProperty(inst, "_zod", {
        value: {
          def,
          constr: _,
          traits: /* @__PURE__ */ new Set()
        },
        enumerable: false
      });
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer2(inst, def);
    const proto = _.prototype;
    const keys = Object.keys(proto);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a2;
    const inst = params?.Parent ? new Definition() : this;
    init(inst, def);
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
class $ZodAsyncError extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
}
class $ZodEncodeError extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
}
const globalConfig = {};
function config(newConfig) {
  return globalConfig;
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  return {
    get value() {
      {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
    }
  };
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepString = step.toString();
  let stepDecCount = (stepString.split(".")[1] || "").length;
  if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
    const match = stepString.match(/\d?e-(\d?)/);
    if (match?.[1]) {
      stepDecCount = Number.parseInt(match[1]);
    }
  }
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
const EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = cached(() => {
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  return o;
}
const propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
const NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key in shape) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function merge(a, b) {
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return clone(a, def);
}
function partial(Class, schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path2, issues) {
  return issues.map((iss) => {
    var _a2;
    (_a2 = iss).path ?? (_a2.path = []);
    iss.path.unshift(path2);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const full = { ...iss, path: iss.path ?? [] };
  if (!iss.message) {
    const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
    full.message = message;
  }
  delete full.inst;
  delete full.continue;
  if (!ctx?.reportInput) {
    delete full.input;
  }
  return full;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
const initializer$1 = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error2) => {
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues });
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues });
      } else if (issue2.path.length === 0) {
        fieldErrors._errors.push(mapper(issue2));
      } else {
        let curr = fieldErrors;
        let i = 0;
        while (i < issue2.path.length) {
          const el = issue2.path[i];
          const terminal = i === issue2.path.length - 1;
          if (!terminal) {
            curr[el] = curr[el] || { _errors: [] };
          } else {
            curr[el] = curr[el] || { _errors: [] };
            curr[el]._errors.push(mapper(issue2));
          }
          curr = curr[el];
          i++;
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}
function toDotPath(_path) {
  const segs = [];
  const path2 = _path.map((seg) => typeof seg === "object" ? seg.key : seg);
  for (const seg of path2) {
    if (typeof seg === "number")
      segs.push(`[${seg}]`);
    else if (typeof seg === "symbol")
      segs.push(`[${JSON.stringify(String(seg))}]`);
    else if (/[^\w$]/.test(seg))
      segs.push(`[${JSON.stringify(seg)}]`);
    else {
      if (segs.length)
        segs.push(".");
      segs.push(seg);
    }
  }
  return segs.join("");
}
function prettifyError(error) {
  const lines = [];
  const issues = [...error.issues].sort((a, b) => (a.path ?? []).length - (b.path ?? []).length);
  for (const issue2 of issues) {
    lines.push(`✖ ${issue2.message}`);
    if (issue2.path?.length)
      lines.push(`  → at ${toDotPath(issue2.path)}`);
  }
  return lines.join("\n");
}
const _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
  return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
const cuid = /^[cC][^\s-]{8,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const uuid = (version2) => {
  if (!version2)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
  return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time$1(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
  const time2 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex2 = `${time2}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex2})$`);
}
const string$1 = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a2;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a2 = inst._zod).onattach ?? (_a2.onattach = []);
});
const numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
const $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    var _a2;
    (_a2 = inst2._zod.bag).multipleOf ?? (_a2.multipleOf = def.value);
  });
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a2, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a2 = inst._zod).check ?? (_a2.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});
class Doc {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this?.args;
    const content = this?.content ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join("\n"));
  }
}
const version = {
  major: 4,
  minor: 3,
  patch: 6
};
const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a2;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted2 = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted2) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted2)
              isAborted2 = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted2)
            isAborted2 = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  defineLazy(inst, "~standard", () => ({
    validate: (value) => {
      try {
        const r = safeParse$1(inst, value);
        return r.success ? { value: r.data } : { issues: r.error?.issues };
      } catch (_) {
        return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
});
const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      const url = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  def.pattern ?? (def.pattern = nanoid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime$1(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date$1);
  $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time$1(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration$1);
  $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv6`;
  inst._zod.check = (payload) => {
    try {
      new URL(`http://[${payload.value}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    const parts = payload.value.split("/");
    try {
      if (parts.length !== 2)
        throw new Error();
      const [address, prefix] = parts;
      if (!prefix)
        throw new Error();
      const prefixNum = Number(prefix);
      if (`${prefixNum}` !== prefix)
        throw new Error();
      if (prefixNum < 0 || prefixNum > 128)
        throw new Error();
      new URL(`http://[${address}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64";
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64url);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64url";
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
const $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
const $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
const $ZodAny = /* @__PURE__ */ $constructor("$ZodAny", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index2) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index2, result.issues));
  }
  final.value[index2] = result.value;
}
const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = Array(input.length);
    const proms = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, isOptionalOut) {
  if (result.issues.length) {
    if (isOptionalOut && !(key in input)) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (result.value === void 0) {
    if (key in input) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const isOptionalOut = _catchall.optout === "optional";
  for (const key in input) {
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalOut)));
    } else {
      handlePropertyResult(r, payload, key, input, isOptionalOut);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!desc?.get) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape = def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject$1 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape = value.shape;
    for (const key of value.keys) {
      const el = shape[key];
      const isOptionalOut = el._zod.optout === "optional";
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalOut)));
      } else {
        handlePropertyResult(r, payload, key, input, isOptionalOut);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const generateFastpass = (shape) => {
    const doc = new Doc(["shape", "payload", "ctx"]);
    const normalized = _normalized.value;
    const parseStr = (key) => {
      const k = esc(key);
      return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    };
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter = 0;
    for (const key of normalized.keys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(`const newResult = {};`);
    for (const key of normalized.keys) {
      const id = ids[key];
      const k = esc(key);
      const schema = shape[key];
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(key)};`);
      if (isOptionalOut) {
        doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    const fn = doc.compile();
    return (payload, ctx) => fn(shape, payload, ctx);
  };
  let fastpass;
  const isObject$1 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval$1 = allowsEval;
  const fastEnabled = jit && allowsEval$1.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const single = def.options.length === 1;
  const first = def.options[0]._zod.run;
  inst._zod.parse = (payload, ctx) => {
    if (single) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index2 = 0; index2 < a.length; index2++) {
      const itemA = a[index2];
      const itemB = b[index2];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index2, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  for (const iss of left.issues) {
    if (iss.code === "unrecognized_keys") {
      unrecIssue ?? (unrecIssue = iss);
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).l = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  for (const iss of right.issues) {
    if (iss.code === "unrecognized_keys") {
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).r = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length && unrecIssue) {
    result.issues.push({ ...unrecIssue, keys: bothKeys });
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
const $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values) {
      payload.value = {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[key] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[key] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number$1.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  const values = new Set(def.values);
  inst._zod.values = values;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    return payload;
  };
});
function handleOptionalResult(result, input) {
  if (result.issues.length && input === void 0) {
    return { issues: [], value: void 0 };
  }
  return result;
}
const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, payload.value));
      return handleOptionalResult(result, payload.value);
    }
    if (payload.value === void 0) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => {
    const v = def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.value;
        if (result2.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
        }
        return payload;
      });
    }
    payload.value = result.value;
    if (result.issues.length) {
      payload.value = def.catchValue({
        ...payload,
        error: {
          issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
        },
        input: payload.value
      });
      payload.issues = [];
    }
    return payload;
  };
});
const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
  defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
var _a;
class $ZodRegistry {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
  return new Class({
    type: "string",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
  return new Class({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
  return new Class({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
  return new Class({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
  return new Class({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
  return new Class({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
  return new Class({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
  return new Class({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
  return new Class({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
  return new Class({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
  return new Class({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
  return new Class({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
  return new Class({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
  return new Class({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
  return new Class({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
  return new Class({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
  return new Class({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
  return new Class({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _any(Class) {
  return new Class({
    type: "any"
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
  return new Class({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _custom(Class, fn, _params) {
  const norm = normalizeParams(_params);
  norm.abort ?? (norm.abort = true);
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...norm
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {
    }),
    io: params?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    external: params?.external ?? void 0
  };
}
function process$1(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a2;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      process$1(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    Object.assign(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && result.schema._prefault)
    (_a2 = result.schema).default ?? (_a2.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
    }
    if (entry[1] === root) {
      return { ref: "#" };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + defId };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
        continue;
      }
    }
  }
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        Object.assign(schema2, refSchema);
      }
      Object.assign(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  for (const entry of [...ctx.seen.entries()].reverse()) {
    flattenRef(entry[0]);
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") ;
  else ;
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  Object.assign(result, root.def ?? root.schema);
  const defs = ctx.external?.defs ?? {};
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (seen.def && seen.defId) {
      defs[seen.defId] = seen.def;
    }
  }
  if (ctx.external) ;
  else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
const stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time") {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const regexes = [...patterns];
    if (regexes.length === 1)
      json.pattern = regexes[0].source;
    else if (regexes.length > 1) {
      json.allOf = [
        ...regexes.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
const numberProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format === "string" && format.includes("int"))
    json.type = "integer";
  else
    json.type = "number";
  if (typeof exclusiveMinimum === "number") {
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  }
  if (typeof minimum === "number") {
    json.minimum = minimum;
    if (typeof exclusiveMinimum === "number" && ctx.target !== "draft-04") {
      if (exclusiveMinimum >= minimum)
        delete json.minimum;
      else
        delete json.exclusiveMinimum;
    }
  }
  if (typeof exclusiveMaximum === "number") {
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  }
  if (typeof maximum === "number") {
    json.maximum = maximum;
    if (typeof exclusiveMaximum === "number" && ctx.target !== "draft-04") {
      if (exclusiveMaximum <= maximum)
        delete json.maximum;
      else
        delete json.exclusiveMaximum;
    }
  }
  if (typeof multipleOf === "number")
    json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
const anyProcessor = (_schema, _ctx, _json, _params) => {
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
};
const enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
  const def = schema._zod.def;
  const vals = [];
  for (const val of def.values) {
    if (val === void 0) {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
      }
    } else if (typeof val === "bigint") {
      if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      } else {
        vals.push(Number(val));
      }
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) ;
  else if (vals.length === 1) {
    const val = vals[0];
    json.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.enum = [val];
    } else {
      json.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json.type = "boolean";
    if (vals.every((v) => v === null))
      json.type = "null";
    json.enum = vals;
  }
};
const customProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Custom types cannot be represented in JSON Schema");
  }
};
const transformProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Transforms cannot be represented in JSON Schema");
  }
};
const arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = process$1(def.element, ctx, { ...params, path: [...params.path, "items"] });
};
const objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  json.properties = {};
  const shape = def.shape;
  for (const key in shape) {
    json.properties[key] = process$1(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    });
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key) => {
    const v = def.shape[key]._zod;
    if (ctx.io === "input") {
      return v.optin === void 0;
    } else {
      return v.optout === void 0;
    }
  }));
  if (requiredKeys.size > 0) {
    json.required = Array.from(requiredKeys);
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = process$1(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
const unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => process$1(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
const intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = process$1(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = process$1(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
};
const recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const keyBag = keyType._zod.bag;
  const patterns = keyBag?.patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = process$1(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns) {
      json.patternProperties[pattern.source] = valueSchema;
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = process$1(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
    }
    json.additionalProperties = process$1(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  if (keyValues) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues;
    }
  }
};
const nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io === "input")
    json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const innerType = ctx.io === "input" ? def.in._zod.def.type === "transform" ? def.out : def.in : def.out;
  process$1(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function datetime(params) {
  return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function date(params) {
  return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function time(params) {
  return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function duration(params) {
  return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
const initializer = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
      // enumerable: false,
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
      // enumerable: false,
    },
    addIssue: {
      value: (issue2) => {
        inst.issues.push(issue2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (issues2) => {
        inst.issues.push(...issues2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
      // enumerable: false,
    }
  });
};
const ZodRealError = $constructor("ZodError", initializer, {
  Parent: Error
});
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
const ZodType2 = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  $ZodType.init(inst, def);
  Object.assign(inst["~standard"], {
    jsonSchema: {
      input: createStandardJSONSchemaMethod(inst, "input"),
      output: createStandardJSONSchemaMethod(inst, "output")
    }
  });
  inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
  inst.def = def;
  inst.type = def.type;
  Object.defineProperty(inst, "_def", { value: def });
  inst.check = (...checks) => {
    return inst.clone(mergeDefs(def, {
      checks: [
        ...def.checks ?? [],
        ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
      ]
    }), {
      parent: true
    });
  };
  inst.with = inst.check;
  inst.clone = (def2, params) => clone(inst, def2, params);
  inst.brand = () => inst;
  inst.register = ((reg, meta) => {
    reg.add(inst, meta);
    return inst;
  });
  inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
  inst.spa = inst.safeParseAsync;
  inst.encode = (data, params) => encode(inst, data, params);
  inst.decode = (data, params) => decode(inst, data, params);
  inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
  inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
  inst.safeEncode = (data, params) => safeEncode(inst, data, params);
  inst.safeDecode = (data, params) => safeDecode(inst, data, params);
  inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
  inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
  inst.refine = (check, params) => inst.check(refine(check, params));
  inst.superRefine = (refinement) => inst.check(superRefine(refinement));
  inst.overwrite = (fn) => inst.check(/* @__PURE__ */ _overwrite(fn));
  inst.optional = () => optional(inst);
  inst.exactOptional = () => exactOptional(inst);
  inst.nullable = () => nullable(inst);
  inst.nullish = () => optional(nullable(inst));
  inst.nonoptional = (params) => nonoptional(inst, params);
  inst.array = () => array(inst);
  inst.or = (arg) => union([inst, arg]);
  inst.and = (arg) => intersection(inst, arg);
  inst.transform = (tx) => pipe(inst, transform(tx));
  inst.default = (def2) => _default(inst, def2);
  inst.prefault = (def2) => prefault(inst, def2);
  inst.catch = (params) => _catch(inst, params);
  inst.pipe = (target) => pipe(inst, target);
  inst.readonly = () => readonly(inst);
  inst.describe = (description) => {
    const cl = inst.clone();
    globalRegistry.add(cl, { description });
    return cl;
  };
  Object.defineProperty(inst, "description", {
    get() {
      return globalRegistry.get(inst)?.description;
    },
    configurable: true
  });
  inst.meta = (...args) => {
    if (args.length === 0) {
      return globalRegistry.get(inst);
    }
    const cl = inst.clone();
    globalRegistry.add(cl, args[0]);
    return cl;
  };
  inst.isOptional = () => inst.safeParse(void 0).success;
  inst.isNullable = () => inst.safeParse(null).success;
  inst.apply = (fn) => fn(inst);
  return inst;
});
const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
  const bag = inst._zod.bag;
  inst.format = bag.format ?? null;
  inst.minLength = bag.minimum ?? null;
  inst.maxLength = bag.maximum ?? null;
  inst.regex = (...args) => inst.check(/* @__PURE__ */ _regex(...args));
  inst.includes = (...args) => inst.check(/* @__PURE__ */ _includes(...args));
  inst.startsWith = (...args) => inst.check(/* @__PURE__ */ _startsWith(...args));
  inst.endsWith = (...args) => inst.check(/* @__PURE__ */ _endsWith(...args));
  inst.min = (...args) => inst.check(/* @__PURE__ */ _minLength(...args));
  inst.max = (...args) => inst.check(/* @__PURE__ */ _maxLength(...args));
  inst.length = (...args) => inst.check(/* @__PURE__ */ _length(...args));
  inst.nonempty = (...args) => inst.check(/* @__PURE__ */ _minLength(1, ...args));
  inst.lowercase = (params) => inst.check(/* @__PURE__ */ _lowercase(params));
  inst.uppercase = (params) => inst.check(/* @__PURE__ */ _uppercase(params));
  inst.trim = () => inst.check(/* @__PURE__ */ _trim());
  inst.normalize = (...args) => inst.check(/* @__PURE__ */ _normalize(...args));
  inst.toLowerCase = () => inst.check(/* @__PURE__ */ _toLowerCase());
  inst.toUpperCase = () => inst.check(/* @__PURE__ */ _toUpperCase());
  inst.slugify = () => inst.check(/* @__PURE__ */ _slugify());
});
const ZodString2 = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
  inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
  inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
  inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
  inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
  inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
  inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
  inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
  inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
  inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
  inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
  inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
  inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
  inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
  inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
  inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
  inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
  inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
  inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
  inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
  inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
  inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
  inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
  inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
  inst.datetime = (params) => inst.check(datetime(params));
  inst.date = (params) => inst.check(date(params));
  inst.time = (params) => inst.check(time(params));
  inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
  return /* @__PURE__ */ _string(ZodString2, params);
}
const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNumber2 = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json);
  inst.gt = (value, params) => inst.check(/* @__PURE__ */ _gt(value, params));
  inst.gte = (value, params) => inst.check(/* @__PURE__ */ _gte(value, params));
  inst.min = (value, params) => inst.check(/* @__PURE__ */ _gte(value, params));
  inst.lt = (value, params) => inst.check(/* @__PURE__ */ _lt(value, params));
  inst.lte = (value, params) => inst.check(/* @__PURE__ */ _lte(value, params));
  inst.max = (value, params) => inst.check(/* @__PURE__ */ _lte(value, params));
  inst.int = (params) => inst.check(int(params));
  inst.safe = (params) => inst.check(int(params));
  inst.positive = (params) => inst.check(/* @__PURE__ */ _gt(0, params));
  inst.nonnegative = (params) => inst.check(/* @__PURE__ */ _gte(0, params));
  inst.negative = (params) => inst.check(/* @__PURE__ */ _lt(0, params));
  inst.nonpositive = (params) => inst.check(/* @__PURE__ */ _lte(0, params));
  inst.multipleOf = (value, params) => inst.check(/* @__PURE__ */ _multipleOf(value, params));
  inst.step = (value, params) => inst.check(/* @__PURE__ */ _multipleOf(value, params));
  inst.finite = () => inst;
  const bag = inst._zod.bag;
  inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
  inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
  inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
  inst.isFinite = true;
  inst.format = bag.format ?? null;
});
function number(params) {
  return /* @__PURE__ */ _number(ZodNumber2, params);
}
const ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber2.init(inst, def);
});
function int(params) {
  return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
const ZodBoolean2 = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json);
});
function boolean(params) {
  return /* @__PURE__ */ _boolean(ZodBoolean2, params);
}
const ZodAny2 = /* @__PURE__ */ $constructor("ZodAny", (inst, def) => {
  $ZodAny.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => anyProcessor();
});
function any() {
  return /* @__PURE__ */ _any(ZodAny2);
}
const ZodUnknown2 = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
});
function unknown() {
  return /* @__PURE__ */ _unknown(ZodUnknown2);
}
const ZodNever2 = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
});
function never(params) {
  return /* @__PURE__ */ _never(ZodNever2, params);
}
const ZodArray2 = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
  inst.min = (minLength, params) => inst.check(/* @__PURE__ */ _minLength(minLength, params));
  inst.nonempty = (params) => inst.check(/* @__PURE__ */ _minLength(1, params));
  inst.max = (maxLength, params) => inst.check(/* @__PURE__ */ _maxLength(maxLength, params));
  inst.length = (len, params) => inst.check(/* @__PURE__ */ _length(len, params));
  inst.unwrap = () => inst.element;
});
function array(element, params) {
  return /* @__PURE__ */ _array(ZodArray2, element, params);
}
const ZodObject2 = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  $ZodObjectJIT.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  defineLazy(inst, "shape", () => {
    return def.shape;
  });
  inst.keyof = () => _enum(Object.keys(inst._zod.def.shape));
  inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall });
  inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
  inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
  inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
  inst.strip = () => inst.clone({ ...inst._zod.def, catchall: void 0 });
  inst.extend = (incoming) => {
    return extend(inst, incoming);
  };
  inst.safeExtend = (incoming) => {
    return safeExtend(inst, incoming);
  };
  inst.merge = (other) => merge(inst, other);
  inst.pick = (mask) => pick(inst, mask);
  inst.omit = (mask) => omit(inst, mask);
  inst.partial = (...args) => partial(ZodOptional2, inst, args[0]);
  inst.required = (...args) => required(ZodNonOptional, inst, args[0]);
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject2(def);
}
const ZodUnion2 = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion2({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
const ZodIntersection2 = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection2({
    type: "intersection",
    left,
    right
  });
}
const ZodRecord2 = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
  return new ZodRecord2({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
const ZodEnum2 = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
  inst.enum = def.entries;
  inst.options = Object.values(def.entries);
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum2({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum2({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum2({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
const ZodLiteral2 = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral2({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  $ZodTransform.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    payload.value = output;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
const ZodOptional2 = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional2({
    type: "optional",
    innerType
  });
}
const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
const ZodNullable2 = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable2({
    type: "nullable",
    innerType
  });
}
const ZodDefault2 = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault2({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
const ZodCatch2 = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch2({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
const ZodReadonly2 = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly2({
    type: "readonly",
    innerType
  });
}
const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType2.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx);
});
function custom(fn, _params) {
  return /* @__PURE__ */ _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
  return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn) {
  return /* @__PURE__ */ _superRefine(fn);
}
async function initializeMiddlewareStates(middlewareList, state) {
  const middlewareStates = {};
  for (const middleware of middlewareList) {
    if (!middleware.stateSchema) continue;
    let zodSchema = middleware.stateSchema;
    if (langgraph.StateSchema.isInstance(middleware.stateSchema)) {
      const zodShape = {};
      for (const [key, field] of Object.entries(middleware.stateSchema.fields)) if (langgraph.ReducedValue.isInstance(field)) zodShape[key] = field.inputSchema || field.valueSchema;
      else zodShape[key] = field;
      zodSchema = object(zodShape);
    }
    const modifiedSchema = types.interopZodObjectMakeFieldsOptional(zodSchema, (key) => key.startsWith("_"));
    const parseResult = await types.interopSafeParseAsync(modifiedSchema, state);
    if (parseResult.success) {
      Object.assign(middlewareStates, parseResult.data);
      continue;
    }
    const requiredFields = parseResult.error.issues.filter((issue2) => issue2.code === "invalid_type").map((issue2) => `  - ${issue2.path.join(".")}: Required`).join("\n");
    throw new Error(`Middleware "${middleware.name}" has required state fields that must be initialized:
${requiredFields}

To fix this, either:
1. Provide default values in your middleware's state schema using .default():
   stateSchema: z.object({
     myField: z.string().default("default value")
   })

2. Or make the fields optional using .optional():
   stateSchema: z.object({
     myField: z.string().optional()
   })

3. Or ensure you pass these values when invoking the agent:
   agent.invoke({
     messages: [...],
     ${parseResult.error.issues[0]?.path.join(".")}: "value"
   })`);
  }
  return middlewareStates;
}
function derivePrivateState(stateSchema2) {
  const builtInStateSchema = {
    messages: custom(() => []),
    structuredResponse: any().optional()
  };
  if (!stateSchema2) return object(builtInStateSchema);
  let shape;
  if (langgraph.StateSchema.isInstance(stateSchema2)) {
    shape = {};
    for (const [key, field] of Object.entries(stateSchema2.fields)) if (langgraph.ReducedValue.isInstance(field)) shape[key] = field.inputSchema || field.valueSchema;
    else shape[key] = field;
  } else shape = stateSchema2.shape;
  const privateShape = { ...builtInStateSchema };
  for (const [key, value] of Object.entries(shape)) if (key.startsWith("_")) privateShape[key] = value.optional();
  else privateShape[key] = value;
  return object(privateShape);
}
function toPartialZodObject(schema) {
  if (types.isInteropZodObject(schema)) return types.interopZodObjectPartial(schema);
  if (langgraph.StateSchema.isInstance(schema)) {
    const partialShape = {};
    for (const [key, field] of Object.entries(schema.fields)) {
      let fieldSchema;
      if (langgraph.ReducedValue.isInstance(field)) fieldSchema = field.inputSchema || field.valueSchema;
      else fieldSchema = field;
      partialShape[key] = types.isZodSchemaV4(fieldSchema) ? fieldSchema.optional() : any().optional();
    }
    return object(partialShape);
  }
  return object({});
}
function parseJumpToTarget(target) {
  if (!target) return void 0;
  if ([
    "model_request",
    "tools",
    langgraph.END
  ].includes(target)) return target;
  if (target === "model") return "model_request";
  if (target === "tools") return "tools";
  if (target === "end") return langgraph.END;
  throw new Error(`Invalid jump target: ${target}, must be "model", "tools" or "end".`);
}
function mergeAbortSignals(...signals) {
  return AbortSignal.any(signals.filter((maybeSignal) => maybeSignal !== null && maybeSignal !== void 0 && typeof maybeSignal === "object" && "aborted" in maybeSignal && typeof maybeSignal.aborted === "boolean"));
}
var RunnableCallable = class extends runnables.Runnable {
  lc_namespace = ["langgraph"];
  func;
  tags;
  config;
  trace = true;
  recurse = true;
  #state;
  constructor(fields) {
    super();
    this.name = fields.name ?? fields.func.name;
    this.func = fields.func;
    this.config = fields.tags ? { tags: fields.tags } : void 0;
    this.recurse = fields.recurse ?? this.recurse;
  }
  getState() {
    return this.#state;
  }
  /**
  * This allows us to set the state of the runnable, e.g. for model and middleware nodes.
  * @internal
  */
  setState(state) {
    this.#state = {
      ...this.#state,
      ...state
    };
  }
  async invoke(input, options) {
    const mergedConfig = runnables.mergeConfigs(this.config, options);
    const returnValue = await singletons.AsyncLocalStorageProviderSingleton.runWithConfig(mergedConfig, async () => this.func(input, mergedConfig));
    if (runnables.Runnable.isRunnable(returnValue) && this.recurse) return await singletons.AsyncLocalStorageProviderSingleton.runWithConfig(mergedConfig, async () => returnValue.invoke(input, mergedConfig));
    this.#state = returnValue;
    return returnValue;
  }
};
function withAgentName(model, agentNameMode) {
  let processInputMessage;
  let processOutputMessage;
  if (agentNameMode === "inline") {
    processInputMessage = _addInlineAgentName;
    processOutputMessage = _removeInlineAgentName;
  } else throw new Error(`Invalid agent name mode: ${agentNameMode}. Needs to be one of: "inline"`);
  function processInputMessages(messages2) {
    return messages2.map(processInputMessage);
  }
  return runnables.RunnableSequence.from([
    runnables.RunnableLambda.from(processInputMessages),
    model,
    runnables.RunnableLambda.from(processOutputMessage)
  ]);
}
function isInternalModelResponse(response) {
  return messages.AIMessage.isInstance(response) || typeof response === "object" && response !== null && "structuredResponse" in response && "messages" in response;
}
const AGENT_NODE_NAME = "model_request";
var AgentNode = class extends RunnableCallable {
  #options;
  #systemMessage;
  #currentSystemMessage;
  constructor(options) {
    super({
      name: options.name ?? "model",
      func: (input, config2) => this.#run(input, config2)
    });
    this.#options = options;
    this.#systemMessage = options.systemMessage;
  }
  /**
  * Returns response format primtivies based on given model and response format provided by the user.
  *
  * If the user selects a tool output:
  * - return a record of tools to extract structured output from the model's response
  *
  * if the the user selects a native schema output or if the model supports JSON schema output:
  * - return a provider strategy to extract structured output from the model's response
  *
  * @param model - The model to get the response format for.
  * @returns The response format.
  */
  #getResponseFormat(model) {
    if (!this.#options.responseFormat) return void 0;
    const strategies = transformResponseFormat(this.#options.responseFormat, void 0, model);
    const isProviderStrategy = strategies.every((format) => format instanceof ProviderStrategy);
    if (!isProviderStrategy) return {
      type: "tool",
      tools: strategies.filter((format) => format instanceof ToolStrategy).reduce((acc, format) => {
        acc[format.name] = format;
        return acc;
      }, {})
    };
    return {
      type: "native",
      strategy: strategies[0]
    };
  }
  async #run(state, config2) {
    const lastMessage = state.messages.at(-1);
    if (lastMessage && messages.ToolMessage.isInstance(lastMessage) && lastMessage.name && this.#options.shouldReturnDirect.has(lastMessage.name))
      return { messages: [] };
    const response = await this.#invokeModel(state, config2);
    if ("structuredResponse" in response) return {
      messages: [...state.messages, ...response.messages || []],
      structuredResponse: response.structuredResponse
    };
    if (response instanceof langgraph.Command) return response;
    response.name = this.name;
    response.lc_kwargs.name = this.name;
    if (this.#areMoreStepsNeeded(state, response)) return { messages: [new messages.AIMessage({
      content: "Sorry, need more steps to process this request.",
      name: this.name,
      id: response.id
    })] };
    return { messages: [response] };
  }
  /**
  * Derive the model from the options.
  * @param state - The state of the agent.
  * @param config - The config of the agent.
  * @returns The model.
  */
  #deriveModel() {
    if (typeof this.#options.model === "string") return initChatModel(this.#options.model);
    if (this.#options.model) return this.#options.model;
    throw new Error("No model option was provided, either via `model` option.");
  }
  async #invokeModel(state, config2, options = {}) {
    const model = await this.#deriveModel();
    const lgConfig = config2;
    const baseHandler = async (request) => {
      validateLLMHasNoBoundTools(request.model);
      const structuredResponseFormat = this.#getResponseFormat(request.model);
      const modelWithTools = await this.#bindTools(request.model, request, structuredResponseFormat);
      const messages2 = [...this.#currentSystemMessage.text === "" ? [] : [this.#currentSystemMessage], ...request.messages];
      const signal = mergeAbortSignals(this.#options.signal, config2.signal);
      const response = await runnables.raceWithSignal(modelWithTools.invoke(messages2, {
        ...config2,
        signal
      }), signal);
      if (structuredResponseFormat?.type === "native") {
        const structuredResponse = structuredResponseFormat.strategy.parse(response);
        if (structuredResponse) return {
          structuredResponse,
          messages: [response]
        };
        return response;
      }
      if (!structuredResponseFormat || !response.tool_calls) return response;
      const toolCalls = response.tool_calls.filter((call) => call.name in structuredResponseFormat.tools);
      if (toolCalls.length === 0) return response;
      if (toolCalls.length > 1) return this.#handleMultipleStructuredOutputs(response, toolCalls, structuredResponseFormat);
      const toolStrategy2 = structuredResponseFormat.tools[toolCalls[0].name];
      const toolMessageContent = toolStrategy2?.options?.toolMessageContent;
      return this.#handleSingleStructuredOutput(response, toolCalls[0], structuredResponseFormat, toolMessageContent ?? options.lastMessage);
    };
    const wrapperMiddleware = this.#options.wrapModelCallHookMiddleware ?? [];
    let wrappedHandler = baseHandler;
    for (let i = wrapperMiddleware.length - 1; i >= 0; i--) {
      const [middleware, getMiddlewareState] = wrapperMiddleware[i];
      if (middleware.wrapModelCall) {
        const innerHandler = wrappedHandler;
        const currentMiddleware = middleware;
        const currentGetState = getMiddlewareState;
        wrappedHandler = async (request) => {
          const context2 = currentMiddleware.contextSchema ? types.interopParse(currentMiddleware.contextSchema, lgConfig?.context || {}) : lgConfig?.context;
          const runtime = Object.freeze({
            context: context2,
            writer: lgConfig.writer,
            interrupt: lgConfig.interrupt,
            signal: lgConfig.signal
          });
          const requestWithStateAndRuntime = {
            ...request,
            state: {
              ...middleware.stateSchema ? types.interopParse(toPartialZodObject(middleware.stateSchema), state) : {},
              ...currentGetState(),
              messages: state.messages
            },
            runtime
          };
          const handlerWithValidation = async (req) => {
            const modifiedTools = req.tools ?? [];
            const newTools = modifiedTools.filter((tool) => isClientTool(tool) && !this.#options.toolClasses.some((t) => t.name === tool.name));
            if (newTools.length > 0) throw new Error(`You have added a new tool in "wrapModelCall" hook of middleware "${currentMiddleware.name}": ${newTools.map((tool) => tool.name).join(", ")}. This is not supported.`);
            const invalidTools = modifiedTools.filter((tool) => isClientTool(tool) && this.#options.toolClasses.every((t) => t !== tool));
            if (invalidTools.length > 0) throw new Error(`You have modified a tool in "wrapModelCall" hook of middleware "${currentMiddleware.name}": ${invalidTools.map((tool) => tool.name).join(", ")}. This is not supported.`);
            let normalizedReq = req;
            const hasSystemPromptChanged = req.systemPrompt !== this.#currentSystemMessage.text;
            const hasSystemMessageChanged = req.systemMessage !== this.#currentSystemMessage;
            if (hasSystemPromptChanged && hasSystemMessageChanged) throw new Error("Cannot change both systemPrompt and systemMessage in the same request.");
            if (hasSystemPromptChanged) {
              this.#currentSystemMessage = new messages.SystemMessage({ content: [{
                type: "text",
                text: req.systemPrompt
              }] });
              normalizedReq = {
                ...req,
                systemPrompt: this.#currentSystemMessage.text,
                systemMessage: this.#currentSystemMessage
              };
            }
            if (hasSystemMessageChanged) {
              this.#currentSystemMessage = new messages.SystemMessage({ ...req.systemMessage });
              normalizedReq = {
                ...req,
                systemPrompt: this.#currentSystemMessage.text,
                systemMessage: this.#currentSystemMessage
              };
            }
            return innerHandler(normalizedReq);
          };
          if (!currentMiddleware.wrapModelCall) return handlerWithValidation(requestWithStateAndRuntime);
          try {
            const middlewareResponse = await currentMiddleware.wrapModelCall(requestWithStateAndRuntime, handlerWithValidation);
            if (!isInternalModelResponse(middlewareResponse)) throw new Error(`Invalid response from "wrapModelCall" in middleware "${currentMiddleware.name}": expected AIMessage, got ${typeof middlewareResponse}`);
            return middlewareResponse;
          } catch (error) {
            throw MiddlewareError.wrap(error, currentMiddleware.name);
          }
        };
      }
    }
    this.#currentSystemMessage = this.#systemMessage;
    const initialRequest = {
      model,
      systemPrompt: this.#currentSystemMessage?.text,
      systemMessage: this.#currentSystemMessage,
      messages: state.messages,
      tools: this.#options.toolClasses,
      state,
      runtime: Object.freeze({
        context: lgConfig?.context,
        writer: lgConfig.writer,
        interrupt: lgConfig.interrupt,
        signal: lgConfig.signal
      })
    };
    return wrappedHandler(initialRequest);
  }
  /**
  * If the model returns multiple structured outputs, we need to handle it.
  * @param response - The response from the model
  * @param toolCalls - The tool calls that were made
  * @returns The response from the model
  */
  #handleMultipleStructuredOutputs(response, toolCalls, responseFormat) {
    const multipleStructuredOutputsError = new MultipleStructuredOutputsError(toolCalls.map((call) => call.name));
    return this.#handleToolStrategyError(multipleStructuredOutputsError, response, toolCalls[0], responseFormat);
  }
  /**
  * If the model returns a single structured output, we need to handle it.
  * @param toolCall - The tool call that was made
  * @returns The structured response and a message to the LLM if needed
  */
  #handleSingleStructuredOutput(response, toolCall, responseFormat, lastMessage) {
    const tool = responseFormat.tools[toolCall.name];
    try {
      const structuredResponse = tool.parse(toolCall.args);
      return {
        structuredResponse,
        messages: [
          response,
          new messages.ToolMessage({
            tool_call_id: toolCall.id ?? "",
            content: JSON.stringify(structuredResponse),
            name: toolCall.name
          }),
          new messages.AIMessage(lastMessage ?? `Returning structured response: ${JSON.stringify(structuredResponse)}`)
        ]
      };
    } catch (error) {
      return this.#handleToolStrategyError(error, response, toolCall, responseFormat);
    }
  }
  async #handleToolStrategyError(error, response, toolCall, responseFormat) {
    const errorHandler = Object.values(responseFormat.tools).at(0)?.options?.handleError;
    const toolCallId = toolCall.id;
    if (!toolCallId) throw new Error("Tool call ID is required to handle tool output errors. Please provide a tool call ID.");
    if (errorHandler === false) throw error;
    if (errorHandler === void 0 || typeof errorHandler === "boolean" && errorHandler || Array.isArray(errorHandler) && errorHandler.some((h) => h instanceof MultipleStructuredOutputsError)) return new langgraph.Command({
      update: { messages: [response, new messages.ToolMessage({
        content: error.message,
        tool_call_id: toolCallId
      })] },
      goto: AGENT_NODE_NAME
    });
    if (typeof errorHandler === "string") return new langgraph.Command({
      update: { messages: [response, new messages.ToolMessage({
        content: errorHandler,
        tool_call_id: toolCallId
      })] },
      goto: AGENT_NODE_NAME
    });
    if (typeof errorHandler === "function") {
      const content = await errorHandler(error);
      if (typeof content !== "string") throw new Error("Error handler must return a string.");
      return new langgraph.Command({
        update: { messages: [response, new messages.ToolMessage({
          content,
          tool_call_id: toolCallId
        })] },
        goto: AGENT_NODE_NAME
      });
    }
    return new langgraph.Command({
      update: { messages: [response, new messages.ToolMessage({
        content: error.message,
        tool_call_id: toolCallId
      })] },
      goto: AGENT_NODE_NAME
    });
  }
  #areMoreStepsNeeded(state, response) {
    const allToolsReturnDirect = messages.AIMessage.isInstance(response) && response.tool_calls?.every((call) => this.#options.shouldReturnDirect.has(call.name));
    const remainingSteps = "remainingSteps" in state ? state.remainingSteps : void 0;
    return Boolean(remainingSteps && (remainingSteps < 1 && allToolsReturnDirect || remainingSteps < 2 && hasToolCalls(state.messages.at(-1))));
  }
  async #bindTools(model, preparedOptions, structuredResponseFormat) {
    const options = {};
    const structuredTools = Object.values(structuredResponseFormat && "tools" in structuredResponseFormat ? structuredResponseFormat.tools : {});
    const allTools = [...preparedOptions?.tools ?? this.#options.toolClasses, ...structuredTools.map((toolStrategy2) => toolStrategy2.tool)];
    const toolChoice = preparedOptions?.toolChoice || (structuredTools.length > 0 ? "any" : void 0);
    if (structuredResponseFormat?.type === "native") {
      const resolvedStrict = preparedOptions?.modelSettings?.strict ?? structuredResponseFormat?.strategy?.strict ?? true;
      const jsonSchemaParams = {
        name: structuredResponseFormat.strategy.schema?.name ?? "extract",
        description: types.getSchemaDescription(structuredResponseFormat.strategy.schema),
        schema: structuredResponseFormat.strategy.schema,
        strict: resolvedStrict
      };
      Object.assign(options, {
        response_format: {
          type: "json_schema",
          json_schema: jsonSchemaParams
        },
        output_format: {
          type: "json_schema",
          schema: structuredResponseFormat.strategy.schema
        },
        headers: { "anthropic-beta": "structured-outputs-2025-11-13" },
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: structuredResponseFormat.strategy.schema
        },
        strict: resolvedStrict
      });
    }
    const modelWithTools = await bindTools(model, allTools, {
      ...options,
      ...preparedOptions?.modelSettings,
      tool_choice: toolChoice
    });
    const modelRunnable = this.#options.includeAgentName === "inline" ? withAgentName(modelWithTools, this.#options.includeAgentName) : modelWithTools;
    return modelRunnable;
  }
  getState() {
    const state = super.getState();
    const origState = state && !(state instanceof langgraph.Command) ? state : {};
    return {
      messages: [],
      ...origState
    };
  }
};
const getInvalidToolError = (toolName, availableTools) => `Error: ${toolName} is not a valid tool, try one of [${availableTools.join(", ")}].`;
const TOOLS_NODE_NAME = "tools";
const isBaseMessageArray = (input) => Array.isArray(input) && input.every(messages.BaseMessage.isInstance);
const isMessagesState = (input) => typeof input === "object" && input != null && "messages" in input && isBaseMessageArray(input.messages);
const isSendInput = (input) => typeof input === "object" && input != null && "lg_tool_call" in input;
function defaultHandleToolErrors(error, toolCall) {
  if (error instanceof ToolInvocationError) return new messages.ToolMessage({
    content: error.message,
    tool_call_id: toolCall.id,
    name: toolCall.name
  });
  return new messages.ToolMessage({
    content: `${error}
 Please fix your mistakes.`,
    tool_call_id: toolCall.id,
    name: toolCall.name
  });
}
var ToolNode = class extends RunnableCallable {
  tools;
  trace = false;
  signal;
  handleToolErrors = defaultHandleToolErrors;
  wrapToolCall;
  constructor(tools2, options) {
    const { name, tags, handleToolErrors, signal, wrapToolCall: wrapToolCall2 } = options ?? {};
    super({
      name,
      tags,
      func: (state, config2) => this.run(state, config2)
    });
    this.options = options;
    this.tools = tools2;
    this.handleToolErrors = handleToolErrors ?? this.handleToolErrors;
    this.signal = signal;
    this.wrapToolCall = wrapToolCall2;
  }
  /**
  * Handle errors from tool execution or middleware.
  * @param error - The error to handle
  * @param call - The tool call that caused the error
  * @param isMiddlewareError - Whether the error came from wrapToolCall middleware
  * @returns ToolMessage if error is handled, otherwise re-throws
  */
  #handleError(error, call, isMiddlewareError) {
    if (langgraph.isGraphInterrupt(error)) throw error;
    if (this.signal?.aborted) throw error;
    if (isMiddlewareError && this.handleToolErrors !== true) throw error;
    if (!this.handleToolErrors) throw error;
    if (typeof this.handleToolErrors === "function") {
      const result = this.handleToolErrors(error, call);
      if (result && messages.ToolMessage.isInstance(result)) return result;
      throw error;
    } else if (this.handleToolErrors) return new messages.ToolMessage({
      name: call.name,
      content: `${error}
 Please fix your mistakes.`,
      tool_call_id: call.id
    });
    throw error;
  }
  async runTool(call, config2, state) {
    const lgConfig = config2;
    const runtime = {
      context: lgConfig?.context,
      writer: lgConfig?.writer,
      interrupt: lgConfig?.interrupt,
      signal: lgConfig?.signal
    };
    const registeredTool = this.tools.find((t) => t.name === call.name);
    const baseHandler = async (request$1) => {
      const { toolCall, tool: requestTool } = request$1;
      const tool$1 = requestTool ?? this.tools.find((t) => t.name === toolCall.name);
      if (tool$1 === void 0) {
        const availableTools = this.tools.map((t) => t.name);
        return new messages.ToolMessage({
          content: getInvalidToolError(toolCall.name, availableTools),
          tool_call_id: toolCall.id,
          name: toolCall.name,
          status: "error"
        });
      }
      const invokableTool = tool$1;
      try {
        const output = await invokableTool.invoke({
          ...toolCall,
          type: "tool_call"
        }, {
          ...config2,
          config: config2,
          toolCallId: toolCall.id,
          state: config2.configurable?.__pregel_scratchpad?.currentTaskInput,
          signal: mergeAbortSignals(this.signal, config2.signal)
        });
        if (messages.ToolMessage.isInstance(output) || langgraph.isCommand(output)) return output;
        return new messages.ToolMessage({
          name: invokableTool.name,
          content: typeof output === "string" ? output : JSON.stringify(output),
          tool_call_id: toolCall.id
        });
      } catch (e) {
        if (e instanceof tools.ToolInputParsingException) throw new ToolInvocationError(e, toolCall);
        throw e;
      }
    };
    const request = {
      toolCall: call,
      tool: registeredTool,
      state,
      runtime
    };
    if (this.wrapToolCall) try {
      return await this.wrapToolCall(request, baseHandler);
    } catch (e) {
      return this.#handleError(e, call, true);
    }
    if (!registeredTool) {
      const availableTools = this.tools.map((t) => t.name);
      return new messages.ToolMessage({
        content: getInvalidToolError(call.name, availableTools),
        tool_call_id: call.id,
        name: call.name,
        status: "error"
      });
    }
    try {
      return await baseHandler(request);
    } catch (e) {
      return this.#handleError(e, call, false);
    }
  }
  async run(state, config2) {
    let outputs;
    if (isSendInput(state)) {
      const { lg_tool_call: _, jumpTo: __, ...newState } = state;
      outputs = [await this.runTool(state.lg_tool_call, config2, newState)];
    } else {
      let messages$1;
      if (isBaseMessageArray(state)) messages$1 = state;
      else if (isMessagesState(state)) messages$1 = state.messages;
      else throw new Error("ToolNode only accepts BaseMessage[] or { messages: BaseMessage[] } as input.");
      const toolMessageIds = new Set(messages$1.filter((msg) => msg.getType() === "tool").map((msg) => msg.tool_call_id));
      let aiMessage;
      for (let i = messages$1.length - 1; i >= 0; i -= 1) {
        const message = messages$1[i];
        if (messages.AIMessage.isInstance(message)) {
          aiMessage = message;
          break;
        }
      }
      if (!messages.AIMessage.isInstance(aiMessage)) throw new Error("ToolNode only accepts AIMessages as input.");
      outputs = await Promise.all(aiMessage.tool_calls?.filter((call) => call.id == null || !toolMessageIds.has(call.id)).map((call) => this.runTool(call, config2, state)) ?? []);
    }
    if (!outputs.some(langgraph.isCommand)) return Array.isArray(state) ? outputs : { messages: outputs };
    const combinedOutputs = [];
    let parentCommand = null;
    for (const output of outputs) if (langgraph.isCommand(output)) if (output.graph === langgraph.Command.PARENT && Array.isArray(output.goto) && output.goto.every((send) => isSend(send))) if (parentCommand) parentCommand.goto.push(...output.goto);
    else parentCommand = new langgraph.Command({
      graph: langgraph.Command.PARENT,
      goto: output.goto
    });
    else combinedOutputs.push(output);
    else combinedOutputs.push(Array.isArray(state) ? [output] : { messages: [output] });
    if (parentCommand) combinedOutputs.push(parentCommand);
    return combinedOutputs;
  }
};
function isSend(x) {
  return x instanceof langgraph.Send;
}
var AgentContext = class {
};
var AgentRuntime = class {
};
var MiddlewareNode = class extends RunnableCallable {
  #options;
  constructor(fields, options) {
    super(fields);
    this.#options = options;
  }
  async invokeMiddleware(invokeState, config2) {
    let filteredContext = {};
    if (this.middleware.contextSchema) {
      const schemaShape = this.middleware.contextSchema?.shape;
      if (schemaShape) {
        const relevantContext = {};
        const invokeContext = config2?.context || {};
        for (const key of Object.keys(schemaShape)) if (key in invokeContext) relevantContext[key] = invokeContext[key];
        filteredContext = types.interopParse(this.middleware.contextSchema, relevantContext);
      }
    }
    const state = {
      ...this.#options.getState(),
      ...invokeState,
      messages: invokeState.messages
    };
    const runtime = {
      context: filteredContext,
      writer: config2?.writer,
      interrupt: config2?.interrupt,
      signal: config2?.signal
    };
    const result = await this.runHook(
      state,
      /**
      * assign runtime and context values into empty named class
      * instances to create a better error message.
      */
      Object.freeze(Object.assign(new AgentRuntime(), {
        ...runtime,
        context: Object.freeze(Object.assign(new AgentContext(), filteredContext))
      }))
    );
    if (!result) return {
      ...state,
      jumpTo: void 0
    };
    let jumpToConstraint;
    let constraint;
    if (this.name?.startsWith("BeforeAgentNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.beforeAgent);
      constraint = "beforeAgent.canJumpTo";
    } else if (this.name?.startsWith("BeforeModelNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.beforeModel);
      constraint = "beforeModel.canJumpTo";
    } else if (this.name?.startsWith("AfterAgentNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.afterAgent);
      constraint = "afterAgent.canJumpTo";
    } else if (this.name?.startsWith("AfterModelNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.afterModel);
      constraint = "afterModel.canJumpTo";
    }
    if (typeof result.jumpTo === "string" && !jumpToConstraint?.includes(result.jumpTo)) {
      const suggestion = jumpToConstraint && jumpToConstraint.length > 0 ? `must be one of: ${jumpToConstraint?.join(", ")}.` : constraint ? `no ${constraint} defined in middleware ${this.middleware.name}` : "";
      throw new Error(`Invalid jump target: ${result.jumpTo}, ${suggestion}.`);
    }
    if (typeof result === "object" && "type" in result) {
      if (result.type === "terminate") {
        if (result.error) throw result.error;
        return {
          ...state,
          ...result.result || {},
          jumpTo: result.jumpTo
        };
      }
      throw new Error(`Invalid control action: ${JSON.stringify(result)}`);
    }
    return {
      ...state,
      ...result,
      jumpTo: result.jumpTo
    };
  }
  get nodeOptions() {
    return { input: derivePrivateState(this.middleware.stateSchema) };
  }
};
var BeforeAgentNode = class extends MiddlewareNode {
  lc_namespace = [
    "langchain",
    "agents",
    "beforeAgentNodes"
  ];
  constructor(middleware, options) {
    super({
      name: `BeforeAgentNode_${middleware.name}`,
      func: async (state, config2) => this.invokeMiddleware(state, config2)
    }, options);
    this.middleware = middleware;
  }
  runHook(state, runtime) {
    const fn = getHookFunction(this.middleware.beforeAgent);
    return fn(state, runtime);
  }
};
var BeforeModelNode = class extends MiddlewareNode {
  lc_namespace = [
    "langchain",
    "agents",
    "beforeModelNodes"
  ];
  constructor(middleware, options) {
    super({
      name: `BeforeModelNode_${middleware.name}`,
      func: async (state, config2) => this.invokeMiddleware(state, config2)
    }, options);
    this.middleware = middleware;
  }
  runHook(state, runtime) {
    const fn = getHookFunction(this.middleware.beforeModel);
    return fn(state, runtime);
  }
};
var AfterModelNode = class extends MiddlewareNode {
  lc_namespace = [
    "langchain",
    "agents",
    "afterModelNodes"
  ];
  constructor(middleware, options) {
    super({
      name: `AfterModelNode_${middleware.name}`,
      func: async (state, config2) => this.invokeMiddleware(state, config2)
    }, options);
    this.middleware = middleware;
  }
  runHook(state, runtime) {
    const fn = getHookFunction(this.middleware.afterModel);
    return fn(state, runtime);
  }
};
var AfterAgentNode = class extends MiddlewareNode {
  lc_namespace = [
    "langchain",
    "agents",
    "afterAgentNodes"
  ];
  constructor(middleware, options) {
    super({
      name: `AfterAgentNode_${middleware.name}`,
      func: async (state, config2) => this.invokeMiddleware(state, config2)
    }, options);
    this.middleware = middleware;
  }
  runHook(state, runtime) {
    const fn = getHookFunction(this.middleware.afterAgent);
    return fn(state, runtime);
  }
};
var StateManager = class {
  #nodes = /* @__PURE__ */ new Map();
  /**
  * Add node to middleware group.
  * @param name - The name of the middleware group.
  * @param node - The node to add.
  */
  addNode(middleware, node) {
    this.#nodes.set(middleware.name, [...this.#nodes.get(middleware.name) ?? [], node]);
  }
  /**
  * Get the state of a middleware group.
  * @param name - The name of the middleware group.
  * @returns The state of the middleware group.
  */
  getState(name) {
    const middlewareNodes = this.#nodes.get(name) ?? [];
    const state = middlewareNodes.reduce((prev, node) => {
      return {
        ...prev,
        ...node.getState() ?? {}
      };
    }, {});
    delete state.jumpTo;
    return state;
  }
};
var ReactAgent = class ReactAgent2 {
  #graph;
  #toolBehaviorVersion = "v2";
  #agentNode;
  #stateManager = new StateManager();
  #defaultConfig;
  constructor(options, defaultConfig) {
    this.options = options;
    this.#defaultConfig = defaultConfig ?? {};
    this.#toolBehaviorVersion = options.version ?? this.#toolBehaviorVersion;
    if (!options.model) throw new Error("`model` option is required to create an agent.");
    if (typeof options.model !== "string") validateLLMHasNoBoundTools(options.model);
    const middlewareTools = this.options.middleware?.filter((m) => m.tools).flatMap((m) => m.tools) ?? [];
    const toolClasses = [...options.tools ?? [], ...middlewareTools];
    const shouldReturnDirect = new Set(toolClasses.filter(isClientTool).filter((tool) => "returnDirect" in tool && tool.returnDirect).map((tool) => tool.name));
    const { state, input, output } = createAgentState(this.options.responseFormat !== void 0, this.options.stateSchema, this.options.middleware);
    const workflow = new langgraph.StateGraph(state, {
      input,
      output,
      context: this.options.contextSchema
    });
    const allNodeWorkflows = workflow;
    const beforeAgentNodes = [];
    const beforeModelNodes = [];
    const afterModelNodes = [];
    const afterAgentNodes = [];
    const wrapModelCallHookMiddleware = [];
    this.#agentNode = new AgentNode({
      model: this.options.model,
      systemMessage: normalizeSystemPrompt(this.options.systemPrompt),
      includeAgentName: this.options.includeAgentName,
      name: this.options.name,
      responseFormat: this.options.responseFormat,
      middleware: this.options.middleware,
      toolClasses,
      shouldReturnDirect,
      signal: this.options.signal,
      wrapModelCallHookMiddleware
    });
    const middlewareNames = /* @__PURE__ */ new Set();
    const middleware = this.options.middleware ?? [];
    for (let i = 0; i < middleware.length; i++) {
      let beforeAgentNode;
      let beforeModelNode;
      let afterModelNode;
      let afterAgentNode;
      const m = middleware[i];
      if (middlewareNames.has(m.name)) throw new Error(`Middleware ${m.name} is defined multiple times`);
      middlewareNames.add(m.name);
      if (m.beforeAgent) {
        beforeAgentNode = new BeforeAgentNode(m, { getState: () => this.#stateManager.getState(m.name) });
        this.#stateManager.addNode(m, beforeAgentNode);
        const name = `${m.name}.before_agent`;
        beforeAgentNodes.push({
          index: i,
          name,
          allowed: getHookConstraint(m.beforeAgent)
        });
        allNodeWorkflows.addNode(name, beforeAgentNode, beforeAgentNode.nodeOptions);
      }
      if (m.beforeModel) {
        beforeModelNode = new BeforeModelNode(m, { getState: () => this.#stateManager.getState(m.name) });
        this.#stateManager.addNode(m, beforeModelNode);
        const name = `${m.name}.before_model`;
        beforeModelNodes.push({
          index: i,
          name,
          allowed: getHookConstraint(m.beforeModel)
        });
        allNodeWorkflows.addNode(name, beforeModelNode, beforeModelNode.nodeOptions);
      }
      if (m.afterModel) {
        afterModelNode = new AfterModelNode(m, { getState: () => this.#stateManager.getState(m.name) });
        this.#stateManager.addNode(m, afterModelNode);
        const name = `${m.name}.after_model`;
        afterModelNodes.push({
          index: i,
          name,
          allowed: getHookConstraint(m.afterModel)
        });
        allNodeWorkflows.addNode(name, afterModelNode, afterModelNode.nodeOptions);
      }
      if (m.afterAgent) {
        afterAgentNode = new AfterAgentNode(m, { getState: () => this.#stateManager.getState(m.name) });
        this.#stateManager.addNode(m, afterAgentNode);
        const name = `${m.name}.after_agent`;
        afterAgentNodes.push({
          index: i,
          name,
          allowed: getHookConstraint(m.afterAgent)
        });
        allNodeWorkflows.addNode(name, afterAgentNode, afterAgentNode.nodeOptions);
      }
      if (m.wrapModelCall) wrapModelCallHookMiddleware.push([m, () => this.#stateManager.getState(m.name)]);
    }
    allNodeWorkflows.addNode(AGENT_NODE_NAME, this.#agentNode);
    const hasWrapToolCallMiddleware = middleware.some((m) => m.wrapToolCall);
    const clientTools = toolClasses.filter(isClientTool);
    if (clientTools.length > 0 || hasWrapToolCallMiddleware) {
      const toolNode = new ToolNode(clientTools, {
        signal: this.options.signal,
        wrapToolCall: wrapToolCall(middleware)
      });
      allNodeWorkflows.addNode(TOOLS_NODE_NAME, toolNode);
    }
    let entryNode;
    if (beforeAgentNodes.length > 0) entryNode = beforeAgentNodes[0].name;
    else if (beforeModelNodes.length > 0) entryNode = beforeModelNodes[0].name;
    else entryNode = AGENT_NODE_NAME;
    const loopEntryNode = beforeModelNodes.length > 0 ? beforeModelNodes[0].name : AGENT_NODE_NAME;
    const exitNode = afterAgentNodes.length > 0 ? afterAgentNodes[afterAgentNodes.length - 1].name : langgraph.END;
    allNodeWorkflows.addEdge(langgraph.START, entryNode);
    const hasToolsAvailable = clientTools.length > 0 || hasWrapToolCallMiddleware;
    for (let i = 0; i < beforeAgentNodes.length; i++) {
      const node = beforeAgentNodes[i];
      const current = node.name;
      const isLast = i === beforeAgentNodes.length - 1;
      const nextDefault = isLast ? loopEntryNode : beforeAgentNodes[i + 1].name;
      if (node.allowed && node.allowed.length > 0) {
        const allowedMapped = node.allowed.map((t) => parseJumpToTarget(t)).filter((dest) => dest !== TOOLS_NODE_NAME || hasToolsAvailable);
        const destinations = Array.from(/* @__PURE__ */ new Set([nextDefault, ...allowedMapped.map((dest) => dest === langgraph.END ? exitNode : dest)]));
        allNodeWorkflows.addConditionalEdges(current, this.#createBeforeAgentRouter(clientTools, nextDefault, exitNode, hasToolsAvailable), destinations);
      } else allNodeWorkflows.addEdge(current, nextDefault);
    }
    for (let i = 0; i < beforeModelNodes.length; i++) {
      const node = beforeModelNodes[i];
      const current = node.name;
      const isLast = i === beforeModelNodes.length - 1;
      const nextDefault = isLast ? AGENT_NODE_NAME : beforeModelNodes[i + 1].name;
      if (node.allowed && node.allowed.length > 0) {
        const allowedMapped = node.allowed.map((t) => parseJumpToTarget(t)).filter((dest) => dest !== TOOLS_NODE_NAME || hasToolsAvailable);
        const destinations = Array.from(/* @__PURE__ */ new Set([nextDefault, ...allowedMapped]));
        allNodeWorkflows.addConditionalEdges(current, this.#createBeforeModelRouter(clientTools, nextDefault, hasToolsAvailable), destinations);
      } else allNodeWorkflows.addEdge(current, nextDefault);
    }
    const lastAfterModelNode = afterModelNodes.at(-1);
    if (afterModelNodes.length > 0 && lastAfterModelNode) allNodeWorkflows.addEdge(AGENT_NODE_NAME, lastAfterModelNode.name);
    else {
      const modelPaths = this.#getModelPaths(clientTools, false, hasToolsAvailable);
      const destinations = modelPaths.map((p) => p === langgraph.END ? exitNode : p);
      if (destinations.length === 1) allNodeWorkflows.addEdge(AGENT_NODE_NAME, destinations[0]);
      else allNodeWorkflows.addConditionalEdges(AGENT_NODE_NAME, this.#createModelRouter(exitNode), destinations);
    }
    for (let i = afterModelNodes.length - 1; i > 0; i--) {
      const node = afterModelNodes[i];
      const current = node.name;
      const nextDefault = afterModelNodes[i - 1].name;
      if (node.allowed && node.allowed.length > 0) {
        const allowedMapped = node.allowed.map((t) => parseJumpToTarget(t)).filter((dest) => dest !== TOOLS_NODE_NAME || hasToolsAvailable);
        const destinations = Array.from(/* @__PURE__ */ new Set([nextDefault, ...allowedMapped]));
        allNodeWorkflows.addConditionalEdges(current, this.#createAfterModelSequenceRouter(clientTools, node.allowed, nextDefault, hasToolsAvailable), destinations);
      } else allNodeWorkflows.addEdge(current, nextDefault);
    }
    if (afterModelNodes.length > 0) {
      const firstAfterModel = afterModelNodes[0];
      const firstAfterModelNode = firstAfterModel.name;
      const modelPaths = this.#getModelPaths(clientTools, true, hasToolsAvailable).filter((p) => p !== TOOLS_NODE_NAME || hasToolsAvailable);
      const allowJump = Boolean(firstAfterModel.allowed && firstAfterModel.allowed.length > 0);
      const destinations = modelPaths.map((p) => p === langgraph.END ? exitNode : p);
      allNodeWorkflows.addConditionalEdges(firstAfterModelNode, this.#createAfterModelRouter(clientTools, allowJump, exitNode, hasToolsAvailable), destinations);
    }
    for (let i = afterAgentNodes.length - 1; i > 0; i--) {
      const node = afterAgentNodes[i];
      const current = node.name;
      const nextDefault = afterAgentNodes[i - 1].name;
      if (node.allowed && node.allowed.length > 0) {
        const allowedMapped = node.allowed.map((t) => parseJumpToTarget(t)).filter((dest) => dest !== TOOLS_NODE_NAME || hasToolsAvailable);
        const destinations = Array.from(/* @__PURE__ */ new Set([nextDefault, ...allowedMapped]));
        allNodeWorkflows.addConditionalEdges(current, this.#createAfterModelSequenceRouter(clientTools, node.allowed, nextDefault, hasToolsAvailable), destinations);
      } else allNodeWorkflows.addEdge(current, nextDefault);
    }
    if (afterAgentNodes.length > 0) {
      const firstAfterAgent = afterAgentNodes[0];
      const firstAfterAgentNode = firstAfterAgent.name;
      if (firstAfterAgent.allowed && firstAfterAgent.allowed.length > 0) {
        const allowedMapped = firstAfterAgent.allowed.map((t) => parseJumpToTarget(t)).filter((dest) => dest !== TOOLS_NODE_NAME || hasToolsAvailable);
        const destinations = Array.from(/* @__PURE__ */ new Set([langgraph.END, ...allowedMapped]));
        allNodeWorkflows.addConditionalEdges(firstAfterAgentNode, this.#createAfterModelSequenceRouter(clientTools, firstAfterAgent.allowed, langgraph.END, hasToolsAvailable), destinations);
      } else allNodeWorkflows.addEdge(firstAfterAgentNode, langgraph.END);
    }
    if (hasToolsAvailable) {
      const toolReturnTarget = loopEntryNode;
      if (shouldReturnDirect.size > 0) allNodeWorkflows.addConditionalEdges(TOOLS_NODE_NAME, this.#createToolsRouter(shouldReturnDirect, exitNode), [toolReturnTarget, exitNode]);
      else allNodeWorkflows.addEdge(TOOLS_NODE_NAME, toolReturnTarget);
    }
    this.#graph = allNodeWorkflows.compile({
      checkpointer: this.options.checkpointer,
      store: this.options.store,
      name: this.options.name,
      description: this.options.description
    });
  }
  /**
  * Get the compiled {@link https://docs.langchain.com/oss/javascript/langgraph/use-graph-api | StateGraph}.
  */
  get graph() {
    return this.#graph;
  }
  /**
  * Creates a new ReactAgent with the given config merged into the existing config.
  * Follows the same pattern as LangGraph's Pregel.withConfig().
  *
  * The merged config is applied as a default that gets merged with any config
  * passed at invocation time (invoke/stream). Invocation-time config takes precedence.
  *
  * @param config - Configuration to merge with existing config
  * @returns A new ReactAgent instance with the merged configuration
  *
  * @example
  * ```typescript
  * const agent = createAgent({ model: "gpt-4o", tools: [...] });
  *
  * // Set a default recursion limit
  * const configuredAgent = agent.withConfig({ recursionLimit: 1000 });
  *
  * // Chain multiple configs
  * const debugAgent = agent
  *   .withConfig({ recursionLimit: 1000 })
  *   .withConfig({ tags: ["debug"] });
  * ```
  */
  withConfig(config2) {
    return new ReactAgent2(this.options, runnables.mergeConfigs(this.#defaultConfig, config2));
  }
  /**
  * Get possible edge destinations from model node.
  * @param toolClasses names of tools to call
  * @param includeModelRequest whether to include "model_request" as a valid path (for jumpTo routing)
  * @param hasToolsAvailable whether tools are available (includes dynamic tools via middleware)
  * @returns list of possible edge destinations
  */
  #getModelPaths(toolClasses, includeModelRequest = false, hasToolsAvailable = toolClasses.length > 0) {
    const paths = [];
    if (hasToolsAvailable) paths.push(TOOLS_NODE_NAME);
    if (includeModelRequest) paths.push(AGENT_NODE_NAME);
    paths.push(langgraph.END);
    return paths;
  }
  /**
  * Create routing function for tools node conditional edges.
  */
  #createToolsRouter(shouldReturnDirect, exitNode) {
    return (state) => {
      const builtInState = state;
      const messages$1 = builtInState.messages;
      const lastMessage = messages$1[messages$1.length - 1];
      if (messages.ToolMessage.isInstance(lastMessage) && lastMessage.name && shouldReturnDirect.has(lastMessage.name)) return this.options.responseFormat ? AGENT_NODE_NAME : exitNode;
      return AGENT_NODE_NAME;
    };
  }
  /**
  * Create routing function for model node conditional edges.
  * @param exitNode - The exit node to route to (could be after_agent or END)
  */
  #createModelRouter(exitNode = langgraph.END) {
    return (state) => {
      const builtInState = state;
      const messages$1 = builtInState.messages;
      const lastMessage = messages$1.at(-1);
      if (!messages.AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) return exitNode;
      const hasOnlyStructuredResponseCalls = lastMessage.tool_calls.every((toolCall) => toolCall.name.startsWith("extract-"));
      if (hasOnlyStructuredResponseCalls) return exitNode;
      if (this.#toolBehaviorVersion === "v1") return TOOLS_NODE_NAME;
      const regularToolCalls = lastMessage.tool_calls.filter((toolCall) => !toolCall.name.startsWith("extract-"));
      if (regularToolCalls.length === 0) return exitNode;
      return regularToolCalls.map((toolCall) => new langgraph.Send(TOOLS_NODE_NAME, {
        ...state,
        lg_tool_call: toolCall
      }));
    };
  }
  /**
  * Create routing function for jumpTo functionality after afterModel hooks.
  *
  * This router checks if the `jumpTo` property is set in the state after afterModel middleware
  * execution. If set, it routes to the specified target ("model_request" or "tools").
  * If not set, it falls back to the normal model routing logic for afterModel context.
  *
  * The jumpTo property is automatically cleared after use to prevent infinite loops.
  *
  * @param toolClasses - Available tool classes for validation
  * @param allowJump - Whether jumping is allowed
  * @param exitNode - The exit node to route to (could be after_agent or END)
  * @param hasToolsAvailable - Whether tools are available (includes dynamic tools via middleware)
  * @returns Router function that handles jumpTo logic and normal routing
  */
  #createAfterModelRouter(toolClasses, allowJump, exitNode, hasToolsAvailable = toolClasses.length > 0) {
    const hasStructuredResponse = Boolean(this.options.responseFormat);
    return (state) => {
      const builtInState = state;
      const messages$1 = builtInState.messages;
      const lastMessage = messages$1.at(-1);
      if (messages.AIMessage.isInstance(lastMessage) && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) return exitNode;
      if (allowJump && builtInState.jumpTo) {
        const destination = parseJumpToTarget(builtInState.jumpTo);
        if (destination === langgraph.END) return exitNode;
        if (destination === TOOLS_NODE_NAME) {
          if (!hasToolsAvailable) return exitNode;
          return new langgraph.Send(TOOLS_NODE_NAME, {
            ...state,
            jumpTo: void 0
          });
        }
        return new langgraph.Send(AGENT_NODE_NAME, {
          ...state,
          jumpTo: void 0
        });
      }
      const toolMessages = messages$1.filter(messages.ToolMessage.isInstance);
      const lastAiMessage = messages$1.filter(messages.AIMessage.isInstance).at(-1);
      const pendingToolCalls = lastAiMessage?.tool_calls?.filter((call) => !toolMessages.some((m) => m.tool_call_id === call.id));
      if (pendingToolCalls && pendingToolCalls.length > 0) return pendingToolCalls.map((toolCall) => new langgraph.Send(TOOLS_NODE_NAME, {
        ...state,
        lg_tool_call: toolCall
      }));
      const hasStructuredResponseCalls = lastAiMessage?.tool_calls?.some((toolCall) => toolCall.name.startsWith("extract-"));
      if (pendingToolCalls && pendingToolCalls.length === 0 && !hasStructuredResponseCalls && hasStructuredResponse) return AGENT_NODE_NAME;
      if (!messages.AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) return exitNode;
      const hasOnlyStructuredResponseCalls = lastMessage.tool_calls.every((toolCall) => toolCall.name.startsWith("extract-"));
      const hasRegularToolCalls = lastMessage.tool_calls.some((toolCall) => !toolCall.name.startsWith("extract-"));
      if (hasOnlyStructuredResponseCalls || !hasRegularToolCalls) return exitNode;
      return TOOLS_NODE_NAME;
    };
  }
  /**
  * Router for afterModel sequence nodes (connecting later middlewares to earlier ones),
  * honoring allowed jump targets and defaulting to the next node.
  * @param toolClasses - Available tool classes for validation
  * @param allowed - List of allowed jump targets
  * @param nextDefault - Default node to route to
  * @param hasToolsAvailable - Whether tools are available (includes dynamic tools via middleware)
  */
  #createAfterModelSequenceRouter(toolClasses, allowed, nextDefault, hasToolsAvailable = toolClasses.length > 0) {
    const allowedSet = new Set(allowed.map((t) => parseJumpToTarget(t)));
    return (state) => {
      const builtInState = state;
      if (builtInState.jumpTo) {
        const dest = parseJumpToTarget(builtInState.jumpTo);
        if (dest === langgraph.END && allowedSet.has(langgraph.END)) return langgraph.END;
        if (dest === TOOLS_NODE_NAME && allowedSet.has(TOOLS_NODE_NAME)) {
          if (!hasToolsAvailable) return langgraph.END;
          return new langgraph.Send(TOOLS_NODE_NAME, {
            ...state,
            jumpTo: void 0
          });
        }
        if (dest === AGENT_NODE_NAME && allowedSet.has(AGENT_NODE_NAME)) return new langgraph.Send(AGENT_NODE_NAME, {
          ...state,
          jumpTo: void 0
        });
      }
      return nextDefault;
    };
  }
  /**
  * Create routing function for jumpTo functionality after beforeAgent hooks.
  * Falls back to the default next node if no jumpTo is present.
  * When jumping to END, routes to exitNode (which could be an afterAgent node).
  * @param toolClasses - Available tool classes for validation
  * @param nextDefault - Default node to route to
  * @param exitNode - Exit node to route to (could be after_agent or END)
  * @param hasToolsAvailable - Whether tools are available (includes dynamic tools via middleware)
  */
  #createBeforeAgentRouter(toolClasses, nextDefault, exitNode, hasToolsAvailable = toolClasses.length > 0) {
    return (state) => {
      const builtInState = state;
      if (!builtInState.jumpTo) return nextDefault;
      const destination = parseJumpToTarget(builtInState.jumpTo);
      if (destination === langgraph.END)
        return exitNode;
      if (destination === TOOLS_NODE_NAME) {
        if (!hasToolsAvailable) return exitNode;
        return new langgraph.Send(TOOLS_NODE_NAME, {
          ...state,
          jumpTo: void 0
        });
      }
      return new langgraph.Send(AGENT_NODE_NAME, {
        ...state,
        jumpTo: void 0
      });
    };
  }
  /**
  * Create routing function for jumpTo functionality after beforeModel hooks.
  * Falls back to the default next node if no jumpTo is present.
  * @param toolClasses - Available tool classes for validation
  * @param nextDefault - Default node to route to
  * @param hasToolsAvailable - Whether tools are available (includes dynamic tools via middleware)
  */
  #createBeforeModelRouter(toolClasses, nextDefault, hasToolsAvailable = toolClasses.length > 0) {
    return (state) => {
      const builtInState = state;
      if (!builtInState.jumpTo) return nextDefault;
      const destination = parseJumpToTarget(builtInState.jumpTo);
      if (destination === langgraph.END) return langgraph.END;
      if (destination === TOOLS_NODE_NAME) {
        if (!hasToolsAvailable) return langgraph.END;
        return new langgraph.Send(TOOLS_NODE_NAME, {
          ...state,
          jumpTo: void 0
        });
      }
      return new langgraph.Send(AGENT_NODE_NAME, {
        ...state,
        jumpTo: void 0
      });
    };
  }
  /**
  * Initialize middleware states if not already present in the input state.
  */
  async #initializeMiddlewareStates(state, config2) {
    if (!this.options.middleware || this.options.middleware.length === 0 || state instanceof langgraph.Command || !state) return state;
    const defaultStates = await initializeMiddlewareStates(this.options.middleware, state);
    const threadState = await this.#graph.getState(config2).catch(() => ({ values: {} }));
    const updatedState = {
      ...threadState.values,
      ...state
    };
    if (!updatedState) return updatedState;
    for (const [key, value] of Object.entries(defaultStates)) if (!(key in updatedState)) updatedState[key] = value;
    return updatedState;
  }
  /**
  * Executes the agent with the given state and returns the final state after all processing.
  *
  * This method runs the agent's entire workflow synchronously, including:
  * - Processing the input messages through any configured middleware
  * - Calling the language model to generate responses
  * - Executing any tool calls made by the model
  * - Running all middleware hooks (beforeModel, afterModel, etc.)
  *
  * @param state - The initial state for the agent execution. Can be:
  *   - An object containing `messages` array and any middleware-specific state properties
  *   - A Command object for more advanced control flow
  *
  * @param config - Optional runtime configuration including:
  * @param config.context - The context for the agent execution.
  * @param config.configurable - LangGraph configuration options like `thread_id`, `run_id`, etc.
  * @param config.store - The store for the agent execution for persisting state, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/memory#memory-storage | Memory storage}.
  * @param config.signal - An optional {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal | `AbortSignal`} for the agent execution.
  * @param config.recursionLimit - The recursion limit for the agent execution.
  *
  * @returns A Promise that resolves to the final agent state after execution completes.
  *          The returned state includes:
  *          - a `messages` property containing an array with all messages (input, AI responses, tool calls/results)
  *          - a `structuredResponse` property containing the structured response (if configured)
  *          - all state values defined in the middleware
  *
  * @example
  * ```typescript
  * const agent = new ReactAgent({
  *   llm: myModel,
  *   tools: [calculator, webSearch],
  *   responseFormat: z.object({
  *     weather: z.string(),
  *   }),
  * });
  *
  * const result = await agent.invoke({
  *   messages: [{ role: "human", content: "What's the weather in Paris?" }]
  * });
  *
  * console.log(result.structuredResponse.weather); // outputs: "It's sunny and 75°F."
  * ```
  */
  async invoke(state, config2) {
    const mergedConfig = runnables.mergeConfigs(this.#defaultConfig, config2);
    const initializedState = await this.#initializeMiddlewareStates(state, mergedConfig);
    return this.#graph.invoke(initializedState, mergedConfig);
  }
  /**
  * Executes the agent with streaming, returning an async iterable of state updates as they occur.
  *
  * This method runs the agent's workflow similar to `invoke`, but instead of waiting for
  * completion, it streams high-level state updates in real-time. This allows you to:
  * - Display intermediate results to users as they're generated
  * - Monitor the agent's progress through each step
  * - React to state changes as nodes complete
  *
  * For more granular event-level streaming (like individual LLM tokens), use `streamEvents` instead.
  *
  * @param state - The initial state for the agent execution. Can be:
  *   - An object containing `messages` array and any middleware-specific state properties
  *   - A Command object for more advanced control flow
  *
  * @param config - Optional runtime configuration including:
  * @param config.context - The context for the agent execution.
  * @param config.configurable - LangGraph configuration options like `thread_id`, `run_id`, etc.
  * @param config.store - The store for the agent execution for persisting state, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/memory#memory-storage | Memory storage}.
  * @param config.signal - An optional {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal | `AbortSignal`} for the agent execution.
  * @param config.streamMode - The streaming mode for the agent execution, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/streaming#supported-stream-modes | Supported stream modes}.
  * @param config.recursionLimit - The recursion limit for the agent execution.
  *
  * @returns A Promise that resolves to an IterableReadableStream of state updates.
  *          Each update contains the current state after a node completes.
  *
  * @example
  * ```typescript
  * const agent = new ReactAgent({
  *   llm: myModel,
  *   tools: [calculator, webSearch]
  * });
  *
  * const stream = await agent.stream({
  *   messages: [{ role: "human", content: "What's 2+2 and the weather in NYC?" }]
  * });
  *
  * for await (const chunk of stream) {
  *   console.log(chunk); // State update from each node
  * }
  * ```
  */
  async stream(state, config2) {
    const mergedConfig = runnables.mergeConfigs(this.#defaultConfig, config2);
    const initializedState = await this.#initializeMiddlewareStates(state, mergedConfig);
    return this.#graph.stream(initializedState, mergedConfig);
  }
  /**
  * Visualize the graph as a PNG image.
  * @param params - Parameters for the drawMermaidPng method.
  * @param params.withStyles - Whether to include styles in the graph.
  * @param params.curveStyle - The style of the graph's curves.
  * @param params.nodeColors - The colors of the graph's nodes.
  * @param params.wrapLabelNWords - The maximum number of words to wrap in a node's label.
  * @param params.backgroundColor - The background color of the graph.
  * @returns PNG image as a buffer
  */
  async drawMermaidPng(params) {
    const representation = await this.#graph.getGraphAsync();
    const image = await representation.drawMermaidPng(params);
    const arrayBuffer = await image.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    return buffer;
  }
  /**
  * Draw the graph as a Mermaid string.
  * @param params - Parameters for the drawMermaid method.
  * @param params.withStyles - Whether to include styles in the graph.
  * @param params.curveStyle - The style of the graph's curves.
  * @param params.nodeColors - The colors of the graph's nodes.
  * @param params.wrapLabelNWords - The maximum number of words to wrap in a node's label.
  * @param params.backgroundColor - The background color of the graph.
  * @returns Mermaid string
  */
  async drawMermaid(params) {
    const representation = await this.#graph.getGraphAsync();
    return representation.drawMermaid(params);
  }
  /**
  * The following are internal methods to enable support for LangGraph Platform.
  * They are not part of the createAgent public API.
  *
  * Note: we intentionally return as `never` to avoid type errors due to type inference.
  */
  /**
  * @internal
  */
  streamEvents(state, config2, streamOptions) {
    const mergedConfig = runnables.mergeConfigs(this.#defaultConfig, config2);
    return this.#graph.streamEvents(state, {
      ...mergedConfig,
      version: config2?.version ?? "v2"
    }, streamOptions);
  }
  /**
  * @internal
  */
  getGraphAsync(config2) {
    return this.#graph.getGraphAsync(config2);
  }
  /**
  * @internal
  */
  getState(config2, options) {
    return this.#graph.getState(config2, options);
  }
  /**
  * @internal
  */
  getStateHistory(config2, options) {
    return this.#graph.getStateHistory(config2, options);
  }
  /**
  * @internal
  */
  getSubgraphs(namespace, recurse) {
    return this.#graph.getSubgraphs(namespace, recurse);
  }
  /**
  * @internal
  */
  getSubgraphAsync(namespace, recurse) {
    return this.#graph.getSubgraphsAsync(namespace, recurse);
  }
  /**
  * @internal
  */
  updateState(inputConfig, values, asNode) {
    return this.#graph.updateState(inputConfig, values, asNode);
  }
  /**
  * @internal
  */
  get builder() {
    return this.#graph.builder;
  }
};
function createAgent(params) {
  return new ReactAgent(params);
}
const DescriptionFunctionSchema = functionType().args(custom$1(), custom$1(), custom$1()).returns(unionType([stringType(), promiseType(stringType())]));
const ALLOWED_DECISIONS = [
  "approve",
  "edit",
  "reject"
];
const DecisionType = enumType(ALLOWED_DECISIONS);
const InterruptOnConfigSchema = objectType({
  allowedDecisions: arrayType(DecisionType),
  description: unionType([stringType(), DescriptionFunctionSchema]).optional(),
  argsSchema: recordType(anyType()).optional()
});
const contextSchema$5 = objectType({
  interruptOn: recordType(unionType([booleanType(), InterruptOnConfigSchema])).optional(),
  descriptionPrefix: stringType().default("Tool execution requires approval")
});
function humanInTheLoopMiddleware(options) {
  const createActionAndConfig = async (toolCall, config2, state, runtime) => {
    const toolName = toolCall.name;
    const toolArgs = toolCall.args;
    const descriptionValue = config2.description;
    let description;
    if (typeof descriptionValue === "function") description = await descriptionValue(toolCall, state, runtime);
    else if (descriptionValue !== void 0) description = descriptionValue;
    else description = `${options.descriptionPrefix ?? "Tool execution requires approval"}

Tool: ${toolName}
Args: ${JSON.stringify(toolArgs, null, 2)}`;
    const actionRequest = {
      name: toolName,
      args: toolArgs,
      description
    };
    const reviewConfig = {
      actionName: toolName,
      allowedDecisions: config2.allowedDecisions
    };
    if (config2.argsSchema) reviewConfig.argsSchema = config2.argsSchema;
    return {
      actionRequest,
      reviewConfig
    };
  };
  const processDecision = (decision, toolCall, config2) => {
    const allowedDecisions = config2.allowedDecisions;
    if (decision.type === "approve" && allowedDecisions.includes("approve")) return {
      revisedToolCall: toolCall,
      toolMessage: null
    };
    if (decision.type === "edit" && allowedDecisions.includes("edit")) {
      const editedAction = decision.editedAction;
      if (!editedAction || typeof editedAction.name !== "string") throw new Error(`Invalid edited action for tool "${toolCall.name}": name must be a string`);
      if (!editedAction.args || typeof editedAction.args !== "object") throw new Error(`Invalid edited action for tool "${toolCall.name}": args must be an object`);
      return {
        revisedToolCall: {
          type: "tool_call",
          name: editedAction.name,
          args: editedAction.args,
          id: toolCall.id
        },
        toolMessage: null
      };
    }
    if (decision.type === "reject" && allowedDecisions.includes("reject")) {
      if (decision.message !== void 0 && typeof decision.message !== "string") throw new Error(`Tool call response for "${toolCall.name}" must be a string, got ${typeof decision.message}`);
      const content = decision.message ?? `User rejected the tool call for \`${toolCall.name}\` with id ${toolCall.id}`;
      const toolMessage = new messages.ToolMessage({
        content,
        name: toolCall.name,
        tool_call_id: toolCall.id,
        status: "error"
      });
      return {
        revisedToolCall: toolCall,
        toolMessage
      };
    }
    const msg = `Unexpected human decision: ${JSON.stringify(decision)}. Decision type '${decision.type}' is not allowed for tool '${toolCall.name}'. Expected one of ${JSON.stringify(allowedDecisions)} based on the tool's configuration.`;
    throw new Error(msg);
  };
  return createMiddleware({
    name: "HumanInTheLoopMiddleware",
    contextSchema: contextSchema$5,
    afterModel: {
      canJumpTo: ["model"],
      hook: async (state, runtime) => {
        const config2 = types.interopParse(contextSchema$5, {
          ...options,
          ...runtime.context || {}
        });
        if (!config2) return;
        const { messages: messages$1 } = state;
        if (!messages$1.length) return;
        const lastMessage = [...messages$1].reverse().find((msg) => messages.AIMessage.isInstance(msg));
        if (!lastMessage || !lastMessage.tool_calls?.length) return;
        if (!config2.interruptOn) return;
        const resolvedConfigs = {};
        for (const [toolName, toolConfig] of Object.entries(config2.interruptOn)) if (typeof toolConfig === "boolean") {
          if (toolConfig === true) resolvedConfigs[toolName] = { allowedDecisions: [...ALLOWED_DECISIONS] };
        } else if (toolConfig.allowedDecisions) resolvedConfigs[toolName] = toolConfig;
        const interruptToolCalls = [];
        const autoApprovedToolCalls = [];
        for (const toolCall of lastMessage.tool_calls) if (toolCall.name in resolvedConfigs) interruptToolCalls.push(toolCall);
        else autoApprovedToolCalls.push(toolCall);
        if (!interruptToolCalls.length) return;
        const actionRequests = [];
        const reviewConfigs = [];
        for (const toolCall of interruptToolCalls) {
          const interruptConfig = resolvedConfigs[toolCall.name];
          const { actionRequest, reviewConfig } = await createActionAndConfig(toolCall, interruptConfig, state, runtime);
          actionRequests.push(actionRequest);
          reviewConfigs.push(reviewConfig);
        }
        const hitlRequest = {
          actionRequests,
          reviewConfigs
        };
        const hitlResponse = await langgraph.interrupt(hitlRequest);
        const decisions = hitlResponse.decisions;
        if (!decisions || !Array.isArray(decisions)) throw new Error("Invalid HITLResponse: decisions must be a non-empty array");
        if (decisions.length !== interruptToolCalls.length) throw new Error(`Number of human decisions (${decisions.length}) does not match number of hanging tool calls (${interruptToolCalls.length}).`);
        const revisedToolCalls = [...autoApprovedToolCalls];
        const artificialToolMessages = [];
        const hasRejectedToolCalls = decisions.some((decision) => decision.type === "reject");
        for (let i = 0; i < decisions.length; i++) {
          const decision = decisions[i];
          const toolCall = interruptToolCalls[i];
          const interruptConfig = resolvedConfigs[toolCall.name];
          const { revisedToolCall, toolMessage } = processDecision(decision, toolCall, interruptConfig);
          if (revisedToolCall && (!hasRejectedToolCalls || decision.type === "reject")) revisedToolCalls.push(revisedToolCall);
          if (toolMessage) artificialToolMessages.push(toolMessage);
        }
        if (messages.AIMessage.isInstance(lastMessage)) lastMessage.tool_calls = revisedToolCalls;
        const jumpTo = hasRejectedToolCalls ? "model" : void 0;
        return {
          messages: [lastMessage, ...artificialToolMessages],
          jumpTo
        };
      }
    }
  });
}
const DEFAULT_SUMMARY_PROMPT = `<role>
Context Extraction Assistant
</role>

<primary_objective>
Your sole objective in this task is to extract the highest quality/most relevant context from the conversation history below.
</primary_objective>

<objective_information>
You're nearing the total number of input tokens you can accept, so you must extract the highest quality/most relevant pieces of information from your conversation history.
This context will then overwrite the conversation history presented below. Because of this, ensure the context you extract is only the most important information to your overall goal.
</objective_information>

<instructions>
The conversation history below will be replaced with the context you extract in this step. Because of this, you must do your very best to extract and record all of the most important context from the conversation history.
You want to ensure that you don't repeat any actions you've already completed, so the context you extract from the conversation history should be focused on the most important information to your overall goal.
</instructions>

The user will message you with the full message history you'll be extracting context from, to then replace. Carefully read over it all, and think deeply about what information is most important to your overall goal that should be saved:

With all of this in mind, please carefully read over the entire conversation history, and extract the most important and relevant context to replace it so that you can free up space in the conversation history.
Respond ONLY with the extracted context. Do not include any additional information, or text before or after the extracted context.

<messages>
Messages to summarize:
{messages}
</messages>`;
const DEFAULT_SUMMARY_PREFIX = "Here is a summary of the conversation to date:";
const DEFAULT_MESSAGES_TO_KEEP = 20;
const DEFAULT_TRIM_TOKEN_LIMIT = 4e3;
const SEARCH_RANGE_FOR_TOOL_PAIRS = 5;
const tokenCounterSchema = functionType().args(arrayType(custom$1())).returns(unionType([numberType(), promiseType(numberType())]));
const contextSizeSchema = objectType({
  fraction: numberType().gt(0, "Fraction must be greater than 0").max(1, "Fraction must be less than or equal to 1").optional(),
  tokens: numberType().positive("Tokens must be greater than 0").optional(),
  messages: numberType().int("Messages must be an integer").positive("Messages must be greater than 0").optional()
}).refine((data) => {
  const count = [
    data.fraction,
    data.tokens,
    data.messages
  ].filter((v) => v !== void 0).length;
  return count >= 1;
}, { message: "At least one of fraction, tokens, or messages must be provided" });
const keepSchema = objectType({
  fraction: numberType().min(0, "Messages must be non-negative").max(1, "Fraction must be less than or equal to 1").optional(),
  tokens: numberType().min(0, "Tokens must be greater than or equal to 0").optional(),
  messages: numberType().int("Messages must be an integer").min(0, "Messages must be non-negative").optional()
}).refine((data) => {
  const count = [
    data.fraction,
    data.tokens,
    data.messages
  ].filter((v) => v !== void 0).length;
  return count === 1;
}, { message: "Exactly one of fraction, tokens, or messages must be provided" });
const contextSchema$4 = objectType({
  model: custom$1(),
  trigger: unionType([contextSizeSchema, arrayType(contextSizeSchema)]).optional(),
  keep: keepSchema.optional(),
  tokenCounter: tokenCounterSchema.optional(),
  summaryPrompt: stringType().default(DEFAULT_SUMMARY_PROMPT),
  trimTokensToSummarize: numberType().optional(),
  summaryPrefix: stringType().optional(),
  maxTokensBeforeSummary: numberType().optional(),
  messagesToKeep: numberType().optional()
});
function getProfileLimits(input) {
  if ("profile" in input && typeof input.profile === "object" && input.profile && "maxInputTokens" in input.profile && (typeof input.profile.maxInputTokens === "number" || input.profile.maxInputTokens == null)) return input.profile.maxInputTokens ?? void 0;
  if ("model" in input && typeof input.model === "string") return base.getModelContextSize(input.model);
  if ("modelName" in input && typeof input.modelName === "string") return base.getModelContextSize(input.modelName);
  return void 0;
}
function summarizationMiddleware(options) {
  const { data: userOptions, error } = types.interopSafeParse(contextSchema$4, options);
  if (error) throw new Error(`Invalid summarization middleware options: ${prettifyError(error)}`);
  return createMiddleware({
    name: "SummarizationMiddleware",
    contextSchema: contextSchema$4.extend({ model: custom$1().optional() }),
    beforeModel: async (state, runtime) => {
      let trigger = userOptions.trigger;
      let keep = userOptions.keep;
      if (userOptions.maxTokensBeforeSummary !== void 0) {
        console.warn("maxTokensBeforeSummary is deprecated. Use `trigger: { tokens: value }` instead.");
        if (trigger === void 0) trigger = { tokens: userOptions.maxTokensBeforeSummary };
      }
      if (userOptions.messagesToKeep !== void 0) {
        console.warn("messagesToKeep is deprecated. Use `keep: { messages: value }` instead.");
        if (!keep || keep && "messages" in keep && keep.messages === DEFAULT_MESSAGES_TO_KEEP) keep = { messages: userOptions.messagesToKeep };
      }
      const resolvedTrigger = runtime.context?.trigger !== void 0 ? runtime.context.trigger : trigger;
      const resolvedKeep = runtime.context?.keep !== void 0 ? runtime.context.keep : keep ?? { messages: DEFAULT_MESSAGES_TO_KEEP };
      const validatedKeep = keepSchema.parse(resolvedKeep);
      let triggerConditions = [];
      if (resolvedTrigger === void 0) triggerConditions = [];
      else if (Array.isArray(resolvedTrigger))
        triggerConditions = resolvedTrigger.map((t) => contextSizeSchema.parse(t));
      else
        triggerConditions = [contextSizeSchema.parse(resolvedTrigger)];
      const requiresProfile = triggerConditions.some((c) => "fraction" in c) || "fraction" in validatedKeep;
      const model = typeof userOptions.model === "string" ? await initChatModel(userOptions.model) : userOptions.model;
      if (requiresProfile && !getProfileLimits(model)) throw new Error("Model profile information is required to use fractional token limits. Use absolute token counts instead.");
      const summaryPrompt = runtime.context?.summaryPrompt === DEFAULT_SUMMARY_PROMPT ? userOptions.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT : runtime.context?.summaryPrompt ?? userOptions.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT;
      const summaryPrefix = runtime.context.summaryPrefix ?? userOptions.summaryPrefix ?? DEFAULT_SUMMARY_PREFIX;
      const trimTokensToSummarize = runtime.context?.trimTokensToSummarize !== void 0 ? runtime.context.trimTokensToSummarize : userOptions.trimTokensToSummarize ?? DEFAULT_TRIM_TOKEN_LIMIT;
      ensureMessageIds(state.messages);
      const tokenCounter = runtime.context?.tokenCounter !== void 0 ? runtime.context.tokenCounter : userOptions.tokenCounter ?? countTokensApproximately;
      const totalTokens = await tokenCounter(state.messages);
      const doSummarize = await shouldSummarize(state.messages, totalTokens, triggerConditions, model);
      if (!doSummarize) return;
      const { systemPrompt, conversationMessages } = splitSystemMessage(state.messages);
      const cutoffIndex = await determineCutoffIndex(conversationMessages, validatedKeep, tokenCounter, model);
      if (cutoffIndex <= 0) return;
      const { messagesToSummarize, preservedMessages } = partitionMessages(systemPrompt, conversationMessages, cutoffIndex);
      const summary = await createSummary(messagesToSummarize, model, summaryPrompt, tokenCounter, trimTokensToSummarize, runtime);
      const summaryMessage = new messages.HumanMessage({
        content: `${summaryPrefix}

${summary}`,
        id: uuid$1.v4(),
        additional_kwargs: { lc_source: "summarization" }
      });
      return { messages: [
        new messages.RemoveMessage({ id: langgraph.REMOVE_ALL_MESSAGES }),
        summaryMessage,
        ...preservedMessages
      ] };
    }
  });
}
function ensureMessageIds(messages2) {
  for (const msg of messages2) if (!msg.id) msg.id = uuid$1.v4();
}
function splitSystemMessage(messages$1) {
  if (messages$1.length > 0 && messages.SystemMessage.isInstance(messages$1[0])) return {
    systemPrompt: messages$1[0],
    conversationMessages: messages$1.slice(1)
  };
  return { conversationMessages: messages$1 };
}
function partitionMessages(systemPrompt, conversationMessages, cutoffIndex) {
  const messagesToSummarize = conversationMessages.slice(0, cutoffIndex);
  const preservedMessages = conversationMessages.slice(cutoffIndex);
  if (systemPrompt) messagesToSummarize.unshift(systemPrompt);
  return {
    messagesToSummarize,
    preservedMessages
  };
}
async function shouldSummarize(messages2, totalTokens, triggerConditions, model) {
  if (triggerConditions.length === 0) return false;
  for (const trigger of triggerConditions) {
    let conditionMet = true;
    let hasAnyProperty = false;
    if (trigger.messages !== void 0) {
      hasAnyProperty = true;
      if (messages2.length < trigger.messages) conditionMet = false;
    }
    if (trigger.tokens !== void 0) {
      hasAnyProperty = true;
      if (totalTokens < trigger.tokens) conditionMet = false;
    }
    if (trigger.fraction !== void 0) {
      hasAnyProperty = true;
      const maxInputTokens = getProfileLimits(model);
      if (typeof maxInputTokens === "number") {
        const threshold = Math.floor(maxInputTokens * trigger.fraction);
        if (totalTokens < threshold) conditionMet = false;
      } else
        conditionMet = false;
    }
    if (hasAnyProperty && conditionMet) return true;
  }
  return false;
}
async function determineCutoffIndex(messages2, keep, tokenCounter, model) {
  if ("tokens" in keep || "fraction" in keep) {
    const tokenBasedCutoff = await findTokenBasedCutoff(messages2, keep, tokenCounter, model);
    if (typeof tokenBasedCutoff === "number") return tokenBasedCutoff;
    return findSafeCutoff(messages2, DEFAULT_MESSAGES_TO_KEEP);
  }
  return findSafeCutoff(messages2, keep.messages ?? DEFAULT_MESSAGES_TO_KEEP);
}
async function findTokenBasedCutoff(messages2, keep, tokenCounter, model) {
  if (messages2.length === 0) return 0;
  let targetTokenCount;
  if ("fraction" in keep && keep.fraction !== void 0) {
    const maxInputTokens = getProfileLimits(model);
    if (typeof maxInputTokens !== "number") return;
    targetTokenCount = Math.floor(maxInputTokens * keep.fraction);
  } else if ("tokens" in keep && keep.tokens !== void 0) targetTokenCount = Math.floor(keep.tokens);
  else return;
  if (targetTokenCount <= 0) targetTokenCount = 1;
  const totalTokens = await tokenCounter(messages2);
  if (totalTokens <= targetTokenCount) return 0;
  let left = 0;
  let right = messages2.length;
  let cutoffCandidate = messages2.length;
  const maxIterations = Math.floor(Math.log2(messages2.length)) + 1;
  for (let i = 0; i < maxIterations; i++) {
    if (left >= right) break;
    const mid = Math.floor((left + right) / 2);
    const suffixTokens = await tokenCounter(messages2.slice(mid));
    if (suffixTokens <= targetTokenCount) {
      cutoffCandidate = mid;
      right = mid;
    } else left = mid + 1;
  }
  if (cutoffCandidate === messages2.length) cutoffCandidate = left;
  if (cutoffCandidate >= messages2.length) {
    if (messages2.length === 1) return 0;
    cutoffCandidate = messages2.length - 1;
  }
  const safeCutoff = findSafeCutoffPoint(messages2, cutoffCandidate);
  if (safeCutoff <= cutoffCandidate) return safeCutoff;
  for (let i = cutoffCandidate; i >= 0; i--) if (isSafeCutoffPoint(messages2, i)) return i;
  return 0;
}
function findSafeCutoff(messages2, messagesToKeep) {
  if (messages2.length <= messagesToKeep) return 0;
  const targetCutoff = messages2.length - messagesToKeep;
  const safeCutoff = findSafeCutoffPoint(messages2, targetCutoff);
  if (safeCutoff <= targetCutoff) return safeCutoff;
  for (let i = targetCutoff; i >= 0; i--) if (isSafeCutoffPoint(messages2, i)) return i;
  return 0;
}
function isSafeCutoffPoint(messages$1, cutoffIndex) {
  if (cutoffIndex >= messages$1.length) return true;
  if (cutoffIndex < messages$1.length && messages.AIMessage.isInstance(messages$1[cutoffIndex]) && hasToolCalls(messages$1[cutoffIndex])) return false;
  const searchStart = Math.max(0, cutoffIndex - SEARCH_RANGE_FOR_TOOL_PAIRS);
  const searchEnd = Math.min(messages$1.length, cutoffIndex + SEARCH_RANGE_FOR_TOOL_PAIRS);
  for (let i = searchStart; i < searchEnd; i++) {
    if (!hasToolCalls(messages$1[i])) continue;
    const toolCallIds = extractToolCallIds(messages$1[i]);
    if (cutoffSeparatesToolPair(messages$1, i, cutoffIndex, toolCallIds)) return false;
  }
  return true;
}
function extractToolCallIds(aiMessage) {
  const toolCallIds = /* @__PURE__ */ new Set();
  if (aiMessage.tool_calls) for (const toolCall of aiMessage.tool_calls) {
    const id = typeof toolCall === "object" && "id" in toolCall ? toolCall.id : null;
    if (id) toolCallIds.add(id);
  }
  return toolCallIds;
}
function findSafeCutoffPoint(messages$1, cutoffIndex) {
  if (cutoffIndex >= messages$1.length || !messages.ToolMessage.isInstance(messages$1[cutoffIndex])) return cutoffIndex;
  const toolCallIds = /* @__PURE__ */ new Set();
  let idx = cutoffIndex;
  while (idx < messages$1.length && messages.ToolMessage.isInstance(messages$1[idx])) {
    const toolMsg = messages$1[idx];
    if (toolMsg.tool_call_id) toolCallIds.add(toolMsg.tool_call_id);
    idx++;
  }
  for (let i = cutoffIndex - 1; i >= 0; i--) {
    const msg = messages$1[i];
    if (messages.AIMessage.isInstance(msg) && hasToolCalls(msg)) {
      const aiToolCallIds = extractToolCallIds(msg);
      for (const id of toolCallIds) if (aiToolCallIds.has(id)) return i;
    }
  }
  return idx;
}
function cutoffSeparatesToolPair(messages$1, aiMessageIndex, cutoffIndex, toolCallIds) {
  for (let j = aiMessageIndex + 1; j < messages$1.length; j++) {
    const message = messages$1[j];
    if (messages.ToolMessage.isInstance(message) && toolCallIds.has(message.tool_call_id)) {
      const aiBeforeCutoff = aiMessageIndex < cutoffIndex;
      const toolBeforeCutoff = j < cutoffIndex;
      if (aiBeforeCutoff !== toolBeforeCutoff) return true;
    }
  }
  return false;
}
async function createSummary(messagesToSummarize, model, summaryPrompt, tokenCounter, trimTokensToSummarize, runtime) {
  if (!messagesToSummarize.length) return "No previous conversation history.";
  const trimmedMessages = await trimMessagesForSummary(messagesToSummarize, tokenCounter, trimTokensToSummarize);
  if (!trimmedMessages.length) return "Previous conversation was too long to summarize.";
  const formattedMessages = messages.getBufferString(trimmedMessages);
  try {
    const formattedPrompt = summaryPrompt.replace("{messages}", formattedMessages);
    const baseConfig = runnables.pickRunnableConfigKeys(runtime) ?? {};
    const config2 = runnables.mergeConfigs(baseConfig, { metadata: { lc_source: "summarization" } });
    const response = await model.invoke(formattedPrompt, config2);
    const content = response.content;
    if (typeof content === "string") return content.trim();
    else if (Array.isArray(content)) {
      const textContent = content.map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null && "text" in item) return item.text;
        return "";
      }).join("");
      return textContent.trim();
    }
    return "Error generating summary: Invalid response format";
  } catch (e) {
    return `Error generating summary: ${e}`;
  }
}
async function trimMessagesForSummary(messages$1, tokenCounter, trimTokensToSummarize) {
  if (trimTokensToSummarize === void 0) return messages$1;
  try {
    return await messages.trimMessages(messages$1, {
      maxTokens: trimTokensToSummarize,
      tokenCounter: async (msgs) => tokenCounter(msgs),
      strategy: "last",
      allowPartial: true,
      includeSystem: true
    });
  } catch {
    return messages$1.slice(-15);
  }
}
function dynamicSystemPromptMiddleware(fn) {
  return createMiddleware({
    name: "DynamicSystemPromptMiddleware",
    wrapModelCall: async (request, handler) => {
      const systemPrompt = await fn(request.state, request.runtime);
      const isExpectedType = typeof systemPrompt === "string" || messages.SystemMessage.isInstance(systemPrompt);
      if (!isExpectedType) throw new Error("dynamicSystemPromptMiddleware function must return a string or SystemMessage");
      return handler({
        ...request,
        systemMessage: request.systemMessage.concat(systemPrompt)
      });
    }
  });
}
const DEFAULT_SYSTEM_PROMPT = "Your goal is to select the most relevant tools for answering the user's query.";
function createToolSelectionResponse(tools2) {
  if (!tools2 || tools2.length === 0) throw new Error("Invalid usage: tools must be non-empty");
  const toolLiterals = tools2.map((tool) => literalType(tool.name));
  const toolEnum = unionType(toolLiterals);
  return objectType({ tools: arrayType(toolEnum).describe("Tools to use. Place the most relevant tools first.") });
}
const LLMToolSelectorOptionsSchema = objectType({
  model: stringType().or(instanceOfType(base.BaseLanguageModel)).optional(),
  systemPrompt: stringType().optional(),
  maxTools: numberType().optional(),
  alwaysInclude: arrayType(stringType()).optional()
});
function llmToolSelectorMiddleware(options) {
  return createMiddleware({
    name: "LLMToolSelector",
    contextSchema: LLMToolSelectorOptionsSchema,
    async wrapModelCall(request, handler) {
      const selectionRequest = await prepareSelectionRequest(request, options, request.runtime);
      if (!selectionRequest) return handler(request);
      const toolSelectionSchema = createToolSelectionResponse(selectionRequest.availableTools);
      const structuredModel = await selectionRequest.model.withStructuredOutput?.(toolSelectionSchema);
      const response = await structuredModel?.invoke([{
        role: "system",
        content: selectionRequest.systemMessage
      }, selectionRequest.lastUserMessage]);
      if (!response || typeof response !== "object" || !("tools" in response)) throw new Error(`Expected object response with tools array, got ${typeof response}`);
      return handler(processSelectionResponse(response, selectionRequest.availableTools, selectionRequest.validToolNames, request, options));
    }
  });
}
async function prepareSelectionRequest(request, options, runtime) {
  const model = runtime.context.model ?? options.model;
  const maxTools = runtime.context.maxTools ?? options.maxTools;
  const alwaysInclude = runtime.context.alwaysInclude ?? options.alwaysInclude ?? [];
  const systemPrompt = runtime.context.systemPrompt ?? options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  if (!request.tools || request.tools.length === 0) return void 0;
  const baseTools = request.tools.filter((tool) => typeof tool === "object" && "name" in tool && "description" in tool && typeof tool.name === "string");
  if (alwaysInclude.length > 0) {
    const availableToolNames = new Set(baseTools.map((tool) => tool.name));
    const missingTools = alwaysInclude.filter((name) => !availableToolNames.has(name));
    if (missingTools.length > 0) throw new Error(`Tools in alwaysInclude not found in request: ${missingTools.join(", ")}. Available tools: ${Array.from(availableToolNames).sort().join(", ")}`);
  }
  const availableTools = baseTools.filter((tool) => !alwaysInclude.includes(tool.name));
  if (availableTools.length === 0) return void 0;
  let systemMessage = systemPrompt;
  if (maxTools !== void 0) systemMessage += `
IMPORTANT: List the tool names in order of relevance, with the most relevant first. If you exceed the maximum number of tools, only the first ${maxTools} will be used.`;
  let lastUserMessage;
  for (const message of request.messages) if (messages.HumanMessage.isInstance(message)) lastUserMessage = message;
  if (!lastUserMessage) throw new Error("No user message found in request messages");
  const modelInstance = !model ? request.model : typeof model === "string" ? await initChatModel(model) : model;
  const validToolNames = availableTools.map((tool) => tool.name);
  return {
    availableTools,
    systemMessage,
    lastUserMessage,
    model: modelInstance,
    validToolNames
  };
}
function processSelectionResponse(response, availableTools, validToolNames, request, options) {
  const maxTools = options.maxTools;
  const alwaysInclude = options.alwaysInclude ?? [];
  const selectedToolNames = [];
  const invalidToolSelections = [];
  for (const toolName of response.tools) {
    if (!validToolNames.includes(toolName)) {
      invalidToolSelections.push(toolName);
      continue;
    }
    if (!selectedToolNames.includes(toolName) && (maxTools === void 0 || selectedToolNames.length < maxTools)) selectedToolNames.push(toolName);
  }
  if (invalidToolSelections.length > 0) throw new Error(`Model selected invalid tools: ${invalidToolSelections.join(", ")}`);
  const selectedTools = availableTools.filter((tool) => selectedToolNames.includes(tool.name));
  const alwaysIncludedTools = (request.tools ?? []).filter((tool) => typeof tool === "object" && "name" in tool && typeof tool.name === "string" && alwaysInclude.includes(tool.name));
  selectedTools.push(...alwaysIncludedTools);
  const providerTools = (request.tools ?? []).filter((tool) => !(typeof tool === "object" && "name" in tool && "description" in tool && typeof tool.name === "string"));
  return {
    ...request,
    tools: [...selectedTools, ...providerTools]
  };
}
var PIIDetectionError = class extends Error {
  constructor(piiType, matches) {
    super(`PII detected: ${piiType} found ${matches.length} occurrence(s)`);
    this.piiType = piiType;
    this.matches = matches;
    this.name = "PIIDetectionError";
  }
};
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const IP_PATTERN = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const MAC_ADDRESS_PATTERN = /\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/g;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;
function luhnCheck(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "");
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}
function regexMatchToPIIMatch(match) {
  return {
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  };
}
function detectEmail(content) {
  const matches = [];
  const regex = new RegExp(EMAIL_PATTERN);
  let match;
  while ((match = regex.exec(content)) !== null) matches.push(regexMatchToPIIMatch(match));
  return matches;
}
function detectCreditCard(content) {
  const matches = [];
  const regex = new RegExp(CREDIT_CARD_PATTERN);
  let match;
  while ((match = regex.exec(content)) !== null) {
    const cardNumber = match[0].replace(/\D/g, "");
    if (cardNumber.length >= 13 && cardNumber.length <= 19 && luhnCheck(cardNumber)) matches.push(regexMatchToPIIMatch(match));
  }
  return matches;
}
function detectIP(content) {
  const matches = [];
  const regex = new RegExp(IP_PATTERN);
  let match;
  while ((match = regex.exec(content)) !== null) {
    const ip = match[0];
    const parts = ip.split(".");
    if (parts.length === 4 && parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    })) matches.push(regexMatchToPIIMatch(match));
  }
  return matches;
}
function detectMacAddress(content) {
  const matches = [];
  const regex = new RegExp(MAC_ADDRESS_PATTERN);
  let match;
  while ((match = regex.exec(content)) !== null) matches.push(regexMatchToPIIMatch(match));
  return matches;
}
function detectUrl(content) {
  const matches = [];
  const regex = new RegExp(URL_PATTERN);
  let match;
  while ((match = regex.exec(content)) !== null) matches.push(regexMatchToPIIMatch(match));
  return matches;
}
const BUILT_IN_DETECTORS = {
  email: detectEmail,
  credit_card: detectCreditCard,
  ip: detectIP,
  mac_address: detectMacAddress,
  url: detectUrl
};
function resolveRedactionRule(config2) {
  let detector;
  if (config2.detector) if (typeof config2.detector === "string") {
    const regex = new RegExp(config2.detector, "g");
    detector = (content) => {
      const matches = [];
      let match;
      const regexCopy = new RegExp(regex);
      while ((match = regexCopy.exec(content)) !== null) matches.push(regexMatchToPIIMatch(match));
      return matches;
    };
  } else if (config2.detector instanceof RegExp) detector = (content) => {
    if (!(config2.detector instanceof RegExp)) throw new Error("Detector is required");
    const matches = [];
    let match;
    while ((match = config2.detector.exec(content)) !== null) matches.push(regexMatchToPIIMatch(match));
    return matches;
  };
  else detector = config2.detector;
  else {
    const builtInType = config2.piiType;
    if (!BUILT_IN_DETECTORS[builtInType]) throw new Error(`Unknown PII type: ${config2.piiType}. Must be one of: ${Object.keys(BUILT_IN_DETECTORS).join(", ")}, or provide a custom detector.`);
    detector = BUILT_IN_DETECTORS[builtInType];
  }
  return {
    piiType: config2.piiType,
    strategy: config2.strategy,
    detector
  };
}
function applyRedactStrategy(content, matches, piiType) {
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const replacement = `[REDACTED_${piiType.toUpperCase()}]`;
    result = result.slice(0, match.start) + replacement + result.slice(match.end);
  }
  return result;
}
function applyMaskStrategy(content, matches, piiType) {
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const text = match.text;
    let masked;
    if (piiType === "credit_card") {
      const digits = text.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      masked = `****-****-****-${last4}`;
    } else if (piiType === "email") {
      const [local, domain] = text.split("@");
      if (local && domain) masked = `${local[0]}***@${domain}`;
      else masked = "***";
    } else {
      const visibleChars = Math.min(4, text.length);
      masked = `${"*".repeat(Math.max(0, text.length - visibleChars))}${text.slice(-visibleChars)}`;
    }
    result = result.slice(0, match.start) + masked + result.slice(match.end);
  }
  return result;
}
function applyHashStrategy(content, matches, piiType) {
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const hash$1 = hash.sha256(match.text).slice(0, 8);
    const replacement = `<${piiType}_hash:${hash$1}>`;
    result = result.slice(0, match.start) + replacement + result.slice(match.end);
  }
  return result;
}
function applyStrategy(content, matches, strategy, piiType) {
  if (matches.length === 0) return content;
  switch (strategy) {
    case "block":
      throw new PIIDetectionError(piiType, matches);
    case "redact":
      return applyRedactStrategy(content, matches, piiType);
    case "mask":
      return applyMaskStrategy(content, matches, piiType);
    case "hash":
      return applyHashStrategy(content, matches, piiType);
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}
const contextSchema$3 = objectType({
  applyToInput: booleanType().optional(),
  applyToOutput: booleanType().optional(),
  applyToToolResults: booleanType().optional()
});
function processContent(content, rule) {
  const matches = rule.detector(content);
  if (matches.length === 0) return {
    content,
    matches: []
  };
  const sanitized = applyStrategy(content, matches, rule.strategy, rule.piiType);
  return {
    content: sanitized,
    matches
  };
}
function piiMiddleware(piiType, options = {}) {
  const { strategy = "redact", detector } = options;
  const resolvedRule = resolveRedactionRule({
    piiType,
    strategy,
    detector
  });
  const middlewareName = `PIIMiddleware[${resolvedRule.piiType}]`;
  return createMiddleware({
    name: middlewareName,
    contextSchema: contextSchema$3,
    beforeModel: async (state, runtime) => {
      const applyToInput = runtime.context.applyToInput ?? options.applyToInput ?? true;
      const applyToToolResults = runtime.context.applyToToolResults ?? options.applyToToolResults ?? false;
      if (!applyToInput && !applyToToolResults) return;
      const messages$1 = state.messages;
      if (!messages$1 || messages$1.length === 0) return;
      const newMessages = [...messages$1];
      let anyModified = false;
      if (applyToInput) {
        let lastUserIdx = null;
        for (let i = messages$1.length - 1; i >= 0; i--) if (messages.HumanMessage.isInstance(messages$1[i])) {
          lastUserIdx = i;
          break;
        }
        if (lastUserIdx !== null) {
          const lastUserMsg = messages$1[lastUserIdx];
          if (lastUserMsg && lastUserMsg.content) {
            const content = String(lastUserMsg.content);
            const { content: newContent, matches } = processContent(content, resolvedRule);
            if (matches.length > 0) {
              newMessages[lastUserIdx] = new messages.HumanMessage({
                content: newContent,
                id: lastUserMsg.id,
                name: lastUserMsg.name
              });
              anyModified = true;
            }
          }
        }
      }
      if (applyToToolResults) {
        let lastAiIdx = null;
        for (let i = messages$1.length - 1; i >= 0; i--) if (messages.AIMessage.isInstance(messages$1[i])) {
          lastAiIdx = i;
          break;
        }
        if (lastAiIdx !== null) for (let i = lastAiIdx + 1; i < messages$1.length; i++) {
          const msg = messages$1[i];
          if (messages.ToolMessage.isInstance(msg)) {
            if (!msg.content) continue;
            const content = String(msg.content);
            const { content: newContent, matches } = processContent(content, resolvedRule);
            if (matches.length > 0) {
              newMessages[i] = new messages.ToolMessage({
                content: newContent,
                id: msg.id,
                name: msg.name,
                tool_call_id: msg.tool_call_id
              });
              anyModified = true;
            }
          }
        }
      }
      if (anyModified) return { messages: newMessages };
    },
    afterModel: async (state, runtime) => {
      const applyToOutput = runtime.context.applyToOutput ?? options.applyToOutput ?? false;
      if (!applyToOutput) return;
      const messages$1 = state.messages;
      if (!messages$1 || messages$1.length === 0) return;
      let lastAiIdx = null;
      let lastAiMsg = null;
      for (let i = messages$1.length - 1; i >= 0; i--) if (messages.AIMessage.isInstance(messages$1[i])) {
        lastAiMsg = messages$1[i];
        lastAiIdx = i;
        break;
      }
      if (lastAiIdx === null || !lastAiMsg || !lastAiMsg.content) return;
      const content = String(lastAiMsg.content);
      const { content: newContent, matches } = processContent(content, resolvedRule);
      if (matches.length === 0) return;
      const updatedMessage = new messages.AIMessage({
        content: newContent,
        id: lastAiMsg.id,
        name: lastAiMsg.name,
        tool_calls: lastAiMsg.tool_calls
      });
      const newMessages = [...messages$1];
      newMessages[lastAiIdx] = updatedMessage;
      return { messages: newMessages };
    }
  });
}
const contextSchema$2 = objectType({ rules: recordType(stringType(), instanceOfType(RegExp).describe("Regular expression pattern to match PII")).optional() });
function generateRedactionId() {
  return Math.random().toString(36).substring(2, 11);
}
function applyPIIRules(text, rules, redactionMap) {
  let processedText = text;
  for (const [name, pattern] of Object.entries(rules)) {
    const replacement = name.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, "");
    processedText = processedText.replace(pattern, (match) => {
      const id = generateRedactionId();
      redactionMap[id] = match;
      return `[REDACTED_${replacement}_${id}]`;
    });
  }
  return processedText;
}
async function processMessage(message, config2) {
  if (messages.HumanMessage.isInstance(message) || messages.ToolMessage.isInstance(message) || messages.SystemMessage.isInstance(message)) {
    const content = message.content;
    const processedContent = await applyPIIRules(content, config2.rules, config2.redactionMap);
    if (processedContent !== content) {
      const MessageConstructor = Object.getPrototypeOf(message).constructor;
      return new MessageConstructor({
        ...message,
        content: processedContent
      });
    }
    return message;
  }
  if (messages.AIMessage.isInstance(message)) {
    const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
    const toolCalls = JSON.stringify(message.tool_calls);
    const processedContent = await applyPIIRules(content, config2.rules, config2.redactionMap);
    const processedToolCalls = await applyPIIRules(toolCalls, config2.rules, config2.redactionMap);
    if (processedContent !== content || processedToolCalls !== toolCalls) return new messages.AIMessage({
      ...message,
      content: typeof message.content === "string" ? processedContent : JSON.parse(processedContent),
      tool_calls: JSON.parse(processedToolCalls)
    });
    return message;
  }
  throw new Error(`Unsupported message type: ${message.type}`);
}
function restoreRedactedValues(text, redactionMap) {
  let restoredText = text;
  const redactionPattern = /\[REDACTED_[A-Z_]+_(\w+)\]/g;
  restoredText = restoredText.replace(redactionPattern, (match, id) => {
    if (redactionMap[id]) return redactionMap[id];
    return match;
  });
  return restoredText;
}
function restoreMessage(message, redactionMap) {
  if (messages.HumanMessage.isInstance(message) || messages.ToolMessage.isInstance(message) || messages.SystemMessage.isInstance(message)) {
    const content = message.content;
    const restoredContent = restoreRedactedValues(content, redactionMap);
    if (restoredContent !== content) {
      const MessageConstructor = Object.getPrototypeOf(message).constructor;
      const newMessage = new MessageConstructor({
        ...message,
        content: restoredContent
      });
      return {
        message: newMessage,
        changed: true
      };
    }
    return {
      message,
      changed: false
    };
  }
  if (messages.AIMessage.isInstance(message)) {
    const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
    const toolCalls = JSON.stringify(message.tool_calls);
    const processedContent = restoreRedactedValues(content, redactionMap);
    const processedToolCalls = restoreRedactedValues(toolCalls, redactionMap);
    if (processedContent !== content || processedToolCalls !== toolCalls) return {
      message: new messages.AIMessage({
        ...message,
        content: typeof message.content === "string" ? processedContent : JSON.parse(processedContent),
        tool_calls: JSON.parse(processedToolCalls)
      }),
      changed: true
    };
    return {
      message,
      changed: false
    };
  }
  throw new Error(`Unsupported message type: ${message.type}`);
}
function piiRedactionMiddleware(options = {}) {
  const redactionMap = {};
  console.warn("DEPRECATED: piiRedactionMiddleware is deprecated. Please use piiMiddleware instead, go to https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#pii-detection for more information.");
  return createMiddleware({
    name: "PIIRedactionMiddleware",
    contextSchema: contextSchema$2,
    wrapModelCall: async (request, handler) => {
      const rules = request.runtime.context.rules ?? options.rules ?? {};
      if (Object.keys(rules).length === 0) return handler(request);
      const processedMessages = await Promise.all(request.state.messages.map((message) => processMessage(message, {
        rules,
        redactionMap
      })));
      return handler({
        ...request,
        messages: processedMessages
      });
    },
    afterModel: async (state) => {
      if (Object.keys(redactionMap).length === 0) return;
      const lastMessage = state.messages.at(-1);
      if (!messages.AIMessage.isInstance(lastMessage)) return;
      const secondLastMessage = state.messages.at(-2);
      const { message: restoredLastMessage, changed } = restoreMessage(lastMessage, redactionMap);
      if (!changed) return;
      let structuredResponse;
      if (messages.AIMessage.isInstance(lastMessage) && lastMessage?.tool_calls?.length === 0 && typeof lastMessage.content === "string" && lastMessage.content.startsWith("{") && lastMessage.content.endsWith("}")) try {
        structuredResponse = JSON.parse(restoreRedactedValues(lastMessage.content, redactionMap));
      } catch {
      }
      const isStructuredResponseToolCall = messages.AIMessage.isInstance(secondLastMessage) && secondLastMessage?.tool_calls?.length !== 0 && secondLastMessage?.tool_calls?.some((call) => call.name.startsWith("extract-"));
      if (isStructuredResponseToolCall) {
        const { message: restoredSecondLastMessage, changed: changedSecondLastMessage } = restoreMessage(secondLastMessage, redactionMap);
        const structuredResponseRedacted = secondLastMessage.tool_calls?.find((call) => call.name.startsWith("extract-"))?.args;
        const structuredResponse$1 = structuredResponseRedacted ? JSON.parse(restoreRedactedValues(JSON.stringify(structuredResponseRedacted), redactionMap)) : void 0;
        if (changed || changedSecondLastMessage) return {
          ...state,
          ...structuredResponse$1 ? { structuredResponse: structuredResponse$1 } : {},
          messages: [
            new messages.RemoveMessage({ id: secondLastMessage.id }),
            new messages.RemoveMessage({ id: lastMessage.id }),
            restoredSecondLastMessage,
            restoredLastMessage
          ]
        };
      }
      return {
        ...state,
        ...structuredResponse ? { structuredResponse } : {},
        messages: [new messages.RemoveMessage({ id: lastMessage.id }), restoredLastMessage]
      };
    }
  });
}
const DEFAULT_TOOL_PLACEHOLDER = "[cleared]";
const DEFAULT_TRIGGER_TOKENS = 1e5;
const DEFAULT_KEEP = 3;
var ClearToolUsesEdit = class {
  #triggerConditions;
  trigger;
  keep;
  clearToolInputs;
  excludeTools;
  placeholder;
  model;
  clearAtLeast;
  constructor(config2 = {}) {
    let trigger = config2.trigger;
    if (config2.triggerTokens !== void 0) {
      console.warn("triggerTokens is deprecated. Use `trigger: { tokens: value }` instead.");
      if (trigger === void 0) trigger = { tokens: config2.triggerTokens };
    }
    let keep = config2.keep;
    if (config2.keepMessages !== void 0) {
      console.warn("keepMessages is deprecated. Use `keep: { messages: value }` instead.");
      if (keep === void 0) keep = { messages: config2.keepMessages };
    }
    if (trigger === void 0) trigger = { tokens: DEFAULT_TRIGGER_TOKENS };
    if (keep === void 0) keep = { messages: DEFAULT_KEEP };
    if (Array.isArray(trigger)) {
      this.#triggerConditions = trigger.map((t) => contextSizeSchema.parse(t));
      this.trigger = this.#triggerConditions;
    } else {
      const validated = contextSizeSchema.parse(trigger);
      this.#triggerConditions = [validated];
      this.trigger = validated;
    }
    const validatedKeep = keepSchema.parse(keep);
    this.keep = validatedKeep;
    if (config2.clearAtLeast !== void 0) console.warn("clearAtLeast is deprecated and will be removed in a future version. It conflicts with the `keep` property. Use `keep: { tokens: value }` or `keep: { messages: value }` instead to control retention.");
    this.clearAtLeast = config2.clearAtLeast ?? 0;
    this.clearToolInputs = config2.clearToolInputs ?? false;
    this.excludeTools = new Set(config2.excludeTools ?? []);
    this.placeholder = config2.placeholder ?? DEFAULT_TOOL_PLACEHOLDER;
  }
  async apply(params) {
    const { messages: messages$1, model, countTokens } = params;
    const tokens = await countTokens(messages$1);
    const orphanedIndices = [];
    for (let i = 0; i < messages$1.length; i++) {
      const msg = messages$1[i];
      if (messages.ToolMessage.isInstance(msg)) {
        const aiMessage = this.#findAIMessageForToolCall(messages$1.slice(0, i), msg.tool_call_id);
        if (!aiMessage) orphanedIndices.push(i);
        else {
          const toolCall = aiMessage.tool_calls?.find((call) => call.id === msg.tool_call_id);
          if (!toolCall) orphanedIndices.push(i);
        }
      }
    }
    for (let i = orphanedIndices.length - 1; i >= 0; i--) messages$1.splice(orphanedIndices[i], 1);
    let currentTokens = tokens;
    if (orphanedIndices.length > 0) currentTokens = await countTokens(messages$1);
    if (!this.#shouldEdit(messages$1, currentTokens, model)) return;
    const candidates = [];
    for (let i = 0; i < messages$1.length; i++) {
      const msg = messages$1[i];
      if (messages.ToolMessage.isInstance(msg)) candidates.push({
        idx: i,
        msg
      });
    }
    if (candidates.length === 0) return;
    const keepCount = await this.#determineKeepCount(candidates, countTokens, model);
    const candidatesToClear = keepCount >= candidates.length ? [] : keepCount > 0 ? candidates.slice(0, -keepCount) : candidates;
    let clearedTokens = 0;
    const initialCandidatesToClear = [...candidatesToClear];
    for (const { idx, msg: toolMessage } of initialCandidatesToClear) {
      const contextEditing = toolMessage.response_metadata?.context_editing;
      if (contextEditing?.cleared) continue;
      const aiMessage = this.#findAIMessageForToolCall(messages$1.slice(0, idx), toolMessage.tool_call_id);
      if (!aiMessage) continue;
      const toolCall = aiMessage.tool_calls?.find((call) => call.id === toolMessage.tool_call_id);
      if (!toolCall) continue;
      const toolName = toolMessage.name || toolCall.name;
      if (this.excludeTools.has(toolName)) continue;
      messages$1[idx] = new messages.ToolMessage({
        tool_call_id: toolMessage.tool_call_id,
        content: this.placeholder,
        name: toolMessage.name,
        artifact: void 0,
        response_metadata: {
          ...toolMessage.response_metadata,
          context_editing: {
            cleared: true,
            strategy: "clear_tool_uses"
          }
        }
      });
      if (this.clearToolInputs) {
        const aiMsgIdx = messages$1.indexOf(aiMessage);
        if (aiMsgIdx >= 0) messages$1[aiMsgIdx] = this.#buildClearedToolInputMessage(aiMessage, toolMessage.tool_call_id);
      }
      const newTokenCount = await countTokens(messages$1);
      clearedTokens = Math.max(0, currentTokens - newTokenCount);
    }
    if (this.clearAtLeast > 0 && clearedTokens < this.clearAtLeast) {
      const remainingCandidates = keepCount > 0 && keepCount < candidates.length ? candidates.slice(-keepCount) : [];
      for (let i = remainingCandidates.length - 1; i >= 0; i--) {
        if (clearedTokens >= this.clearAtLeast) break;
        const { idx, msg: toolMessage } = remainingCandidates[i];
        const contextEditing = toolMessage.response_metadata?.context_editing;
        if (contextEditing?.cleared) continue;
        const aiMessage = this.#findAIMessageForToolCall(messages$1.slice(0, idx), toolMessage.tool_call_id);
        if (!aiMessage) continue;
        const toolCall = aiMessage.tool_calls?.find((call) => call.id === toolMessage.tool_call_id);
        if (!toolCall) continue;
        const toolName = toolMessage.name || toolCall.name;
        if (this.excludeTools.has(toolName)) continue;
        messages$1[idx] = new messages.ToolMessage({
          tool_call_id: toolMessage.tool_call_id,
          content: this.placeholder,
          name: toolMessage.name,
          artifact: void 0,
          response_metadata: {
            ...toolMessage.response_metadata,
            context_editing: {
              cleared: true,
              strategy: "clear_tool_uses"
            }
          }
        });
        if (this.clearToolInputs) {
          const aiMsgIdx = messages$1.indexOf(aiMessage);
          if (aiMsgIdx >= 0) messages$1[aiMsgIdx] = this.#buildClearedToolInputMessage(aiMessage, toolMessage.tool_call_id);
        }
        const newTokenCount = await countTokens(messages$1);
        clearedTokens = Math.max(0, currentTokens - newTokenCount);
      }
    }
  }
  /**
  * Determine whether editing should run for the current token usage
  */
  #shouldEdit(messages2, totalTokens, model) {
    for (const trigger of this.#triggerConditions) {
      let conditionMet = true;
      let hasAnyProperty = false;
      if (trigger.messages !== void 0) {
        hasAnyProperty = true;
        if (messages2.length < trigger.messages) conditionMet = false;
      }
      if (trigger.tokens !== void 0) {
        hasAnyProperty = true;
        if (totalTokens < trigger.tokens) conditionMet = false;
      }
      if (trigger.fraction !== void 0) {
        hasAnyProperty = true;
        if (!model) continue;
        const maxInputTokens = getProfileLimits(model);
        if (typeof maxInputTokens === "number") {
          const threshold = Math.floor(maxInputTokens * trigger.fraction);
          if (threshold <= 0) continue;
          if (totalTokens < threshold) conditionMet = false;
        } else
          continue;
      }
      if (hasAnyProperty && conditionMet) return true;
    }
    return false;
  }
  /**
  * Determine how many tool results to keep based on keep policy
  */
  async #determineKeepCount(candidates, countTokens, model) {
    if ("messages" in this.keep && this.keep.messages !== void 0) return this.keep.messages;
    if ("tokens" in this.keep && this.keep.tokens !== void 0) {
      const targetTokens = this.keep.tokens;
      let tokenCount = 0;
      let keepCount = 0;
      for (let i = candidates.length - 1; i >= 0; i--) {
        const candidate = candidates[i];
        const msgTokens = await countTokens([candidate.msg]);
        if (tokenCount + msgTokens <= targetTokens) {
          tokenCount += msgTokens;
          keepCount++;
        } else break;
      }
      return keepCount;
    }
    if ("fraction" in this.keep && this.keep.fraction !== void 0) {
      if (!model) return DEFAULT_KEEP;
      const maxInputTokens = getProfileLimits(model);
      if (typeof maxInputTokens === "number") {
        const targetTokens = Math.floor(maxInputTokens * this.keep.fraction);
        if (targetTokens <= 0) return DEFAULT_KEEP;
        let tokenCount = 0;
        let keepCount = 0;
        for (let i = candidates.length - 1; i >= 0; i--) {
          const candidate = candidates[i];
          const msgTokens = await countTokens([candidate.msg]);
          if (tokenCount + msgTokens <= targetTokens) {
            tokenCount += msgTokens;
            keepCount++;
          } else break;
        }
        return keepCount;
      }
    }
    return DEFAULT_KEEP;
  }
  #findAIMessageForToolCall(previousMessages, toolCallId) {
    for (let i = previousMessages.length - 1; i >= 0; i--) {
      const msg = previousMessages[i];
      if (messages.AIMessage.isInstance(msg)) {
        const hasToolCall = msg.tool_calls?.some((call) => call.id === toolCallId);
        if (hasToolCall) return msg;
      }
    }
    return null;
  }
  #buildClearedToolInputMessage(message, toolCallId) {
    const updatedToolCalls = message.tool_calls?.map((toolCall) => {
      if (toolCall.id === toolCallId) return {
        ...toolCall,
        args: {}
      };
      return toolCall;
    });
    const metadata = { ...message.response_metadata };
    const contextEntry = { ...metadata.context_editing };
    const clearedIds = new Set(contextEntry.cleared_tool_inputs);
    clearedIds.add(toolCallId);
    contextEntry.cleared_tool_inputs = Array.from(clearedIds).sort();
    metadata.context_editing = contextEntry;
    return new messages.AIMessage({
      content: message.content,
      tool_calls: updatedToolCalls,
      response_metadata: metadata,
      id: message.id,
      name: message.name,
      additional_kwargs: message.additional_kwargs
    });
  }
};
function contextEditingMiddleware(config2 = {}) {
  const edits = config2.edits ?? [new ClearToolUsesEdit()];
  const tokenCountMethod = config2.tokenCountMethod ?? "approx";
  return createMiddleware({
    name: "ContextEditingMiddleware",
    wrapModelCall: async (request, handler) => {
      if (!request.messages || request.messages.length === 0) return handler(request);
      const systemMsg = request.systemPrompt ? [new messages.SystemMessage(request.systemPrompt)] : [];
      const countTokens = tokenCountMethod === "approx" ? countTokensApproximately : async (messages2) => {
        const allMessages = [...systemMsg, ...messages2];
        if ("getNumTokensFromMessages" in request.model) return request.model.getNumTokensFromMessages(allMessages).then(({ totalCount }) => totalCount);
        throw new Error(`Model "${request.model.getName()}" does not support token counting`);
      };
      for (const edit of edits) await edit.apply({
        messages: request.messages,
        model: request.model,
        countTokens
      });
      return handler(request);
    }
  });
}
function buildToolMessageContent(toolName) {
  if (toolName) return `Tool call limit exceeded. Do not call '${toolName}' again.`;
  return "Tool call limit exceeded. Do not make additional tool calls.";
}
const VALID_EXIT_BEHAVIORS = [
  "continue",
  "error",
  "end"
];
const DEFAULT_EXIT_BEHAVIOR$1 = "continue";
function buildFinalAIMessageContent(threadCount, runCount, threadLimit, runLimit, toolName) {
  const toolDesc = toolName ? `'${toolName}' tool` : "Tool";
  const exceededLimits = [];
  if (threadLimit !== void 0 && threadCount > threadLimit) exceededLimits.push(`thread limit exceeded (${threadCount}/${threadLimit} calls)`);
  if (runLimit !== void 0 && runCount > runLimit) exceededLimits.push(`run limit exceeded (${runCount}/${runLimit} calls)`);
  const limitsText = exceededLimits.join(" and ");
  return `${toolDesc} call limit reached: ${limitsText}.`;
}
const exitBehaviorSchema = enumType(VALID_EXIT_BEHAVIORS).default(DEFAULT_EXIT_BEHAVIOR$1);
var ToolCallLimitExceededError = class extends Error {
  /**
  * Current thread tool call count.
  */
  threadCount;
  /**
  * Current run tool call count.
  */
  runCount;
  /**
  * Thread tool call limit (if set).
  */
  threadLimit;
  /**
  * Run tool call limit (if set).
  */
  runLimit;
  /**
  * Tool name being limited (if specific tool), or undefined for all tools.
  */
  toolName;
  constructor(threadCount, runCount, threadLimit, runLimit, toolName = void 0) {
    const message = buildFinalAIMessageContent(threadCount, runCount, threadLimit, runLimit, toolName);
    super(message);
    this.name = "ToolCallLimitExceededError";
    this.threadCount = threadCount;
    this.runCount = runCount;
    this.threadLimit = threadLimit;
    this.runLimit = runLimit;
    this.toolName = toolName;
  }
};
objectType({
  toolName: stringType().optional(),
  threadLimit: numberType().optional(),
  runLimit: numberType().optional(),
  exitBehavior: exitBehaviorSchema
});
const stateSchema$2 = objectType({
  threadToolCallCount: recordType(stringType(), numberType()).default({}),
  runToolCallCount: recordType(stringType(), numberType()).default({})
});
const DEFAULT_TOOL_COUNT_KEY = "__all__";
function toolCallLimitMiddleware(options) {
  if (options.threadLimit === void 0 && options.runLimit === void 0) throw new Error("At least one limit must be specified (threadLimit or runLimit)");
  const exitBehavior = options.exitBehavior ?? DEFAULT_EXIT_BEHAVIOR$1;
  const parseResult = exitBehaviorSchema.safeParse(exitBehavior);
  if (!parseResult.success) throw new Error(prettifyError(parseResult.error).slice(2));
  if (options.threadLimit !== void 0 && options.runLimit !== void 0 && options.runLimit > options.threadLimit) throw new Error(`runLimit (${options.runLimit}) cannot exceed threadLimit (${options.threadLimit}). The run limit should be less than or equal to the thread limit.`);
  const middlewareName = options.toolName ? `ToolCallLimitMiddleware[${options.toolName}]` : "ToolCallLimitMiddleware";
  return createMiddleware({
    name: middlewareName,
    stateSchema: stateSchema$2,
    afterModel: {
      canJumpTo: ["end"],
      hook: (state) => {
        const lastAIMessage = [...state.messages].reverse().find(messages.AIMessage.isInstance);
        if (!lastAIMessage || !lastAIMessage.tool_calls) return void 0;
        const wouldExceedLimit = (threadCount, runCount) => {
          return options.threadLimit !== void 0 && threadCount + 1 > options.threadLimit || options.runLimit !== void 0 && runCount + 1 > options.runLimit;
        };
        const matchesToolFilter = (toolCall) => {
          return options.toolName === void 0 || toolCall.name === options.toolName;
        };
        const separateToolCalls = (toolCalls, threadCount, runCount) => {
          const allowed$1 = [];
          const blocked$1 = [];
          let tempThreadCount = threadCount;
          let tempRunCount = runCount;
          for (const toolCall of toolCalls) {
            if (!matchesToolFilter(toolCall)) continue;
            if (wouldExceedLimit(tempThreadCount, tempRunCount)) blocked$1.push(toolCall);
            else {
              allowed$1.push(toolCall);
              tempThreadCount += 1;
              tempRunCount += 1;
            }
          }
          return {
            allowed: allowed$1,
            blocked: blocked$1,
            finalThreadCount: tempThreadCount,
            finalRunCount: tempRunCount + blocked$1.length
          };
        };
        const countKey = options.toolName ?? DEFAULT_TOOL_COUNT_KEY;
        const threadCounts = { ...state.threadToolCallCount ?? {} };
        const runCounts = { ...state.runToolCallCount ?? {} };
        const currentThreadCount = threadCounts[countKey] ?? 0;
        const currentRunCount = runCounts[countKey] ?? 0;
        const { allowed, blocked, finalThreadCount, finalRunCount } = separateToolCalls(lastAIMessage.tool_calls, currentThreadCount, currentRunCount);
        threadCounts[countKey] = finalThreadCount;
        runCounts[countKey] = finalRunCount;
        if (blocked.length === 0) {
          if (allowed.length > 0) return {
            threadToolCallCount: threadCounts,
            runToolCallCount: runCounts
          };
          return void 0;
        }
        if (exitBehavior === "error") {
          const hypotheticalThreadCount = finalThreadCount + blocked.length;
          throw new ToolCallLimitExceededError(hypotheticalThreadCount, finalRunCount, options.threadLimit, options.runLimit, options.toolName);
        }
        const toolMsgContent = buildToolMessageContent(options.toolName);
        const artificialMessages = blocked.map((toolCall) => new messages.ToolMessage({
          content: toolMsgContent,
          tool_call_id: toolCall.id,
          name: toolCall.name,
          status: "error"
        }));
        if (exitBehavior === "end") {
          let otherTools = [];
          if (options.toolName !== void 0)
            otherTools = lastAIMessage.tool_calls.filter((tc) => tc.name !== options.toolName);
          else {
            const uniqueToolNames = new Set(lastAIMessage.tool_calls.map((tc) => tc.name).filter(Boolean));
            if (uniqueToolNames.size > 1)
              otherTools = allowed.length > 0 ? allowed : lastAIMessage.tool_calls;
          }
          if (otherTools.length > 0) {
            const toolNames = Array.from(new Set(otherTools.map((tc) => tc.name).filter(Boolean))).join(", ");
            throw new Error(`Cannot end execution with other tool calls pending. Found calls to: ${toolNames}. Use 'continue' or 'error' behavior instead.`);
          }
          const hypotheticalThreadCount = finalThreadCount + blocked.length;
          const finalMsgContent = buildFinalAIMessageContent(hypotheticalThreadCount, finalRunCount, options.threadLimit, options.runLimit, options.toolName);
          artificialMessages.push(new messages.AIMessage(finalMsgContent));
          return {
            threadToolCallCount: threadCounts,
            runToolCallCount: runCounts,
            jumpTo: "end",
            messages: artificialMessages
          };
        }
        return {
          threadToolCallCount: threadCounts,
          runToolCallCount: runCounts,
          messages: artificialMessages
        };
      }
    },
    afterAgent: () => ({ runToolCallCount: {} })
  });
}
const WRITE_TODOS_DESCRIPTION = `Use this tool to create and manage a structured task list for your current work session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.
Only use this tool if you think it will be helpful in staying organized. If the user's request is trivial and takes less than 3 steps, it is better to NOT use this tool and just do the task directly.

## When to Use This Tool
Use this tool in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. The plan may need future revisions or updates based on results from the first few steps. Keeping track of this in a list is helpful.

## How to Use This Tool
1. When you start working on a task - Mark it as in_progress BEFORE beginning work.
2. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation.
3. You can also update future tasks, such as deleting them if they are no longer necessary, or adding new tasks that are necessary. Don't change previously completed tasks.
4. You can make several updates to the todo list at once. For example, when you complete a task, you can mark the next task you need to start as in_progress.

## When NOT to Use This Tool
It is important to skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Examples of When to Use the Todo List

<example>
User: I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!
Assistant: I'll help add a dark mode toggle to your application settings. Let me create a todo list to track this implementation.
*Creates todo list with the following items:*
1. Create dark mode toggle component in Settings page
2. Add dark mode state management (context/store)
3. Implement CSS-in-JS styles for dark theme
4. Update existing components to support theme switching
5. Run tests and build process, addressing any failures or errors that occur
*Begins working on the first task*

<reasoning>
The assistant used the todo list because:
1. Adding dark mode in it of itself is a multi-step feature requiring UI, state management, and styling changes
2. The assistant inferred that tests and build need to pass by adding "Ensure tests and build succeed" as the final task
3. Both of the user's requests are complex and require multiple steps to complete.
</reasoning>
</example>

<example>
User: Help me plan a comprehensive marketing campaign for our new product launch, including social media, email marketing, and press releases.
Assistant: I'll help you plan a comprehensive marketing campaign for your product launch. Let me create a todo list to organize all the components.
*Creates todo list with the following items:*
1. Define target audience and key messaging
2. Create social media content calendar and posting schedule
3. Design email marketing sequence and automation flows
4. Draft press release and identify media contacts
5. Set up tracking and analytics for campaign performance
6. Create visual assets and brand materials
7. Coordinate launch timeline and deliverables
*Begins working on the first task*

<reasoning>
The assistant used the todo list because:
1. Marketing campaign planning involves multiple distinct channels and activities
2. Each component requires careful coordination and planning
3. The systematic approach ensures all aspects of the launch are covered
</reasoning>
</example>

<example>
User: Help me rename the function getCwd to getCurrentWorkingDirectory across my project
Assistant: Let me first search through your codebase to find all occurrences of 'getCwd'.
*Uses search tools to locate all instances of getCwd in the codebase*
Assistant: I've found 15 instances of 'getCwd' across 8 different files. Let me create a todo list to track these changes.
*Creates todo list with specific items for each file that needs updating*

<reasoning>
The assistant used the todo list because:
1. The assistant searched to understand the scope of the task
2. Upon finding multiple occurrences across different files, it determined this was a complex task with multiple steps (>3)
3. The todo list helps ensure every instance is tracked and updated systematically
4. This approach prevents missing any occurrences and maintains consistency.
</reasoning>
</example>

<example>
User: I need help organizing my home office: decluttering the desk, setting up a filing system, organizing digital files, and creating a daily workflow.
Assistant: I'll help you organize your home office systematically. Let me create a todo list to track each area of organization.
*Creates todo list with items like: 1) Sort and declutter desk items, 2) Set up physical filing system for documents, 3) Organize digital files and folders, 4) Create daily workflow and productivity systems, 5) Establish maintenance routines*
Let's start with decluttering your desk space to create a clean foundation for the other organizational systems.

<reasoning>
The assistant used the todo list because:
1. The user provided multiple distinct organizational tasks
2. Each area requires different approaches and careful planning
3. Home organization benefits from systematic, step-by-step completion
4. Progress tracking ensures all areas are addressed thoroughly
</reasoning>
</example>

## Examples of When NOT to Use the Todo List

<example>
User: How do I print 'Hello World' in Python?
Assistant: In Python, you can print "Hello World" with this simple code:

\`\`\`python
print("Hello World")
\`\`\`

This will output the text "Hello World" to the console when executed.</assistant>

<reasoning>
The assistant did not use the todo list because this is a single, trivial task that can be completed in one step. There's no need to track multiple tasks or steps for such a straightforward request.
</reasoning>
</example>

<example>
User: What's the best way to water houseplants?
Assistant: The best way to water houseplants depends on the specific plant type, but here are some general guidelines:

- Check soil moisture by inserting your finger about 1-2 inches into the soil
- Water thoroughly when the top inch feels dry, allowing water to drain from the bottom
- Use room temperature water and water in the morning when possible
- Avoid overwatering, which is more harmful than underwatering for most plants

Different plants have different needs, so it's important to research your specific varieties for optimal care.

<reasoning>
The assistant did not use the todo list because this is an informational request with no actual tasks to complete. The user is simply asking for advice and explanation, not for the assistant to perform multiple steps or activities.
</reasoning>
</example>

<example>
User: Can you add a comment to the calculateTotal function to explain what it does?
Assistant: Sure, let me add a comment to the calculateTotal function to explain what it does.
* Uses the Edit tool to add a comment to the calculateTotal function *

<reasoning>
The assistant did not use the todo list because this is a single, straightforward task confined to one location. Adding a comment doesn't require tracking multiple steps or systematic organization.
</reasoning>
</example>

<example>
User: What time is it in Tokyo right now?
Assistant: I'll check the current time in Tokyo for you.

*Searches for current time in Tokyo*

The current time in Tokyo, Japan is [current time]. Tokyo is in the Japan Standard Time (JST) zone, which is UTC+9.

<reasoning>
The assistant did not use the todo list because this is a single information lookup with immediate results. There are no multiple steps to track or organize, making the todo list unnecessary for this straightforward request.
</reasoning>
</example>

<example>
User: I need to write a function that checks if a number is prime and then test it out.
Assistant: I'll help you write a function that checks if a number is prime and then test it out.
*Writes function that checks if a number is prime*
*Tests the function*

<reasoning>
Even though this is a multi-step task, it is very straightforward and can be completed in two trivial steps (which is less than 3 steps!). Using the todo list here is overkill and wastes time and tokens.
</reasoning>
</example>

<example>
User: I want you to order a pizza from Dominos, order a burger from McDonald's, and order a salad from Subway.
Assistant: I'll help you order a pizza from Dominos, order a burger from McDonald's, and order a salad from Subway.
*Orders a pizza from Dominos*
*Orders a burger from McDonald's*
*Orders a salad from Subway*

<reasoning>
Even though this is a multi-step task, assuming the assistant has the ability to order from these restaurants, it is very straightforward and can be completed in three trivial tool calls. 
Using the todo list here is overkill and wastes time and tokens. These three tool calls should be made in parallel, in fact.
</reasoning>
</example>


## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (you can have multiple tasks in_progress at a time if they are not related to each other and can be run in parallel)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely
   - IMPORTANT: When you write this todo list, you should mark your first task (or tasks) as in_progress immediately!.
   - IMPORTANT: Unless all tasks are completed, you should always have at least one task in_progress to show the user that you are working on something.

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - There are unresolved issues or errors
     - Work is partial or incomplete
     - You encountered blockers that prevent completion
     - You couldn't find necessary resources or dependencies
     - Quality standards haven't been met

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully
Remember: If you only need to make a few tool calls to complete a task, and it is clear what you need to do, it is better to just do the task directly and NOT call this tool at all.`;
const TODO_LIST_MIDDLEWARE_SYSTEM_PROMPT = `## \`write_todos\`

You have access to the \`write_todos\` tool to help you manage and plan complex objectives. 
Use this tool for complex objectives to ensure that you are tracking each necessary step and giving the user visibility into your progress.
This tool is very helpful for planning complex objectives, and for breaking down these larger complex objectives into smaller steps.

It is critical that you mark todos as completed as soon as you are done with a step. Do not batch up multiple steps before marking them as completed.
For simple objectives that only require a few steps, it is better to just complete the objective directly and NOT use this tool.
Writing todos takes time and tokens, use it when it is helpful for managing complex many-step problems! But not for simple few-step requests.

## Important To-Do List Usage Notes to Remember
- The \`write_todos\` tool should never be called multiple times in parallel.
- Don't be afraid to revise the To-Do list as you go. New information may reveal new tasks that need to be done, or old tasks that are irrelevant.`;
const TodoStatus = enumType([
  "pending",
  "in_progress",
  "completed"
]).describe("Status of the todo");
const TodoSchema = objectType({
  content: stringType().describe("Content of the todo item"),
  status: TodoStatus
});
const stateSchema$1 = objectType({ todos: arrayType(TodoSchema).default([]) });
function todoListMiddleware(options) {
  const writeTodos = tools.tool(({ todos }, config2) => {
    return new langgraph.Command({ update: {
      todos,
      messages: [new messages.ToolMessage({
        content: `Updated todo list to ${JSON.stringify(todos)}`,
        tool_call_id: config2.toolCall?.id
      })]
    } });
  }, {
    name: "write_todos",
    description: options?.toolDescription ?? WRITE_TODOS_DESCRIPTION,
    schema: objectType({ todos: arrayType(TodoSchema).describe("List of todo items to update") })
  });
  return createMiddleware({
    name: "todoListMiddleware",
    stateSchema: stateSchema$1,
    tools: [writeTodos],
    wrapModelCall: (request, handler) => handler({
      ...request,
      systemMessage: request.systemMessage.concat(`

${options?.systemPrompt ?? TODO_LIST_MIDDLEWARE_SYSTEM_PROMPT}`)
    }),
    afterModel: (state) => {
      const messages$1 = state.messages;
      if (!messages$1 || messages$1.length === 0) return void 0;
      const lastAiMsg = [...messages$1].reverse().find((msg) => messages.AIMessage.isInstance(msg));
      if (!lastAiMsg || !lastAiMsg.tool_calls || lastAiMsg.tool_calls.length === 0) return void 0;
      const writeTodosCalls = lastAiMsg.tool_calls.filter((tc) => tc.name === writeTodos.name);
      if (writeTodosCalls.length > 1) {
        const errorMessages = writeTodosCalls.map((tc) => new messages.ToolMessage({
          content: "Error: The `write_todos` tool should never be called multiple times in parallel. Please call it only once per model invocation to update the todo list.",
          tool_call_id: tc.id,
          status: "error"
        }));
        return { messages: errorMessages };
      }
      return void 0;
    }
  });
}
const DEFAULT_EXIT_BEHAVIOR = "end";
const contextSchema$1 = objectType({
  threadLimit: numberType().optional(),
  runLimit: numberType().optional(),
  exitBehavior: enumType(["error", "end"]).optional()
});
const stateSchema = objectType({
  threadModelCallCount: numberType().default(0),
  runModelCallCount: numberType().default(0)
});
var ModelCallLimitMiddlewareError = class extends Error {
  constructor({ threadLimit, runLimit, threadCount, runCount }) {
    const exceededHint = [];
    if (typeof threadLimit === "number" && typeof threadCount === "number") exceededHint.push(`thread level call limit reached with ${threadCount} model calls`);
    if (typeof runLimit === "number" && typeof runCount === "number") exceededHint.push(`run level call limit reached with ${runCount} model calls`);
    super(`Model call limits exceeded${exceededHint.length > 0 ? `: ${exceededHint.join(", ")}` : ""}`);
    this.name = "ModelCallLimitMiddlewareError";
  }
};
function modelCallLimitMiddleware(middlewareOptions) {
  return createMiddleware({
    name: "ModelCallLimitMiddleware",
    contextSchema: contextSchema$1,
    stateSchema,
    beforeModel: {
      canJumpTo: ["end"],
      hook: (state, runtime) => {
        let exitBehavior = runtime.context.exitBehavior ?? middlewareOptions?.exitBehavior ?? DEFAULT_EXIT_BEHAVIOR;
        if (exitBehavior === "throw") {
          console.warn("The 'throw' exit behavior is deprecated. Please use 'error' instead.");
          exitBehavior = "error";
        }
        const threadLimit = runtime.context.threadLimit ?? middlewareOptions?.threadLimit;
        const runLimit = runtime.context.runLimit ?? middlewareOptions?.runLimit;
        const threadCount = state.threadModelCallCount;
        const runCount = state.runModelCallCount;
        if (typeof threadLimit === "number" && threadLimit <= threadCount) {
          const error = new ModelCallLimitMiddlewareError({
            threadLimit,
            threadCount
          });
          if (exitBehavior === "end") return {
            jumpTo: "end",
            messages: [new messages.AIMessage(error.message)]
          };
          throw error;
        }
        if (typeof runLimit === "number" && runLimit <= runCount) {
          const error = new ModelCallLimitMiddlewareError({
            runLimit,
            runCount
          });
          if (exitBehavior === "end") return {
            jumpTo: "end",
            messages: [new messages.AIMessage(error.message)]
          };
          throw error;
        }
        return state;
      }
    },
    afterModel: (state) => ({
      runModelCallCount: state.runModelCallCount + 1,
      threadModelCallCount: state.threadModelCallCount + 1
    }),
    afterAgent: () => ({ runModelCallCount: 0 })
  });
}
function modelFallbackMiddleware(...fallbackModels) {
  return createMiddleware({
    name: "modelFallbackMiddleware",
    wrapModelCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        for (let i = 0; i < fallbackModels.length; i++) try {
          const fallbackModel = fallbackModels[i];
          const model = typeof fallbackModel === "string" ? await initChatModel(fallbackModel) : fallbackModel;
          return await handler({
            ...request,
            model
          });
        } catch (fallbackError) {
          if (i === fallbackModels.length - 1) throw fallbackError;
        }
        throw error;
      }
    }
  });
}
const RetrySchema = objectType({
  maxRetries: numberType().min(0).default(2),
  retryOn: unionType([functionType().args(instanceOfType(Error)).returns(booleanType()), arrayType(custom$1())]).default(() => () => true),
  backoffFactor: numberType().min(0).default(2),
  initialDelayMs: numberType().min(0).default(1e3),
  maxDelayMs: numberType().min(0).default(6e4),
  jitter: booleanType().default(true)
});
var InvalidRetryConfigError = class extends Error {
  cause;
  constructor(error) {
    const message = prettifyError(error).slice(2);
    super(message);
    this.name = "InvalidRetryConfigError";
    this.cause = error;
  }
};
const ModelRetryMiddlewareOptionsSchema = objectType({ onFailure: unionType([
  literalType("error"),
  literalType("continue"),
  functionType().args(instanceOfType(Error)).returns(stringType())
]).default("continue") }).merge(RetrySchema);
function modelRetryMiddleware(config2 = {}) {
  const { success, error, data } = ModelRetryMiddlewareOptionsSchema.safeParse(config2);
  if (!success) throw new InvalidRetryConfigError(error);
  const { maxRetries, retryOn, onFailure, backoffFactor, initialDelayMs, maxDelayMs, jitter } = data;
  const shouldRetryException = (error$1) => {
    if (typeof retryOn === "function") return retryOn(error$1);
    return retryOn.some((ErrorConstructor) => error$1.constructor === ErrorConstructor);
  };
  const delayConfig = {
    backoffFactor,
    initialDelayMs,
    maxDelayMs,
    jitter
  };
  const formatFailureMessage = (error$1, attemptsMade) => {
    const errorType = error$1.constructor.name;
    const attemptWord = attemptsMade === 1 ? "attempt" : "attempts";
    return `Model call failed after ${attemptsMade} ${attemptWord} with ${errorType}: ${error$1.message}`;
  };
  const handleFailure = (error$1, attemptsMade) => {
    if (onFailure === "error") throw error$1;
    let content;
    if (typeof onFailure === "function") content = onFailure(error$1);
    else content = formatFailureMessage(error$1, attemptsMade);
    return new messages.AIMessage({ content });
  };
  return createMiddleware({
    name: "modelRetryMiddleware",
    contextSchema: ModelRetryMiddlewareOptionsSchema,
    wrapModelCall: async (request, handler) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) try {
        return await handler(request);
      } catch (error$1) {
        const attemptsMade = attempt + 1;
        const err = error$1 && typeof error$1 === "object" && "message" in error$1 ? error$1 : new Error(String(error$1));
        if (!shouldRetryException(err)) return handleFailure(err, attemptsMade);
        if (attempt < maxRetries) {
          const delay = calculateRetryDelay(delayConfig, attempt);
          if (delay > 0) await sleep(delay);
        } else return handleFailure(err, attemptsMade);
      }
      throw new Error("Unexpected: retry loop completed without returning");
    }
  });
}
const ToolRetryMiddlewareOptionsSchema = objectType({
  tools: arrayType(unionType([
    custom$1(),
    custom$1(),
    stringType()
  ])).optional(),
  onFailure: unionType([
    literalType("error"),
    literalType("continue"),
    literalType("raise"),
    literalType("return_message"),
    functionType().args(instanceOfType(Error)).returns(stringType())
  ]).default("continue")
}).merge(RetrySchema);
function toolRetryMiddleware(config2 = {}) {
  const { success, error, data } = ToolRetryMiddlewareOptionsSchema.safeParse(config2);
  if (!success) throw new InvalidRetryConfigError(error);
  const { maxRetries, tools: tools2, retryOn, onFailure: onFailureConfig, backoffFactor, initialDelayMs, maxDelayMs, jitter } = data;
  let onFailure = onFailureConfig;
  if (onFailureConfig === "raise") {
    console.warn("⚠️ `onFailure: 'raise'` is deprecated. Use `onFailure: 'error'` instead.");
    onFailure = "error";
  } else if (onFailureConfig === "return_message") {
    console.warn("⚠️ `onFailure: 'return_message'` is deprecated. Use `onFailure: 'continue'` instead.");
    onFailure = "continue";
  }
  const toolFilter = [];
  for (const tool of tools2 ?? []) if (typeof tool === "string") toolFilter.push(tool);
  else if ("name" in tool && typeof tool.name === "string") toolFilter.push(tool.name);
  else throw new TypeError("Expected a tool name string or tool instance to be passed to toolRetryMiddleware");
  const shouldRetryTool = (toolName) => {
    if (toolFilter.length === 0) return true;
    return toolFilter.includes(toolName);
  };
  const shouldRetryException = (error$1) => {
    if (typeof retryOn === "function") return retryOn(error$1);
    return retryOn.some((ErrorConstructor) => {
      return error$1 instanceof ErrorConstructor;
    });
  };
  const delayConfig = {
    backoffFactor,
    initialDelayMs,
    maxDelayMs,
    jitter
  };
  const formatFailureMessage = (toolName, error$1, attemptsMade) => {
    const errorType = error$1.constructor.name;
    const attemptWord = attemptsMade === 1 ? "attempt" : "attempts";
    return `Tool '${toolName}' failed after ${attemptsMade} ${attemptWord} with ${errorType}`;
  };
  const handleFailure = (toolName, toolCallId, error$1, attemptsMade) => {
    if (onFailure === "error") throw error$1;
    let content;
    if (typeof onFailure === "function") content = onFailure(error$1);
    else content = formatFailureMessage(toolName, error$1, attemptsMade);
    return new messages.ToolMessage({
      content,
      tool_call_id: toolCallId,
      name: toolName,
      status: "error"
    });
  };
  return createMiddleware({
    name: "toolRetryMiddleware",
    contextSchema: ToolRetryMiddlewareOptionsSchema,
    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall.name;
      if (!shouldRetryTool(toolName)) return handler(request);
      const toolCallId = request.toolCall.id ?? "";
      for (let attempt = 0; attempt <= maxRetries; attempt++) try {
        return await handler(request);
      } catch (error$1) {
        const attemptsMade = attempt + 1;
        const err = error$1 && typeof error$1 === "object" && "message" in error$1 ? error$1 : new Error(String(error$1));
        if (!shouldRetryException(err)) return handleFailure(toolName, toolCallId, err, attemptsMade);
        if (attempt < maxRetries) {
          const delay = calculateRetryDelay(delayConfig, attempt);
          if (delay > 0) await sleep(delay);
        } else return handleFailure(toolName, toolCallId, err, attemptsMade);
      }
      throw new Error("Unexpected: retry loop completed without returning");
    }
  });
}
function toolEmulatorMiddleware(options = {}) {
  let agentModel;
  const { tools: tools2, model } = options;
  const emulateAll = !tools2 || tools2.length === 0;
  const toolsToEmulate = /* @__PURE__ */ new Set();
  if (!emulateAll && tools2) for (const tool of tools2) if (typeof tool === "string") toolsToEmulate.add(tool);
  else {
    const toolName = typeof tool.name === "string" ? tool.name : String(tool.name);
    toolsToEmulate.add(toolName);
  }
  let emulatorModel;
  const getEmulatorModel = async () => {
    if (typeof model === "object") return model;
    if (typeof model === "string") {
      emulatorModel = emulatorModel ?? await initChatModel(model, { temperature: 1 }).catch((err) => {
        console.error("Error initializing emulator model, using agent model:", err);
        return agentModel;
      });
      return emulatorModel;
    }
    return agentModel;
  };
  return createMiddleware({
    name: "ToolEmulatorMiddleware",
    wrapModelCall: async (request, handler) => {
      agentModel = request.model;
      return handler(request);
    },
    wrapToolCall: async (request, handler) => {
      const toolName = request.toolCall.name;
      const shouldEmulate = emulateAll || toolsToEmulate.has(toolName);
      if (!shouldEmulate) return handler(request);
      const toolArgs = request.toolCall.args;
      const toolDescription = request.tool?.description || "No description available";
      const toolArgsString = typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs);
      const prompt = `You are emulating a tool call for testing purposes.

Tool: ${toolName}
Description: ${toolDescription}
Arguments: ${toolArgsString}

Generate a realistic response that this tool would return given these arguments.
Return ONLY the tool's output, no explanation or preamble. Introduce variation into your responses.`;
      const emulator = await getEmulatorModel();
      const response = await emulator.invoke([new messages.HumanMessage(prompt)]);
      const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      return new messages.ToolMessage({
        content,
        tool_call_id: request.toolCall.id ?? "",
        name: toolName
      });
    }
  });
}
function isOpenAIModel(model) {
  if (!model || typeof model !== "object" || model === null || !("client" in model) || !("_getClientOptions" in model) || typeof model._getClientOptions !== "function") return false;
  model._getClientOptions();
  return typeof model.client === "object" && model.client !== null && "moderations" in model.client && typeof model.client.moderations === "object" && model.client.moderations !== null && "create" in model.client.moderations && typeof model.client.moderations.create === "function";
}
const DEFAULT_VIOLATION_TEMPLATE = "I'm sorry, but I can't comply with that request. It was flagged for {categories}.";
var OpenAIModerationError = class extends Error {
  content;
  stage;
  result;
  originalMessage;
  constructor({ content, stage, result, message }) {
    super(message);
    this.name = "OpenAIModerationError";
    this.content = content;
    this.stage = stage;
    this.result = result;
    this.originalMessage = message;
  }
};
function openAIModerationMiddleware(options) {
  const { model, moderationModel = "omni-moderation-latest", checkInput = true, checkOutput = true, checkToolResults = false, exitBehavior = "end", violationMessage } = options;
  let openaiModel;
  const initModerationModel = async () => {
    if (openaiModel) return openaiModel;
    const resolvedModel = typeof model === "string" ? await initChatModel(model) : model;
    if (!resolvedModel.getName().includes("ChatOpenAI")) throw new Error(`Model must be an OpenAI model to use moderation middleware. Got: ${resolvedModel.getName()}`);
    if (!isOpenAIModel(resolvedModel)) throw new Error("Model must support moderation to use moderation middleware.");
    openaiModel = resolvedModel;
    return openaiModel;
  };
  const extractText = (message) => {
    if (message.content == null) return null;
    const text = message.text;
    return text || null;
  };
  const findLastIndex = (messages2, messageType) => {
    for (let idx = messages2.length - 1; idx >= 0; idx--) if (messageType.isInstance(messages2[idx])) return idx;
    return null;
  };
  const formatViolationMessage = (content, result) => {
    const categories = [];
    const categoriesObj = result.categories;
    for (const [name, flagged] of Object.entries(categoriesObj)) if (flagged) categories.push(name.replace(/_/g, " "));
    const categoryLabel = categories.length > 0 ? categories.join(", ") : "OpenAI's safety policies";
    const template = violationMessage || DEFAULT_VIOLATION_TEMPLATE;
    const scoresJson = JSON.stringify(result.category_scores, null, 2);
    try {
      return template.replace("{categories}", categoryLabel).replace("{category_scores}", scoresJson).replace("{original_content}", content);
    } catch {
      return template;
    }
  };
  function moderateContent(input, params) {
    const clientOptions = openaiModel?._getClientOptions?.();
    const moderationModel$1 = params?.model ?? "omni-moderation-latest";
    const moderationRequest = {
      input,
      model: moderationModel$1
    };
    return openaiModel.client.moderations.create(moderationRequest, clientOptions);
  }
  const applyViolation = (messages$1, index2, stage, content, result) => {
    const violationText = formatViolationMessage(content, result);
    if (exitBehavior === "error") throw new OpenAIModerationError({
      content,
      stage,
      result,
      message: violationText
    });
    if (exitBehavior === "end") return {
      jumpTo: "end",
      messages: [new messages.AIMessage({ content: violationText })]
    };
    if (index2 == null) return void 0;
    const newMessages = [...messages$1];
    const original = newMessages[index2];
    const MessageConstructor = Object.getPrototypeOf(original).constructor;
    newMessages[index2] = new MessageConstructor({
      ...original,
      content: violationText
    });
    return { messages: newMessages };
  };
  const moderateUserMessage = async (messages$1) => {
    const idx = findLastIndex(messages$1, messages.HumanMessage);
    if (idx == null) return null;
    const message = messages$1[idx];
    const text = extractText(message);
    if (!text) return null;
    await initModerationModel();
    const response = await moderateContent(text, { model: moderationModel });
    const flaggedResult = response.results.find((result) => result.flagged);
    if (!flaggedResult) return null;
    return applyViolation(messages$1, idx, "input", text, flaggedResult);
  };
  const moderateToolMessages = async (messages$1) => {
    const lastAiIdx = findLastIndex(messages$1, messages.AIMessage);
    if (lastAiIdx == null) return null;
    const working = [...messages$1];
    let modified = false;
    for (let idx = lastAiIdx + 1; idx < working.length; idx++) {
      const msg = working[idx];
      if (!messages.ToolMessage.isInstance(msg)) continue;
      const text = extractText(msg);
      if (!text) continue;
      await initModerationModel();
      const response = await moderateContent(text, { model: moderationModel });
      const flaggedResult = response.results.find((result) => result.flagged);
      if (!flaggedResult) continue;
      const action = applyViolation(working, idx, "tool", text, flaggedResult);
      if (action) {
        if ("jumpTo" in action) return action;
        if ("messages" in action) {
          working.splice(0, working.length, ...action.messages);
          modified = true;
        }
      }
    }
    if (modified) return { messages: working };
    return null;
  };
  const moderateOutput = async (messages$1) => {
    const lastAiIdx = findLastIndex(messages$1, messages.AIMessage);
    if (lastAiIdx == null) return null;
    const aiMessage = messages$1[lastAiIdx];
    const text = extractText(aiMessage);
    if (!text) return null;
    await initModerationModel();
    const response = await moderateContent(text, { model: moderationModel });
    const flaggedResult = response.results.find((result) => result.flagged);
    if (!flaggedResult) return null;
    return applyViolation(messages$1, lastAiIdx, "output", text, flaggedResult);
  };
  const moderateInputs = async (messages2) => {
    const working = [...messages2];
    let modified = false;
    if (checkToolResults) {
      const action = await moderateToolMessages(working);
      if (action) {
        if ("jumpTo" in action) return action;
        if ("messages" in action) {
          working.splice(0, working.length, ...action.messages);
          modified = true;
        }
      }
    }
    if (checkInput) {
      const action = await moderateUserMessage(working);
      if (action) {
        if ("jumpTo" in action) return action;
        if ("messages" in action) {
          working.splice(0, working.length, ...action.messages);
          modified = true;
        }
      }
    }
    if (modified) return { messages: working };
    return null;
  };
  return createMiddleware({
    name: "OpenAIModerationMiddleware",
    beforeModel: {
      hook: async (state) => {
        if (!checkInput && !checkToolResults) return void 0;
        const messages2 = state.messages || [];
        if (messages2.length === 0) return void 0;
        return await moderateInputs(messages2) ?? void 0;
      },
      canJumpTo: ["end"]
    },
    afterModel: {
      hook: async (state) => {
        if (!checkOutput) return void 0;
        const messages2 = state.messages || [];
        if (messages2.length === 0) return void 0;
        return await moderateOutput(messages2) ?? void 0;
      },
      canJumpTo: ["end"]
    }
  });
}
const DEFAULT_ENABLE_CACHING = true;
const DEFAULT_TTL = "5m";
const DEFAULT_MIN_MESSAGES_TO_CACHE = 3;
const DEFAULT_UNSUPPORTED_MODEL_BEHAVIOR = "warn";
const contextSchema = objectType({
  enableCaching: booleanType().optional(),
  ttl: enumType(["5m", "1h"]).optional(),
  minMessagesToCache: numberType().optional(),
  unsupportedModelBehavior: enumType([
    "ignore",
    "warn",
    "raise"
  ]).optional()
});
var PromptCachingMiddlewareError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PromptCachingMiddlewareError";
  }
};
function anthropicPromptCachingMiddleware(middlewareOptions) {
  return createMiddleware({
    name: "PromptCachingMiddleware",
    contextSchema,
    wrapModelCall: (request, handler) => {
      const enableCaching = request.runtime.context.enableCaching ?? middlewareOptions?.enableCaching ?? DEFAULT_ENABLE_CACHING;
      const ttl = request.runtime.context.ttl ?? middlewareOptions?.ttl ?? DEFAULT_TTL;
      const minMessagesToCache = request.runtime.context.minMessagesToCache ?? middlewareOptions?.minMessagesToCache ?? DEFAULT_MIN_MESSAGES_TO_CACHE;
      const unsupportedModelBehavior = request.runtime.context.unsupportedModelBehavior ?? middlewareOptions?.unsupportedModelBehavior ?? DEFAULT_UNSUPPORTED_MODEL_BEHAVIOR;
      if (!enableCaching || !request.model) return handler(request);
      const isAnthropicModel = request.model.getName() === "ChatAnthropic" || request.model.getName() === "ConfigurableModel" && request.model._defaultConfig?.modelProvider === "anthropic";
      if (!isAnthropicModel) {
        const modelName = request.model.getName();
        const modelInfo = request.model.getName() === "ConfigurableModel" ? `${modelName} (${request.model._defaultConfig?.modelProvider})` : modelName;
        const baseMessage = `Unsupported model '${modelInfo}'. Prompt caching requires an Anthropic model`;
        if (unsupportedModelBehavior === "raise") throw new PromptCachingMiddlewareError(`${baseMessage} (e.g., 'anthropic:claude-4-0-sonnet').`);
        else if (unsupportedModelBehavior === "warn") console.warn(`PromptCachingMiddleware: Skipping caching for ${modelName}. Consider switching to an Anthropic model for caching benefits.`);
        return handler(request);
      }
      const messagesCount = request.state.messages.length + (request.systemPrompt ? 1 : 0);
      if (messagesCount < minMessagesToCache) return handler(request);
      return handler({
        ...request,
        modelSettings: {
          ...request.modelSettings,
          cache_control: {
            type: "ephemeral",
            ttl
          }
        }
      });
    }
  });
}
var src_exports = {};
__export(src_exports, {
  AIMessage: () => messages.AIMessage,
  AIMessageChunk: () => messages.AIMessageChunk,
  BaseMessage: () => messages.BaseMessage,
  BaseMessageChunk: () => messages.BaseMessageChunk,
  ClearToolUsesEdit: () => ClearToolUsesEdit,
  Document: () => documents.Document,
  DynamicStructuredTool: () => tools.DynamicStructuredTool,
  DynamicTool: () => tools.DynamicTool,
  FakeToolCallingModel: () => FakeToolCallingModel,
  HumanMessage: () => messages.HumanMessage,
  HumanMessageChunk: () => messages.HumanMessageChunk,
  InMemoryStore: () => stores.InMemoryStore,
  MIDDLEWARE_BRAND: () => MIDDLEWARE_BRAND,
  MiddlewareError: () => MiddlewareError,
  MultipleStructuredOutputsError: () => MultipleStructuredOutputsError,
  MultipleToolsBoundError: () => MultipleToolsBoundError,
  PIIDetectionError: () => PIIDetectionError,
  ProviderStrategy: () => ProviderStrategy,
  StructuredOutputParsingError: () => StructuredOutputParsingError,
  StructuredTool: () => tools.StructuredTool,
  SystemMessage: () => messages.SystemMessage,
  SystemMessageChunk: () => messages.SystemMessageChunk,
  TODO_LIST_MIDDLEWARE_SYSTEM_PROMPT: () => TODO_LIST_MIDDLEWARE_SYSTEM_PROMPT,
  Tool: () => tools.Tool,
  ToolCallLimitExceededError: () => ToolCallLimitExceededError,
  ToolInvocationError: () => ToolInvocationError,
  ToolMessage: () => messages.ToolMessage,
  ToolMessageChunk: () => messages.ToolMessageChunk,
  ToolStrategy: () => ToolStrategy,
  anthropicPromptCachingMiddleware: () => anthropicPromptCachingMiddleware,
  applyStrategy: () => applyStrategy,
  context: () => context.context,
  contextEditingMiddleware: () => contextEditingMiddleware,
  countTokensApproximately: () => countTokensApproximately,
  createAgent: () => createAgent,
  createMiddleware: () => createMiddleware,
  detectCreditCard: () => detectCreditCard,
  detectEmail: () => detectEmail,
  detectIP: () => detectIP,
  detectMacAddress: () => detectMacAddress,
  detectUrl: () => detectUrl,
  dynamicSystemPromptMiddleware: () => dynamicSystemPromptMiddleware,
  filterMessages: () => messages.filterMessages,
  humanInTheLoopMiddleware: () => humanInTheLoopMiddleware,
  initChatModel: () => initChatModel,
  llmToolSelectorMiddleware: () => llmToolSelectorMiddleware,
  modelCallLimitMiddleware: () => modelCallLimitMiddleware,
  modelFallbackMiddleware: () => modelFallbackMiddleware,
  modelRetryMiddleware: () => modelRetryMiddleware,
  openAIModerationMiddleware: () => openAIModerationMiddleware,
  piiMiddleware: () => piiMiddleware,
  piiRedactionMiddleware: () => piiRedactionMiddleware,
  providerStrategy: () => providerStrategy,
  resolveRedactionRule: () => resolveRedactionRule,
  summarizationMiddleware: () => summarizationMiddleware,
  todoListMiddleware: () => todoListMiddleware,
  tool: () => tools.tool,
  toolCallLimitMiddleware: () => toolCallLimitMiddleware,
  toolEmulatorMiddleware: () => toolEmulatorMiddleware,
  toolRetryMiddleware: () => toolRetryMiddleware,
  toolStrategy: () => toolStrategy,
  trimMessages: () => messages.trimMessages
});
const OPENWORK_DIR = path.join(os.homedir(), ".openwork");
const ENV_FILE = path.join(OPENWORK_DIR, ".env");
const ENV_VAR_NAMES = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  ollama: ""
  // Ollama doesn't require an API key
};
function getOpenworkDir() {
  if (!fs.existsSync(OPENWORK_DIR)) {
    fs.mkdirSync(OPENWORK_DIR, { recursive: true });
  }
  return OPENWORK_DIR;
}
function getDbPath() {
  return path.join(getOpenworkDir(), "openwork.sqlite");
}
function getMemoryDbPath() {
  return path.join(getOpenworkDir(), "memory.sqlite");
}
function getThreadCheckpointDir() {
  const dir = path.join(getOpenworkDir(), "threads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
function getThreadCheckpointPath(threadId) {
  return path.join(getThreadCheckpointDir(), `${threadId}.sqlite`);
}
function getThreadRalphLogPath(threadId) {
  return path.join(getThreadCheckpointDir(), `${threadId}.ralph.jsonl`);
}
function deleteThreadCheckpoint(threadId) {
  const path2 = getThreadCheckpointPath(threadId);
  if (fs.existsSync(path2)) {
    fs.unlinkSync(path2);
  }
}
function hasThreadCheckpoint(threadId) {
  const path2 = getThreadCheckpointPath(threadId);
  return fs.existsSync(path2);
}
function getEnvFilePath() {
  return ENV_FILE;
}
function parseEnvFile() {
  const envPath = getEnvFilePath();
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
  }
  return result;
}
function writeEnvFile(env) {
  getOpenworkDir();
  const lines = Object.entries(env).filter((entry) => entry[1]).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(getEnvFilePath(), lines.join("\n") + "\n");
}
function getApiKey(provider) {
  const envVarName = ENV_VAR_NAMES[provider];
  if (!envVarName) return void 0;
  const env = parseEnvFile();
  if (env[envVarName]) return env[envVarName];
  return process.env[envVarName];
}
function setApiKey(provider, apiKey) {
  const envVarName = ENV_VAR_NAMES[provider];
  if (!envVarName) return;
  const env = parseEnvFile();
  env[envVarName] = apiKey;
  writeEnvFile(env);
  process.env[envVarName] = apiKey;
}
function deleteApiKey(provider) {
  const envVarName = ENV_VAR_NAMES[provider];
  if (!envVarName) return;
  const env = parseEnvFile();
  delete env[envVarName];
  writeEnvFile(env);
  delete process.env[envVarName];
}
function hasApiKey(provider) {
  return !!getApiKey(provider);
}
let db$1 = null;
let saveTimer$1 = null;
let dirty$1 = false;
function saveToDisk() {
  if (!db$1) return;
  dirty$1 = true;
  if (saveTimer$1) {
    clearTimeout(saveTimer$1);
  }
  saveTimer$1 = setTimeout(() => {
    if (db$1 && dirty$1) {
      const data = db$1.export();
      fs.writeFileSync(getDbPath(), Buffer.from(data));
      dirty$1 = false;
    }
  }, 100);
}
function markDbDirty() {
  saveToDisk();
}
function getDb() {
  if (!db$1) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return db$1;
}
async function initializeDatabase() {
  const dbPath = getDbPath();
  console.log("Initializing database at:", dbPath);
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db$1 = new SQL.Database(buffer);
  } else {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db$1 = new SQL.Database();
  }
  db$1.run(`
    CREATE TABLE IF NOT EXISTS threads (
      thread_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'idle',
      thread_values TEXT,
      title TEXT
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      thread_id TEXT REFERENCES threads(thread_id) ON DELETE CASCADE,
      assistant_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT,
      metadata TEXT,
      kwargs TEXT
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS assistants (
      assistant_id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      name TEXT,
      model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS provider_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS tool_config (
      name TEXT PRIMARY KEY,
      enabled INTEGER,
      enabled_classic INTEGER,
      enabled_butler INTEGER,
      key TEXT
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      command TEXT,
      args TEXT,
      env TEXT,
      cwd TEXT,
      url TEXT,
      headers TEXT,
      auto_start INTEGER,
      enabled_classic INTEGER,
      enabled_butler INTEGER,
      enabled INTEGER
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS subagents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      model TEXT,
      model_provider TEXT,
      tools TEXT,
      middleware TEXT,
      skills TEXT,
      interrupt_on INTEGER,
      enabled_classic INTEGER,
      enabled_butler INTEGER,
      enabled INTEGER
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS butler_calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      reminder_sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS butler_countdown_timers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL,
      reminder_sent_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS butler_mail_watch_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder TEXT NOT NULL,
      from_contains TEXT,
      subject_contains TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_seen_uid INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db$1.run(`
    CREATE TABLE IF NOT EXISTS butler_mail_watch_messages (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      uid INTEGER NOT NULL,
      subject TEXT NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      received_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  db$1.run(`CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at)`);
  db$1.run(`CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id)`);
  db$1.run(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`);
  db$1.run(
    `CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated_at ON prompt_templates(updated_at)`
  );
  db$1.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_name ON prompt_templates(name COLLATE NOCASE)`
  );
  db$1.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_calendar_events_start_at ON butler_calendar_events(start_at)`
  );
  db$1.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_countdown_timers_due_at ON butler_countdown_timers(due_at)`
  );
  db$1.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_mail_watch_rules_enabled ON butler_mail_watch_rules(enabled)`
  );
  db$1.run(
    `CREATE INDEX IF NOT EXISTS idx_butler_mail_watch_messages_rule_created ON butler_mail_watch_messages(rule_id, created_at DESC)`
  );
  db$1.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_butler_mail_watch_messages_rule_uid ON butler_mail_watch_messages(rule_id, uid)`
  );
  if (!tableHasColumn(db$1, "subagents", "model_provider")) {
    db$1.run(`ALTER TABLE subagents ADD COLUMN model_provider TEXT`);
  }
  if (!tableHasColumn(db$1, "subagents", "skills")) {
    db$1.run(`ALTER TABLE subagents ADD COLUMN skills TEXT`);
  }
  if (!tableHasColumn(db$1, "tool_config", "enabled_classic")) {
    db$1.run(`ALTER TABLE tool_config ADD COLUMN enabled_classic INTEGER`);
  }
  if (!tableHasColumn(db$1, "tool_config", "enabled_butler")) {
    db$1.run(`ALTER TABLE tool_config ADD COLUMN enabled_butler INTEGER`);
  }
  if (!tableHasColumn(db$1, "mcp_servers", "enabled_classic")) {
    db$1.run(`ALTER TABLE mcp_servers ADD COLUMN enabled_classic INTEGER`);
  }
  if (!tableHasColumn(db$1, "mcp_servers", "enabled_butler")) {
    db$1.run(`ALTER TABLE mcp_servers ADD COLUMN enabled_butler INTEGER`);
  }
  if (!tableHasColumn(db$1, "subagents", "enabled_classic")) {
    db$1.run(`ALTER TABLE subagents ADD COLUMN enabled_classic INTEGER`);
  }
  if (!tableHasColumn(db$1, "subagents", "enabled_butler")) {
    db$1.run(`ALTER TABLE subagents ADD COLUMN enabled_butler INTEGER`);
  }
  db$1.run(
    `UPDATE tool_config
     SET enabled_classic = COALESCE(enabled_classic, enabled),
         enabled_butler = COALESCE(enabled_butler, enabled)
     WHERE enabled IS NOT NULL`
  );
  db$1.run(
    `UPDATE mcp_servers
     SET enabled_classic = COALESCE(enabled_classic, enabled),
         enabled_butler = COALESCE(enabled_butler, enabled)
     WHERE enabled IS NOT NULL`
  );
  db$1.run(
    `UPDATE subagents
     SET enabled_classic = COALESCE(enabled_classic, enabled),
         enabled_butler = COALESCE(enabled_butler, enabled)
     WHERE enabled IS NOT NULL`
  );
  migrateConfigFromJson(db$1);
  saveToDisk();
  console.log("Database initialized successfully");
  return db$1;
}
function readLegacyJson(filename) {
  const filePath = path.join(getOpenworkDir(), filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function tableHasRows(database, tableName) {
  const stmt = database.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`);
  const has = stmt.step();
  stmt.free();
  return has;
}
function tableHasColumn(database, tableName, columnName) {
  const stmt = database.prepare(`PRAGMA table_info(${tableName})`);
  let found = false;
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.name === columnName) {
      found = true;
      break;
    }
  }
  stmt.free();
  return found;
}
function getMetaValue(database, key) {
  const stmt = database.prepare("SELECT value FROM meta WHERE key = ?");
  stmt.bind([key]);
  const hasRow = stmt.step();
  if (!hasRow) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row.value ?? null;
}
function setMetaValue(database, key, value) {
  database.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, value]);
}
function migrateConfigFromJson(database) {
  const migrated = getMetaValue(database, "json_migrated");
  if (migrated === "1") {
    return;
  }
  let wrote = false;
  if (!tableHasRows(database, "app_settings")) {
    const settings = readLegacyJson("settings.json");
    if (settings) {
      database.run("INSERT OR REPLACE INTO app_settings (id, data) VALUES (1, ?)", [
        JSON.stringify(settings)
      ]);
      wrote = true;
    }
  }
  if (!tableHasRows(database, "provider_config")) {
    const config2 = readLegacyJson("provider-config.json");
    if (config2) {
      database.run("INSERT OR REPLACE INTO provider_config (id, data) VALUES (1, ?)", [
        JSON.stringify(config2)
      ]);
      wrote = true;
    }
  }
  if (!tableHasRows(database, "tool_config")) {
    const tools2 = readLegacyJson(
      "tools.json"
    );
    if (tools2 && typeof tools2 === "object") {
      for (const [name, entry] of Object.entries(tools2)) {
        if (!name) continue;
        const enabled = entry?.enabled === void 0 || entry?.enabled === null ? null : entry.enabled ? 1 : 0;
        const key = entry?.key ?? null;
        database.run("INSERT OR REPLACE INTO tool_config (name, enabled, key) VALUES (?, ?, ?)", [
          name,
          enabled,
          key
        ]);
        database.run(
          `UPDATE tool_config
           SET enabled_classic = COALESCE(enabled_classic, enabled),
               enabled_butler = COALESCE(enabled_butler, enabled)
           WHERE name = ?`,
          [name]
        );
        wrote = true;
      }
    }
  }
  if (!tableHasRows(database, "mcp_servers")) {
    const mcp = readLegacyJson("mcp.json");
    const servers = Array.isArray(mcp?.servers) ? mcp?.servers : [];
    for (const server of servers) {
      database.run(
        `INSERT OR REPLACE INTO mcp_servers
         (id, name, mode, command, args, env, cwd, url, headers, auto_start, enabled_classic, enabled_butler, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          server.id,
          server.name,
          server.mode,
          server.command ?? null,
          server.args ? JSON.stringify(server.args) : null,
          server.env ? JSON.stringify(server.env) : null,
          server.cwd ?? null,
          server.url ?? null,
          server.headers ? JSON.stringify(server.headers) : null,
          server.autoStart === void 0 ? null : server.autoStart ? 1 : 0,
          server.enabledClassic === void 0 ? server.enabled === void 0 ? null : server.enabled ? 1 : 0 : server.enabledClassic ? 1 : 0,
          server.enabledButler === void 0 ? server.enabled === void 0 ? null : server.enabled ? 1 : 0 : server.enabledButler ? 1 : 0,
          server.enabled === void 0 ? null : server.enabled ? 1 : 0
        ]
      );
      wrote = true;
    }
  }
  if (!tableHasRows(database, "subagents")) {
    const subagents = readLegacyJson("subagents.json");
    if (Array.isArray(subagents)) {
      for (const subagent of subagents) {
        database.run(
          `INSERT OR REPLACE INTO subagents
           (id, name, description, system_prompt, model, model_provider, tools, middleware, skills, interrupt_on, enabled_classic, enabled_butler, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            subagent.id,
            subagent.name,
            subagent.description,
            subagent.systemPrompt,
            subagent.model ?? null,
            subagent.provider ?? null,
            subagent.tools ? JSON.stringify(subagent.tools) : null,
            subagent.middleware ? JSON.stringify(subagent.middleware) : null,
            subagent.skills ? JSON.stringify(subagent.skills) : null,
            subagent.interruptOn === void 0 ? null : subagent.interruptOn ? 1 : 0,
            subagent.enabledClassic === void 0 ? subagent.enabled === void 0 ? null : subagent.enabled ? 1 : 0 : subagent.enabledClassic ? 1 : 0,
            subagent.enabledButler === void 0 ? subagent.enabled === void 0 ? null : subagent.enabled ? 1 : 0 : subagent.enabledButler ? 1 : 0,
            subagent.enabled === void 0 ? null : subagent.enabled ? 1 : 0
          ]
        );
        wrote = true;
      }
    }
  }
  setMetaValue(database, "json_migrated", "1");
  if (wrote) {
    saveToDisk();
  }
}
function getAllThreads() {
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM threads ORDER BY updated_at DESC");
  const threads = [];
  while (stmt.step()) {
    threads.push(stmt.getAsObject());
  }
  stmt.free();
  return threads;
}
function getThread(threadId) {
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM threads WHERE thread_id = ?");
  stmt.bind([threadId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const thread = stmt.getAsObject();
  stmt.free();
  return thread;
}
function createThread(threadId, metadata) {
  const database = getDb();
  const now = Date.now();
  database.run(
    `INSERT INTO threads (thread_id, created_at, updated_at, metadata, status)
     VALUES (?, ?, ?, ?, ?)`,
    [threadId, now, now, metadata ? JSON.stringify(metadata) : null, "idle"]
  );
  saveToDisk();
  return {
    thread_id: threadId,
    created_at: now,
    updated_at: now,
    metadata: metadata ? JSON.stringify(metadata) : null,
    status: "idle",
    thread_values: null,
    title: null
  };
}
function updateThread(threadId, updates) {
  const database = getDb();
  const existing = getThread(threadId);
  if (!existing) return null;
  const now = Date.now();
  const setClauses = ["updated_at = ?"];
  const values = [now];
  if (updates.metadata !== void 0) {
    setClauses.push("metadata = ?");
    values.push(
      typeof updates.metadata === "string" ? updates.metadata : JSON.stringify(updates.metadata)
    );
  }
  if (updates.status !== void 0) {
    setClauses.push("status = ?");
    values.push(updates.status);
  }
  if (updates.thread_values !== void 0) {
    setClauses.push("thread_values = ?");
    values.push(updates.thread_values);
  }
  if (updates.title !== void 0) {
    setClauses.push("title = ?");
    values.push(updates.title);
  }
  values.push(threadId);
  database.run(`UPDATE threads SET ${setClauses.join(", ")} WHERE thread_id = ?`, values);
  saveToDisk();
  return getThread(threadId);
}
function deleteThread(threadId) {
  const database = getDb();
  database.run("DELETE FROM threads WHERE thread_id = ?", [threadId]);
  saveToDisk();
}
const index = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createThread,
  deleteThread,
  getAllThreads,
  getDb,
  getThread,
  initializeDatabase,
  markDbDirty,
  updateThread
}, Symbol.toStringTag, { value: "Module" }));
function isSimpleProviderId(value) {
  return value === "ollama" || value === "openai-compatible" || value === "multimodal";
}
function normalizeProviderState(value) {
  if (!value || typeof value !== "object") return null;
  const record2 = value;
  if ("active" in record2 && "configs" in record2) {
    const active = record2.active;
    const configs = record2.configs;
    if (!isSimpleProviderId(active) || !configs || typeof configs !== "object") {
      return null;
    }
    return { active, configs };
  }
  if ("type" in record2 && typeof record2.type === "string") {
    const legacy = record2;
    if (!isSimpleProviderId(legacy.type)) return null;
    return {
      active: legacy.type,
      configs: { [legacy.type]: legacy }
    };
  }
  return null;
}
function getProviderState() {
  const database = getDb();
  const stmt = database.prepare("SELECT data FROM provider_config WHERE id = 1");
  const hasRow = stmt.step();
  if (!hasRow) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  try {
    const parsed = JSON.parse(row.data ?? "");
    return normalizeProviderState(parsed);
  } catch {
    return null;
  }
}
function setProviderState(state) {
  const database = getDb();
  database.run("INSERT OR REPLACE INTO provider_config (id, data) VALUES (1, ?)", [
    JSON.stringify(state, null, 2)
  ]);
  markDbDirty();
}
class SqlJsSaver extends langgraphCheckpoint.BaseCheckpointSaver {
  db = null;
  dbPath;
  isSetup = false;
  saveTimer = null;
  dirty = false;
  constructor(dbPath, serde) {
    super(serde);
    this.dbPath = dbPath;
  }
  /**
   * Initialize the database asynchronously
   */
  async initialize() {
    if (this.db) return;
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      const MAX_DB_SIZE = 100 * 1024 * 1024;
      if (stats.size > MAX_DB_SIZE) {
        console.warn(
          `[SqlJsSaver] Database file is too large (${Math.round(stats.size / 1024 / 1024)}MB). Creating fresh database to prevent memory issues.`
        );
        const backupPath = this.dbPath + ".bak." + Date.now();
        try {
          fs.renameSync(this.dbPath, backupPath);
          console.log(`[SqlJsSaver] Old database backed up to: ${backupPath}`);
        } catch (e) {
          console.warn("[SqlJsSaver] Could not backup old database:", e);
          try {
            fs.unlinkSync(this.dbPath);
          } catch (e2) {
            console.error("[SqlJsSaver] Could not delete old database:", e2);
          }
        }
        this.db = new SQL.Database();
      } else {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      }
    } else {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new SQL.Database();
    }
    this.setup();
  }
  setup() {
    if (this.isSetup || !this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        parent_checkpoint_id TEXT,
        type TEXT,
        checkpoint TEXT,
        metadata TEXT,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS writes (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        channel TEXT NOT NULL,
        type TEXT,
        value TEXT,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
      )
    `);
    this.isSetup = true;
    this.saveToDisk();
  }
  /**
   * Save database to disk (debounced)
   */
  saveToDisk() {
    if (!this.db) return;
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      if (this.db && this.dirty) {
        const data = this.db.export();
        fs.writeFileSync(this.dbPath, Buffer.from(data));
        this.dirty = false;
      }
    }, 100);
  }
  /**
   * Force immediate save to disk
   */
  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.db && this.dirty) {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
      this.dirty = false;
    }
  }
  async getTuple(config2) {
    await this.initialize();
    if (!this.db) throw new Error("Database not initialized");
    const { thread_id, checkpoint_ns = "", checkpoint_id } = config2.configurable ?? {};
    let sql;
    let params;
    if (checkpoint_id) {
      sql = `
        SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata
        FROM checkpoints
        WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
      `;
      params = [thread_id, checkpoint_ns, checkpoint_id];
    } else {
      sql = `
        SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata
        FROM checkpoints
        WHERE thread_id = ? AND checkpoint_ns = ?
        ORDER BY checkpoint_id DESC
        LIMIT 1
      `;
      params = [thread_id, checkpoint_ns];
    }
    const stmt = this.db.prepare(sql);
    stmt.bind(params.filter((p) => p !== void 0));
    if (!stmt.step()) {
      stmt.free();
      return void 0;
    }
    const row = stmt.getAsObject();
    stmt.free();
    const writesStmt = this.db.prepare(`
      SELECT task_id, channel, type, value
      FROM writes
      WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
    `);
    writesStmt.bind([row.thread_id, row.checkpoint_ns, row.checkpoint_id]);
    const pendingWrites = [];
    while (writesStmt.step()) {
      const write = writesStmt.getAsObject();
      const value = await this.serde.loadsTyped(write.type ?? "json", write.value ?? "");
      pendingWrites.push([write.task_id, write.channel, value]);
    }
    writesStmt.free();
    const checkpoint = await this.serde.loadsTyped(
      row.type ?? "json",
      row.checkpoint
    );
    const finalConfig = checkpoint_id ? config2 : {
      configurable: {
        thread_id: row.thread_id,
        checkpoint_ns: row.checkpoint_ns,
        checkpoint_id: row.checkpoint_id
      }
    };
    return {
      checkpoint,
      config: finalConfig,
      metadata: await this.serde.loadsTyped(
        row.type ?? "json",
        row.metadata
      ),
      parentConfig: row.parent_checkpoint_id ? {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.parent_checkpoint_id
        }
      } : void 0,
      pendingWrites
    };
  }
  async *list(config2, options) {
    await this.initialize();
    if (!this.db) throw new Error("Database not initialized");
    const { limit, before } = options ?? {};
    const thread_id = config2.configurable?.thread_id;
    const checkpoint_ns = config2.configurable?.checkpoint_ns ?? "";
    let sql = `
      SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata
      FROM checkpoints
      WHERE thread_id = ? AND checkpoint_ns = ?
    `;
    const params = [thread_id, checkpoint_ns];
    if (before?.configurable?.checkpoint_id) {
      sql += ` AND checkpoint_id < ?`;
      params.push(before.configurable.checkpoint_id);
    }
    sql += ` ORDER BY checkpoint_id DESC`;
    if (limit) {
      sql += ` LIMIT ${parseInt(String(limit), 10)}`;
    }
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const writesStmt = this.db.prepare(`
        SELECT task_id, channel, type, value
        FROM writes
        WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
      `);
      writesStmt.bind([row.thread_id, row.checkpoint_ns, row.checkpoint_id]);
      const pendingWrites = [];
      while (writesStmt.step()) {
        const write = writesStmt.getAsObject();
        const value = await this.serde.loadsTyped(write.type ?? "json", write.value ?? "");
        pendingWrites.push([write.task_id, write.channel, value]);
      }
      writesStmt.free();
      const checkpoint = await this.serde.loadsTyped(
        row.type ?? "json",
        row.checkpoint
      );
      yield {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id
          }
        },
        checkpoint,
        metadata: await this.serde.loadsTyped(
          row.type ?? "json",
          row.metadata
        ),
        parentConfig: row.parent_checkpoint_id ? {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.parent_checkpoint_id
          }
        } : void 0,
        pendingWrites
      };
    }
    stmt.free();
  }
  async put(config2, checkpoint, metadata) {
    await this.initialize();
    if (!this.db) throw new Error("Database not initialized");
    if (!config2.configurable) {
      throw new Error("Empty configuration supplied.");
    }
    const thread_id = config2.configurable?.thread_id;
    const checkpoint_ns = config2.configurable?.checkpoint_ns ?? "";
    const parent_checkpoint_id = config2.configurable?.checkpoint_id;
    if (!thread_id) {
      throw new Error('Missing "thread_id" field in passed "config.configurable".');
    }
    const preparedCheckpoint = langgraphCheckpoint.copyCheckpoint(checkpoint);
    const [[type1, serializedCheckpoint], [type2, serializedMetadata]] = await Promise.all([
      this.serde.dumpsTyped(preparedCheckpoint),
      this.serde.dumpsTyped(metadata)
    ]);
    if (type1 !== type2) {
      throw new Error("Failed to serialize checkpoint and metadata to the same type.");
    }
    this.db.run(
      `INSERT OR REPLACE INTO checkpoints 
       (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        thread_id,
        checkpoint_ns,
        checkpoint.id,
        parent_checkpoint_id ?? null,
        type1,
        serializedCheckpoint,
        serializedMetadata
      ]
    );
    this.saveToDisk();
    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id
      }
    };
  }
  async putWrites(config2, writes, taskId) {
    await this.initialize();
    if (!this.db) throw new Error("Database not initialized");
    if (!config2.configurable) {
      throw new Error("Empty configuration supplied.");
    }
    if (!config2.configurable?.thread_id) {
      throw new Error("Missing thread_id field in config.configurable.");
    }
    if (!config2.configurable?.checkpoint_id) {
      throw new Error("Missing checkpoint_id field in config.configurable.");
    }
    for (let idx = 0; idx < writes.length; idx++) {
      const write = writes[idx];
      const [type, serializedWrite] = await this.serde.dumpsTyped(write[1]);
      this.db.run(
        `INSERT OR REPLACE INTO writes 
         (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config2.configurable.thread_id,
          config2.configurable.checkpoint_ns ?? "",
          config2.configurable.checkpoint_id,
          taskId,
          idx,
          write[0],
          type,
          serializedWrite
        ]
      );
    }
    this.saveToDisk();
  }
  async deleteThread(threadId) {
    await this.initialize();
    if (!this.db) throw new Error("Database not initialized");
    this.db.run(`DELETE FROM checkpoints WHERE thread_id = ?`, [threadId]);
    this.db.run(`DELETE FROM writes WHERE thread_id = ?`, [threadId]);
    this.saveToDisk();
  }
  /**
   * Close the database and save any pending changes
   */
  async close() {
    await this.flush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
class LocalSandbox extends deepagents.FilesystemBackend {
  /** Unique identifier for this sandbox instance */
  id;
  timeout;
  maxOutputBytes;
  env;
  workingDir;
  constructor(options = {}) {
    super({
      rootDir: options.rootDir,
      virtualMode: options.virtualMode,
      maxFileSizeMb: options.maxFileSizeMb
    });
    this.id = `local-sandbox-${node_crypto.randomUUID().slice(0, 8)}`;
    this.timeout = options.timeout ?? 12e4;
    this.maxOutputBytes = options.maxOutputBytes ?? 1e5;
    this.env = options.env ?? { ...process.env };
    this.workingDir = options.rootDir ?? process.cwd();
  }
  /**
   * Execute a shell command in the workspace directory.
   *
   * @param command - Shell command string to execute
   * @returns ExecuteResponse with combined output, exit code, and truncation flag
   *
   * @example
   * ```typescript
   * const result = await sandbox.execute('echo "Hello World"');
   * // result.output: "Hello World\n"
   * // result.exitCode: 0
   * // result.truncated: false
   * ```
   */
  async execute(command) {
    console.log(
      `[LocalSandbox] execute() called with command: ${command.substring(0, 200)}${command.length > 200 ? "..." : ""}`
    );
    console.log(`[LocalSandbox] Working directory: ${this.workingDir}`);
    console.log(`[LocalSandbox] Timeout: ${this.timeout}ms`);
    if (!command || typeof command !== "string") {
      console.log(`[LocalSandbox] Invalid command, returning error`);
      return {
        output: "Error: Shell tool expects a non-empty command string.",
        exitCode: 1,
        truncated: false
      };
    }
    return new Promise((resolve) => {
      const outputParts = [];
      let totalBytes = 0;
      let truncated = false;
      let resolved = false;
      const isWindows = process.platform === "win32";
      let processedCommand = command;
      if (isWindows) {
        processedCommand = command.replace(/\\"/g, '"');
        if (processedCommand !== command) {
          console.log("[LocalSandbox] Fixed escaped quotes in command for Windows");
          console.log(`[LocalSandbox] Original: ${command.substring(0, 200)}`);
          console.log(`[LocalSandbox] Processed: ${processedCommand.substring(0, 200)}`);
        }
      }
      const shell = isWindows ? "powershell.exe" : "/bin/sh";
      const shellArgs = isWindows ? [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        processedCommand
      ] : ["-c", command];
      console.log(`[LocalSandbox] Shell: ${shell}`);
      console.log(`[LocalSandbox] Shell args: ${JSON.stringify(shellArgs).substring(0, 300)}`);
      console.log(`[LocalSandbox] Spawning process...`);
      const startTime = Date.now();
      const proc = node_child_process.spawn(shell, shellArgs, {
        cwd: this.workingDir,
        env: this.env,
        stdio: ["ignore", "pipe", "pipe"]
      });
      console.log(`[LocalSandbox] Process spawned with PID: ${proc.pid}`);
      proc.stdout.on("end", () => {
        console.log(`[LocalSandbox] stdout stream ended`);
      });
      proc.stderr.on("end", () => {
        console.log(`[LocalSandbox] stderr stream ended`);
      });
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill("SIGTERM");
          setTimeout(() => proc.kill("SIGKILL"), 1e3);
          const timeoutSecs = (this.timeout / 1e3).toFixed(1);
          const hint = "This may be caused by: unmatched quotes (causing shell to wait for input), interactive commands requiring stdin, or a genuinely long-running process.";
          resolve({
            output: `Error: Command timed out after ${timeoutSecs} seconds and was terminated.
${hint}`,
            exitCode: null,
            truncated: false
          });
        }
      }, this.timeout);
      proc.stdout.on("data", (data) => {
        console.log(`[LocalSandbox] stdout data received: ${data.length} bytes`);
        if (truncated) return;
        const chunk = data.toString();
        const newTotal = totalBytes + chunk.length;
        if (newTotal > this.maxOutputBytes) {
          const remaining = this.maxOutputBytes - totalBytes;
          if (remaining > 0) {
            outputParts.push(chunk.slice(0, remaining));
          }
          truncated = true;
          totalBytes = this.maxOutputBytes;
        } else {
          outputParts.push(chunk);
          totalBytes = newTotal;
        }
      });
      proc.stderr.on("data", (data) => {
        console.log(`[LocalSandbox] stderr data received: ${data.length} bytes`);
        console.log(`[LocalSandbox] stderr content: ${data.toString().substring(0, 200)}`);
        if (truncated) return;
        const chunk = data.toString();
        const prefixedLines = chunk.split("\n").filter((line) => line.length > 0).map((line) => `[stderr] ${line}`).join("\n");
        if (prefixedLines.length === 0) return;
        const withNewline = prefixedLines + (chunk.endsWith("\n") ? "\n" : "");
        const newTotal = totalBytes + withNewline.length;
        if (newTotal > this.maxOutputBytes) {
          const remaining = this.maxOutputBytes - totalBytes;
          if (remaining > 0) {
            outputParts.push(withNewline.slice(0, remaining));
          }
          truncated = true;
          totalBytes = this.maxOutputBytes;
        } else {
          outputParts.push(withNewline);
          totalBytes = newTotal;
        }
      });
      proc.on("close", (code, signal) => {
        const elapsed = Date.now() - startTime;
        console.log(
          `[LocalSandbox] Process closed after ${elapsed}ms, code: ${code}, signal: ${signal}`
        );
        if (resolved) {
          console.log(`[LocalSandbox] Already resolved, ignoring close event`);
          return;
        }
        resolved = true;
        clearTimeout(timeoutId);
        let output = outputParts.join("");
        if (truncated) {
          output += `

... Output truncated at ${this.maxOutputBytes} bytes.`;
        }
        if (!output.trim()) {
          output = "<no output>";
        }
        resolve({
          output,
          exitCode: signal ? null : code,
          truncated
        });
      });
      proc.on("error", (err) => {
        console.log(`[LocalSandbox] Spawn error: ${err.message}`);
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        resolve({
          output: `Error: Failed to execute command: ${err.message}`,
          exitCode: 1,
          truncated: false
        });
      });
    });
  }
}
function formatDetails(details) {
  if (!details || Object.keys(details).length === 0) return void 0;
  return details;
}
function logEntry(scope, action, details) {
  const payload = formatDetails(details);
  if (payload) {
    console.log(`[Trace][${scope}] ${action} start`, payload);
  } else {
    console.log(`[Trace][${scope}] ${action} start`);
  }
}
function logExit(scope, action, details, durationMs) {
  const payload = formatDetails({
    ...details ?? {},
    ...durationMs !== void 0 ? { durationMs } : {}
  });
  if (payload) {
    console.log(`[Trace][${scope}] ${action} end`, payload);
  } else {
    console.log(`[Trace][${scope}] ${action} end`);
  }
}
async function withSpan(scope, action, details, fn) {
  const start = Date.now();
  logEntry(scope, action, details);
  try {
    const result = await fn();
    logExit(scope, action, { ok: true }, Date.now() - start);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    logExit(scope, action, { ok: false, error: message }, Date.now() - start);
    throw error;
  }
}
function summarizeArgs(args) {
  if (!args) return { keyCount: 0, keys: [] };
  const keys = Object.keys(args);
  return { keyCount: keys.length, keys: keys.slice(0, 10) };
}
function summarizeList(items, max = 10) {
  const list = items ?? [];
  return { count: list.length, names: list.slice(0, max) };
}
const SKILL_OVERLAY_PREFIX = "/__openwork_skills__";
function normalizeVirtualPath(path2) {
  const normalized = path2.replace(/\\/g, "/");
  if (!normalized) return "/";
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.replace(/\/+$/, "");
  }
  return normalized;
}
function normalizeRealPath(path2) {
  return path$1.resolve(path2).replace(/\\/g, "/");
}
function toRealPath(root, suffix) {
  if (!suffix) return root;
  const parts = suffix.split("/").filter(Boolean);
  return path$1.join(root, ...parts);
}
class SkillOverlayBackend {
  constructor(base2) {
    this.base = base2;
    this.id = base2.id;
  }
  id;
  sourceRoots = /* @__PURE__ */ new Map();
  registerSkillSource(sourceRoot, skillsByName) {
    const normalizedSource = normalizeVirtualPath(sourceRoot);
    if (!normalizedSource.startsWith(SKILL_OVERLAY_PREFIX)) {
      throw new Error(`Invalid skill source root: ${sourceRoot}`);
    }
    const normalizedSkills = /* @__PURE__ */ new Map();
    for (const [skillName, realRoot] of Object.entries(skillsByName)) {
      const trimmed = skillName.trim();
      if (!trimmed || !realRoot.trim()) continue;
      normalizedSkills.set(trimmed, path$1.resolve(realRoot));
    }
    logEntry("Overlay", "skills.overlay.register", {
      sourceRoot: normalizedSource,
      count: normalizedSkills.size,
      names: Array.from(normalizedSkills.keys()).slice(0, 10)
    });
    this.sourceRoots.set(normalizedSource, normalizedSkills);
    logExit("Overlay", "skills.overlay.register", {
      sourceRoot: normalizedSource,
      count: normalizedSkills.size
    });
  }
  resolveSkillPath(inputPath) {
    const normalizedPath = normalizeVirtualPath(inputPath);
    const sortedSources = Array.from(this.sourceRoots.keys()).sort((a, b) => b.length - a.length);
    for (const sourceRoot of sortedSources) {
      if (normalizedPath === sourceRoot) {
        return { sourceRoot };
      }
      const prefix = `${sourceRoot}/`;
      if (!normalizedPath.startsWith(prefix)) continue;
      const remainder = normalizedPath.slice(prefix.length);
      const [skillName, ...restParts] = remainder.split("/");
      if (!skillName) {
        return { sourceRoot };
      }
      const sourceSkills = this.sourceRoots.get(sourceRoot);
      const realSkillRoot = sourceSkills?.get(skillName);
      const virtualSkillRoot = `${sourceRoot}/${skillName}`;
      if (!realSkillRoot) {
        return { sourceRoot, skillName, virtualSkillRoot };
      }
      const suffix = restParts.join("/");
      const realPath = toRealPath(realSkillRoot, suffix);
      return {
        sourceRoot,
        skillName,
        virtualSkillRoot,
        realSkillRoot,
        realPath
      };
    }
    return null;
  }
  rewritePathToVirtual(realPath, virtualRoot, realRoot) {
    const normalizedRealPath = normalizeRealPath(realPath);
    const normalizedRealRoot = normalizeRealPath(realRoot);
    const normalizedVirtualRoot = normalizeVirtualPath(virtualRoot);
    if (normalizedRealPath === normalizedRealRoot) {
      return normalizedVirtualRoot;
    }
    if (normalizedRealPath.startsWith(`${normalizedRealRoot}/`)) {
      return `${normalizedVirtualRoot}${normalizedRealPath.slice(normalizedRealRoot.length)}`;
    }
    return normalizedVirtualRoot;
  }
  rewriteFileInfo(info, resolution) {
    if (!resolution.virtualSkillRoot || !resolution.realSkillRoot) {
      return info;
    }
    const rewrittenPath = this.rewritePathToVirtual(
      info.path,
      resolution.virtualSkillRoot,
      resolution.realSkillRoot
    );
    return {
      ...info,
      path: info.is_dir && !rewrittenPath.endsWith("/") ? `${rewrittenPath}/` : rewrittenPath
    };
  }
  async lsInfo(path2) {
    const resolution = this.resolveSkillPath(path2);
    if (!resolution) {
      return this.base.lsInfo(path2);
    }
    logEntry("Overlay", "skills.overlay.ls", {
      path: normalizeVirtualPath(path2),
      sourceRoot: resolution.sourceRoot,
      skillName: resolution.skillName ?? null
    });
    if (!resolution.skillName) {
      const sourceSkills = this.sourceRoots.get(resolution.sourceRoot);
      if (!sourceSkills) return [];
      const rootListing = Array.from(sourceSkills.keys()).sort((a, b) => a.localeCompare(b)).map((skillName) => ({
        path: `${resolution.sourceRoot}/${skillName}/`,
        is_dir: true
      }));
      logExit("Overlay", "skills.overlay.ls", {
        path: normalizeVirtualPath(path2),
        count: rootListing.length,
        entries: rootListing.map((item) => item.path)
      });
      return rootListing;
    }
    if (!resolution.realPath) {
      logExit("Overlay", "skills.overlay.ls", {
        path: normalizeVirtualPath(path2),
        count: 0,
        reason: "skill_not_registered"
      });
      return [];
    }
    const infos = await this.base.lsInfo(resolution.realPath);
    const rewritten = infos.map((info) => this.rewriteFileInfo(info, resolution));
    logExit("Overlay", "skills.overlay.ls", {
      path: normalizeVirtualPath(path2),
      realPath: normalizeRealPath(resolution.realPath),
      count: rewritten.length,
      entries: rewritten.map((item) => item.path).slice(0, 10)
    });
    return rewritten;
  }
  async read(filePath, offset, limit) {
    const resolution = this.resolveSkillPath(filePath);
    if (!resolution) {
      return this.base.read(filePath, offset, limit);
    }
    logEntry("Overlay", "skills.overlay.read", {
      path: normalizeVirtualPath(filePath),
      sourceRoot: resolution.sourceRoot,
      skillName: resolution.skillName ?? null,
      offset: offset ?? 0,
      limit: limit ?? null
    });
    if (!resolution.realPath) {
      const missing = "Error: Skill path not found.";
      logExit("Overlay", "skills.overlay.read", {
        path: normalizeVirtualPath(filePath),
        ok: false,
        error: missing
      });
      return missing;
    }
    const content = await this.base.read(resolution.realPath, offset, limit);
    logExit("Overlay", "skills.overlay.read", {
      path: normalizeVirtualPath(filePath),
      realPath: normalizeRealPath(resolution.realPath),
      ok: !content.startsWith("Error:"),
      length: content.length
    });
    return content;
  }
  async readRaw(filePath) {
    const resolution = this.resolveSkillPath(filePath);
    if (!resolution) {
      return this.base.readRaw(filePath);
    }
    if (!resolution.realPath) {
      throw new Error("Skill path not found.");
    }
    return this.base.readRaw(resolution.realPath);
  }
  async downloadFiles(paths) {
    const results = [];
    for (const requestedPath of paths) {
      const resolution = this.resolveSkillPath(requestedPath);
      if (!resolution) {
        const passthrough2 = await this.base.downloadFiles([requestedPath]);
        if (passthrough2.length === 1) {
          results.push(passthrough2[0]);
        } else {
          results.push({
            path: requestedPath,
            content: null,
            error: "invalid_path"
          });
        }
        continue;
      }
      const normalizedRequestedPath = normalizeVirtualPath(requestedPath);
      logEntry("Overlay", "skills.overlay.download", {
        path: normalizedRequestedPath,
        sourceRoot: resolution.sourceRoot,
        skillName: resolution.skillName ?? null
      });
      if (!resolution.skillName) {
        const response2 = {
          path: normalizedRequestedPath,
          content: null,
          error: "is_directory"
        };
        logExit("Overlay", "skills.overlay.download", {
          path: normalizedRequestedPath,
          ok: false,
          error: response2.error
        });
        results.push(response2);
        continue;
      }
      if (!resolution.realPath || !resolution.virtualSkillRoot) {
        const response2 = {
          path: normalizedRequestedPath,
          content: null,
          error: "file_not_found"
        };
        logExit("Overlay", "skills.overlay.download", {
          path: normalizedRequestedPath,
          ok: false,
          error: response2.error
        });
        results.push(response2);
        continue;
      }
      if (normalizedRequestedPath === resolution.virtualSkillRoot) {
        const response2 = {
          path: normalizedRequestedPath,
          content: null,
          error: "is_directory"
        };
        logExit("Overlay", "skills.overlay.download", {
          path: normalizedRequestedPath,
          ok: false,
          error: response2.error
        });
        results.push(response2);
        continue;
      }
      const passthrough = await this.base.downloadFiles([resolution.realPath]);
      if (passthrough.length !== 1) {
        const response2 = {
          path: normalizedRequestedPath,
          content: null,
          error: "invalid_path"
        };
        logExit("Overlay", "skills.overlay.download", {
          path: normalizedRequestedPath,
          realPath: normalizeRealPath(resolution.realPath),
          ok: false,
          error: response2.error
        });
        results.push(response2);
        continue;
      }
      const [baseResponse] = passthrough;
      const response = {
        path: normalizedRequestedPath,
        content: baseResponse.content,
        error: baseResponse.error
      };
      logExit("Overlay", "skills.overlay.download", {
        path: normalizedRequestedPath,
        realPath: normalizeRealPath(resolution.realPath),
        ok: response.error == null,
        bytes: response.content?.byteLength ?? 0,
        error: response.error
      });
      results.push(response);
    }
    return results;
  }
  async grepRaw(pattern, path2, glob) {
    if (!path2) {
      return this.base.grepRaw(pattern, path2 ?? void 0, glob);
    }
    const resolution = this.resolveSkillPath(path2);
    if (!resolution) {
      return this.base.grepRaw(pattern, path2, glob);
    }
    if (!resolution.skillName) {
      const sourceSkills = this.sourceRoots.get(resolution.sourceRoot);
      if (!sourceSkills || sourceSkills.size === 0) return [];
      const merged = [];
      for (const [skillName, realRoot] of sourceSkills.entries()) {
        const result2 = await this.base.grepRaw(pattern, realRoot, glob);
        if (typeof result2 === "string") {
          return result2;
        }
        const virtualRoot = `${resolution.sourceRoot}/${skillName}`;
        for (const match of result2) {
          merged.push({
            ...match,
            path: this.rewritePathToVirtual(match.path, virtualRoot, realRoot)
          });
        }
      }
      return merged;
    }
    if (!resolution.realPath || !resolution.realSkillRoot || !resolution.virtualSkillRoot) {
      return [];
    }
    const result = await this.base.grepRaw(pattern, resolution.realPath, glob);
    if (typeof result === "string") {
      return result;
    }
    return result.map((match) => ({
      ...match,
      path: this.rewritePathToVirtual(
        match.path,
        resolution.virtualSkillRoot,
        resolution.realSkillRoot
      )
    }));
  }
  async globInfo(pattern, path2 = "/") {
    const resolution = this.resolveSkillPath(path2);
    if (!resolution) {
      return this.base.globInfo(pattern, path2);
    }
    if (!resolution.skillName) {
      const sourceSkills = this.sourceRoots.get(resolution.sourceRoot);
      if (!sourceSkills || sourceSkills.size === 0) return [];
      const merged = [];
      for (const [skillName, realRoot] of sourceSkills.entries()) {
        const result = await this.base.globInfo(pattern, realRoot);
        const virtualRoot = `${resolution.sourceRoot}/${skillName}`;
        merged.push(
          ...result.map((item) => ({
            ...item,
            path: this.rewritePathToVirtual(item.path, virtualRoot, realRoot)
          }))
        );
      }
      return merged;
    }
    if (!resolution.realPath || !resolution.realSkillRoot || !resolution.virtualSkillRoot) {
      return [];
    }
    const infos = await this.base.globInfo(pattern, resolution.realPath);
    return infos.map((item) => ({
      ...item,
      path: this.rewritePathToVirtual(
        item.path,
        resolution.virtualSkillRoot,
        resolution.realSkillRoot
      )
    }));
  }
  async write(filePath, content) {
    const resolution = this.resolveSkillPath(filePath);
    if (!resolution) {
      return this.base.write(filePath, content);
    }
    return {
      error: "Skill paths are read-only."
    };
  }
  async edit(filePath, oldString, newString, replaceAll) {
    const resolution = this.resolveSkillPath(filePath);
    if (!resolution) {
      return this.base.edit(filePath, oldString, newString, replaceAll);
    }
    return {
      error: "Skill paths are read-only."
    };
  }
  execute(command) {
    return this.base.execute(command);
  }
}
function appendCurrentTime(prompt) {
  const now = /* @__PURE__ */ new Date();
  return `${prompt}

Current time: ${now.toISOString()}
Current year: ${now.getFullYear()}`;
}
function parseJson$1(value) {
  if (typeof value !== "string" || !value) return void 0;
  try {
    return JSON.parse(value);
  } catch {
    return void 0;
  }
}
function listSubagents() {
  logEntry("Subagents", "list");
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM subagents");
  const result = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const providerRaw = row.model_provider ?? void 0;
    const provider = providerRaw === "ollama" || providerRaw === "openai-compatible" || providerRaw === "multimodal" ? providerRaw : void 0;
    const legacyEnabled = row.enabled === null || row.enabled === void 0 ? void 0 : Boolean(row.enabled);
    const enabledClassic = row.enabled_classic === null || row.enabled_classic === void 0 ? legacyEnabled : Boolean(row.enabled_classic);
    const enabledButler = row.enabled_butler === null || row.enabled_butler === void 0 ? legacyEnabled : Boolean(row.enabled_butler);
    result.push({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      systemPrompt: String(row.system_prompt),
      provider,
      model: row.model ?? void 0,
      tools: parseJson$1(row.tools),
      middleware: parseJson$1(row.middleware),
      skills: parseJson$1(row.skills),
      interruptOn: row.interrupt_on === null || row.interrupt_on === void 0 ? void 0 : Boolean(row.interrupt_on),
      enabledClassic,
      enabledButler,
      enabled: enabledClassic ?? legacyEnabled
    });
  }
  stmt.free();
  logExit("Subagents", "list", { count: result.length });
  return result;
}
function isSubagentEnabledInScope(subagent, scope) {
  if (scope === "butler") {
    return subagent.enabledButler ?? subagent.enabled ?? true;
  }
  return subagent.enabledClassic ?? subagent.enabled ?? true;
}
function listSubagentsByScope(scope) {
  return listSubagents().filter((subagent) => isSubagentEnabledInScope(subagent, scope));
}
function createSubagent(input) {
  logEntry("Subagents", "create", {
    name: input.name,
    toolCount: input.tools?.length ?? 0,
    skillCount: input.skills?.length ?? 0
  });
  if (!input.name?.trim()) {
    throw new Error("Subagent name is required.");
  }
  if (!input.description?.trim()) {
    throw new Error("Subagent description is required.");
  }
  if (!input.systemPrompt?.trim()) {
    throw new Error("Subagent system prompt is required.");
  }
  const subagents = listSubagents();
  const nameExists = subagents.some(
    (agent) => agent.name.toLowerCase() === input.name.toLowerCase()
  );
  if (nameExists) {
    throw new Error(`Subagent name "${input.name}" already exists.`);
  }
  const created = {
    id: node_crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    systemPrompt: appendCurrentTime(input.systemPrompt.trim()),
    provider: input.provider,
    model: input.model,
    tools: input.tools,
    middleware: input.middleware,
    skills: input.skills,
    interruptOn: input.interruptOn ?? false,
    enabledClassic: input.enabledClassic ?? input.enabled ?? true,
    enabledButler: input.enabledButler ?? input.enabled ?? true,
    enabled: input.enabledClassic ?? input.enabled ?? true
  };
  const database = getDb();
  database.run(
    `INSERT OR REPLACE INTO subagents
     (id, name, description, system_prompt, model, model_provider, tools, middleware, skills, interrupt_on, enabled_classic, enabled_butler, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      created.id,
      created.name,
      created.description,
      created.systemPrompt,
      created.model ?? null,
      created.provider ?? null,
      created.tools ? JSON.stringify(created.tools) : null,
      created.middleware ? JSON.stringify(created.middleware) : null,
      created.skills ? JSON.stringify(created.skills) : null,
      created.interruptOn === void 0 ? null : created.interruptOn ? 1 : 0,
      created.enabledClassic === void 0 ? null : created.enabledClassic ? 1 : 0,
      created.enabledButler === void 0 ? null : created.enabledButler ? 1 : 0,
      created.enabled === void 0 ? null : created.enabled ? 1 : 0
    ]
  );
  markDbDirty();
  logExit("Subagents", "create", { id: created.id, name: created.name });
  return created;
}
function updateSubagent(id, updates) {
  logEntry("Subagents", "update", { id, updates: Object.keys(updates || {}) });
  const subagents = listSubagents();
  const index2 = subagents.findIndex((agent) => agent.id === id);
  if (index2 < 0) {
    throw new Error("Subagent not found.");
  }
  const nextName = updates.name?.trim();
  if (nextName) {
    const nameExists = subagents.some(
      (agent) => agent.id !== id && agent.name.toLowerCase() === nextName.toLowerCase()
    );
    if (nameExists) {
      throw new Error(`Subagent name "${nextName}" already exists.`);
    }
  }
  const current = subagents[index2];
  const nextSystemPrompt = updates.systemPrompt?.trim();
  const currentClassic = current.enabledClassic ?? current.enabled ?? true;
  const currentButler = current.enabledButler ?? current.enabled ?? true;
  const updatesClassic = updates.enabledClassic === void 0 ? void 0 : Boolean(updates.enabledClassic);
  const updatesButler = updates.enabledButler === void 0 ? void 0 : Boolean(updates.enabledButler);
  const nextClassic = updatesClassic ?? (updates.enabled === void 0 ? currentClassic : updates.enabled);
  const nextButler = updatesButler ?? (updates.enabled === void 0 ? currentButler : updates.enabled);
  const updated = {
    ...current,
    ...updates,
    name: nextName ?? current.name,
    description: updates.description?.trim() ?? current.description,
    systemPrompt: updates.systemPrompt === void 0 ? current.systemPrompt : appendCurrentTime(nextSystemPrompt ?? ""),
    enabledClassic: nextClassic,
    enabledButler: nextButler,
    enabled: nextClassic
  };
  const database = getDb();
  database.run(
    `INSERT OR REPLACE INTO subagents
     (id, name, description, system_prompt, model, model_provider, tools, middleware, skills, interrupt_on, enabled_classic, enabled_butler, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      updated.id,
      updated.name,
      updated.description,
      updated.systemPrompt,
      updated.model ?? null,
      updated.provider ?? null,
      updated.tools ? JSON.stringify(updated.tools) : null,
      updated.middleware ? JSON.stringify(updated.middleware) : null,
      updated.skills ? JSON.stringify(updated.skills) : null,
      updated.interruptOn === void 0 ? null : updated.interruptOn ? 1 : 0,
      updated.enabledClassic === void 0 ? null : updated.enabledClassic ? 1 : 0,
      updated.enabledButler === void 0 ? null : updated.enabledButler ? 1 : 0,
      updated.enabled === void 0 ? null : updated.enabled ? 1 : 0
    ]
  );
  markDbDirty();
  logExit("Subagents", "update", { id, name: updated.name });
  return updated;
}
function deleteSubagent(id) {
  logEntry("Subagents", "delete", { id });
  const database = getDb();
  database.run("DELETE FROM subagents WHERE id = ?", [id]);
  markDbDirty();
  logExit("Subagents", "delete", { id });
}
const SKILLS_CONFIG_FILE = path$1.join(getOpenworkDir(), "skills.json");
function readSkillsConfig() {
  if (!fs$1.existsSync(SKILLS_CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs$1.readFileSync(SKILLS_CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
function writeSkillsConfig(config2) {
  const data = JSON.stringify(config2, null, 2);
  fs$1.writeFileSync(SKILLS_CONFIG_FILE, data);
}
function getSkillEnabledState(skillName) {
  const config2 = readSkillsConfig();
  const entry = config2[skillName];
  const classic = entry?.enabledClassic ?? entry?.enabled ?? true;
  const butler = entry?.enabledButler ?? entry?.enabled ?? true;
  return { classic, butler };
}
function isSkillEnabled(skillName, scope = "classic") {
  const state = getSkillEnabledState(skillName);
  return scope === "butler" ? state.butler : state.classic;
}
function pruneSkillConfig(config2, skillName) {
  const entry = config2[skillName];
  if (!entry) return;
  if (entry.enabled === void 0 && entry.enabledClassic === void 0 && entry.enabledButler === void 0) {
    delete config2[skillName];
  }
}
function setSkillEnabled(skillName, enabled, scope) {
  const config2 = readSkillsConfig();
  const existing = config2[skillName] ?? {};
  if (!scope) {
    existing.enabled = enabled;
    existing.enabledClassic = enabled;
    existing.enabledButler = enabled;
  } else {
    if (scope === "classic") {
      existing.enabledClassic = enabled;
    } else {
      existing.enabledButler = enabled;
    }
    existing.enabled = existing.enabledClassic ?? existing.enabledButler ?? existing.enabled;
  }
  config2[skillName] = existing;
  pruneSkillConfig(config2, skillName);
  writeSkillsConfig(config2);
}
function removeSkillConfig(skillName) {
  const config2 = readSkillsConfig();
  if (config2[skillName]) {
    delete config2[skillName];
    writeSkillsConfig(config2);
  }
}
const SKILLS_REGISTRY_FILE = path$1.join(getOpenworkDir(), "skills-registry.json");
function normalizePath(path2) {
  return path$1.resolve(path2).replace(/\\/g, "/");
}
function pathKey(path2) {
  const normalized = normalizePath(path2);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function dedupeSourceRoots(sourceRoots) {
  const seen = /* @__PURE__ */ new Set();
  const normalized = [];
  for (const root of sourceRoots) {
    const trimmed = root.trim();
    if (!trimmed) continue;
    const resolved = normalizePath(trimmed);
    const key = pathKey(resolved);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(resolved);
  }
  return normalized;
}
function normalizeSkillEntry(sourceRoots, skillName, value) {
  if (!skillName.trim() || typeof value !== "object" || !value) {
    return null;
  }
  const entry = value;
  if (typeof entry.skillPath !== "string" || !entry.skillPath.trim()) {
    return null;
  }
  const skillPath = normalizePath(entry.skillPath);
  const derivedRoot = normalizePath(path$1.resolve(path$1.dirname(skillPath), ".."));
  const sourceRoot = typeof entry.sourceRoot === "string" && entry.sourceRoot.trim() ? normalizePath(entry.sourceRoot) : dedupeSourceRoots([derivedRoot, ...sourceRoots]).find((root) => fs$1.existsSync(root)) ?? derivedRoot;
  return {
    skillPath,
    sourceRoot
  };
}
function normalizeRegistryStore(raw) {
  const sourceRoots = Array.isArray(raw.sourceRoots) ? dedupeSourceRoots(raw.sourceRoots.filter((item) => typeof item === "string")) : [];
  const skills = {};
  if (raw.skills && typeof raw.skills === "object") {
    for (const [name, value] of Object.entries(raw.skills)) {
      const entry = normalizeSkillEntry(sourceRoots, name, value);
      if (!entry) continue;
      skills[name] = entry;
    }
  }
  return {
    sourceRoots,
    skills
  };
}
function sortSkillsByName(skills) {
  return Object.fromEntries(Object.entries(skills).sort(([a], [b]) => a.localeCompare(b)));
}
function readSkillsRegistry() {
  if (!fs$1.existsSync(SKILLS_REGISTRY_FILE)) {
    return {
      sourceRoots: [],
      skills: {}
    };
  }
  try {
    const raw = fs$1.readFileSync(SKILLS_REGISTRY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeRegistryStore(parsed);
  } catch {
    return {
      sourceRoots: [],
      skills: {}
    };
  }
}
function writeSkillsRegistry(registry2) {
  const normalized = {
    sourceRoots: dedupeSourceRoots(registry2.sourceRoots),
    skills: sortSkillsByName(registry2.skills)
  };
  fs$1.writeFileSync(SKILLS_REGISTRY_FILE, `${JSON.stringify(normalized, null, 2)}
`);
  return normalized;
}
function registerSkillSourceRoot(sourceRoot) {
  const normalizedRoot = normalizePath(sourceRoot);
  const current = readSkillsRegistry();
  const nextRoots = current.sourceRoots.filter((root) => pathKey(root) !== pathKey(normalizedRoot));
  nextRoots.push(normalizedRoot);
  return writeSkillsRegistry({
    sourceRoots: nextRoots,
    skills: current.skills
  });
}
function rebuildSkillsRegistry() {
  const current = readSkillsRegistry();
  const sourceRoots = dedupeSourceRoots(current.sourceRoots);
  const nextSkills = {};
  let discoveredSkills = 0;
  for (const sourceRoot of sourceRoots) {
    const discovered = deepagents.listSkills({ userSkillsDir: sourceRoot });
    discoveredSkills += discovered.length;
    for (const skill of discovered) {
      if (!skill?.name || !skill?.path) continue;
      nextSkills[skill.name] = {
        skillPath: normalizePath(skill.path),
        sourceRoot
      };
    }
  }
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const [name, entry] of Object.entries(nextSkills)) {
    const previous = current.skills[name];
    if (!previous) {
      added += 1;
      continue;
    }
    if (pathKey(previous.skillPath) !== pathKey(entry.skillPath) || pathKey(previous.sourceRoot) !== pathKey(entry.sourceRoot)) {
      updated += 1;
    }
  }
  for (const name of Object.keys(current.skills)) {
    if (!nextSkills[name]) {
      removed += 1;
    }
  }
  const registry2 = writeSkillsRegistry({
    sourceRoots,
    skills: nextSkills
  });
  return {
    registry: registry2,
    added,
    updated,
    removed,
    scannedRoots: sourceRoots.length,
    discoveredSkills
  };
}
const MANAGED_SKILLS_ROOT = path$1.join(getOpenworkDir(), "skills");
const AGENT_USER_SKILLS_ROOT = path$1.join(node_os.homedir(), ".agents", "skills");
function ensureManagedSkillsDir() {
  if (!fs$1.existsSync(MANAGED_SKILLS_ROOT)) {
    fs$1.mkdirSync(MANAGED_SKILLS_ROOT, { recursive: true });
  }
  return MANAGED_SKILLS_ROOT;
}
function normalizeSkillPath(path2) {
  return path$1.resolve(path2).replace(/\\/g, "/");
}
function getSkillsRoot() {
  return ensureManagedSkillsDir();
}
function listSkillRecordsByRoot(params) {
  const { root, sourceType, readOnly, ensureRoot } = params;
  if (ensureRoot && !fs$1.existsSync(root)) {
    fs$1.mkdirSync(root, { recursive: true });
  }
  if (!fs$1.existsSync(root)) {
    return [];
  }
  const skills = deepagents.listSkills({ userSkillsDir: root });
  return skills.map((skill) => {
    const state = getSkillEnabledState(skill.name);
    return {
      name: skill.name,
      description: skill.description,
      path: normalizeSkillPath(skill.path),
      skillPath: path$1.resolve(skill.path),
      root: path$1.resolve(root),
      source: skill.source,
      sourceType,
      readOnly,
      enabled: state.classic,
      enabledClassic: state.classic,
      enabledButler: state.butler
    };
  });
}
function listConfiguredSkillRecords() {
  const registry2 = readSkillsRegistry();
  const records = [];
  for (const [name, entry] of Object.entries(registry2.skills)) {
    if (!name.trim()) continue;
    if (!entry?.skillPath) continue;
    const skillPath = path$1.resolve(entry.skillPath);
    if (!fs$1.existsSync(skillPath)) {
      continue;
    }
    const state = getSkillEnabledState(name);
    records.push({
      name,
      description: readSkillDescription(skillPath),
      path: normalizeSkillPath(skillPath),
      skillPath,
      root: path$1.resolve(entry.sourceRoot),
      source: "user",
      sourceType: "configured-path",
      readOnly: true,
      enabled: state.classic,
      enabledClassic: state.classic,
      enabledButler: state.butler
    });
  }
  return records;
}
function listAppSkillRecords(options) {
  const agentUserSkills = listSkillRecordsByRoot({
    root: AGENT_USER_SKILLS_ROOT,
    sourceType: "agent-user",
    readOnly: true
  });
  const managedSkills = listSkillRecordsByRoot({
    root: ensureManagedSkillsDir(),
    sourceType: "managed",
    readOnly: false,
    ensureRoot: true
  });
  const configuredPathSkills = listConfiguredSkillRecords();
  const merged = /* @__PURE__ */ new Map();
  for (const item of [...agentUserSkills, ...managedSkills, ...configuredPathSkills]) {
    merged.set(item.name, item);
  }
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}
function toSkillItem(record2) {
  return {
    name: record2.name,
    description: record2.description,
    path: normalizeSkillPath(record2.skillPath),
    source: record2.source,
    sourceType: record2.sourceType,
    readOnly: record2.readOnly,
    enabledClassic: record2.enabledClassic,
    enabledButler: record2.enabledButler,
    enabled: record2.enabled
  };
}
function resolveSkillRecord(name, options) {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Skill name is required.");
  }
  const record2 = listAppSkillRecords().find((item) => item.name === normalized);
  if (!record2) {
    throw new Error("Skill not found.");
  }
  return record2;
}
function listAppSkills(options) {
  logEntry("Skills", "list");
  const all = listAppSkillRecords().map((record2) => toSkillItem(record2));
  const result = options?.scope === void 0 ? all : all.filter(
    (item) => options.scope === "butler" ? item.enabledButler : item.enabledClassic
  );
  logExit("Skills", "list", { count: result.length });
  return result;
}
function scanAndImportAgentUserSkills() {
  logEntry("Skills", "scan");
  const rebuild = rebuildSkillsRegistry();
  const result = listAppSkills();
  logExit("Skills", "scan", {
    scannedRoots: rebuild.scannedRoots,
    discoveredSkills: rebuild.discoveredSkills,
    added: rebuild.added,
    updated: rebuild.updated,
    removed: rebuild.removed,
    count: result.length
  });
  return result;
}
function validateSkillName(name) {
  if (!name) {
    throw new Error("Skill name is required.");
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Skill name must be lowercase alphanumeric with hyphens.");
  }
}
function createSkill(params) {
  logEntry("Skills", "create", { name: params.name, contentLength: params.content?.length ?? 0 });
  const root = ensureManagedSkillsDir();
  const name = params.name.trim();
  const description = params.description.trim();
  validateSkillName(name);
  if (!description) {
    throw new Error("Skill description is required.");
  }
  const skillDir = path$1.join(root, name);
  if (fs$1.existsSync(skillDir)) {
    throw new Error(`Skill "${name}" already exists.`);
  }
  fs$1.mkdirSync(skillDir, { recursive: true });
  const content = params.content?.trim() || `---
name: ${name}
description: ${description}
---

# ${name}

Describe what this skill does and how to use it.
`;
  const skillPath = path$1.join(skillDir, "SKILL.md");
  fs$1.writeFileSync(skillPath, content);
  const result = {
    name,
    description,
    path: normalizeSkillPath(skillPath),
    source: "user",
    sourceType: "managed",
    readOnly: false,
    enabledClassic: true,
    enabledButler: true,
    enabled: true
  };
  logExit("Skills", "create", { name });
  return result;
}
function resolveSkillSourcePath(inputPath) {
  if (!fs$1.existsSync(inputPath)) {
    throw new Error("Skill path does not exist.");
  }
  const stats = fs$1.statSync(inputPath);
  if (stats.isFile()) {
    if (path$1.basename(inputPath).toLowerCase() !== "skill.md") {
      throw new Error("Skill path must point to a SKILL.md file or its directory.");
    }
    return path$1.resolve(path$1.join(inputPath, ".."));
  }
  if (stats.isDirectory()) {
    const skillMd = path$1.join(inputPath, "SKILL.md");
    if (!fs$1.existsSync(skillMd)) {
      throw new Error("No SKILL.md found in the selected directory.");
    }
    return path$1.resolve(inputPath);
  }
  throw new Error("Skill path must be a file or directory.");
}
function installSkillFromPath(inputPath) {
  logEntry("Skills", "install", { inputPath });
  const sourceDir = resolveSkillSourcePath(inputPath);
  const sourceRoot = path$1.resolve(path$1.dirname(sourceDir));
  const skillName = path$1.basename(sourceDir);
  registerSkillSourceRoot(sourceRoot);
  const rebuild = rebuildSkillsRegistry();
  const registryRecord = rebuild.registry.skills[skillName];
  if (!registryRecord || !fs$1.existsSync(registryRecord.skillPath)) {
    throw new Error(`Skill "${skillName}" was not found after scanning configured paths.`);
  }
  const state = getSkillEnabledState(skillName);
  const description = readSkillDescription(registryRecord.skillPath);
  const result = {
    name: skillName,
    description,
    path: normalizeSkillPath(registryRecord.skillPath),
    source: "user",
    sourceType: "configured-path",
    readOnly: true,
    enabledClassic: state.classic,
    enabledButler: state.butler,
    enabled: state.classic
  };
  logExit("Skills", "install", {
    name: skillName,
    sourceRoot: normalizeSkillPath(sourceRoot),
    scannedRoots: rebuild.scannedRoots,
    added: rebuild.added,
    updated: rebuild.updated,
    removed: rebuild.removed
  });
  return result;
}
function readSkillDescription(skillPath) {
  try {
    const content = fs$1.readFileSync(skillPath, "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return "";
    const frontmatter = match[1];
    const descMatch = frontmatter.match(/^description:\s*(.*)$/m);
    if (!descMatch) return "";
    const raw = descMatch[1].trim();
    if (raw.startsWith('"') && raw.endsWith('"') || raw.startsWith("'") && raw.endsWith("'")) {
      try {
        if (raw.startsWith('"')) {
          return JSON.parse(raw);
        }
        return raw.slice(1, -1);
      } catch {
        return raw.slice(1, -1);
      }
    }
    return raw;
  } catch {
    return "";
  }
}
function deleteSkill(name) {
  logEntry("Skills", "delete", { name });
  const record2 = resolveSkillRecord(name);
  if (record2.readOnly) {
    throw new Error("Skill is read-only.");
  }
  const skillDir = path$1.resolve(record2.skillPath, "..");
  if (!fs$1.existsSync(skillDir)) {
    logExit("Skills", "delete", { name, removed: false });
    return;
  }
  fs$1.rmSync(skillDir, { recursive: true, force: true });
  removeSkillConfig(record2.name);
  logExit("Skills", "delete", { name: record2.name });
}
function getSkillContent(name) {
  logEntry("Skills", "getContent", { name });
  const record2 = resolveSkillRecord(name);
  if (!fs$1.existsSync(record2.skillPath)) {
    throw new Error("Skill not found.");
  }
  const content = fs$1.readFileSync(record2.skillPath, "utf-8");
  logExit("Skills", "getContent", { name: record2.name, contentLength: content.length });
  return content;
}
function saveSkillContent(name, content) {
  logEntry("Skills", "saveContent", { name, contentLength: content.length });
  const record2 = resolveSkillRecord(name);
  if (record2.readOnly) {
    throw new Error("Skill is read-only.");
  }
  if (!fs$1.existsSync(record2.skillPath)) {
    throw new Error("Skill not found.");
  }
  fs$1.writeFileSync(record2.skillPath, content);
  const description = readSkillDescription(record2.skillPath);
  const result = {
    name: record2.name,
    description,
    path: normalizeSkillPath(record2.skillPath),
    source: record2.source,
    sourceType: record2.sourceType,
    readOnly: false,
    enabledClassic: isSkillEnabled(record2.name, "classic"),
    enabledButler: isSkillEnabled(record2.name, "butler"),
    enabled: isSkillEnabled(record2.name, "classic")
  };
  logExit("Skills", "saveContent", { name: record2.name });
  return result;
}
function updateSkillEnabled(name, enabled, scope) {
  logEntry("Skills", "setEnabled", { name, enabled, scope: scope ?? "all" });
  const record2 = resolveSkillRecord(name);
  setSkillEnabled(record2.name, enabled, scope);
  const state = getSkillEnabledState(record2.name);
  const description = readSkillDescription(record2.skillPath);
  const result = {
    name: record2.name,
    description,
    path: normalizeSkillPath(record2.skillPath),
    source: record2.source,
    sourceType: record2.sourceType,
    readOnly: record2.readOnly,
    enabledClassic: state.classic,
    enabledButler: state.butler,
    enabled: state.classic
  };
  logExit("Skills", "setEnabled", {
    name: record2.name,
    enabledClassic: result.enabledClassic,
    enabledButler: result.enabledButler
  });
  return result;
}
function readToolsConfig() {
  const database = getDb();
  const stmt = database.prepare(
    "SELECT name, enabled, enabled_classic, enabled_butler, key FROM tool_config"
  );
  const config2 = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const name = row.name;
    if (!name) continue;
    const legacyEnabled = row.enabled === null || row.enabled === void 0 ? void 0 : Boolean(row.enabled);
    const enabledClassic = row.enabled_classic === null || row.enabled_classic === void 0 ? legacyEnabled : Boolean(row.enabled_classic);
    const enabledButler = row.enabled_butler === null || row.enabled_butler === void 0 ? legacyEnabled : Boolean(row.enabled_butler);
    const key = row.key ?? void 0;
    config2[name] = {
      enabled: legacyEnabled ?? enabledClassic,
      enabledClassic,
      enabledButler,
      key
    };
  }
  stmt.free();
  return config2;
}
function resolveLegacyEnabled(entry) {
  if (entry.enabledClassic === void 0 && entry.enabledButler === void 0) {
    return entry.enabled;
  }
  if (entry.enabledClassic !== void 0 && entry.enabledButler !== void 0) {
    return entry.enabledClassic === entry.enabledButler ? entry.enabledClassic : entry.enabledClassic;
  }
  return entry.enabledClassic ?? entry.enabledButler ?? entry.enabled;
}
function writeToolsConfig(config2) {
  const database = getDb();
  database.run("DELETE FROM tool_config");
  for (const [name, entry] of Object.entries(config2)) {
    const enabledLegacy = resolveLegacyEnabled(entry);
    const enabled = enabledLegacy === void 0 || enabledLegacy === null ? null : enabledLegacy ? 1 : 0;
    const enabledClassic = entry.enabledClassic === void 0 || entry.enabledClassic === null ? null : entry.enabledClassic ? 1 : 0;
    const enabledButler = entry.enabledButler === void 0 || entry.enabledButler === null ? null : entry.enabledButler ? 1 : 0;
    const key = entry.key ?? null;
    database.run(
      `INSERT OR REPLACE INTO tool_config
       (name, enabled, enabled_classic, enabled_butler, key)
       VALUES (?, ?, ?, ?, ?)`,
      [name, enabled, enabledClassic, enabledButler, key]
    );
  }
  markDbDirty();
}
function pruneEntry(config2, toolName) {
  const existing = config2[toolName];
  if (!existing) return;
  if (!existing.key && existing.enabled === void 0 && existing.enabledClassic === void 0 && existing.enabledButler === void 0) {
    delete config2[toolName];
  }
}
function getStoredToolKey(toolName) {
  const config2 = readToolsConfig();
  return config2[toolName]?.key;
}
function setStoredToolKey(toolName, key) {
  const config2 = readToolsConfig();
  const existing = config2[toolName] ?? {};
  const trimmed = key?.trim();
  if (!trimmed) {
    delete existing.key;
  } else {
    existing.key = trimmed;
  }
  config2[toolName] = existing;
  pruneEntry(config2, toolName);
  writeToolsConfig(config2);
}
function getToolEnabledState(toolName) {
  const config2 = readToolsConfig();
  const entry = config2[toolName];
  const classic = entry?.enabledClassic ?? entry?.enabled ?? true;
  const butler = entry?.enabledButler ?? entry?.enabled ?? true;
  return { classic, butler };
}
function isToolEnabled(toolName, scope = "classic") {
  const state = getToolEnabledState(toolName);
  return scope === "butler" ? state.butler : state.classic;
}
function setToolEnabled(toolName, enabled, scope) {
  const config2 = readToolsConfig();
  const existing = config2[toolName] ?? {};
  if (!scope) {
    existing.enabled = enabled;
    existing.enabledClassic = enabled;
    existing.enabledButler = enabled;
  } else {
    if (scope === "classic") {
      existing.enabledClassic = enabled;
    } else {
      existing.enabledButler = enabled;
    }
    existing.enabled = existing.enabledClassic ?? existing.enabledButler ?? existing.enabled;
  }
  config2[toolName] = existing;
  pruneEntry(config2, toolName);
  writeToolsConfig(config2);
}
function resolveToolKey(toolName, envVarName) {
  const storedKey = getStoredToolKey(toolName);
  if (storedKey) {
    return storedKey;
  }
  if (envVarName) {
    return process.env[envVarName];
  }
  return void 0;
}
const createSkillFromConversationSchema = object({
  skillName: string().trim().min(1).optional(),
  threadId: string().trim().min(1).optional(),
  focus: string().trim().min(1).optional()
});
const modelOutputSchema = object({
  name: string().trim().min(1).max(64).optional(),
  description: string().trim().min(1),
  body: string().trim().min(1)
});
const EXTRACTION_SYSTEM_PROMPT = [
  "你是 skill 提炼器。你会把会话执行过程提炼成可复用技能。",
  "必须只输出 JSON，不允许输出解释文字。",
  'JSON 结构必须为：{"name":"...","description":"...","body":"..."}',
  "description 必须写清“做什么 + 何时使用（触发条件）”。",
  "body 必须使用可执行的指令语气，聚焦一个稳定流程，避免泛化空话。",
  "body 必须显式提醒读取 references/execution-log.md，避免把长日志写进 SKILL.md。",
  "如果识别到可复用步骤，body 必须给出明确 step-by-step 工作流。",
  "name 必须是小写字母/数字/连字符，长度不超过 64。"
].join("\n");
const createSkillFromConversationDefinition = {
  name: "create_skill_from_conversation",
  label: "Create Skill From Conversation",
  description: "Extract a reusable skill from the current thread execution process.",
  requiresKey: false
};
function normalizeSkillName(raw) {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) return "conversation-skill";
  return normalized.slice(0, 64).replace(/-+$/g, "") || "conversation-skill";
}
function resolveSkillNameWithSuffix(preferred) {
  const base2 = normalizeSkillName(preferred);
  const existing = new Set(listAppSkills().map((item) => item.name));
  if (!existing.has(base2)) return base2;
  for (let index2 = 2; index2 < 1e4; index2 += 1) {
    const suffix = `-${index2}`;
    const headMax = Math.max(1, 64 - suffix.length);
    const head = base2.slice(0, headMax).replace(/-+$/g, "") || "skill";
    const candidate = `${head}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a unique skill name.");
}
function extractTextContent$3(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const block = item;
      if (block.type === "text" && typeof block.text === "string") return block.text;
      if (typeof block.text === "string") return block.text;
      if (typeof block.content === "string") return block.content;
      if (block.content !== void 0) {
        try {
          return JSON.stringify(block.content);
        } catch {
          return String(block.content);
        }
      }
      return "";
    }).join("");
  }
  if (content && typeof content === "object") {
    const value = content;
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return "";
}
function parseJsonObject$1(text) {
  const raw = text.trim();
  if (!raw) {
    throw new Error("Model returned empty response.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last < first) {
      throw new Error("Model output contains no JSON object.");
    }
    return JSON.parse(raw.slice(first, last + 1));
  }
}
function getMessageRole(msg) {
  if (typeof msg._getType === "function") {
    return msg._getType();
  }
  if (typeof msg.type === "string") return msg.type;
  const classId = Array.isArray(msg.id) ? msg.id : [];
  const className = classId[classId.length - 1] || "";
  if (className.includes("Human")) return "human";
  if (className.includes("AI")) return "ai";
  if (className.includes("Tool")) return "tool";
  if (className.includes("System")) return "system";
  return "";
}
function getMessageId(msg) {
  if (typeof msg.id === "string") return msg.id;
  const kwargs = msg.kwargs;
  return kwargs?.id;
}
function getMessageContent(msg) {
  if ("content" in msg) {
    return extractTextContent$3(msg.content);
  }
  const kwargs = msg.kwargs;
  return extractTextContent$3(kwargs?.content);
}
function getToolCalls(msg) {
  if (Array.isArray(msg.tool_calls)) {
    return msg.tool_calls;
  }
  const kwargs = msg.kwargs;
  return kwargs?.tool_calls || [];
}
function getToolMessageMeta(msg) {
  const toolCallId = msg.tool_call_id;
  const toolName = msg.name;
  const kwargs = msg.kwargs;
  return {
    toolCallId: toolCallId || kwargs?.tool_call_id,
    toolName: toolName || kwargs?.name
  };
}
function uniqueMessageKey(msg, role, content) {
  const id = getMessageId(msg);
  if (id) return `id:${id}`;
  const meta = getToolMessageMeta(msg);
  return `anon:${role}:${meta.toolCallId || ""}:${meta.toolName || ""}:${content}`;
}
function extractMessagesFromCheckpointTuple(tuple) {
  if (!tuple || typeof tuple !== "object") return [];
  const entry = tuple;
  const messages2 = entry.checkpoint?.channel_values?.messages;
  return Array.isArray(messages2) ? messages2 : [];
}
async function loadThreadCheckpointHistory(threadId) {
  const checkpointPath = getThreadCheckpointPath(threadId);
  if (!fs$1.existsSync(checkpointPath)) {
    return [];
  }
  const saver = new SqlJsSaver(checkpointPath);
  await saver.initialize();
  try {
    const checkpoints = [];
    for await (const tuple of saver.list(
      { configurable: { thread_id: threadId } },
      { limit: 2e3 }
    )) {
      checkpoints.push(tuple);
    }
    checkpoints.reverse();
    return checkpoints;
  } finally {
    await saver.close();
  }
}
function extractProcessEvents(checkpoints) {
  const events2 = [];
  const seenMessages = /* @__PURE__ */ new Set();
  const seenToolCalls = /* @__PURE__ */ new Set();
  let userCount = 0;
  let assistantCount = 0;
  let toolCallCount = 0;
  let toolResultCount = 0;
  for (const tuple of checkpoints) {
    const messages2 = extractMessagesFromCheckpointTuple(tuple);
    for (const rawMessage of messages2) {
      if (!rawMessage || typeof rawMessage !== "object") continue;
      const message = rawMessage;
      const role = getMessageRole(message);
      if (!role || role === "system") continue;
      const content = getMessageContent(message).trim();
      const messageKey = uniqueMessageKey(message, role, content);
      if (seenMessages.has(messageKey)) {
        continue;
      }
      seenMessages.add(messageKey);
      if (role === "human") {
        if (content) {
          events2.push({ type: "user", content, messageId: getMessageId(message) });
          userCount += 1;
        }
        continue;
      }
      if (role === "ai") {
        if (content) {
          events2.push({ type: "assistant", content, messageId: getMessageId(message) });
          assistantCount += 1;
        }
        const toolCalls = getToolCalls(message);
        for (const toolCall of toolCalls) {
          const argsText = toolCall.args ? JSON.stringify(toolCall.args) : "{}";
          const key = toolCall.id || `${toolCall.name || "tool"}:${argsText}`;
          if (seenToolCalls.has(key)) continue;
          seenToolCalls.add(key);
          events2.push({
            type: "tool_call",
            content: `${toolCall.name || "tool"}(${argsText})`,
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            toolArgs: toolCall.args
          });
          toolCallCount += 1;
        }
        continue;
      }
      if (role === "tool") {
        const meta = getToolMessageMeta(message);
        events2.push({
          type: "tool_result",
          content,
          messageId: getMessageId(message),
          toolCallId: meta.toolCallId,
          toolName: meta.toolName
        });
        toolResultCount += 1;
      }
    }
  }
  return {
    events: events2,
    userCount,
    assistantCount,
    toolCallCount,
    toolResultCount
  };
}
function formatEventBlock(event, index2) {
  const header = event.type === "user" ? `### ${index2 + 1}. USER` : event.type === "assistant" ? `### ${index2 + 1}. ASSISTANT` : event.type === "tool_call" ? `### ${index2 + 1}. TOOL_CALL ${event.toolName || "unknown"}` : `### ${index2 + 1}. TOOL_RESULT ${event.toolName || "unknown"}`;
  const metadata = [
    event.messageId ? `- messageId: ${event.messageId}` : null,
    event.toolCallId ? `- toolCallId: ${event.toolCallId}` : null
  ].filter(Boolean).join("\n");
  const body = event.type === "tool_call" && event.toolArgs ? `\`\`\`json
${JSON.stringify(event.toolArgs, null, 2)}
\`\`\`` : `\`\`\`text
${event.content || "(empty)"}
\`\`\``;
  return [header, metadata, body].filter(Boolean).join("\n");
}
function renderExecutionLog(params) {
  const { threadId, focus, checkpointsCount, extraction } = params;
  const summary = [
    "# Execution Log",
    `- generatedAt: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    `- threadId: ${threadId}`,
    `- focus: ${focus || "none"}`,
    `- checkpointsAnalyzed: ${checkpointsCount}`,
    `- events: ${extraction.events.length}`,
    `- userMessages: ${extraction.userCount}`,
    `- assistantMessages: ${extraction.assistantCount}`,
    `- toolCalls: ${extraction.toolCallCount}`,
    `- toolResults: ${extraction.toolResultCount}`,
    "",
    "## Timeline"
  ];
  if (extraction.events.length === 0) {
    summary.push("_No process events found in checkpoint history._");
  } else {
    for (let index2 = 0; index2 < extraction.events.length; index2 += 1) {
      summary.push(formatEventBlock(extraction.events[index2], index2));
      summary.push("");
    }
  }
  return summary.join("\n");
}
function compactForModel(input, max = 500) {
  const text = input.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
function buildModelInput(params) {
  const { threadId, focus, extraction } = params;
  const recentEvents = extraction.events.slice(-120);
  const timeline = recentEvents.map((event, index2) => {
    if (event.type === "tool_call") {
      return `${index2 + 1}. [tool_call] ${event.toolName || "tool"} args=${compactForModel(
        JSON.stringify(event.toolArgs ?? {}),
        360
      )}`;
    }
    if (event.type === "tool_result") {
      return `${index2 + 1}. [tool_result] ${event.toolName || "tool"} result=${compactForModel(
        event.content,
        420
      )}`;
    }
    return `${index2 + 1}. [${event.type}] ${compactForModel(event.content, 420)}`;
  }).join("\n");
  return [
    "[Thread]",
    threadId,
    "",
    "[Focus]",
    focus || "none",
    "",
    "[Stats]",
    `events=${extraction.events.length}; users=${extraction.userCount}; assistants=${extraction.assistantCount}; toolCalls=${extraction.toolCallCount}; toolResults=${extraction.toolResultCount}`,
    "",
    "[Recent Timeline]",
    timeline || "none",
    "",
    "[Constraints]",
    "Generate a reusable SKILL.md body. Mention references/execution-log.md explicitly."
  ].join("\n");
}
function resolveRuntimeThreadId(runtime) {
  const top = runtime;
  if (typeof top?.configurable?.thread_id === "string" && top.configurable.thread_id.trim()) {
    return top.configurable.thread_id.trim();
  }
  const nested = runtime;
  if (typeof nested?.config?.configurable?.thread_id === "string" && nested.config.configurable.thread_id.trim()) {
    return nested.config.configurable.thread_id.trim();
  }
  return void 0;
}
function resolveProviderConfig$3(state, providerId) {
  const config2 = state.configs[providerId];
  if (!config2) {
    throw new Error(`Provider "${providerId}" not configured. Please configure it in Settings.`);
  }
  return config2;
}
function getModelInstance$3() {
  const state = getProviderState();
  if (!state) {
    throw new Error(
      "Provider not configured. Please configure Ollama, OpenAI-compatible, or Multimodal provider in Settings."
    );
  }
  const config2 = resolveProviderConfig$3(state, state.active);
  if (!config2.model) {
    throw new Error("Active provider has no model configured.");
  }
  if (config2.type === "ollama") {
    const baseURL = config2.url.endsWith("/v1") ? config2.url : `${config2.url}/v1`;
    return new openai.ChatOpenAI({
      model: config2.model,
      configuration: { baseURL },
      apiKey: "ollama"
    });
  }
  return new openai.ChatOpenAI({
    model: config2.model,
    apiKey: config2.apiKey,
    configuration: { baseURL: config2.url }
  });
}
async function extractSkillDraftByModel(params) {
  const model = getModelInstance$3();
  const response = await model.invoke([
    new messages.SystemMessage(EXTRACTION_SYSTEM_PROMPT),
    new messages.HumanMessage(buildModelInput(params))
  ]);
  const raw = extractTextContent$3(response.content);
  const parsed = parseJsonObject$1(raw);
  const output = modelOutputSchema.parse(parsed);
  return {
    name: output.name,
    description: output.description,
    body: output.body
  };
}
function ensureExecutionReference(body) {
  const marker = "references/execution-log.md";
  if (body.includes(marker)) {
    return body.trim();
  }
  return [
    body.trim(),
    "",
    "## References",
    "- Read `references/execution-log.md` for full execution details."
  ].join("\n");
}
function buildFallbackDescription(focus) {
  if (focus?.trim()) {
    return `Extract and execute the "${focus.trim()}" workflow from prior conversations. Use this skill when a similar objective appears.`;
  }
  return "Extract and execute a reusable workflow from prior conversation execution. Use this skill when similar goals and tool sequences appear.";
}
function buildFallbackBody(params) {
  const focusLine = params.focus?.trim() ? `- Prioritize the workflow around: ${params.focus.trim()}.` : "- Prioritize the core objective from the latest conversation.";
  const errorLine = params.modelError ? `- Model extraction failed: ${params.modelError}` : "- Model extraction fallback path was used.";
  return [
    `# ${params.name}`,
    "",
    "Execute this workflow consistently when the user asks for the same outcome.",
    "",
    "## Workflow",
    "1. Read `references/execution-log.md` completely to reconstruct the exact sequence.",
    "2. Identify the minimal reusable path (inputs, tools, expected outputs).",
    "3. Execute steps in order; keep tool calls and output formats consistent.",
    "4. Validate final output against the user's original objective.",
    "",
    "## Notes",
    focusLine,
    errorLine,
    "- Keep this skill focused on one stable process."
  ].join("\n");
}
function buildSkillMarkdown(params) {
  const description = params.description.trim().replace(/\r?\n+/g, " ");
  const safeDescription = description || "Reusable skill extracted from conversation process.";
  return [
    "---",
    `name: ${params.name}`,
    `description: ${JSON.stringify(safeDescription)}`,
    "---",
    "",
    ensureExecutionReference(params.body),
    ""
  ].join("\n");
}
const createSkillFromConversationTool = tools.tool(
  async ({ skillName, threadId, focus }, runtime) => {
    const start = Date.now();
    const runtimeThreadId = resolveRuntimeThreadId(runtime);
    const resolvedThreadId = threadId?.trim() || runtimeThreadId;
    logEntry("Tool", "create_skill_from_conversation", {
      requestedThreadId: threadId || null,
      runtimeThreadId: runtimeThreadId || null,
      hasFocus: !!focus
    });
    if (!resolvedThreadId) {
      const message = "Thread ID is required. Provide threadId explicitly or invoke the tool from a thread runtime.";
      logExit(
        "Tool",
        "create_skill_from_conversation",
        { ok: false, error: "missing_thread_id" },
        Date.now() - start
      );
      throw new Error(message);
    }
    const checkpoints = await loadThreadCheckpointHistory(resolvedThreadId);
    const extraction = extractProcessEvents(checkpoints);
    const executionLogContent = renderExecutionLog({
      threadId: resolvedThreadId,
      focus,
      checkpointsCount: checkpoints.length,
      extraction
    });
    let draft = null;
    let usedFallback = false;
    let modelError;
    try {
      draft = await extractSkillDraftByModel({
        threadId: resolvedThreadId,
        focus,
        extraction
      });
    } catch (error) {
      usedFallback = true;
      modelError = error instanceof Error ? error.message : String(error);
    }
    const preferredName = skillName?.trim() || draft?.name?.trim() || focus?.trim() || extraction.events.find((event) => event.type === "user")?.content || "conversation-skill";
    const finalName = resolveSkillNameWithSuffix(preferredName);
    const description = draft?.description?.trim() || buildFallbackDescription(focus);
    const body = draft?.body?.trim() || buildFallbackBody({ name: finalName, focus, modelError });
    const skillMd = buildSkillMarkdown({
      name: finalName,
      description,
      body
    });
    const created = createSkill({
      name: finalName,
      description,
      content: skillMd
    });
    const skillsRoot = getSkillsRoot();
    const skillDir = path$1.resolve(skillsRoot, finalName);
    const executionLogPath = path$1.join(skillDir, "references", "execution-log.md");
    fs$1.mkdirSync(path$1.resolve(skillDir, "references"), { recursive: true });
    fs$1.writeFileSync(executionLogPath, executionLogContent);
    const result = {
      ok: true,
      threadId: resolvedThreadId,
      skill: {
        name: created.name,
        path: created.path,
        sourceType: "managed"
      },
      files: {
        skillMdPath: created.path,
        executionLogPath: path$1.resolve(executionLogPath)
      },
      stats: {
        checkpoints: checkpoints.length,
        events: extraction.events.length,
        userMessages: extraction.userCount,
        assistantMessages: extraction.assistantCount,
        toolCalls: extraction.toolCallCount,
        toolResults: extraction.toolResultCount
      },
      usedFallback,
      modelError: modelError || null
    };
    logExit(
      "Tool",
      "create_skill_from_conversation",
      { ok: true, skillName: finalName },
      Date.now() - start
    );
    return result;
  },
  {
    name: createSkillFromConversationDefinition.name,
    description: createSkillFromConversationDefinition.description,
    schema: createSkillFromConversationSchema
  }
);
const internetSearchDefinition = {
  name: "internet_search",
  label: "Internet Search",
  description: "Run a web search",
  keyLabel: "Tavily API Key",
  envVar: "TAVILY_API_KEY"
};
const internetSearchTool = tools.tool(
  async ({
    query,
    maxResults = 5,
    topic = "general",
    includeRawContent = false
  }) => {
    const start = Date.now();
    logEntry("Tool", "internet_search", {
      queryLength: query?.length ?? 0,
      maxResults,
      topic,
      includeRawContent
    });
    const apiKey = resolveToolKey(internetSearchDefinition.name, internetSearchDefinition.envVar);
    if (!apiKey) {
      logExit(
        "Tool",
        "internet_search",
        { ok: false, error: "missing_api_key" },
        Date.now() - start
      );
      throw new Error("Tavily API key is not configured. Please set it in Tools or TAVILY_API_KEY.");
    }
    const tavilySearch = new tavily.TavilySearch({
      maxResults,
      tavilyApiKey: apiKey,
      includeRawContent,
      topic
    });
    try {
      const result = await tavilySearch._call({ query });
      logExit("Tool", "internet_search", { ok: true }, Date.now() - start);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      logExit("Tool", "internet_search", { ok: false, error: message }, Date.now() - start);
      throw error;
    }
  },
  {
    name: internetSearchDefinition.name,
    description: internetSearchDefinition.description,
    schema: object({
      query: string().describe("The search query"),
      maxResults: number().optional().default(5).describe("Maximum number of results to return"),
      topic: _enum(["general", "news", "finance"]).optional().default("general").describe("Search topic category"),
      includeRawContent: boolean().optional().default(false).describe("Whether to include raw content")
    })
  }
);
function nowIso$2() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function normalizeIsoTime(input, fieldName) {
  const value = input.trim();
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }
  const date2 = new Date(value);
  if (Number.isNaN(date2.getTime())) {
    throw new Error(`Invalid ${fieldName}.`);
  }
  return date2.toISOString();
}
function normalizeOptionalText(input) {
  const value = input?.trim();
  return value ? value : void 0;
}
function normalizeRequiredText(input, fieldName) {
  const value = input.trim();
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }
  return value;
}
function mapCalendarEventRow(row) {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: normalizeOptionalText(row.description ?? void 0),
    location: normalizeOptionalText(row.location ?? void 0),
    startAt: String(row.start_at ?? ""),
    endAt: normalizeOptionalText(row.end_at ?? void 0),
    enabled: Boolean(row.enabled),
    reminderSentAt: normalizeOptionalText(
      row.reminder_sent_at ?? void 0
    ),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}
function mapCountdownRow(row) {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: normalizeOptionalText(row.description ?? void 0),
    dueAt: String(row.due_at ?? ""),
    status: String(row.status ?? "running"),
    reminderSentAt: normalizeOptionalText(
      row.reminder_sent_at ?? void 0
    ),
    completedAt: normalizeOptionalText(
      row.completed_at ?? void 0
    ),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}
function mapMailRuleRow(row) {
  const rawLastSeenUid = row.last_seen_uid;
  const lastSeenUid = typeof rawLastSeenUid === "number" && Number.isFinite(rawLastSeenUid) ? rawLastSeenUid : void 0;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    folder: String(row.folder ?? "INBOX"),
    fromContains: normalizeOptionalText(
      row.from_contains ?? void 0
    ),
    subjectContains: normalizeOptionalText(
      row.subject_contains ?? void 0
    ),
    enabled: Boolean(row.enabled),
    lastSeenUid,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}
function mapMailMessageRow(row) {
  return {
    id: String(row.id ?? ""),
    ruleId: String(row.rule_id ?? ""),
    uid: Number(row.uid ?? 0),
    subject: String(row.subject ?? ""),
    from: String(row.sender ?? ""),
    text: String(row.text ?? ""),
    receivedAt: String(row.received_at ?? ""),
    createdAt: String(row.created_at ?? "")
  };
}
function findCalendarEventById(id) {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, title, description, location, start_at, end_at, enabled, reminder_sent_at, created_at, updated_at
     FROM butler_calendar_events WHERE id = ? LIMIT 1`
  );
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return mapCalendarEventRow(row);
}
function findCountdownById(id) {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, title, description, due_at, status, reminder_sent_at, completed_at, created_at, updated_at
     FROM butler_countdown_timers WHERE id = ? LIMIT 1`
  );
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return mapCountdownRow(row);
}
function findMailRuleById(id) {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, name, folder, from_contains, subject_contains, enabled, last_seen_uid, created_at, updated_at
     FROM butler_mail_watch_rules WHERE id = ? LIMIT 1`
  );
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return mapMailRuleRow(row);
}
function listCalendarWatchEvents() {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, title, description, location, start_at, end_at, enabled, reminder_sent_at, created_at, updated_at
     FROM butler_calendar_events
     ORDER BY start_at ASC`
  );
  const rows = [];
  while (stmt.step()) {
    rows.push(mapCalendarEventRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}
function createCalendarWatchEvent(input) {
  const database = getDb();
  const now = nowIso$2();
  const id = uuid$1.v4();
  const event = {
    id,
    title: normalizeRequiredText(input.title, "title"),
    description: normalizeOptionalText(input.description),
    location: normalizeOptionalText(input.location),
    startAt: normalizeIsoTime(input.startAt, "startAt"),
    endAt: input.endAt ? normalizeIsoTime(input.endAt, "endAt") : void 0,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now
  };
  database.run(
    `INSERT INTO butler_calendar_events (
      id, title, description, location, start_at, end_at, enabled, reminder_sent_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.title,
      event.description ?? null,
      event.location ?? null,
      event.startAt,
      event.endAt ?? null,
      event.enabled ? 1 : 0,
      null,
      event.createdAt,
      event.updatedAt
    ]
  );
  markDbDirty();
  return event;
}
function updateCalendarWatchEvent(id, updates) {
  const existing = findCalendarEventById(id);
  if (!existing) {
    throw new Error("Calendar event not found.");
  }
  const next = {
    ...existing,
    title: updates.title === void 0 ? existing.title : normalizeRequiredText(updates.title, "title"),
    description: updates.description === void 0 ? existing.description : normalizeOptionalText(updates.description),
    location: updates.location === void 0 ? existing.location : normalizeOptionalText(updates.location),
    startAt: updates.startAt === void 0 ? existing.startAt : normalizeIsoTime(updates.startAt, "startAt"),
    endAt: updates.endAt === void 0 ? existing.endAt : updates.endAt ? normalizeIsoTime(updates.endAt, "endAt") : void 0,
    enabled: updates.enabled ?? existing.enabled,
    reminderSentAt: updates.reminderSentAt === void 0 ? existing.reminderSentAt : updates.reminderSentAt ? normalizeIsoTime(updates.reminderSentAt, "reminderSentAt") : void 0,
    updatedAt: nowIso$2()
  };
  const database = getDb();
  database.run(
    `UPDATE butler_calendar_events
     SET title = ?, description = ?, location = ?, start_at = ?, end_at = ?, enabled = ?, reminder_sent_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.title,
      next.description ?? null,
      next.location ?? null,
      next.startAt,
      next.endAt ?? null,
      next.enabled ? 1 : 0,
      next.reminderSentAt ?? null,
      next.updatedAt,
      id
    ]
  );
  markDbDirty();
  return next;
}
function deleteCalendarWatchEvent(id) {
  const database = getDb();
  database.run("DELETE FROM butler_calendar_events WHERE id = ?", [id]);
  markDbDirty();
}
function listCountdownWatchItems() {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, title, description, due_at, status, reminder_sent_at, completed_at, created_at, updated_at
     FROM butler_countdown_timers
     ORDER BY due_at ASC`
  );
  const rows = [];
  while (stmt.step()) {
    rows.push(mapCountdownRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}
function createCountdownWatchItem(input) {
  const database = getDb();
  const now = nowIso$2();
  const id = uuid$1.v4();
  const item = {
    id,
    title: normalizeRequiredText(input.title, "title"),
    description: normalizeOptionalText(input.description),
    dueAt: normalizeIsoTime(input.dueAt, "dueAt"),
    status: "running",
    createdAt: now,
    updatedAt: now
  };
  database.run(
    `INSERT INTO butler_countdown_timers (
      id, title, description, due_at, status, reminder_sent_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.title,
      item.description ?? null,
      item.dueAt,
      item.status,
      null,
      null,
      item.createdAt,
      item.updatedAt
    ]
  );
  markDbDirty();
  return item;
}
function updateCountdownWatchItem(id, updates) {
  const existing = findCountdownById(id);
  if (!existing) {
    throw new Error("Countdown timer not found.");
  }
  const nextStatus = updates.status ?? existing.status;
  const nextCompletedAt = updates.completedAt === void 0 ? existing.completedAt : updates.completedAt ? normalizeIsoTime(updates.completedAt, "completedAt") : void 0;
  const next = {
    ...existing,
    title: updates.title === void 0 ? existing.title : normalizeRequiredText(updates.title, "title"),
    description: updates.description === void 0 ? existing.description : normalizeOptionalText(updates.description),
    dueAt: updates.dueAt === void 0 ? existing.dueAt : normalizeIsoTime(updates.dueAt, "dueAt"),
    status: nextStatus,
    reminderSentAt: updates.reminderSentAt === void 0 ? existing.reminderSentAt : updates.reminderSentAt ? normalizeIsoTime(updates.reminderSentAt, "reminderSentAt") : void 0,
    completedAt: nextCompletedAt,
    updatedAt: nowIso$2()
  };
  const database = getDb();
  database.run(
    `UPDATE butler_countdown_timers
     SET title = ?, description = ?, due_at = ?, status = ?, reminder_sent_at = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.title,
      next.description ?? null,
      next.dueAt,
      next.status,
      next.reminderSentAt ?? null,
      next.completedAt ?? null,
      next.updatedAt,
      id
    ]
  );
  markDbDirty();
  return next;
}
function deleteCountdownWatchItem(id) {
  const database = getDb();
  database.run("DELETE FROM butler_countdown_timers WHERE id = ?", [id]);
  markDbDirty();
}
function listMailWatchRules() {
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, name, folder, from_contains, subject_contains, enabled, last_seen_uid, created_at, updated_at
     FROM butler_mail_watch_rules
     ORDER BY created_at DESC`
  );
  const rows = [];
  while (stmt.step()) {
    rows.push(mapMailRuleRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}
function createMailWatchRule(input) {
  const database = getDb();
  const now = nowIso$2();
  const id = uuid$1.v4();
  const rule = {
    id,
    name: normalizeRequiredText(input.name, "name"),
    folder: normalizeOptionalText(input.folder) || "INBOX",
    fromContains: normalizeOptionalText(input.fromContains),
    subjectContains: normalizeOptionalText(input.subjectContains),
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now
  };
  database.run(
    `INSERT INTO butler_mail_watch_rules (
      id, name, folder, from_contains, subject_contains, enabled, last_seen_uid, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.id,
      rule.name,
      rule.folder,
      rule.fromContains ?? null,
      rule.subjectContains ?? null,
      rule.enabled ? 1 : 0,
      null,
      rule.createdAt,
      rule.updatedAt
    ]
  );
  markDbDirty();
  return rule;
}
function updateMailWatchRule(id, updates) {
  const existing = findMailRuleById(id);
  if (!existing) {
    throw new Error("Mail watch rule not found.");
  }
  const next = {
    ...existing,
    name: updates.name === void 0 ? existing.name : normalizeRequiredText(updates.name, "name"),
    folder: updates.folder === void 0 ? existing.folder : normalizeOptionalText(updates.folder) || "INBOX",
    fromContains: updates.fromContains === void 0 ? existing.fromContains : normalizeOptionalText(updates.fromContains),
    subjectContains: updates.subjectContains === void 0 ? existing.subjectContains : normalizeOptionalText(updates.subjectContains),
    enabled: updates.enabled ?? existing.enabled,
    lastSeenUid: updates.lastSeenUid === void 0 ? existing.lastSeenUid : updates.lastSeenUid === null ? void 0 : Math.max(0, Math.floor(updates.lastSeenUid)),
    updatedAt: nowIso$2()
  };
  const database = getDb();
  database.run(
    `UPDATE butler_mail_watch_rules
     SET name = ?, folder = ?, from_contains = ?, subject_contains = ?, enabled = ?, last_seen_uid = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.folder,
      next.fromContains ?? null,
      next.subjectContains ?? null,
      next.enabled ? 1 : 0,
      next.lastSeenUid ?? null,
      next.updatedAt,
      id
    ]
  );
  markDbDirty();
  return next;
}
function deleteMailWatchRule(id) {
  const database = getDb();
  database.run("DELETE FROM butler_mail_watch_rules WHERE id = ?", [id]);
  database.run("DELETE FROM butler_mail_watch_messages WHERE rule_id = ?", [id]);
  markDbDirty();
}
function listRecentMailWatchMessages(limit = 20) {
  const normalizedLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const database = getDb();
  const stmt = database.prepare(
    `SELECT id, rule_id, uid, subject, sender, text, received_at, created_at
     FROM butler_mail_watch_messages
     ORDER BY created_at DESC
     LIMIT ?`
  );
  stmt.bind([normalizedLimit]);
  const rows = [];
  while (stmt.step()) {
    rows.push(mapMailMessageRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}
function insertMailWatchMessages(messages2) {
  if (messages2.length === 0) return [];
  const database = getDb();
  const inserted = [];
  const checkStmt = database.prepare(
    "SELECT 1 FROM butler_mail_watch_messages WHERE id = ? LIMIT 1"
  );
  for (const message of messages2) {
    checkStmt.bind([message.id]);
    const exists = checkStmt.step();
    checkStmt.reset();
    if (exists) {
      continue;
    }
    database.run(
      `INSERT INTO butler_mail_watch_messages (
        id, rule_id, uid, subject, sender, text, received_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.ruleId,
        message.uid,
        message.subject,
        message.from,
        message.text,
        message.receivedAt,
        message.createdAt
      ]
    );
    inserted.push(message);
  }
  checkStmt.free();
  if (inserted.length > 0) {
    markDbDirty();
  }
  return inserted;
}
const addCalendarEventDefinition = {
  name: "add_calendar_event",
  label: "Add Calendar Event",
  description: "Add an event to Butler monitor calendar.",
  requiresKey: false
};
const payloadSchema$2 = object({
  title: string().trim().min(1),
  startAt: string().trim().min(1).describe("ISO datetime string (example: 2026-02-09T15:30:00+08:00)"),
  endAt: string().trim().optional().describe("Optional ISO datetime string"),
  description: string().trim().optional(),
  location: string().trim().optional()
});
const addCalendarEventTool = tools.tool(
  async (input) => {
    const event = createCalendarWatchEvent({
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      description: input.description,
      location: input.location,
      enabled: true
    });
    return {
      ok: true,
      event
    };
  },
  {
    name: addCalendarEventDefinition.name,
    description: addCalendarEventDefinition.description,
    schema: payloadSchema$2
  }
);
const addCountdownTimerDefinition = {
  name: "add_countdown_timer",
  label: "Add Countdown Timer",
  description: "Add a countdown timer to Butler monitor.",
  requiresKey: false
};
const payloadSchema$1 = object({
  title: string().trim().min(1),
  dueAt: string().trim().min(1).describe("ISO datetime string (example: 2026-02-09T16:00:00+08:00)"),
  description: string().trim().optional()
});
const addCountdownTimerTool = tools.tool(
  async (input) => {
    const timer = createCountdownWatchItem({
      title: input.title,
      dueAt: input.dueAt,
      description: input.description
    });
    return {
      ok: true,
      timer
    };
  },
  {
    name: addCountdownTimerDefinition.name,
    description: addCountdownTimerDefinition.description,
    schema: payloadSchema$1
  }
);
const defaultSettings = {
  ralphIterations: 5,
  email: {
    enabled: false,
    from: "",
    to: [],
    smtp: {
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: ""
    },
    imap: {
      host: "",
      port: 993,
      secure: true,
      user: "",
      pass: ""
    },
    taskTag: "<OpenworkTask>",
    pollIntervalSec: 60
  },
  speech: {
    stt: {
      url: "",
      headers: {},
      language: ""
    },
    tts: {
      url: "",
      headers: {},
      voice: ""
    }
  },
  defaultWorkspacePath: "",
  butler: {
    rootPath: path.join(getOpenworkDir(), "butler-workspaces"),
    maxConcurrent: 2,
    recentRounds: 5,
    monitorScanIntervalSec: 30,
    monitorPullIntervalSec: 60
  },
  plugins: {
    actionbook: {
      enabled: false
    }
  },
  dockerConfig: {
    enabled: false,
    image: "python:3.13-alpine",
    mounts: [
      {
        hostPath: "",
        containerPath: "/workspace",
        readOnly: false
      }
    ],
    resources: {},
    ports: []
  }
};
function readSettings() {
  const database = getDb();
  const stmt = database.prepare("SELECT data FROM app_settings WHERE id = 1");
  const hasRow = stmt.step();
  if (!hasRow) {
    stmt.free();
    return defaultSettings;
  }
  const row = stmt.getAsObject();
  stmt.free();
  try {
    const parsed = JSON.parse(row.data ?? "{}");
    return {
      ...defaultSettings,
      ...parsed,
      butler: {
        ...defaultSettings.butler,
        ...parsed?.butler ?? {}
      },
      email: {
        ...defaultSettings.email,
        ...parsed?.email ?? {},
        smtp: {
          ...defaultSettings.email.smtp,
          ...parsed?.email?.smtp ?? {}
        },
        imap: {
          ...defaultSettings.email.imap,
          ...parsed?.email?.imap ?? {}
        }
      },
      speech: {
        ...defaultSettings.speech,
        ...parsed?.speech ?? {},
        stt: {
          ...defaultSettings.speech.stt,
          ...parsed?.speech?.stt ?? {}
        },
        tts: {
          ...defaultSettings.speech.tts,
          ...parsed?.speech?.tts ?? {}
        }
      },
      plugins: {
        ...defaultSettings.plugins,
        ...parsed?.plugins ?? {},
        actionbook: {
          ...defaultSettings.plugins.actionbook,
          ...parsed?.plugins?.actionbook ?? {}
        }
      }
    };
  } catch {
    return defaultSettings;
  }
}
function writeSettings(settings) {
  const database = getDb();
  const data = JSON.stringify(settings, null, 2);
  database.run("INSERT OR REPLACE INTO app_settings (id, data) VALUES (1, ?)", [data]);
  markDbDirty();
}
function getSettings() {
  return readSettings();
}
function updateSettings(updates) {
  const current = readSettings();
  const next = {
    ...current,
    ...updates,
    butler: {
      ...current.butler,
      ...updates.butler ?? {}
    },
    email: {
      ...current.email,
      ...updates.email ?? {},
      smtp: {
        ...current.email.smtp,
        ...updates.email?.smtp ?? {}
      },
      imap: {
        ...current.email.imap,
        ...updates.email?.imap ?? {}
      }
    },
    speech: {
      ...current.speech,
      ...updates.speech ?? {},
      stt: {
        ...current.speech.stt,
        ...updates.speech?.stt ?? {}
      },
      tts: {
        ...current.speech.tts,
        ...updates.speech?.tts ?? {}
      }
    },
    plugins: {
      ...current.plugins,
      ...updates.plugins ?? {},
      actionbook: {
        ...current.plugins.actionbook,
        ...updates.plugins?.actionbook ?? {}
      }
    },
    defaultWorkspacePath: updates.defaultWorkspacePath === void 0 ? current.defaultWorkspacePath : updates.defaultWorkspacePath,
    dockerConfig: updates.dockerConfig ?? current.dockerConfig
  };
  writeSettings(next);
  return next;
}
function getTaskTag() {
  const settings = getSettings();
  return settings.email.taskTag || "<OpenworkTask>";
}
function normalizeSubject(subject) {
  return subject.replace(/^(?:\s*(?:re|fwd|fw):\s*)+/gi, "").trim();
}
function buildEmailSubject(threadId, suffix) {
  const cleaned = suffix.trim();
  const tag = getTaskTag();
  return `${tag} [${threadId}] ${cleaned}`.trim();
}
function stripEmailSubjectPrefix(subject) {
  const normalized = normalizeSubject(subject);
  const tag = getTaskTag();
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedTag}\\s*(\\[[^\\]]+\\]\\s*)?`, "i");
  return normalized.replace(regex, "").trim();
}
function getEmailSettings() {
  const settings = getSettings();
  return settings.email;
}
function normalizeEmail(value) {
  return value?.trim().toLowerCase() ?? "";
}
function isSelfSender(parsed, settings) {
  const selfAddresses = [settings.from, settings.smtp.user, settings.imap.user].map((addr) => normalizeEmail(addr)).filter(Boolean);
  if (selfAddresses.length === 0) return false;
  const fromAddresses = parsed.from?.value?.map((entry) => normalizeEmail(entry.address))?.filter(Boolean) ?? [];
  if (fromAddresses.some((addr) => selfAddresses.includes(addr))) {
    return true;
  }
  const fromText = normalizeEmail(parsed.from?.text);
  if (fromText && selfAddresses.some((addr) => fromText.includes(addr))) {
    return true;
  }
  return false;
}
function ensureEmailEnabled(settings) {
  if (!settings.enabled) {
    throw new Error("Email integration is disabled.");
  }
  if (!settings.smtp.host || !settings.smtp.user || !settings.smtp.pass) {
    throw new Error("SMTP settings are incomplete.");
  }
  if (!settings.imap.host || !settings.imap.user || !settings.imap.pass) {
    throw new Error("IMAP settings are incomplete.");
  }
  if (!settings.from || settings.to.length === 0) {
    throw new Error("Email sender or recipient is missing.");
  }
}
function canSendEmail() {
  const settings = getEmailSettings();
  if (!settings.enabled) return false;
  if (!settings.smtp.host || !settings.smtp.user || !settings.smtp.pass) return false;
  if (!settings.from || settings.to.length === 0) return false;
  return true;
}
async function sendEmail({
  subject,
  text,
  attachments
}) {
  const settings = getEmailSettings();
  ensureEmailEnabled(settings);
  const transporter = nodemailer__namespace.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: settings.smtp.secure,
    auth: {
      user: settings.smtp.user,
      pass: settings.smtp.pass
    }
  });
  await transporter.sendMail({
    from: settings.from,
    to: settings.to.join(", "),
    subject,
    text,
    attachments
  });
}
function extractThreadIdFromSubject(subject) {
  const normalized = normalizeSubject(subject);
  const tag = getTaskTag();
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escapedTag}\\s*\\[([^\\]]+)\\]`, "i");
  const match = normalized.match(regex);
  return match ? match[1] : null;
}
function isStartWorkSubject(subject) {
  const normalized = normalizeSubject(subject);
  const tag = getTaskTag();
  if (!normalized.toLowerCase().includes(tag.toLowerCase())) {
    return false;
  }
  if (extractThreadIdFromSubject(normalized)) {
    return false;
  }
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedTag}\\s*startwork\\b`, "i");
  return regex.test(normalized);
}
async function fetchUnreadEmailTasks(threadId) {
  const settings = getEmailSettings();
  ensureEmailEnabled(settings);
  const client = new imapflow.ImapFlow({
    host: settings.imap.host,
    port: settings.imap.port,
    secure: settings.imap.secure,
    auth: {
      user: settings.imap.user,
      pass: settings.imap.pass
    },
    socketTimeout: 3e4,
    // 30 seconds timeout instead of default 5 minutes
    logger: false
  });
  const tasks = [];
  const matchedUids = [];
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    const tag = getTaskTag();
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const uids = await client.search({
      seen: false,
      since: today
    });
    if (!uids || uids.length === 0) {
      return tasks;
    }
    const recentUids = uids.slice(-5);
    for await (const message of client.fetch(recentUids, {
      source: true,
      envelope: true
    })) {
      if (!message.source) continue;
      const parsed = await mailparser.simpleParser(message.source);
      const subject = parsed.subject ?? "";
      if (!subject.toLowerCase().includes(tag.toLowerCase())) {
        continue;
      }
      if (isSelfSender(parsed, settings)) {
        continue;
      }
      if (threadId) ;
      const from = parsed.from?.text ?? "";
      const text = parsed.text ?? "";
      const extractedThreadId = extractThreadIdFromSubject(subject);
      tasks.push({
        id: String(message.uid),
        subject,
        from,
        text,
        threadId: extractedThreadId
      });
      if (message.uid) {
        matchedUids.push(message.uid);
      }
    }
    for (const uid of matchedUids) {
      try {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      } catch (markError) {
        console.warn("[EmailService] Failed to mark email as read:", markError);
      }
    }
  } finally {
    try {
      await client.logout();
    } catch {
    }
  }
  return tasks;
}
async function markEmailTaskRead(taskId) {
  const settings = getEmailSettings();
  ensureEmailEnabled(settings);
  const uid = Number.parseInt(taskId, 10);
  if (!Number.isFinite(uid)) {
    throw new Error(`Invalid email task id: ${taskId}`);
  }
  const client = new imapflow.ImapFlow({
    host: settings.imap.host,
    port: settings.imap.port,
    secure: settings.imap.secure,
    auth: {
      user: settings.imap.user,
      pass: settings.imap.pass
    },
    socketTimeout: 3e4,
    // 30 seconds timeout instead of default 5 minutes
    logger: false
  });
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
  } finally {
    try {
      await client.logout();
    } catch {
    }
  }
}
const sendEmailDefinition = {
  name: "send_email",
  label: "Send Email",
  description: "Send an email using Email settings",
  requiresKey: false
};
const attachmentSchema = object({
  path: string().describe("Absolute path to attachment file"),
  filename: string().optional().describe("Optional filename override"),
  contentType: string().optional().describe("Optional MIME type")
});
const payloadSchema = object({
  threadId: string().optional(),
  suffix: string().optional(),
  subject: string().optional(),
  text: string().min(1),
  attachments: array(attachmentSchema).optional()
}).refine((data) => !!data.subject || !!data.threadId && !!data.suffix, {
  message: "Provide subject or threadId and suffix."
});
const sendEmailTool = tools.tool(
  async ({ threadId, suffix, subject, text, attachments }) => {
    const trimmedSubject = subject?.trim();
    const trimmedThreadId = threadId?.trim();
    const trimmedSuffix = suffix?.trim();
    const resolvedSubject = trimmedSubject || buildEmailSubject(trimmedThreadId || "", trimmedSuffix || "").trim();
    if (!resolvedSubject || !trimmedSubject && (!trimmedThreadId || !trimmedSuffix)) {
      throw new Error("Email subject is required.");
    }
    if (attachments?.length) {
      for (const attachment of attachments) {
        if (!attachment.path || !fs$1.existsSync(attachment.path)) {
          throw new Error(`Attachment not found: ${attachment.path}`);
        }
      }
    }
    await sendEmail({
      subject: resolvedSubject,
      text,
      attachments
    });
    return { ok: true, subject: resolvedSubject };
  },
  {
    name: sendEmailDefinition.name,
    description: sendEmailDefinition.description,
    schema: payloadSchema
  }
);
const toolRegistry = [
  { definition: createSkillFromConversationDefinition, instance: createSkillFromConversationTool },
  { definition: internetSearchDefinition, instance: internetSearchTool },
  { definition: addCalendarEventDefinition, instance: addCalendarEventTool },
  { definition: addCountdownTimerDefinition, instance: addCountdownTimerTool },
  { definition: sendEmailDefinition, instance: sendEmailTool }
];
const toolDefinitions = toolRegistry.map((entry) => entry.definition);
toolRegistry.map((entry) => entry.instance);
const toolInstanceMap = new Map(
  toolRegistry.map((entry) => [entry.definition.name, entry.instance])
);
function parseJson(value) {
  if (typeof value !== "string" || !value) return void 0;
  try {
    return JSON.parse(value);
  } catch {
    return void 0;
  }
}
function listMcpConfigs() {
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM mcp_servers");
  const servers = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    servers.push({
      id: String(row.id),
      name: String(row.name),
      mode: row.mode,
      command: row.command ?? void 0,
      args: parseJson(row.args),
      env: parseJson(row.env),
      cwd: row.cwd ?? void 0,
      url: row.url ?? void 0,
      headers: parseJson(row.headers),
      autoStart: row.auto_start === null || row.auto_start === void 0 ? void 0 : Boolean(row.auto_start),
      enabledClassic: row.enabled_classic === null || row.enabled_classic === void 0 ? row.enabled === null || row.enabled === void 0 ? void 0 : Boolean(row.enabled) : Boolean(row.enabled_classic),
      enabledButler: row.enabled_butler === null || row.enabled_butler === void 0 ? row.enabled === null || row.enabled === void 0 ? void 0 : Boolean(row.enabled) : Boolean(row.enabled_butler),
      enabled: row.enabled === null || row.enabled === void 0 ? void 0 : Boolean(row.enabled)
    });
  }
  stmt.free();
  return servers;
}
function saveMcpConfigs(servers) {
  const database = getDb();
  database.run("DELETE FROM mcp_servers");
  for (const server of servers) {
    database.run(
      `INSERT OR REPLACE INTO mcp_servers
       (id, name, mode, command, args, env, cwd, url, headers, auto_start, enabled_classic, enabled_butler, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        server.id,
        server.name,
        server.mode,
        server.command ?? null,
        server.args ? JSON.stringify(server.args) : null,
        server.env ? JSON.stringify(server.env) : null,
        server.cwd ?? null,
        server.url ?? null,
        server.headers ? JSON.stringify(server.headers) : null,
        server.autoStart === void 0 ? null : server.autoStart ? 1 : 0,
        server.enabledClassic === void 0 ? server.enabled === void 0 ? null : server.enabled ? 1 : 0 : server.enabledClassic ? 1 : 0,
        server.enabledButler === void 0 ? server.enabled === void 0 ? null : server.enabled ? 1 : 0 : server.enabledButler ? 1 : 0,
        server.enabled === void 0 ? null : server.enabled ? 1 : 0
      ]
    );
  }
  markDbDirty();
}
const runningServers = /* @__PURE__ */ new Map();
const lastErrors = /* @__PURE__ */ new Map();
const clientInfo = {
  name: "openwork",
  version: "0.1.0"
};
function isServerEnabledForScope(config2, scope) {
  if (scope === "butler") {
    return config2.enabledButler ?? config2.enabled ?? true;
  }
  return config2.enabledClassic ?? config2.enabled ?? true;
}
function getConfigById(id) {
  return listMcpConfigs().find((item) => item.id === id);
}
function mergeEnabledFields(current, updates) {
  const next = {
    ...current,
    ...updates
  };
  if (updates.enabled !== void 0) {
    next.enabledClassic = updates.enabled;
    next.enabledButler = updates.enabled;
    next.enabled = updates.enabled;
    return next;
  }
  const classic = updates.enabledClassic ?? current.enabledClassic ?? current.enabled ?? true;
  const butler = updates.enabledButler ?? current.enabledButler ?? current.enabled ?? true;
  next.enabledClassic = classic;
  next.enabledButler = butler;
  next.enabled = classic;
  return next;
}
function updateConfig(id, updates) {
  const servers = listMcpConfigs();
  const index2 = servers.findIndex((item) => item.id === id);
  if (index2 < 0) {
    throw new Error("MCP server not found.");
  }
  const next = mergeEnabledFields(servers[index2], updates);
  servers[index2] = next;
  saveMcpConfigs(servers);
  return next;
}
function parseToolDefinitions(raw) {
  const tools2 = raw?.tools;
  if (!Array.isArray(tools2)) {
    return [];
  }
  return tools2.filter((item) => item && typeof item.name === "string");
}
function jsonSchemaToZod(inputSchema) {
  if (!inputSchema?.properties || Object.keys(inputSchema.properties).length === 0) {
    return object({});
  }
  const shape = {};
  const required2 = new Set(inputSchema.required ?? []);
  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    const propObj = prop;
    let zodType;
    switch (propObj.type) {
      case "string":
        zodType = string();
        break;
      case "number":
      case "integer":
        zodType = number();
        break;
      case "boolean":
        zodType = boolean();
        break;
      case "array":
        zodType = array(any());
        break;
      case "object":
        zodType = record(string(), any());
        break;
      default:
        zodType = any();
    }
    if (propObj.description) {
      zodType = zodType.describe(propObj.description);
    }
    shape[key] = required2.has(key) ? zodType : zodType.optional();
  }
  return object(shape);
}
function buildToolInstances(serverId, tools$1) {
  return tools$1.map((toolDef) => {
    const toolName = `mcp.${serverId}.${toolDef.name}`;
    const description = toolDef.description || `Call MCP tool "${toolDef.name}" from server ${serverId}.`;
    const schema = jsonSchemaToZod(toolDef.inputSchema);
    return tools.tool(
      async (args) => {
        const start = Date.now();
        logEntry("MCP", "toolCall", {
          tool: toolName,
          serverId,
          ...summarizeArgs(args)
        });
        const running = runningServers.get(serverId);
        if (!running) {
          logExit("MCP", "toolCall", { tool: toolName, serverId, ok: false }, Date.now() - start);
          throw new Error(`MCP server ${serverId} is not running.`);
        }
        try {
          const result = await running.client.callTool({
            name: toolDef.name,
            arguments: args ?? {}
          });
          logExit("MCP", "toolCall", { tool: toolName, serverId, ok: true }, Date.now() - start);
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";
          logExit(
            "MCP",
            "toolCall",
            { tool: toolName, serverId, ok: false, error: message },
            Date.now() - start
          );
          throw error;
        }
      },
      {
        name: toolName,
        description,
        schema
      }
    );
  });
}
function toMcpToolInfo(server, toolDef) {
  const fullName = `mcp.${server.id}.${toolDef.name}`;
  return {
    serverId: server.id,
    serverName: server.name,
    toolName: toolDef.name,
    fullName,
    description: toolDef.description
  };
}
function listMcpServers() {
  logEntry("MCP", "listServers");
  const servers = listMcpConfigs();
  const result = servers.map((config2) => {
    const running = runningServers.get(config2.id);
    const status = {
      running: !!running,
      toolsCount: running?.tools?.length ?? 0,
      lastError: lastErrors.get(config2.id) ?? null
    };
    return { config: config2, status };
  });
  logExit("MCP", "listServers", { count: result.length });
  return result;
}
function createMcpServer(input) {
  logEntry("MCP", "createServer", { name: input.name, mode: input.mode });
  if (!input.name?.trim()) {
    throw new Error("MCP server name is required.");
  }
  if (input.mode === "local" && !input.command?.trim()) {
    throw new Error("Command is required for local MCP servers.");
  }
  if (input.mode === "remote" && !input.url?.trim()) {
    throw new Error("URL is required for remote MCP servers.");
  }
  const servers = listMcpConfigs();
  const enabledClassic = input.enabledClassic ?? input.enabled ?? true;
  const enabledButler = input.enabledButler ?? input.enabled ?? true;
  const created = {
    ...input,
    id: node_crypto.randomUUID(),
    name: input.name.trim(),
    command: input.command?.trim(),
    url: input.url?.trim(),
    autoStart: input.autoStart ?? false,
    enabledClassic,
    enabledButler,
    enabled: input.enabled ?? enabledClassic
  };
  saveMcpConfigs([...servers, created]);
  logExit("MCP", "createServer", { id: created.id, name: created.name });
  return created;
}
async function updateMcpServer({
  id,
  updates
}) {
  logEntry("MCP", "updateServer", { id, updates: Object.keys(updates || {}) });
  const next = updateConfig(id, updates);
  const running = runningServers.has(id);
  if (running && updates.autoStart === false) {
    await stopMcpServer(id);
    logExit("MCP", "updateServer", { id, running: false });
    return next;
  }
  const requiresRestart = running && (updates.mode !== void 0 || updates.command !== void 0 || updates.args !== void 0 || updates.env !== void 0 || updates.cwd !== void 0 || updates.url !== void 0 || updates.headers !== void 0);
  if (requiresRestart) {
    await stopMcpServer(id);
    await startMcpServer(id);
  } else if (!running && updates.autoStart) {
    await startMcpServer(id);
  }
  logExit("MCP", "updateServer", { id, running: runningServers.has(id) });
  return next;
}
async function deleteMcpServer(id) {
  logEntry("MCP", "deleteServer", { id });
  await stopMcpServer(id);
  const servers = listMcpConfigs().filter((item) => item.id !== id);
  saveMcpConfigs(servers);
  lastErrors.delete(id);
  logExit("MCP", "deleteServer", { id });
}
async function startMcpServer(id) {
  return withSpan("MCP", "startServer", { id }, async () => {
    const existing = runningServers.get(id);
    if (existing) {
      return { running: true, toolsCount: existing.tools.length, lastError: null };
    }
    const config2 = getConfigById(id);
    if (!config2) {
      throw new Error("MCP server not found.");
    }
    try {
      const client = new index_js.Client(clientInfo, { capabilities: {} });
      let transport;
      if (config2.mode === "local") {
        const env = {};
        for (const [key, value] of Object.entries(process.env)) {
          if (typeof value === "string") env[key] = value;
        }
        if (config2.env) {
          for (const [key, value] of Object.entries(config2.env)) {
            if (typeof value === "string") env[key] = value;
          }
        }
        transport = new stdio_js.StdioClientTransport({
          command: config2.command || "",
          args: config2.args || [],
          env,
          cwd: config2.cwd
        });
      } else {
        const url = new URL(config2.url || "");
        transport = new sse_js.SSEClientTransport(
          url,
          config2.headers ? { headers: config2.headers } : void 0
        );
      }
      await client.connect(transport);
      const toolList = await client.listTools();
      const tools2 = parseToolDefinitions(toolList);
      const toolInstances = buildToolInstances(config2.id, tools2);
      runningServers.set(config2.id, {
        config: config2,
        client,
        transport,
        tools: tools2,
        toolInstances
      });
      lastErrors.set(config2.id, null);
      updateConfig(config2.id, { autoStart: true });
      logEntry("MCP", "startServer.tools", {
        id,
        ...summarizeList(tools2.map((toolDef) => toolDef.name))
      });
      return { running: true, toolsCount: tools2.length, lastError: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start MCP server.";
      lastErrors.set(id, message);
      throw new Error(message);
    }
  });
}
async function stopMcpServer(id) {
  logEntry("MCP", "stopServer", { id });
  const running = runningServers.get(id);
  if (running) {
    try {
      await running.client.close();
    } catch {
    }
    const maybeTransport = running.transport;
    if (maybeTransport?.close) {
      try {
        await maybeTransport.close();
      } catch {
      }
    }
    runningServers.delete(id);
  }
  updateConfig(id, { autoStart: false });
  lastErrors.set(id, null);
  logExit("MCP", "stopServer", { id, running: false });
  return { running: false, toolsCount: 0, lastError: null };
}
async function startAutoMcpServers() {
  logEntry("MCP", "startAuto");
  const servers = listMcpConfigs().filter(
    (item) => item.autoStart && ((item.enabledClassic ?? item.enabled ?? true) || (item.enabledButler ?? item.enabled ?? true))
  );
  for (const server of servers) {
    try {
      await startMcpServer(server.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start MCP server.";
      lastErrors.set(server.id, message);
    }
  }
  logExit("MCP", "startAuto", { count: servers.length });
}
async function getRunningMcpToolInstances(scope = "classic") {
  const instances = Array.from(runningServers.values()).filter((server) => isServerEnabledForScope(server.config, scope)).flatMap((server) => server.toolInstances);
  logExit("MCP", "getRunningToolInstances", { count: instances.length, scope });
  return instances;
}
function listRunningMcpTools(scope = "classic") {
  const result = Array.from(runningServers.values()).filter((server) => isServerEnabledForScope(server.config, scope)).flatMap((server) => server.tools.map((toolDef) => toMcpToolInfo(server.config, toolDef)));
  logExit("MCP", "listRunningTools", { count: result.length, scope });
  return result;
}
function getRunningMcpToolInstanceMap(scope = "classic") {
  const entries = Array.from(runningServers.values()).filter((server) => isServerEnabledForScope(server.config, scope)).flatMap(
    (server) => server.tools.map((toolDef, index2) => {
      const fullName = `mcp.${server.config.id}.${toolDef.name}`;
      const instance = server.toolInstances[index2];
      return [fullName, instance];
    })
  );
  logExit("MCP", "getRunningToolInstanceMap", { count: entries.length, scope });
  return new Map(entries);
}
function toToolInfo(definition) {
  const hasKey = definition.name === "send_email" ? canSendEmail() : definition.requiresKey === false ? true : !!resolveToolKey(definition.name, definition.envVar);
  const enabledClassic = isToolEnabled(definition.name, "classic");
  const enabledButler = isToolEnabled(definition.name, "butler");
  const enabled = enabledClassic;
  return {
    ...definition,
    hasKey,
    enabledClassic,
    enabledButler,
    enabled
  };
}
function listTools() {
  logEntry("Tools", "listTools", { definitions: toolDefinitions.length });
  const result = toolDefinitions.map((definition) => toToolInfo(definition));
  logExit("Tools", "listTools", summarizeList(result.map((t) => t.name)));
  return result;
}
function getEnabledToolInstances(scope = "classic") {
  const enabled = toolDefinitions.filter((definition) => isToolEnabled(definition.name, scope)).map((definition) => toolInstanceMap.get(definition.name)).filter((instance) => !!instance);
  logExit("Tools", "getEnabledToolInstances", { count: enabled.length, scope });
  return enabled;
}
function getEnabledToolNames(scope = "classic") {
  const names = toolDefinitions.filter((definition) => isToolEnabled(definition.name, scope)).map((definition) => definition.name);
  logExit("Tools", "getEnabledToolNames", { ...summarizeList(names), scope });
  return names;
}
function resolveToolInstancesByName(names, scope = "classic") {
  if (!names) {
    logExit("Tools", "resolveToolInstancesByName", { requested: 0, resolved: 0 });
    return void 0;
  }
  if (names.length === 0) {
    logExit("Tools", "resolveToolInstancesByName", { requested: 0, resolved: 0 });
    return [];
  }
  const mcpToolMap = getRunningMcpToolInstanceMap(scope);
  const instances = names.map((name) => name.startsWith("mcp.") ? mcpToolMap.get(name) : toolInstanceMap.get(name)).filter((instance) => !!instance);
  logExit("Tools", "resolveToolInstancesByName", {
    requested: names.length,
    resolved: instances.length
  });
  return instances.length > 0 ? instances : void 0;
}
function updateToolKey(toolName, key) {
  const definition = toolDefinitions.find((tool) => tool.name === toolName);
  if (!definition) {
    throw new Error("Tool not found.");
  }
  logEntry("Tools", "updateToolKey", { toolName, hasKey: !!key });
  setStoredToolKey(toolName, key);
  const result = toToolInfo(definition);
  logExit("Tools", "updateToolKey", { toolName, hasKey: result.hasKey });
  return result;
}
function updateToolEnabled(toolName, enabled) {
  const definition = toolDefinitions.find((tool) => tool.name === toolName);
  if (!definition) {
    throw new Error("Tool not found.");
  }
  logEntry("Tools", "updateToolEnabled", { toolName, enabled });
  setToolEnabled(toolName, enabled);
  const result = toToolInfo(definition);
  logExit("Tools", "updateToolEnabled", { toolName, enabled: result.enabled });
  return result;
}
function updateToolEnabledByScope(toolName, enabled, scope) {
  const definition = toolDefinitions.find((tool) => tool.name === toolName);
  if (!definition) {
    throw new Error("Tool not found.");
  }
  logEntry("Tools", "updateToolEnabledByScope", { toolName, enabled, scope });
  setToolEnabled(toolName, enabled, scope);
  const result = toToolInfo(definition);
  logExit("Tools", "updateToolEnabledByScope", {
    toolName,
    scope,
    enabledClassic: result.enabledClassic,
    enabledButler: result.enabledButler
  });
  return result;
}
const middlewareRegistry = [
  {
    definition: {
      id: "patch_tool_calls",
      label: "Patch Tool Calls",
      description: "Ensure tool calls are paired with tool results."
    },
    factory: () => deepagents.createPatchToolCallsMiddleware()
  }
];
const middlewareDefinitions = middlewareRegistry.map(
  (entry) => entry.definition
);
const middlewareFactoryMap = new Map(
  middlewareRegistry.map((entry) => [entry.definition.id, entry.factory])
);
function resolveMiddlewareById(ids) {
  if (!ids) return void 0;
  if (ids.length === 0) return [];
  return ids.map((id) => middlewareFactoryMap.get(id)).filter((factory) => !!factory).map((factory) => factory());
}
function normalizeContainerPath$1(input) {
  if (!input) return "/";
  const normalized = input.replace(/\\/g, "/");
  const withLeading = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return path__namespace.posix.normalize(withLeading);
}
function resolveDockerMount(mounts, containerPath) {
  const normalizedPath = normalizeContainerPath$1(containerPath);
  const sortedMounts = [...mounts].sort(
    (a, b) => normalizeContainerPath$1(b.containerPath).length - normalizeContainerPath$1(a.containerPath).length
  );
  for (const mount of sortedMounts) {
    const mountPath = normalizeContainerPath$1(mount.containerPath);
    if (normalizedPath === mountPath || normalizedPath.startsWith(`${mountPath}/`)) {
      const relativePath = normalizedPath.slice(mountPath.length).replace(/^\/+/, "");
      return { mount, relativePath };
    }
  }
  return null;
}
async function runDockerCommand$1(args, timeoutMs = 12e4) {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = node_child_process.spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      proc.kill("SIGTERM");
      resolve({
        stdout: "",
        stderr: "Error: Docker command timed out.",
        exitCode: null,
        durationMs: Date.now() - start
      });
    }, timeoutMs);
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        durationMs: Date.now() - start
      });
    });
    proc.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({
        stdout: "",
        stderr: `Error: ${err.message}`,
        exitCode: 1,
        durationMs: Date.now() - start
      });
    });
  });
}
function createDockerTools(config2, containerId2) {
  const executeBash = tools.tool(
    async ({
      command,
      cwd,
      env,
      timeoutMs
    }) => {
      if (!command) {
        return { stdout: "", stderr: "Error: command is required.", exitCode: 1, durationMs: 0 };
      }
      if (!containerId2) {
        return {
          stdout: "",
          stderr: "Error: Docker container is not running.",
          exitCode: 1,
          durationMs: 0
        };
      }
      const execArgs = ["exec"];
      execArgs.push("-w", cwd ? normalizeContainerPath$1(cwd) : "/workspace");
      if (env) {
        Object.entries(env).forEach(([key, value]) => {
          execArgs.push("-e", `${key}=${value}`);
        });
      }
      execArgs.push(containerId2, "sh", "-c", command);
      return runDockerCommand$1(execArgs, timeoutMs);
    },
    {
      name: "execute_bash",
      description: "Execute a shell command inside the Docker container",
      schema: object({
        command: string().describe("Shell command to execute"),
        cwd: string().optional().describe("Working directory inside the container"),
        env: record(string(), string()).optional().describe("Environment variables"),
        timeoutMs: number().optional().describe("Timeout in milliseconds")
      })
    }
  );
  const uploadFile = tools.tool(
    async ({
      path: containerPath,
      content,
      encoding = "utf-8"
    }) => {
      const match = resolveDockerMount(config2.mounts || [], containerPath);
      if (!match) {
        throw new Error("Access denied: path outside docker mounts.");
      }
      const fullPath = path__namespace.join(match.mount.hostPath, match.relativePath);
      await fs__namespace.mkdir(path__namespace.dirname(fullPath), { recursive: true });
      const data = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf-8");
      await fs__namespace.writeFile(fullPath, data);
      return { path: containerPath, bytes_written: data.length };
    },
    {
      name: "upload_file",
      description: "Upload a file into the Docker mount",
      schema: object({
        path: string().describe("Container path to write"),
        content: string().describe("File content"),
        encoding: _enum(["utf-8", "base64"]).optional()
      })
    }
  );
  const downloadFile = tools.tool(
    async ({
      path: containerPath,
      encoding = "utf-8",
      limitBytes
    }) => {
      const match = resolveDockerMount(config2.mounts || [], containerPath);
      if (!match) {
        throw new Error("Access denied: path outside docker mounts.");
      }
      const fullPath = path__namespace.join(match.mount.hostPath, match.relativePath);
      const data = await fs__namespace.readFile(fullPath);
      const sliced = limitBytes ? data.slice(0, limitBytes) : data;
      return encoding === "base64" ? sliced.toString("base64") : sliced.toString("utf-8");
    },
    {
      name: "download_file",
      description: "Download a file from the Docker mount",
      schema: object({
        path: string().describe("Container path to read"),
        encoding: _enum(["utf-8", "base64"]).optional(),
        limitBytes: number().optional().describe("Limit bytes to read")
      })
    }
  );
  const catFile = tools.tool(
    async ({ path: containerPath, limitBytes }) => {
      const match = resolveDockerMount(config2.mounts || [], containerPath);
      if (!match) {
        throw new Error("Access denied: path outside docker mounts.");
      }
      const fullPath = path__namespace.join(match.mount.hostPath, match.relativePath);
      const data = await fs__namespace.readFile(fullPath);
      const sliced = limitBytes ? data.slice(0, limitBytes) : data;
      return sliced.toString("utf-8");
    },
    {
      name: "cat_file",
      description: "Read a file from the Docker mount",
      schema: object({
        path: string().describe("Container path to read"),
        limitBytes: number().optional().describe("Limit bytes to read")
      })
    }
  );
  const editFile = tools.tool(
    async ({
      path: containerPath,
      old_str,
      new_str
    }) => {
      const match = resolveDockerMount(config2.mounts || [], containerPath);
      if (!match) {
        throw new Error("Access denied: path outside docker mounts.");
      }
      const fullPath = path__namespace.join(match.mount.hostPath, match.relativePath);
      const original = await fs__namespace.readFile(fullPath, "utf-8");
      const occurrences = original.split(old_str).length - 1;
      if (occurrences !== 1) {
        throw new Error(`Expected one occurrence, found ${occurrences}.`);
      }
      const updated = original.replace(old_str, new_str);
      await fs__namespace.writeFile(fullPath, updated, "utf-8");
      return "File updated.";
    },
    {
      name: "edit_file",
      description: "Edit a file inside the Docker mount by replacing a string",
      schema: object({
        path: string().describe("Container path to edit"),
        old_str: string().describe("Exact text to replace"),
        new_str: string().describe("Replacement text")
      })
    }
  );
  return [executeBash, uploadFile, downloadFile, catFile, editFile];
}
function getBaseSystemPrompt(options = {}) {
  const { isWindows = false } = options;
  const platformNotice = isWindows ? `
**IMPORTANT: You are currently running on Windows platform.**
- Shell commands run in cmd.exe (not PowerShell)
- Use Windows-style commands (dir instead of ls, type instead of cat, etc.)
- Use semicolon (;) or & to chain commands, not &&
- Be careful with path separators (use \\ or / in paths)
- **NEVER use backslash to escape quotes (e.g., WRONG: backslash-quote). Just use plain quotes: "path"**
- If a path contains spaces, wrap it in double quotes directly: cd "D:\\My Folder"
- Unmatched or improperly escaped quotes will cause the command to hang waiting for input
` : "";
  return `You are an AI assistant that helps users with various tasks including coding, research, and analysis.
${platformNotice}

# Core Behavior

Be concise and direct. Answer in fewer than 4 lines unless the user asks for detail.
After working on a file, just stop - don't explain what you did unless asked.
Avoid unnecessary introductions or conclusions.

When you run non-trivial bash commands, briefly explain what they do.

## Proactiveness
Take action when asked, but don't surprise users with unrequested actions.
If asked how to approach something, answer first before taking action.

## Following Conventions
- Check existing code for libraries and frameworks before assuming availability
- Mimic existing code style, naming conventions, and patterns
- Never add comments unless asked

## Task Management
Use write_todos for complex multi-step tasks (3+ steps). Mark tasks in_progress before starting, completed immediately after finishing.
For simple 1-2 step tasks, just do them directly without todos.

## File Reading Best Practices

When exploring codebases or reading multiple files, use pagination to prevent context overflow.

**Pattern for codebase exploration:**
1. First scan: \`read_file(path, limit=100)\` - See file structure and key sections
2. Targeted read: \`read_file(path, offset=100, limit=200)\` - Read specific sections if needed
3. Full read: Only use \`read_file(path)\` without limit when necessary for editing

**When to paginate:**
- Reading any file >500 lines
- Exploring unfamiliar codebases (always start with limit=100)
- Reading multiple files in sequence

**When full read is OK:**
- Small files (<500 lines)
- Files you need to edit immediately after reading

## Working with Subagents (task tool)
When delegating to subagents:
- **Use filesystem for large I/O**: If input/output is large (>500 words), communicate via files
- **Parallelize independent work**: Spawn parallel subagents for independent tasks
- **Clear specifications**: Tell subagent exactly what format/structure you need
- **Main agent synthesizes**: Subagents gather/execute, main agent integrates results

## Tools

### File Tools
- read_file: Read file contents
- edit_file: Replace exact strings in files (must read first, provide unique old_string)
- write_file: Create or overwrite files
- ls: List directory contents
- glob: Find files by pattern (e.g., "**/*.py")
- grep: Search file contents

All file paths should use fully qualified absolute system paths (e.g., /Users/name/project/src/file.ts).

### Shell Tool
- execute: Run shell commands in the workspace directory

The execute tool runs commands directly on the user's machine. Use it for:
- Running scripts, tests, and builds (npm test, python script.py, make)
- Git operations (git status, git diff, git commit)
- Installing dependencies (npm install, pip install)
- System commands (which, env, pwd)

**Important:**
- All execute commands require user approval before running
- Commands run in the workspace root directory
- Avoid using shell for file reading (use read_file instead)
- Avoid using shell for file searching (use grep/glob instead)
- When running non-trivial commands, briefly explain what they do
- Commands have a timeout limit; long-running commands will be terminated automatically

**Platform-Specific Notes:**
- On Windows, commands run in cmd.exe; on Unix/macOS, commands run in /bin/sh
- Windows/PowerShell specific:
  - Use semicolon (;) instead of && to chain commands in PowerShell
  - Avoid escaping quotes with backslash (backslash-quote is incorrect in PowerShell)
  - Use double quotes properly: "path with spaces" not backslash-escaped quotes
  - Unmatched quotes cause the shell to wait for more input (>> prompt), which will timeout
- Always ensure quotes are properly paired to avoid interactive prompts
- Never use commands that require interactive input (stdin) - they will timeout

## Code References
When referencing code, use format: \`file_path:line_number\`

## Documentation
- Do NOT create excessive markdown summary/documentation files after completing work
- Focus on the work itself, not documenting what you did
- Only create documentation when explicitly requested

## Human-in-the-Loop Tool Approval

Some tool calls require user approval before execution. When a tool call is rejected by the user:
1. Accept their decision immediately - do NOT retry the same command
2. Explain that you understand they rejected the action
3. Suggest an alternative approach or ask for clarification
4. Never attempt the exact same rejected command again

Respect the user's decisions and work with them collaboratively.

## Todo List Management

When using the write_todos tool:
1. Keep the todo list MINIMAL - aim for 3-6 items maximum
2. Only create todos for complex, multi-step tasks that truly need tracking
3. Break down work into clear, actionable items without over-fragmenting
4. For simple tasks (1-2 steps), just do them directly without creating todos
5. When first creating a todo list for a task, ALWAYS ask the user if the plan looks good before starting work
   - Create the todos, let them render, then ask: "Does this plan look good?" or similar
   - Wait for the user's response before marking the first todo as in_progress
   - If they want changes, adjust the plan accordingly
6. Update todo status promptly as you complete each item

The todo list is a planning tool - use it judiciously to avoid overwhelming the user with excessive task tracking.
`;
}
getBaseSystemPrompt();
function buildBasePrompt(context2) {
  return getBaseSystemPrompt({ isWindows: context2.isWindows });
}
function buildDefaultModePrompt(_context) {
  return "";
}
function buildEmailModePromptForThread(threadId) {
  return [
    "Email conversation mode:",
    `- After completing the task, ALWAYS call the send_email tool with threadId="${threadId}".`,
    '- Set suffix to something like "Completed - <short summary of the task>".',
    "- Put the full completion content in the email body (not a placeholder).",
    "- If the user asked for files or artifacts, attach them using send_email.attachments.",
    "- Keep the chat response brief since the email is the primary delivery channel."
  ].join("\n");
}
function buildEmailModePrompt(context2) {
  return buildEmailModePromptForThread(context2.threadId);
}
function buildLoopModePrompt(_context) {
  return [
    "Loop mode context:",
    "- This request may be automatically triggered by schedule, API, or file events.",
    "- Treat any trigger marker/data in the user message as execution context, then complete the requested work."
  ].join("\n");
}
function buildRalphModePrompt(_context) {
  return [
    "Ralph mode context:",
    "- This conversation may be part of an iterative execution workflow.",
    "- Follow the current user request and keep workflow state stable unless explicitly asked to reset."
  ].join("\n");
}
function buildWorkspacePrompt(workspacePath) {
  return `### File System and Paths

**IMPORTANT - Path Handling:**
- All file paths use fully qualified absolute system paths
- The workspace root is: \`${workspacePath}\`
- Example: \`${workspacePath}/src/index.ts\`, \`${workspacePath}/README.md\`
- To list the workspace root, use \`ls("${workspacePath}")\`
- Always use full absolute paths for all file operations`;
}
function buildDockerPrompt() {
  return `### Docker Mode

- Use Docker tools for container operations: execute_bash, upload_file, download_file, edit_file, cat_file
- Container working directory is /workspace
- Local filesystem tools operate on the host, not inside the container`;
}
function buildCurrentTimePrompt(now) {
  return `Current time: ${now.toISOString()}
Current year: ${now.getFullYear()}`;
}
function resolveAgentPromptMode(threadMode) {
  switch (threadMode) {
    case "ralph":
      return "ralph";
    case "loop":
      return "loop";
    case "email":
      return "email";
    default:
      return "default";
  }
}
function buildModePrompt(mode, context2) {
  switch (mode) {
    case "ralph":
      return buildRalphModePrompt();
    case "loop":
      return buildLoopModePrompt();
    case "email":
      return buildEmailModePrompt(context2);
    case "default":
    default:
      return buildDefaultModePrompt();
  }
}
function composeAgentSystemPrompt(input) {
  const mode = resolveAgentPromptMode(input.threadMode);
  const now = input.now ?? /* @__PURE__ */ new Date();
  const sections = [
    buildBasePrompt(input),
    buildWorkspacePrompt(input.workspacePath),
    input.dockerEnabled ? buildDockerPrompt() : "",
    buildModePrompt(mode, input),
    buildCurrentTimePrompt(now),
    input.extraSystemPrompt?.trim() || ""
  ];
  return sections.filter((section) => section.trim().length > 0).join("\n\n");
}
function normalizeDockerWorkspace(config2) {
  const mount = config2.mounts?.[0];
  if (mount?.containerPath) {
    const normalized = mount.containerPath.replace(/\\/g, "/");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
  return "/workspace";
}
function getErrorMessage(error) {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message || error.name;
  }
  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}
function normalizeSkillSourcePath(path2) {
  return path2.replace(/\\/g, "/");
}
function resolveSkillRoot(path2) {
  const resolved = path$1.resolve(path2);
  if (path$1.basename(resolved).toLowerCase() === "skill.md") {
    return path$1.dirname(resolved);
  }
  return resolved;
}
function buildSkillPathMap(skills) {
  const skillPathByName = /* @__PURE__ */ new Map();
  for (const skill of skills) {
    if (!skill?.name || !skill?.path) continue;
    skillPathByName.set(skill.name, resolveSkillRoot(skill.path));
  }
  return skillPathByName;
}
function toOverlaySegment(value) {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  return encodeURIComponent(trimmed);
}
function createSkillOverlaySource(params) {
  const { overlayBackend, sourceRoot, selectedSkillNames, skillPathByName, agentName } = params;
  const uniqueSkillNames = Array.from(new Set(selectedSkillNames ?? []));
  logEntry("Runtime", "skills.overlay.prepare", {
    agentName,
    sourceRoot: normalizeSkillSourcePath(sourceRoot),
    ...summarizeList(uniqueSkillNames)
  });
  if (uniqueSkillNames.length === 0) {
    logExit("Runtime", "skills.overlay.prepare", {
      agentName,
      sourceCount: 0,
      reason: "no_selection"
    });
    return void 0;
  }
  const skillsByName = {};
  for (const skillName of uniqueSkillNames) {
    const sourceDir = skillPathByName.get(skillName);
    if (!sourceDir) {
      logEntry("Runtime", "skills.missing", { agentName, skillName, reason: "not_in_registry" });
      continue;
    }
    if (!fs$1.existsSync(sourceDir)) {
      logEntry("Runtime", "skills.missing", { agentName, skillName, reason: "file_missing" });
      continue;
    }
    skillsByName[skillName] = sourceDir;
  }
  if (Object.keys(skillsByName).length === 0) {
    logExit("Runtime", "skills.overlay.prepare", {
      agentName,
      sourceCount: 0,
      reason: "no_valid_paths"
    });
    return void 0;
  }
  overlayBackend.registerSkillSource(sourceRoot, skillsByName);
  const sources = [normalizeSkillSourcePath(sourceRoot)];
  logExit("Runtime", "skills.overlay.prepare", {
    agentName,
    sourceCount: sources.length,
    sources,
    registeredCount: Object.keys(skillsByName).length,
    registeredSkills: Object.keys(skillsByName).slice(0, 10)
  });
  return sources;
}
function createToolErrorHandlingMiddleware() {
  return createMiddleware({
    name: "toolErrorHandlingMiddleware",
    wrapToolCall: async (request, handler) => {
      try {
        const result = await handler(request);
        return result;
      } catch (error) {
        const toolName = String(request.tool?.name || "unknown");
        const toolCallId = request.toolCall.id || "unknown";
        const errorMessage = getErrorMessage(error);
        return new messages.ToolMessage({
          content: `TOOL_ERROR: The tool "${toolName}" failed with the following error:

ERROR_MESSAGE: ${errorMessage}

INSTRUCTIONS: Please review the error and retry the operation with corrected parameters or try an alternative approach.`,
          tool_call_id: toolCallId,
          name: toolName
        });
      }
    }
  });
}
const checkpointers = /* @__PURE__ */ new Map();
async function getCheckpointer(threadId) {
  let checkpointer = checkpointers.get(threadId);
  if (!checkpointer) {
    const dbPath = getThreadCheckpointPath(threadId);
    checkpointer = new SqlJsSaver(dbPath);
    await checkpointer.initialize();
    checkpointers.set(threadId, checkpointer);
  }
  return checkpointer;
}
async function closeCheckpointer(threadId) {
  const checkpointer = checkpointers.get(threadId);
  if (checkpointer) {
    await checkpointer.close();
    checkpointers.delete(threadId);
  }
}
function hasImageBlocks(content) {
  if (!Array.isArray(content)) return false;
  return content.some((block) => block?.type === "image" || block?.type === "image_url");
}
function requireProviderState$2() {
  const state = getProviderState();
  if (!state) {
    throw new Error(
      "Provider not configured. Please configure Ollama, OpenAI-compatible, or Multimodal provider in Settings."
    );
  }
  return state;
}
function resolveProviderConfig$2(state, providerId) {
  const config2 = state.configs[providerId];
  if (!config2) {
    throw new Error(`Provider "${providerId}" not configured. Please configure it in Settings.`);
  }
  return config2;
}
function getModelInstance$2(providerOverride, modelOverride, messageContent) {
  const state = requireProviderState$2();
  const requestedProvider = providerOverride ?? state.active;
  const config2 = resolveProviderConfig$2(state, requestedProvider);
  const effectiveModel = modelOverride?.trim() || config2.model;
  if (!effectiveModel) {
    throw new Error(`Provider "${requestedProvider}" has no model configured.`);
  }
  console.log("[Runtime] Using provider:", requestedProvider);
  console.log("[Runtime] Configured model:", config2.model);
  if (modelOverride) {
    console.log("[Runtime] Model override:", modelOverride);
  }
  if (hasImageBlocks(messageContent)) {
    console.log("[Runtime] Detected image content in message");
  }
  if (config2.type === "ollama") {
    const baseURL = config2.url.endsWith("/v1") ? config2.url : `${config2.url}/v1`;
    console.log("[Runtime] Ollama baseURL:", baseURL);
    return new openai.ChatOpenAI({
      model: effectiveModel,
      configuration: {
        baseURL
      },
      // Ollama doesn't need an API key, but ChatOpenAI requires one
      // Use a placeholder value
      apiKey: "ollama"
    });
  }
  if (!config2.apiKey) {
    throw new Error(`Provider "${requestedProvider}" is missing an API key.`);
  }
  console.log("[Runtime] OpenAI-compatible baseURL:", config2.url);
  return new openai.ChatOpenAI({
    model: effectiveModel,
    apiKey: config2.apiKey,
    configuration: {
      baseURL: config2.url
    }
  });
}
async function createAgentRuntime(options) {
  const {
    threadId,
    threadMode,
    modelId,
    messageContent,
    workspacePath,
    dockerConfig,
    dockerContainerId,
    disableApprovals,
    extraSystemPrompt,
    forceToolNames,
    capabilityScope = "classic"
  } = options;
  if (!threadId) {
    throw new Error("Thread ID is required for checkpointing.");
  }
  if (!workspacePath) {
    throw new Error(
      "Workspace path is required. Please select a workspace folder before running the agent."
    );
  }
  logEntry("Runtime", "createAgentRuntime", {
    threadId,
    threadMode: threadMode ?? "default",
    hasWorkspace: !!workspacePath,
    dockerEnabled: !!dockerConfig?.enabled
  });
  console.log("[Runtime] Creating agent runtime...");
  console.log("[Runtime] Thread ID:", threadId);
  console.log("[Runtime] Workspace path:", workspacePath);
  if (dockerConfig?.enabled) {
    console.log("[Runtime] Docker mode enabled with image:", dockerConfig.image);
  }
  const requiresMultimodal = hasImageBlocks(messageContent);
  const model = getModelInstance$2(
    requiresMultimodal ? "multimodal" : void 0,
    void 0,
    messageContent
  );
  console.log("[Runtime] Model instance created:", typeof model);
  const checkpointer = await getCheckpointer(threadId);
  console.log("[Runtime] Checkpointer ready for thread:", threadId);
  const baseBackend = new LocalSandbox({
    rootDir: workspacePath || process.cwd(),
    virtualMode: false,
    // Use absolute system paths for consistency with shell commands
    timeout: 12e4,
    // 2 minutes
    maxOutputBytes: 1e5
    // ~100KB
  });
  const overlayBackend = new SkillOverlayBackend(baseBackend);
  const effectiveWorkspace = dockerConfig?.enabled ? normalizeDockerWorkspace(dockerConfig) : workspacePath;
  const isWindows = process.platform === "win32";
  const now = /* @__PURE__ */ new Date();
  const currentTimePrompt = `Current time: ${now.toISOString()}
Current year: ${now.getFullYear()}`;
  const systemPrompt = composeAgentSystemPrompt({
    threadId,
    threadMode,
    workspacePath: effectiveWorkspace,
    isWindows,
    dockerEnabled: !!dockerConfig?.enabled,
    now,
    extraSystemPrompt
  });
  const allSkills = listAppSkills({});
  const enabledSkills = allSkills.filter(
    (skill) => capabilityScope === "butler" ? skill.enabledButler : skill.enabledClassic
  );
  logEntry("Runtime", "skills.registry_snapshot", {
    totalCount: allSkills.length,
    enabledCount: enabledSkills.length,
    enabledSkills: enabledSkills.map((skill) => ({
      name: skill.name,
      path: normalizeSkillSourcePath(skill.path)
    }))
  });
  const skillPathByName = buildSkillPathMap(allSkills);
  const runtimeSkillsRoot = `${SKILL_OVERLAY_PREFIX}/${toOverlaySegment(threadId)}`;
  const mainSkillSources = createSkillOverlaySource({
    overlayBackend,
    sourceRoot: `${runtimeSkillsRoot}/main-agent`,
    selectedSkillNames: enabledSkills.map((skill) => skill.name),
    skillPathByName,
    agentName: "main-agent"
  });
  logEntry("Runtime", "skills.runtime_root", { path: runtimeSkillsRoot });
  logEntry("Runtime", "skills.enabled", summarizeList(enabledSkills.map((skill) => skill.name)));
  logEntry("Runtime", "skills.main_sources", {
    sourceCount: mainSkillSources?.length ?? 0,
    sources: mainSkillSources ?? []
  });
  const subagents = listSubagentsByScope(capabilityScope).map((agent2) => {
    const resolvedTools = resolveToolInstancesByName(agent2.tools, capabilityScope) ?? [];
    logEntry("Runtime", "subagent.tools", {
      name: agent2.name,
      ...summarizeList(agent2.tools ?? [])
    });
    logExit("Runtime", "subagent.tools", {
      name: agent2.name,
      resolvedCount: resolvedTools.length
    });
    const subagentSkillSources = createSkillOverlaySource({
      overlayBackend,
      sourceRoot: `${runtimeSkillsRoot}/${toOverlaySegment(agent2.id)}`,
      selectedSkillNames: agent2.skills,
      skillPathByName,
      agentName: agent2.name
    });
    logEntry("Runtime", "subagent.skills", {
      name: agent2.name,
      ...summarizeList(agent2.skills ?? [])
    });
    logExit("Runtime", "subagent.skills", {
      name: agent2.name,
      sourceCount: subagentSkillSources?.length ?? 0,
      sources: subagentSkillSources ?? []
    });
    const subagentModel = getModelInstance$2(agent2.provider, agent2.model, void 0);
    return {
      name: agent2.name,
      description: agent2.description,
      systemPrompt: `${agent2.systemPrompt}

${currentTimePrompt}`,
      model: subagentModel,
      tools: resolvedTools,
      middleware: resolveMiddlewareById(agent2.middleware),
      skills: subagentSkillSources,
      interruptOn: disableApprovals ? void 0 : agent2.interruptOn ? { execute: true } : void 0
    };
  });
  const filesystemSystemPrompt = `You have access to a filesystem. All file paths use fully qualified absolute system paths.

- ls(path): list files in a directory (e.g., ls("${effectiveWorkspace}"))
- read_file(file_path, offset?, limit?): read a file from the filesystem. IMPORTANT: use "file_path" as parameter name, not "filearg"
- write_file(file_path, content): write to a file in the filesystem
- edit_file(file_path, old_str, new_str): edit a file in the filesystem
- glob(pattern): find files matching a pattern (e.g., "**/*.py")
- grep(pattern, path): search for text within files

The workspace root is: ${effectiveWorkspace}`;
  const dockerTools = dockerConfig?.enabled ? createDockerTools(dockerConfig, dockerContainerId || null) : [];
  const enabledToolNames = getEnabledToolNames(capabilityScope);
  const mcpToolInfos = listRunningMcpTools(capabilityScope);
  const mcpToolNames = mcpToolInfos.map((toolInfo) => toolInfo.fullName);
  const mcpTools = await getRunningMcpToolInstances(capabilityScope);
  const forcedTools = resolveToolInstancesByName(forceToolNames, capabilityScope) ?? [];
  const enabledTools = [...getEnabledToolInstances(capabilityScope), ...mcpTools, ...dockerTools];
  const tools2 = [...enabledTools];
  for (const tool of forcedTools) {
    if (!tools2.includes(tool)) tools2.push(tool);
  }
  logEntry("Runtime", "tools.inject", {
    ...summarizeList(enabledToolNames),
    mcpCount: mcpToolNames.length,
    dockerCount: dockerTools.length,
    scope: capabilityScope
  });
  if (mcpToolNames.length > 0) {
    logEntry("Runtime", "tools.inject.mcp", summarizeList(mcpToolNames));
  }
  const retryMiddleware = toolRetryMiddleware({
    maxRetries: 3,
    onFailure: "continue",
    initialDelayMs: 500,
    backoffFactor: 2
  });
  const toolErrorHandlingMiddleware = createToolErrorHandlingMiddleware();
  const agent = deepagents.createDeepAgent({
    model,
    checkpointer,
    backend: overlayBackend,
    systemPrompt: systemPrompt + "\n\n" + filesystemSystemPrompt,
    tools: tools2,
    // Custom filesystem prompt for absolute paths (requires deepagents update)
    // filesystemSystemPrompt,
    subagents,
    skills: mainSkillSources,
    // Require human approval for all shell commands
    interruptOn: disableApprovals ? void 0 : { execute: true },
    // Add retry + error handling middleware for tool call failures
    middleware: [toolErrorHandlingMiddleware, retryMiddleware]
  });
  console.log("[Runtime] Deep agent created with LocalSandbox at:", workspacePath);
  logExit("Runtime", "createAgentRuntime", { threadId });
  return agent;
}
const DEFAULT_CONFIG = {
  enabled: false,
  image: "python:3.13-alpine",
  mounts: [
    {
      hostPath: "",
      containerPath: "/workspace",
      readOnly: false
    }
  ],
  resources: {},
  ports: []
};
const SESSION_CONTAINER_NAME = "openwork-session";
let sessionEnabled = false;
let containerId = null;
let containerName = null;
let lastError = null;
function sanitizeConfig(config2) {
  return {
    ...DEFAULT_CONFIG,
    ...config2,
    enabled: false,
    mounts: config2.mounts?.length ? config2.mounts : DEFAULT_CONFIG.mounts,
    resources: config2.resources || {},
    ports: config2.ports || []
  };
}
function getDockerConfig() {
  const settings = getSettings();
  if (settings.dockerConfig) {
    return sanitizeConfig(settings.dockerConfig);
  }
  return DEFAULT_CONFIG;
}
function setDockerConfig(config2) {
  const next = sanitizeConfig(config2);
  updateSettings({ dockerConfig: next });
  return next;
}
function getDockerSessionStatus() {
  return {
    enabled: sessionEnabled,
    running: !!containerId,
    containerId: containerId || void 0,
    containerName: containerName || void 0,
    error: lastError || void 0
  };
}
async function runDockerCommand(args, timeoutMs = 12e4) {
  return new Promise((resolve) => {
    const proc = node_child_process.spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      proc.kill("SIGTERM");
      resolve({ stdout: "", stderr: "Docker command timed out.", exitCode: null });
    }, timeoutMs);
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code });
    });
    proc.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ stdout: "", stderr: err.message, exitCode: 1 });
    });
  });
}
function buildDockerRunArgs(config2, name) {
  const args = ["run", "-d", "--name", name];
  const mounts = config2.mounts || [];
  for (const mount of mounts) {
    if (!mount.hostPath || !mount.containerPath) continue;
    const normalized = mount.containerPath.replace(/\\/g, "/");
    const containerPath = normalized.startsWith("/") ? normalized : `/${normalized}`;
    const mountArg = `${mount.hostPath}:${containerPath}${mount.readOnly ? ":ro" : ""}`;
    args.push("-v", mountArg);
  }
  const resources = config2.resources || {};
  if (resources.cpu) {
    args.push("--cpus", String(resources.cpu));
  }
  if (resources.memoryMb) {
    args.push("--memory", `${resources.memoryMb}m`);
  }
  for (const port of config2.ports || []) {
    if (!port.host || !port.container) continue;
    const protocol = port.protocol || "tcp";
    args.push("-p", `${port.host}:${port.container}/${protocol}`);
  }
  return args;
}
async function removeContainer(name) {
  await runDockerCommand(["rm", "-f", name], 3e4);
}
async function startContainer(config2) {
  const name = SESSION_CONTAINER_NAME;
  await removeContainer(name);
  const args = buildDockerRunArgs(config2, name);
  args.push(config2.image, "sh", "-c", "tail -f /dev/null");
  const result = await runDockerCommand(args, 12e4);
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    throw new Error(result.stderr || "Failed to start Docker container.");
  }
  return { id: result.stdout.trim() };
}
async function checkRunning(idOrName) {
  const result = await runDockerCommand(["inspect", "-f", "{{.State.Running}}", idOrName], 1e4);
  return result.exitCode === 0 && result.stdout.trim() === "true";
}
async function enterDockerMode() {
  const config2 = getDockerConfig();
  try {
    const started = await startContainer(config2);
    sessionEnabled = true;
    containerId = started.id;
    containerName = SESSION_CONTAINER_NAME;
    lastError = null;
  } catch (error) {
    sessionEnabled = false;
    containerId = null;
    containerName = null;
    lastError = error instanceof Error ? error.message : "Failed to start Docker container.";
  }
  return getDockerSessionStatus();
}
async function exitDockerMode() {
  if (containerName) {
    await removeContainer(containerName);
  }
  sessionEnabled = false;
  containerId = null;
  containerName = null;
  lastError = null;
  return getDockerSessionStatus();
}
async function restartDockerMode() {
  const wasEnabled = sessionEnabled;
  await exitDockerMode();
  if (wasEnabled) {
    return enterDockerMode();
  }
  return getDockerSessionStatus();
}
async function ensureDockerRunning() {
  if (!sessionEnabled) {
    return getDockerSessionStatus();
  }
  if (containerId && await checkRunning(containerId)) {
    return getDockerSessionStatus();
  }
  return enterDockerMode();
}
function getDockerRuntimeConfig() {
  if (!sessionEnabled) {
    return { config: null, containerId: null };
  }
  const config2 = { ...getDockerConfig(), enabled: true };
  return { config: config2, containerId };
}
const MAX_RALPH_LOG_ENTRIES = 500;
function appendRalphLogEntry(threadId, entry) {
  const logPath = getThreadRalphLogPath(threadId);
  try {
    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf-8");
  } catch (error) {
    console.warn("[RalphLog] Failed to append entry:", error);
    return;
  }
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length <= MAX_RALPH_LOG_ENTRIES) {
      return;
    }
    const trimmed = lines.slice(-MAX_RALPH_LOG_ENTRIES);
    fs.writeFileSync(logPath, trimmed.join("\n") + "\n", "utf-8");
  } catch (error) {
    console.warn("[RalphLog] Failed to trim log:", error);
  }
}
function readRalphLogTail(threadId, limit = 200) {
  const logPath = getThreadRalphLogPath(threadId);
  if (!fs.existsSync(logPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).slice(-limit);
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
      }
    }
    return entries;
  } catch (error) {
    console.warn("[RalphLog] Failed to read log:", error);
    return [];
  }
}
function extractContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (typeof part === "object" && part) {
        const record2 = part;
        if (typeof record2.text === "string") return record2.text;
        if (typeof record2.content === "string") return record2.content;
      }
      return "";
    }).join("");
  }
  return "";
}
function extractAssistantChunkText(data) {
  const tuple = data;
  const msgChunk = tuple?.[0];
  const kwargs = msgChunk?.kwargs || {};
  const classId = Array.isArray(msgChunk?.id) ? msgChunk?.id : [];
  const className = classId[classId.length - 1] || "";
  if (!className.includes("AI")) {
    return null;
  }
  const content = extractContent(kwargs.content);
  return content || null;
}
async function runAgentStream({
  threadId,
  workspacePath,
  modelId,
  dockerConfig,
  dockerContainerId,
  disableApprovals,
  extraSystemPrompt,
  forceToolNames,
  threadMode,
  capabilityScope,
  message,
  window,
  channel,
  abortController,
  ralphLog
}) {
  const agent = await createAgentRuntime({
    threadId,
    workspacePath,
    modelId,
    messageContent: message,
    dockerConfig,
    dockerContainerId,
    disableApprovals,
    extraSystemPrompt,
    forceToolNames,
    threadMode,
    capabilityScope
  });
  const humanMessage = Array.isArray(message) ? new messages.HumanMessage({ content: message }) : new messages.HumanMessage(message);
  const stream2 = await agent.stream(
    { messages: [humanMessage] },
    {
      configurable: { thread_id: threadId },
      signal: abortController.signal,
      streamMode: ["messages", "values"],
      recursionLimit: 1e3
    }
  );
  let lastAssistant = "";
  let lastValuesAiContent = "";
  const runId = node_crypto.randomUUID();
  const seenMessageIds = /* @__PURE__ */ new Set();
  const seenToolCallIds = /* @__PURE__ */ new Set();
  let loggedAnything = false;
  const appendLog = (entry) => {
    if (!ralphLog?.enabled) return;
    const fullEntry = {
      id: node_crypto.randomUUID(),
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      threadId,
      runId,
      iteration: ralphLog.iteration,
      phase: ralphLog.phase,
      ...entry
    };
    try {
      appendRalphLogEntry(threadId, fullEntry);
      loggedAnything = true;
      window.webContents.send(channel, {
        type: "custom",
        data: { type: "ralph_log", entry: fullEntry }
      });
    } catch (error) {
      console.warn("[Agent] Failed to append ralph log entry:", error);
    }
  };
  const extractContent2 = (content) => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter(
        (block) => !!block && typeof block === "object" && block.type === "text"
      ).map((block) => block.text).join("");
    }
    return "";
  };
  const getMessageRole2 = (msg) => {
    if (typeof msg._getType === "function") {
      return msg._getType();
    }
    if (typeof msg.type === "string") return msg.type;
    const classId = Array.isArray(msg.id) ? msg.id : [];
    const className = classId[classId.length - 1] || "";
    if (className.includes("Human")) return "human";
    if (className.includes("AI")) return "ai";
    if (className.includes("Tool")) return "tool";
    if (className.includes("System")) return "system";
    return "";
  };
  const getMessageId2 = (msg) => {
    if (typeof msg.id === "string") return msg.id;
    const kwargs = msg.kwargs;
    return kwargs?.id;
  };
  const getMessageContent2 = (msg) => {
    if ("content" in msg) {
      return extractContent2(msg.content);
    }
    const kwargs = msg.kwargs;
    return extractContent2(kwargs?.content);
  };
  const getToolCalls2 = (msg) => {
    if (Array.isArray(msg.tool_calls)) {
      return msg.tool_calls;
    }
    const kwargs = msg.kwargs;
    return kwargs?.tool_calls || [];
  };
  const getToolMessageMeta2 = (msg) => {
    const toolCallId = msg.tool_call_id;
    const toolName = msg.name;
    const kwargs = msg.kwargs;
    return {
      toolCallId: toolCallId || kwargs?.tool_call_id,
      toolName: toolName || kwargs?.name
    };
  };
  for await (const chunk of stream2) {
    if (abortController.signal.aborted) break;
    const [mode, data] = chunk;
    if (mode === "values") {
      const state = data;
      if (Array.isArray(state.messages)) {
        for (const rawMsg of state.messages) {
          if (!rawMsg || typeof rawMsg !== "object") continue;
          const msg = rawMsg;
          const role = getMessageRole2(msg);
          if (role === "human") continue;
          const messageId = getMessageId2(msg);
          if (messageId && seenMessageIds.has(messageId)) {
            continue;
          }
          const content = getMessageContent2(msg);
          const toolCalls = getToolCalls2(msg);
          if (role === "ai") {
            if (messageId) seenMessageIds.add(messageId);
            if (content) {
              lastValuesAiContent = content;
            }
            if (ralphLog?.enabled && (content || toolCalls.length > 0)) {
              appendLog({
                role: "ai",
                content,
                messageId
              });
            }
            for (const tc of toolCalls) {
              if (!tc.id || seenToolCallIds.has(tc.id)) continue;
              seenToolCallIds.add(tc.id);
              let argsText = "";
              try {
                argsText = tc.args ? JSON.stringify(tc.args) : "";
              } catch {
                argsText = "";
              }
              if (ralphLog?.enabled) {
                appendLog({
                  role: "tool_call",
                  content: `${tc.name || "tool"}(${argsText})`,
                  toolCallId: tc.id,
                  toolName: tc.name,
                  toolArgs: tc.args
                });
              }
            }
          } else if (role === "tool") {
            if (messageId) seenMessageIds.add(messageId);
            if (ralphLog?.enabled) {
              const meta = getToolMessageMeta2(msg);
              appendLog({
                role: "tool",
                content,
                messageId,
                toolCallId: meta.toolCallId,
                toolName: meta.toolName
              });
            }
          }
        }
      }
    }
    if (mode === "messages") {
      const content = extractAssistantChunkText(data);
      if (content) {
        if (content.startsWith(lastAssistant)) {
          lastAssistant = content;
        } else {
          lastAssistant += content;
        }
      }
    }
    window.webContents.send(channel, {
      type: "stream",
      mode,
      data: JSON.parse(JSON.stringify(data))
    });
  }
  if (ralphLog?.enabled && !loggedAnything && lastAssistant.trim()) {
    appendLog({
      role: "ai",
      content: lastAssistant.trim()
    });
  }
  return lastAssistant.trim() || lastValuesAiContent.trim();
}
const lifecycleEmitter = new events.EventEmitter();
function normalizeMode$1(metadata) {
  const mode = metadata.mode;
  if (mode === "ralph" || mode === "email" || mode === "loop" || mode === "butler") {
    return mode;
  }
  return "default";
}
function buildBasePayload(threadId) {
  const row = getThread(threadId);
  const metadata = row?.metadata ? JSON.parse(row.metadata) : {};
  const mode = normalizeMode$1(metadata);
  return { row, metadata, mode };
}
function emitTaskStarted(input) {
  const { row, metadata, mode } = buildBasePayload(input.threadId);
  const payload = {
    threadId: input.threadId,
    mode,
    title: row?.title ?? void 0,
    source: input.source,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    metadata
  };
  lifecycleEmitter.emit("task:started", payload);
}
function emitTaskCompleted(input) {
  const { row, metadata, mode } = buildBasePayload(input.threadId);
  const payload = {
    threadId: input.threadId,
    mode,
    title: row?.title ?? void 0,
    result: input.result,
    error: input.error,
    source: input.source,
    finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    metadata
  };
  lifecycleEmitter.emit("task:completed", payload);
}
function onTaskStarted(listener) {
  lifecycleEmitter.on("task:started", listener);
  return () => lifecycleEmitter.off("task:started", listener);
}
function onTaskCompleted(listener) {
  lifecycleEmitter.on("task:completed", listener);
  return () => lifecycleEmitter.off("task:completed", listener);
}
const activeRuns = /* @__PURE__ */ new Map();
function getActiveRunCount() {
  return activeRuns.size;
}
function parseMetadata$2(threadId) {
  const row = getThread(threadId);
  return row?.metadata ? JSON.parse(row.metadata) : {};
}
function updateMetadata(threadId, updates) {
  const current = parseMetadata$2(threadId);
  const next = {
    ...current,
    ...updates,
    ralph: {
      ...current.ralph,
      ...updates.ralph
    }
  };
  updateThread(threadId, { metadata: JSON.stringify(next) });
}
async function resetRalphCheckpoint(threadId) {
  await closeCheckpointer(threadId);
  deleteThreadCheckpoint(threadId);
}
function appendProgressEntry(workspacePath, storyId = "INIT") {
  const entry = [
    `## [${(/* @__PURE__ */ new Date()).toLocaleString()}] - ${storyId}`,
    "- 实现内容",
    "- 修改的文件",
    "- **后续迭代的经验教训：**",
    "  - 发现的模式",
    "  - 遇到的坑",
    "  - 有用的上下文",
    "---",
    ""
  ].join("\n");
  const progressPath = path$1.join(workspacePath, "progress.txt");
  fs$1.appendFileSync(progressPath, entry);
}
function buildRalphInitPrompt(userMessage) {
  const example = [
    "{",
    '  "project": "MyApp",',
    '  "branchName": "ralph/task-priority",',
    '  "description": "任务优先级系统 - 为任务添加优先级",',
    '  "userStories": [',
    "    {",
    '      "id": "US-001",',
    '      "title": "在数据库中添加优先级字段",',
    '      "description": "作为开发者，我需要存储任务优先级以便跨会话持久化。",',
    '      "acceptanceCriteria": [',
    `        "在 tasks 表中添加 priority 列：'high' | 'medium' | 'low'（默认 'medium'）",`,
    '        "成功生成并运行迁移",',
    '        "类型检查通过"',
    "      ],",
    '      "priority": 1,',
    '      "passes": false,',
    '      "notes": ""',
    "    },",
    "    {",
    '      "id": "US-002",',
    '      "title": "在任务卡片上显示优先级指示器",',
    '      "description": "作为用户，我希望能一眼看到任务优先级。",',
    '      "acceptanceCriteria": [',
    '        "每个任务卡片显示彩色优先级徽章（红色=高，黄色=中，灰色=低）",',
    '        "无需悬停或点击即可看到优先级",',
    '        "类型检查通过",',
    '        "使用 dev-browser 技能在浏览器中验证"',
    "      ],",
    '      "priority": 2,',
    '      "passes": false,',
    '      "notes": ""',
    "    }",
    "  ]",
    "}"
  ].join("\n");
  return [
    "Ralph 模式初始化：",
    "1) 与用户确认任务详情。",
    "2) 按照下面的 JSON 格式生成计划。",
    "3) 将 JSON 保存到工作区的 ralph_plan.json 文件中。",
    "4) 请用户回复 /confirm 以开始迭代。",
    "",
    "JSON 格式示例：",
    example,
    "",
    "用户请求：",
    userMessage.trim()
  ].join("\n");
}
function extractTextFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => block.type === "text" && block.text ? block.text : "").join("");
}
function appendAssistantOutput(current, chunk) {
  const content = extractAssistantChunkText(chunk);
  if (!content) return current;
  if (content.startsWith(current)) {
    return content;
  }
  return current + content;
}
function registerAgentHandlers(ipcMain) {
  console.log("[Agent] Registering agent handlers...");
  ipcMain.on("agent:invoke", async (event, { threadId, message, modelId }) => {
    const channel = `agent:stream:${threadId}`;
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    const messageText = extractTextFromContent(message);
    console.log("[Agent] Received invoke request:", {
      threadId,
      message: messageText.substring(0, 50),
      modelId
    });
    if (!window) {
      console.error("[Agent] No window found");
      return;
    }
    const existingController = activeRuns.get(threadId);
    if (existingController) {
      console.log("[Agent] Aborting existing stream for thread:", threadId);
      existingController.abort();
      activeRuns.delete(threadId);
    }
    const abortController = new AbortController();
    activeRuns.set(threadId, abortController);
    const onWindowClosed = () => {
      console.log("[Agent] Window closed, aborting stream for thread:", threadId);
      abortController.abort();
    };
    window.once("closed", onWindowClosed);
    try {
      const thread = getThread(threadId);
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
      console.log("[Agent] Thread metadata:", metadata);
      const workspacePath = metadata.workspacePath;
      await ensureDockerRunning();
      const dockerRuntime = getDockerRuntimeConfig();
      const dockerConfig = dockerRuntime.config ?? void 0;
      const dockerContainerId = dockerRuntime.containerId ?? void 0;
      if (!workspacePath) {
        window.webContents.send(channel, {
          type: "error",
          error: "WORKSPACE_REQUIRED",
          message: "请在发送消息前选择一个工作区文件夹。"
        });
        return;
      }
      const mode = metadata.mode || "default";
      const settings = getSettings();
      const normalizedWorkspace = workspacePath || "";
      const emitAgentStarted = () => {
        emitTaskStarted({
          threadId,
          source: "agent"
        });
      };
      const disableApprovalsForThread = metadata.disableApprovals === true || metadata.createdBy === "quick-input";
      if (mode === "ralph") {
        const emitRalphLog = (entry) => {
          const fullEntry = {
            id: node_crypto.randomUUID(),
            ts: (/* @__PURE__ */ new Date()).toISOString(),
            threadId,
            runId: node_crypto.randomUUID(),
            ...entry
          };
          appendRalphLogEntry(threadId, fullEntry);
          window.webContents.send(channel, {
            type: "custom",
            data: { type: "ralph_log", entry: fullEntry }
          });
        };
        const trimmedMessage = messageText.trim();
        if (trimmedMessage) {
          emitRalphLog({
            role: "user",
            content: trimmedMessage,
            phase: metadata.ralph?.phase
          });
        }
        const ralph = metadata.ralph || { phase: "init", iterations: 0 };
        const trimmed = trimmedMessage;
        const isConfirm = trimmed.toLowerCase() === "/confirm";
        if (ralph.phase === "awaiting_confirm" && !isConfirm) {
          const initPrompt = buildRalphInitPrompt(trimmed);
          emitAgentStarted();
          const output2 = await runAgentStream({
            threadId,
            workspacePath: normalizedWorkspace,
            modelId,
            dockerConfig,
            dockerContainerId,
            disableApprovals: true,
            message: initPrompt,
            window,
            channel,
            abortController,
            threadMode: mode,
            capabilityScope: "classic",
            ralphLog: { enabled: true, iteration: 0, phase: ralph.phase }
          });
          updateMetadata(threadId, { ralph: { phase: "awaiting_confirm", iterations: 0 } });
          if (!abortController.signal.aborted) {
            emitTaskCompleted({
              threadId,
              result: output2,
              source: "agent"
            });
            window.webContents.send(channel, { type: "done" });
          }
          return;
        }
        if (ralph.phase === "awaiting_confirm" && isConfirm) {
          const planPath = path$1.join(normalizedWorkspace, "ralph_plan.json");
          if (!fs$1.existsSync(planPath)) {
            window.webContents.send(channel, {
              type: "error",
              error: "RALPH_PLAN_MISSING",
              message: "请在确认迭代前先生成 ralph_plan.json 文件。"
            });
            return;
          }
          appendProgressEntry(normalizedWorkspace);
          updateMetadata(threadId, { ralph: { phase: "running", iterations: 0 } });
          let lastIterationOutput = "";
          const maxIterations = settings.ralphIterations || 5;
          for (let i = 1; i <= maxIterations; i += 1) {
            if (abortController.signal.aborted) break;
            const doneFlag = path$1.join(normalizedWorkspace, ".ralph_done");
            if (fs$1.existsSync(doneFlag)) {
              updateMetadata(threadId, { ralph: { phase: "done", iterations: i } });
              break;
            }
            await resetRalphCheckpoint(threadId);
            const iterationPrompt = [
              `Ralph 迭代 ${i}/${maxIterations}：`,
              "- 在修改前先阅读 ralph_plan.json 和 progress.txt。",
              "- 以文件系统作为唯一的真实来源。",
              "- 实现下一个最高优先级的用户故事。",
              "- 使用规定的模板追加到 progress.txt（不要覆盖）。",
              "- 如果工作完成，创建一个 .ralph_done 文件并写入简短总结。",
              "- 如果工作未完成，创建一个 .ralph_ongoing 文件。",
              "- 工作过程的重要信息你需要写入在工作路径中，并写在 progress.txt 中，提示下一轮迭代读取或者最终总结。"
            ].join("\n");
            emitAgentStarted();
            lastIterationOutput = await runAgentStream({
              threadId,
              workspacePath: normalizedWorkspace,
              modelId,
              dockerConfig,
              dockerContainerId,
              disableApprovals: true,
              message: iterationPrompt,
              window,
              channel,
              abortController,
              threadMode: mode,
              capabilityScope: "classic",
              ralphLog: { enabled: true, iteration: i, phase: "running" }
            });
            updateMetadata(threadId, { ralph: { iterations: i } });
            if (fs$1.existsSync(doneFlag)) {
              updateMetadata(threadId, { ralph: { phase: "done", iterations: i } });
              break;
            }
          }
          if (!abortController.signal.aborted) {
            updateMetadata(threadId, { ralph: { phase: "done" } });
          }
          if (!abortController.signal.aborted) {
            emitTaskCompleted({
              threadId,
              result: lastIterationOutput || "Ralph iteration finished.",
              source: "agent"
            });
            window.webContents.send(channel, { type: "done" });
          }
          return;
        }
        if (ralph.phase === "running") {
          if (hasThreadCheckpoint(threadId)) {
            console.log("[Agent] Ralph stuck in running state, resetting to awaiting_confirm");
            updateMetadata(threadId, { ralph: { phase: "awaiting_confirm", iterations: 0 } });
          } else {
            window.webContents.send(channel, {
              type: "error",
              error: "RALPH_RUNNING",
              message: "Ralph 正在运行中，请等待完成。"
            });
            return;
          }
        }
        if (ralph.phase === "done") {
          updateMetadata(threadId, { ralph: { phase: "init", iterations: 0 } });
        }
        if (ralph.phase === "init" || ralph.phase === "done") {
          await resetRalphCheckpoint(threadId);
          const initPrompt = buildRalphInitPrompt(messageText);
          emitAgentStarted();
          const output2 = await runAgentStream({
            threadId,
            workspacePath: normalizedWorkspace,
            modelId,
            dockerConfig,
            dockerContainerId,
            disableApprovals: true,
            message: initPrompt,
            window,
            channel,
            abortController,
            threadMode: mode,
            capabilityScope: "classic",
            ralphLog: { enabled: true, iteration: 0, phase: ralph.phase }
          });
          updateMetadata(threadId, { ralph: { phase: "awaiting_confirm", iterations: 0 } });
          if (!abortController.signal.aborted) {
            emitTaskCompleted({
              threadId,
              result: output2,
              source: "agent"
            });
            window.webContents.send(channel, { type: "done" });
          }
          return;
        }
      }
      if (mode === "email") {
        emitAgentStarted();
        const output2 = await runAgentStream({
          threadId,
          workspacePath: normalizedWorkspace,
          modelId,
          dockerConfig,
          dockerContainerId,
          disableApprovals: disableApprovalsForThread,
          message,
          window,
          channel,
          abortController,
          threadMode: mode,
          capabilityScope: "classic",
          forceToolNames: ["send_email"]
        });
        if (!abortController.signal.aborted) {
          emitTaskCompleted({
            threadId,
            result: output2,
            source: "agent"
          });
          window.webContents.send(channel, { type: "done" });
        }
        return;
      }
      emitAgentStarted();
      const output = await runAgentStream({
        threadId,
        workspacePath: normalizedWorkspace,
        modelId,
        dockerConfig,
        dockerContainerId,
        disableApprovals: disableApprovalsForThread,
        message,
        window,
        channel,
        abortController,
        threadMode: mode,
        capabilityScope: "classic"
      });
      if (!abortController.signal.aborted) {
        emitTaskCompleted({
          threadId,
          result: output,
          source: "agent"
        });
        window.webContents.send(channel, { type: "done" });
      }
    } catch (error) {
      const isAbortError = error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted") || error.message.includes("Controller is already closed"));
      if (!isAbortError) {
        console.error("[Agent] Error:", error);
        emitTaskCompleted({
          threadId,
          error: error instanceof Error ? error.message : "Unknown error",
          source: "agent"
        });
        window.webContents.send(channel, {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    } finally {
      window.removeListener("closed", onWindowClosed);
      activeRuns.delete(threadId);
    }
  });
  ipcMain.on("agent:resume", async (event, { threadId, command, modelId }) => {
    const channel = `agent:stream:${threadId}`;
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    console.log("[Agent] Received resume request:", { threadId, command, modelId });
    if (!window) {
      console.error("[Agent] No window found for resume");
      return;
    }
    const thread = getThread(threadId);
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
    const workspacePath = metadata.workspacePath;
    const threadMode = metadata.mode || "default";
    await ensureDockerRunning();
    const dockerRuntime = getDockerRuntimeConfig();
    const dockerConfig = dockerRuntime.config ?? void 0;
    const dockerContainerId = dockerRuntime.containerId ?? void 0;
    if (!workspacePath) {
      window.webContents.send(channel, {
        type: "error",
        error: "需要工作区路径"
      });
      return;
    }
    const existingController = activeRuns.get(threadId);
    if (existingController) {
      existingController.abort();
      activeRuns.delete(threadId);
    }
    const abortController = new AbortController();
    activeRuns.set(threadId, abortController);
    try {
      emitTaskStarted({
        threadId,
        source: "agent"
      });
      const agent = await createAgentRuntime({
        threadId,
        workspacePath: workspacePath || "",
        modelId,
        dockerConfig,
        dockerContainerId,
        threadMode,
        capabilityScope: "classic"
      });
      const config2 = {
        configurable: { thread_id: threadId },
        signal: abortController.signal,
        streamMode: ["messages", "values"],
        recursionLimit: 1e3
      };
      const decisionType = command?.resume?.decision || "approve";
      const resumeValue = { decisions: [{ type: decisionType }] };
      const stream2 = await agent.stream(new langgraph.Command({ resume: resumeValue }), config2);
      let lastAssistant = "";
      for await (const chunk of stream2) {
        if (abortController.signal.aborted) break;
        const [mode, data] = chunk;
        if (mode === "messages") {
          lastAssistant = appendAssistantOutput(lastAssistant, data);
        }
        window.webContents.send(channel, {
          type: "stream",
          mode,
          data: JSON.parse(JSON.stringify(data))
        });
      }
      if (!abortController.signal.aborted) {
        emitTaskCompleted({
          threadId,
          result: lastAssistant.trim() || "Agent resume completed.",
          source: "agent"
        });
        window.webContents.send(channel, { type: "done" });
      }
    } catch (error) {
      const isAbortError = error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted") || error.message.includes("Controller is already closed"));
      if (!isAbortError) {
        console.error("[Agent] Resume error:", error);
        emitTaskCompleted({
          threadId,
          error: error instanceof Error ? error.message : "Unknown error",
          source: "agent"
        });
        window.webContents.send(channel, {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    } finally {
      activeRuns.delete(threadId);
    }
  });
  ipcMain.on("agent:interrupt", async (event, { threadId, decision }) => {
    const channel = `agent:stream:${threadId}`;
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      console.error("[Agent] No window found for interrupt response");
      return;
    }
    const thread = getThread(threadId);
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
    const workspacePath = metadata.workspacePath;
    const modelId = metadata.model;
    const threadMode = metadata.mode || "default";
    await ensureDockerRunning();
    const dockerRuntime = getDockerRuntimeConfig();
    const dockerConfig = dockerRuntime.config ?? void 0;
    const dockerContainerId = dockerRuntime.containerId ?? void 0;
    if (!workspacePath) {
      window.webContents.send(channel, {
        type: "error",
        error: "需要工作区路径"
      });
      return;
    }
    const existingController = activeRuns.get(threadId);
    if (existingController) {
      existingController.abort();
      activeRuns.delete(threadId);
    }
    const abortController = new AbortController();
    activeRuns.set(threadId, abortController);
    try {
      emitTaskStarted({
        threadId,
        source: "agent"
      });
      const agent = await createAgentRuntime({
        threadId,
        workspacePath: workspacePath || "",
        modelId,
        dockerConfig,
        dockerContainerId,
        threadMode,
        capabilityScope: "classic"
      });
      const config2 = {
        configurable: { thread_id: threadId },
        signal: abortController.signal,
        streamMode: ["messages", "values"],
        recursionLimit: 1e3
      };
      if (decision.type === "approve") {
        const stream2 = await agent.stream(null, config2);
        let lastAssistant = "";
        for await (const chunk of stream2) {
          if (abortController.signal.aborted) break;
          const [mode, data] = chunk;
          if (mode === "messages") {
            lastAssistant = appendAssistantOutput(lastAssistant, data);
          }
          window.webContents.send(channel, {
            type: "stream",
            mode,
            data: JSON.parse(JSON.stringify(data))
          });
        }
        if (!abortController.signal.aborted) {
          emitTaskCompleted({
            threadId,
            result: lastAssistant.trim() || "Agent interrupt approval completed.",
            source: "agent"
          });
          window.webContents.send(channel, { type: "done" });
        }
      } else if (decision.type === "reject") {
        emitTaskCompleted({
          threadId,
          result: "用户拒绝本次工具执行，流程结束。",
          source: "agent"
        });
        window.webContents.send(channel, { type: "done" });
      }
    } catch (error) {
      const isAbortError = error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted") || error.message.includes("Controller is already closed"));
      if (!isAbortError) {
        console.error("[Agent] Interrupt error:", error);
        emitTaskCompleted({
          threadId,
          error: error instanceof Error ? error.message : "Unknown error",
          source: "agent"
        });
        window.webContents.send(channel, {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    } finally {
      activeRuns.delete(threadId);
    }
  });
  ipcMain.handle("agent:cancel", async (_event, { threadId }) => {
    const thread = getThread(threadId);
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
    if (metadata.nonInterruptible === true) {
      console.log("[Agent] Cancellation ignored for non-interruptible thread:", threadId);
      return;
    }
    const controller = activeRuns.get(threadId);
    if (controller) {
      controller.abort();
      activeRuns.delete(threadId);
    }
  });
}
function broadcastThreadsChanged() {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send("threads:changed");
  }
}
function broadcastThreadHistoryUpdated(threadId) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send("thread:history-updated", threadId);
  }
}
function broadcastToast(type, message) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send("app:toast", { type, message });
  }
}
function broadcastTaskCard(card) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send("app:task-card", card);
  }
}
function generateTitle(message) {
  const cleaned = message.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "New Conversation";
  }
  if (cleaned.length <= 50) {
    return cleaned;
  }
  const sentenceMatch = cleaned.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= 60) {
    return sentenceMatch[0].trim();
  }
  const words = cleaned.split(/\s+/);
  let title = "";
  for (const word of words) {
    if ((title + " " + word).length > 47) {
      break;
    }
    title = title ? title + " " + word : word;
  }
  if (title) {
    return title;
  }
  return "New Conversation";
}
function hasQueryFlag(url, key) {
  try {
    return new URL(url).searchParams.get(key) === "1";
  } catch {
    return url.includes(`${key}=1`);
  }
}
function isAuxiliaryWindow(window) {
  const url = window.webContents.getURL();
  if (!url) return false;
  return hasQueryFlag(url, "quickInput") || hasQueryFlag(url, "taskPopup");
}
function isVisibleWindow(window) {
  return window.isVisible() && !window.isMinimized();
}
function getPreferredMainWindow() {
  const windows = electron.BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  if (windows.length === 0) return null;
  const nonAuxiliary = windows.filter((window) => !isAuxiliaryWindow(window));
  const focusedNonAuxiliary = nonAuxiliary.find((window) => window.isFocused());
  if (focusedNonAuxiliary) return focusedNonAuxiliary;
  const visibleNonAuxiliary = nonAuxiliary.find((window) => isVisibleWindow(window));
  if (visibleNonAuxiliary) return visibleNonAuxiliary;
  if (nonAuxiliary.length > 0) return nonAuxiliary[0];
  const focusedFallback = windows.find((window) => window.isFocused());
  if (focusedFallback) return focusedFallback;
  const visibleFallback = windows.find((window) => isVisibleWindow(window));
  if (visibleFallback) return visibleFallback;
  return windows[0];
}
const DEFAULT_PREVIEW_LINES = 200;
const DEFAULT_PREVIEW_BYTES = 8192;
const DEFAULT_QUEUE_MERGE_WINDOW_SEC = 300;
function normalizeLoopConfig(input) {
  const queue = input.queue || { mergeWindowSec: DEFAULT_QUEUE_MERGE_WINDOW_SEC };
  const trigger = input.trigger;
  if (trigger.type === "file") {
    const fileTrigger = trigger;
    return {
      ...input,
      queue: {
        policy: "strict",
        mergeWindowSec: queue.mergeWindowSec || DEFAULT_QUEUE_MERGE_WINDOW_SEC
      },
      trigger: {
        ...fileTrigger,
        previewMaxLines: fileTrigger.previewMaxLines || DEFAULT_PREVIEW_LINES,
        previewMaxBytes: fileTrigger.previewMaxBytes || DEFAULT_PREVIEW_BYTES
      }
    };
  }
  return {
    ...input,
    queue: {
      policy: "strict",
      mergeWindowSec: queue.mergeWindowSec || DEFAULT_QUEUE_MERGE_WINDOW_SEC
    }
  };
}
function getThreadMetadata(threadId) {
  const row = getThread(threadId);
  return row?.metadata ? JSON.parse(row.metadata) : {};
}
function saveLoopConfig(threadId, config2) {
  const metadata = getThreadMetadata(threadId);
  const next = { ...metadata, loop: config2 };
  updateThread(threadId, { metadata: JSON.stringify(next) });
  broadcastThreadsChanged();
}
function getWorkspacePath(threadId) {
  const metadata = getThreadMetadata(threadId);
  return metadata.workspacePath || null;
}
function getLoopConfig(threadId) {
  const metadata = getThreadMetadata(threadId);
  const raw = metadata.loop;
  if (!raw) return null;
  return normalizeLoopConfig(raw);
}
function stringifyLimited(value, maxChars) {
  let text = "";
  try {
    text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}
...[truncated]`;
}
function buildTemplateVariables(config2, event) {
  const vars = {
    "trigger.type": event.type,
    time: new Date(event.ts).toLocaleString()
  };
  if (event.type === "schedule") {
    const trigger = config2.trigger;
    vars["schedule.cron"] = trigger.cron;
  }
  if (event.type === "api") {
    const trigger = config2.trigger;
    vars["api.url"] = trigger.url;
    vars["api.status"] = String(event.status);
    vars["api.json"] = stringifyLimited(event.response, 4e3);
    vars["api.pathValue"] = stringifyLimited(event.pathValue, 2e3);
  }
  if (event.type === "file") {
    vars["file.path"] = event.filePath;
    vars["file.preview"] = event.preview;
    vars["file.size"] = String(event.size);
  }
  return vars;
}
function applyTemplate(template, vars) {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, key) => vars[key] ?? "");
}
function getJsonPathValue(data, pathInput) {
  if (pathInput === "$") return data;
  let pathText = pathInput.trim();
  if (pathText.startsWith("$.")) pathText = pathText.slice(2);
  if (pathText.startsWith("$")) pathText = pathText.slice(1);
  if (!pathText) return data;
  const tokens = [];
  const regex = /[^.[\]]+|\[(\d+)\]/g;
  let match;
  while (match = regex.exec(pathText)) {
    if (match[1] !== void 0) tokens.push(Number(match[1]));
    else tokens.push(match[0]);
  }
  let current = data;
  for (const token of tokens) {
    if (current === null || current === void 0) return void 0;
    if (typeof token === "number") {
      if (Array.isArray(current)) {
        current = current[token];
      } else {
        return void 0;
      }
    } else {
      if (typeof current === "object") {
        current = current[token];
      } else {
        return void 0;
      }
    }
  }
  return current;
}
function checkCondition(op, value, expected) {
  if (op === "truthy") return Boolean(value);
  const text = value === null || value === void 0 ? "" : String(value);
  if (op === "equals") return text === (expected ?? "");
  if (op === "contains") return expected ? text.includes(expected) : false;
  return false;
}
async function readFilePreview(filePath, maxLines, maxBytes) {
  const stat = await fs__namespace.stat(filePath);
  const raw = await fs__namespace.readFile(filePath, "utf-8");
  const sliced = raw.slice(0, maxBytes);
  const lines = sliced.split(/\r?\n/);
  const limitedLines = lines.slice(0, maxLines);
  let preview = limitedLines.join("\n");
  if (lines.length > maxLines || raw.length > maxBytes) {
    preview += "\n...[truncated]";
  }
  return { preview, size: stat.size };
}
async function listFilesRecursive(rootPath) {
  const files = /* @__PURE__ */ new Set();
  async function walk(current) {
    const entries = await fs__namespace.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path__namespace.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.add(fullPath);
      }
    }
  }
  await walk(rootPath);
  return files;
}
function shouldIgnorePath(filePath) {
  const parts = filePath.split(/[\\/]/);
  return parts.some((p) => p.startsWith(".") || p === "node_modules");
}
function matchesSuffix(filePath, suffixes) {
  if (!suffixes || suffixes.length === 0) return true;
  const lower = filePath.toLowerCase();
  return suffixes.some((suffix) => lower.endsWith(suffix.toLowerCase()));
}
class LoopManager {
  runners = /* @__PURE__ */ new Map();
  getConfig(threadId) {
    return getLoopConfig(threadId);
  }
  getStatus(threadId) {
    const runner = this.runners.get(threadId);
    return {
      running: runner?.running || false,
      queueLength: runner?.queue.length || 0
    };
  }
  updateConfig(threadId, config2) {
    const normalized = normalizeLoopConfig(config2);
    saveLoopConfig(threadId, normalized);
    const runner = this.runners.get(threadId);
    if (runner) {
      runner.config = normalized;
      if (normalized.enabled) {
        this.stopRunner(runner);
        this.startRunner(runner);
      } else {
        this.stopRunner(runner);
      }
    }
    return normalized;
  }
  start(threadId) {
    const config2 = getLoopConfig(threadId);
    if (!config2) {
      throw new Error("Missing loop configuration");
    }
    const normalized = normalizeLoopConfig({ ...config2, enabled: true, lastError: null });
    saveLoopConfig(threadId, normalized);
    let runner = this.runners.get(threadId);
    if (!runner) {
      runner = {
        threadId,
        config: normalized,
        running: false,
        queue: []
      };
      this.runners.set(threadId, runner);
    } else {
      runner.config = normalized;
    }
    this.startRunner(runner);
    return normalized;
  }
  stop(threadId) {
    const config2 = getLoopConfig(threadId);
    if (!config2) {
      throw new Error("Missing loop configuration");
    }
    const normalized = normalizeLoopConfig({ ...config2, enabled: false, nextRunAt: null });
    saveLoopConfig(threadId, normalized);
    const runner = this.runners.get(threadId);
    if (runner) {
      runner.config = normalized;
      this.stopRunner(runner);
    }
    return normalized;
  }
  stopAll() {
    for (const runner of this.runners.values()) {
      this.stopRunner(runner);
    }
    this.runners.clear();
  }
  cleanupThread(threadId) {
    const runner = this.runners.get(threadId);
    if (runner) {
      this.stopRunner(runner);
      this.runners.delete(threadId);
    }
  }
  resetAllOnStartup() {
    const rows = getAllThreads();
    for (const row of rows) {
      const config2 = getLoopConfig(row.thread_id);
      if (config2?.enabled) {
        saveLoopConfig(row.thread_id, { ...config2, enabled: false, nextRunAt: null });
      }
    }
  }
  startRunner(runner) {
    this.stopRunner(runner);
    const trigger = runner.config.trigger;
    if (trigger.type === "schedule") {
      this.scheduleNext(runner);
    } else if (trigger.type === "api") {
      this.scheduleNext(runner);
    } else if (trigger.type === "file") {
      runner.config.nextRunAt = null;
      saveLoopConfig(runner.threadId, runner.config);
      this.startFileWatcher(runner, trigger);
    }
  }
  stopRunner(runner) {
    if (runner.scheduleTimer) {
      clearTimeout(runner.scheduleTimer);
      runner.scheduleTimer = void 0;
    }
    if (runner.fileWatcher) {
      runner.fileWatcher.close();
      runner.fileWatcher = void 0;
    }
    if (runner.abortController) {
      runner.abortController.abort();
      runner.abortController = void 0;
    }
    runner.running = false;
    runner.queue = [];
  }
  scheduleNext(runner) {
    const trigger = runner.config.trigger;
    let nextDate = null;
    try {
      const interval = cronParser.parseExpression(trigger.cron, { currentDate: /* @__PURE__ */ new Date() });
      nextDate = interval.next().toDate();
    } catch (error) {
      runner.config.nextRunAt = null;
      saveLoopConfig(runner.threadId, runner.config);
      this.markError(runner, `Invalid cron expression: ${String(error)}`);
      return;
    }
    const delay = Math.max(0, nextDate.getTime() - Date.now());
    runner.config.nextRunAt = nextDate.toISOString();
    saveLoopConfig(runner.threadId, runner.config);
    runner.scheduleTimer = setTimeout(async () => {
      if (!runner.config.enabled) return;
      if (trigger.type === "api") {
        await this.handleApiTrigger(runner, trigger);
      } else {
        this.enqueue(runner, { type: "schedule", ts: Date.now() });
      }
      this.scheduleNext(runner);
    }, delay);
  }
  async handleApiTrigger(runner, trigger) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), trigger.timeoutMs ?? 1e4);
    try {
      const headers = { ...trigger.headers || {} };
      if (trigger.bodyJson) {
        const hasContentType = Object.keys(headers).some(
          (key) => key.toLowerCase() === "content-type"
        );
        if (!hasContentType) {
          headers["Content-Type"] = "application/json";
        }
      }
      const response = await fetch(trigger.url, {
        method: trigger.method || "GET",
        headers,
        body: trigger.bodyJson ? JSON.stringify(trigger.bodyJson) : void 0,
        signal: controller.signal
      });
      const status = response.status;
      const json = await response.json();
      const pathValue = getJsonPathValue(json, trigger.jsonPath || "$");
      const matched = checkCondition(trigger.op, pathValue, trigger.expected);
      if (matched) {
        this.enqueue(runner, { type: "api", ts: Date.now(), response: json, pathValue, status });
      }
    } catch (error) {
      this.markError(runner, `API trigger failed: ${String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  async startFileWatcher(runner, trigger) {
    const watchPath = trigger.watchPath;
    if (!watchPath) {
      this.markError(runner, "Missing watch path for file trigger.");
      return;
    }
    const workspacePath = getWorkspacePath(runner.threadId);
    if (workspacePath) {
      const resolvedWatch = path__namespace.resolve(watchPath);
      const resolvedWorkspace = path__namespace.resolve(workspacePath);
      if (!resolvedWatch.startsWith(resolvedWorkspace)) {
        this.markError(runner, "Watch path must be within the workspace.");
        return;
      }
    }
    try {
      const stat = await fs__namespace.stat(watchPath);
      if (!stat.isDirectory()) {
        this.markError(runner, "Watch path must be a directory.");
        return;
      }
      runner.knownFiles = await listFilesRecursive(watchPath);
    } catch (error) {
      this.markError(runner, `Failed to read watch path: ${String(error)}`);
      return;
    }
    try {
      runner.fileWatcher = fs__namespace$1.watch(
        watchPath,
        { recursive: true },
        async (_eventType, filename) => {
          if (!filename) return;
          if (shouldIgnorePath(filename)) return;
          const fullPath = path__namespace.join(watchPath, filename);
          if (shouldIgnorePath(fullPath)) return;
          if (!matchesSuffix(fullPath, trigger.suffixes)) return;
          try {
            const stat = await fs__namespace.stat(fullPath);
            if (!stat.isFile()) return;
          } catch {
            return;
          }
          if (runner.knownFiles?.has(fullPath)) return;
          runner.knownFiles?.add(fullPath);
          setTimeout(async () => {
            try {
              const { preview, size } = await readFilePreview(
                fullPath,
                trigger.previewMaxLines || DEFAULT_PREVIEW_LINES,
                trigger.previewMaxBytes || DEFAULT_PREVIEW_BYTES
              );
              this.enqueue(runner, {
                type: "file",
                ts: Date.now(),
                filePath: fullPath,
                preview,
                size
              });
            } catch (error) {
              this.markError(runner, `Failed to read file: ${String(error)}`);
            }
          }, 200);
        }
      );
    } catch (error) {
      this.markError(runner, `Failed to watch path: ${String(error)}`);
    }
  }
  enqueue(runner, event) {
    if (!runner.config.enabled) return;
    const mergeWindowMs = (runner.config.queue?.mergeWindowSec || DEFAULT_QUEUE_MERGE_WINDOW_SEC) * 1e3;
    const now = Date.now();
    if (runner.lastEnqueueAt && now - runner.lastEnqueueAt < mergeWindowMs) {
      if (runner.queue.length === 0) {
        runner.queue.push(event);
      } else {
        runner.queue[runner.queue.length - 1] = event;
      }
    } else {
      runner.queue.push(event);
    }
    runner.lastEnqueueAt = now;
    void this.runNext(runner);
  }
  async runNext(runner) {
    if (runner.running) return;
    const event = runner.queue.shift();
    if (!event) return;
    runner.running = true;
    runner.abortController = new AbortController();
    const loopConfig = runner.config;
    const marker = `[Loop Trigger @${new Date(event.ts).toLocaleString()}]`;
    const vars = buildTemplateVariables(loopConfig, event);
    const rendered = applyTemplate(loopConfig.contentTemplate || "", vars);
    const finalMessage = rendered ? `${marker}
${rendered}` : marker;
    try {
      const workspacePath = getWorkspacePath(runner.threadId);
      if (!workspacePath) {
        throw new Error("Workspace path is required to run loop tasks.");
      }
      await ensureDockerRunning();
      const dockerRuntime = getDockerRuntimeConfig();
      const dockerConfig = dockerRuntime.config ?? void 0;
      const dockerContainerId = dockerRuntime.containerId ?? void 0;
      const window = getPreferredMainWindow();
      if (!window) {
        throw new Error("No active window to stream loop output.");
      }
      const metadata = getThreadMetadata(runner.threadId);
      const modelId = metadata.model;
      const capabilityScope = metadata.createdBy === "butler" ? "butler" : "classic";
      emitTaskStarted({
        threadId: runner.threadId,
        source: "loop"
      });
      const output = await runAgentStream({
        threadId: runner.threadId,
        workspacePath,
        modelId,
        dockerConfig,
        dockerContainerId,
        capabilityScope,
        disableApprovals: true,
        threadMode: "loop",
        message: finalMessage,
        window,
        channel: `agent:stream:${runner.threadId}`,
        abortController: runner.abortController
      });
      runner.config.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
      runner.config.lastError = null;
      saveLoopConfig(runner.threadId, runner.config);
      emitTaskCompleted({
        threadId: runner.threadId,
        result: output,
        source: "loop"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.markError(runner, message);
      emitTaskCompleted({
        threadId: runner.threadId,
        error: message,
        source: "loop"
      });
      broadcastToast("error", `[Loop] ${message}`);
    } finally {
      runner.running = false;
      runner.abortController = void 0;
      if (runner.queue.length > 0) {
        void this.runNext(runner);
      }
    }
  }
  markError(runner, message) {
    runner.config.lastError = message;
    saveLoopConfig(runner.threadId, runner.config);
  }
}
const loopManager = new LoopManager();
function toLocalDay(date2) {
  const year = date2.getFullYear();
  const month = `${date2.getMonth() + 1}`.padStart(2, "0");
  const day = `${date2.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getTodayLocalDay(now = /* @__PURE__ */ new Date()) {
  return toLocalDay(now);
}
function getYesterdayLocalDay(now = /* @__PURE__ */ new Date()) {
  const copy = new Date(now);
  copy.setDate(copy.getDate() - 1);
  return toLocalDay(copy);
}
function topLabel(summaries, key, fallback) {
  const stats = /* @__PURE__ */ new Map();
  for (const item of summaries) {
    const value = item[key];
    if (!value) continue;
    stats.set(value, (stats.get(value) ?? 0) + 1);
  }
  let result = fallback;
  let best = -1;
  for (const [label, count] of stats.entries()) {
    if (count > best) {
      best = count;
      result = label;
    }
  }
  return result;
}
function buildDailyProfileInput(params) {
  const { day, summaries, previousProfileDay, previousProfileText } = params;
  const direction = topLabel(summaries, "taskDirection", "任务方向未显著集中");
  const habit = topLabel(summaries, "usageHabits", "使用习惯仍在形成");
  const hobby = topLabel(summaries, "hobbies", "兴趣偏好未显著显现");
  const process2 = topLabel(summaries, "researchProcess", "调研流程以常规对话为主");
  const reportPreference = topLabel(summaries, "reportPreference", "文本");
  const profileText = [
    `日期 ${day} 用户侧写：`,
    `任务方向: ${direction}`,
    `使用习惯: ${habit}`,
    `爱好偏向: ${hobby}`,
    `调研过程: ${process2}`,
    `报告偏好: ${reportPreference}`,
    `有效任务数: ${summaries.length}`
  ].join("\n");
  let comparisonText = "无历史画像，无法比较变化。";
  if (previousProfileText && previousProfileDay) {
    const changed = previousProfileText.includes(direction) && previousProfileText.includes(habit) && previousProfileText.includes(reportPreference) ? "整体偏好与上次保持稳定。" : "与上次相比出现了任务方向或输出偏好的变化。";
    comparisonText = [`对比 ${previousProfileDay}:`, changed].join("\n");
  }
  return {
    day,
    profileText,
    comparisonText,
    previousProfileDay
  };
}
function firstMatch(text, mapping) {
  for (const item of mapping) {
    if (item.patterns.some((pattern) => pattern.test(text))) {
      return item.label;
    }
  }
  return void 0;
}
function compact$3(text, maxLength) {
  const value = text.trim().replace(/\s+/g, " ");
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
function summarizeTaskMemory(source) {
  const { payload, userMessages, assistantMessages, toolNames } = source;
  const allText = `${userMessages.join(" ")} ${assistantMessages.join(" ")}`.toLowerCase();
  const taskDirection = firstMatch(allText, [
    {
      label: "研发编码",
      patterns: [/代码|bug|debug|test|typescript|javascript|python|api|数据库|sql/]
    },
    { label: "调研分析", patterns: [/调研|research|对比|分析|benchmark|评估|报告/] },
    { label: "邮件任务", patterns: [/邮件|email|smtp|imap|回复/] }
  ]) ?? (payload.mode === "email" ? "邮件任务" : payload.mode === "loop" ? "自动化任务" : "通用任务");
  const usageHabits = firstMatch(allText, [
    { label: "偏好多轮迭代", patterns: [/继续|迭代|优化|refactor|改进/] },
    { label: "偏好快速结论", patterns: [/总结|结论|简短|直接给出/] },
    { label: "偏好可执行落地", patterns: [/实现|落地|部署|运行|执行/] }
  ]) ?? (payload.metadata.disableApprovals ? "倾向无审批连续执行" : "标准交互");
  const hobbies = firstMatch(allText, [
    { label: "偏好技术与工具", patterns: [/ai|工具|工程|开发|开源/] },
    { label: "偏好内容写作", patterns: [/写作|文案|润色|翻译/] },
    { label: "偏好数据洞察", patterns: [/数据|图表|指标|统计|dashboard/] }
  ]);
  const reportPreference = firstMatch(allText, [
    { label: "表格", patterns: [/表格|table|csv/] },
    { label: "数据", patterns: [/数据|统计|指标|数字|json/] },
    { label: "页面", patterns: [/页面|ui|界面|dashboard|html/] }
  ]) ?? "文本";
  const researchProcess = firstMatch(toolNames.join(" ").toLowerCase(), [
    { label: "工具驱动调研", patterns: [/search|grep|read_file|glob|mcp/] },
    { label: "自动化循环", patterns: [/loop|cron|watch/] },
    { label: "交互式执行", patterns: [/execute|send_email/] }
  ]) ?? "常规对话分析";
  const lastAssistant = assistantMessages[assistantMessages.length - 1] || payload.result || "";
  const firstUser = userMessages[0] || "";
  const summaryBrief = compact$3(lastAssistant || firstUser || "任务已完成。", 220);
  const summaryDetail = [
    `模式: ${payload.mode}`,
    payload.title ? `标题: ${payload.title}` : null,
    firstUser ? `用户起始需求: ${compact$3(firstUser, 280)}` : null,
    lastAssistant ? `最终结果: ${compact$3(lastAssistant, 600)}` : null,
    toolNames.length > 0 ? `过程工具: ${toolNames.join(", ")}` : null,
    payload.error ? `异常: ${payload.error}` : null
  ].filter(Boolean).join("\n");
  return {
    threadId: payload.threadId,
    mode: payload.mode,
    title: payload.title,
    summaryBrief,
    summaryDetail,
    taskDirection,
    usageHabits,
    hobbies,
    researchProcess,
    reportPreference,
    createdAt: payload.finishedAt
  };
}
let db = null;
let saveTimer = null;
let dirty = false;
function scheduleSave() {
  if (!db) return;
  dirty = true;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    if (!db || !dirty) return;
    const data = db.export();
    fs.writeFileSync(getMemoryDbPath(), Buffer.from(data));
    dirty = false;
  }, 100);
}
async function flushMemoryDatabase() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!db || !dirty) return;
  const data = db.export();
  fs.writeFileSync(getMemoryDbPath(), Buffer.from(data));
  dirty = false;
}
async function initializeMemoryDatabase() {
  if (db) return;
  const SQL = await initSqlJs();
  const dbPath = getMemoryDbPath();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new SQL.Database();
  }
  const database = getMemoryDb();
  database.run(`
    CREATE TABLE IF NOT EXISTS memory_task_summaries (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      title TEXT,
      summary_brief TEXT NOT NULL,
      summary_detail TEXT NOT NULL,
      task_direction TEXT,
      usage_habits TEXT,
      hobbies TEXT,
      research_process TEXT,
      report_preference TEXT,
      created_at TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS memory_daily_profiles (
      day TEXT PRIMARY KEY,
      profile_text TEXT NOT NULL,
      comparison_text TEXT NOT NULL,
      previous_profile_day TEXT,
      created_at TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS memory_runs (
      run_key TEXT PRIMARY KEY,
      run_value TEXT,
      created_at TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS butler_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      ts TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS butler_tasks (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.run(
    "CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_thread_id ON memory_task_summaries(thread_id)"
  );
  database.run(
    "CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_created_at ON memory_task_summaries(created_at)"
  );
  database.run(
    "CREATE INDEX IF NOT EXISTS idx_memory_task_summaries_report_preference ON memory_task_summaries(report_preference)"
  );
  database.run("CREATE INDEX IF NOT EXISTS idx_butler_messages_ts ON butler_messages(ts)");
  scheduleSave();
}
function getMemoryDb() {
  if (!db) {
    throw new Error("Memory database not initialized.");
  }
  return db;
}
function readRows$1(query, params = []) {
  const statement = getMemoryDb().prepare(query);
  if (params.length > 0) {
    statement.bind(params);
  }
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}
function readSingleRow$1(query, params = []) {
  const rows = readRows$1(query, params);
  return rows.length > 0 ? rows[0] : null;
}
function normalizeMode(mode) {
  if (mode === "ralph" || mode === "email" || mode === "loop" || mode === "butler") {
    return mode;
  }
  return "default";
}
function mapTaskSummaryRow(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    mode: normalizeMode(row.mode),
    title: row.title ?? void 0,
    summaryBrief: row.summary_brief,
    summaryDetail: row.summary_detail,
    taskDirection: row.task_direction ?? void 0,
    usageHabits: row.usage_habits ?? void 0,
    hobbies: row.hobbies ?? void 0,
    researchProcess: row.research_process ?? void 0,
    reportPreference: row.report_preference ?? void 0,
    createdAt: row.created_at
  };
}
function insertTaskSummary(input) {
  const row = {
    id: crypto.randomUUID(),
    threadId: input.threadId,
    mode: input.mode,
    title: input.title,
    summaryBrief: input.summaryBrief,
    summaryDetail: input.summaryDetail,
    taskDirection: input.taskDirection,
    usageHabits: input.usageHabits,
    hobbies: input.hobbies,
    researchProcess: input.researchProcess,
    reportPreference: input.reportPreference,
    createdAt: input.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
  getMemoryDb().run(
    `INSERT INTO memory_task_summaries
      (id, thread_id, mode, title, summary_brief, summary_detail, task_direction, usage_habits, hobbies, research_process, report_preference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.threadId,
      row.mode,
      row.title ?? null,
      row.summaryBrief,
      row.summaryDetail,
      row.taskDirection ?? null,
      row.usageHabits ?? null,
      row.hobbies ?? null,
      row.researchProcess ?? null,
      row.reportPreference ?? null,
      row.createdAt
    ]
  );
  scheduleSave();
  return row;
}
function listTaskSummaries(limit = 200) {
  const rows = readRows$1(
    `SELECT * FROM memory_task_summaries
      ORDER BY created_at DESC
      LIMIT ?`,
    [limit]
  );
  return rows.map(mapTaskSummaryRow);
}
function deleteTaskSummariesByThread(threadId) {
  getMemoryDb().run("DELETE FROM memory_task_summaries WHERE thread_id = ?", [threadId]);
  scheduleSave();
}
function clearAllTaskSummaries() {
  getMemoryDb().run("DELETE FROM memory_task_summaries");
  scheduleSave();
}
function searchTaskSummaries(query, limit = 20) {
  const keyword = `%${query.trim()}%`;
  const rows = readRows$1(
    `SELECT * FROM memory_task_summaries
      WHERE title LIKE ? OR summary_brief LIKE ? OR summary_detail LIKE ?
      ORDER BY created_at DESC
      LIMIT ?`,
    [keyword, keyword, keyword, limit]
  );
  return rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    mode: normalizeMode(row.mode),
    title: row.title ?? void 0,
    summaryBrief: row.summary_brief,
    summaryDetail: row.summary_detail,
    taskDirection: row.task_direction ?? void 0,
    usageHabits: row.usage_habits ?? void 0,
    hobbies: row.hobbies ?? void 0,
    researchProcess: row.research_process ?? void 0,
    reportPreference: row.report_preference ?? void 0,
    createdAt: row.created_at
  }));
}
function listTaskSummariesByDay(day) {
  const begin = (/* @__PURE__ */ new Date(`${day}T00:00:00.000`)).toISOString();
  const end = (/* @__PURE__ */ new Date(`${day}T23:59:59.999`)).toISOString();
  const rows = readRows$1(
    `SELECT * FROM memory_task_summaries
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC`,
    [begin, end]
  );
  return rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    mode: normalizeMode(row.mode),
    title: row.title ?? void 0,
    summaryBrief: row.summary_brief,
    summaryDetail: row.summary_detail,
    taskDirection: row.task_direction ?? void 0,
    usageHabits: row.usage_habits ?? void 0,
    hobbies: row.hobbies ?? void 0,
    researchProcess: row.research_process ?? void 0,
    reportPreference: row.report_preference ?? void 0,
    createdAt: row.created_at
  }));
}
function getDailyProfile(day) {
  const row = readSingleRow$1("SELECT * FROM memory_daily_profiles WHERE day = ? LIMIT 1", [day]);
  if (!row) return null;
  return {
    day: row.day,
    profileText: row.profile_text,
    comparisonText: row.comparison_text,
    previousProfileDay: row.previous_profile_day ?? void 0,
    createdAt: row.created_at
  };
}
function listDailyProfiles$1(limit = 60) {
  const rows = readRows$1(
    `SELECT * FROM memory_daily_profiles
      ORDER BY day DESC
      LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({
    day: row.day,
    profileText: row.profile_text,
    comparisonText: row.comparison_text,
    previousProfileDay: row.previous_profile_day ?? void 0,
    createdAt: row.created_at
  }));
}
function getPreviousDailyProfile(beforeDay) {
  const row = readSingleRow$1(
    `SELECT * FROM memory_daily_profiles
      WHERE day < ?
      ORDER BY day DESC
      LIMIT 1`,
    [beforeDay]
  );
  if (!row) return null;
  return {
    day: row.day,
    profileText: row.profile_text,
    comparisonText: row.comparison_text,
    previousProfileDay: row.previous_profile_day ?? void 0,
    createdAt: row.created_at
  };
}
function upsertDailyProfile(input) {
  const row = {
    day: input.day,
    profileText: input.profileText,
    comparisonText: input.comparisonText,
    previousProfileDay: input.previousProfileDay,
    createdAt: input.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
  getMemoryDb().run(
    `INSERT OR REPLACE INTO memory_daily_profiles
      (day, profile_text, comparison_text, previous_profile_day, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    [row.day, row.profileText, row.comparisonText, row.previousProfileDay ?? null, row.createdAt]
  );
  scheduleSave();
  return row;
}
function hasRunMarker(key) {
  const row = readSingleRow$1(
    "SELECT run_key FROM memory_runs WHERE run_key = ? LIMIT 1",
    [key]
  );
  return !!row;
}
function setRunMarker(key, value = "") {
  getMemoryDb().run(
    "INSERT OR REPLACE INTO memory_runs (run_key, run_value, created_at) VALUES (?, ?, ?)",
    [key, value, (/* @__PURE__ */ new Date()).toISOString()]
  );
  scheduleSave();
}
function clearRunMarkers() {
  getMemoryDb().run("DELETE FROM memory_runs");
  scheduleSave();
}
function appendButlerMessage(input) {
  getMemoryDb().run(
    "INSERT OR REPLACE INTO butler_messages (id, role, content, ts) VALUES (?, ?, ?, ?)",
    [input.id, input.role, input.content, input.ts]
  );
  scheduleSave();
}
function listButlerMessages() {
  return readRows$1(
    "SELECT id, role, content, ts FROM butler_messages ORDER BY ts ASC"
  );
}
function clearButlerMessages() {
  getMemoryDb().run("DELETE FROM butler_messages");
  scheduleSave();
}
function upsertButlerTask(task) {
  getMemoryDb().run(
    "INSERT OR REPLACE INTO butler_tasks (id, payload, updated_at) VALUES (?, ?, ?)",
    [task.id, JSON.stringify(task), (/* @__PURE__ */ new Date()).toISOString()]
  );
  scheduleSave();
}
function listButlerTasks() {
  const rows = readRows$1(
    "SELECT id, payload FROM butler_tasks ORDER BY updated_at DESC"
  );
  return rows.flatMap((row) => {
    try {
      const payload = JSON.parse(row.payload);
      return [{ id: row.id, payload }];
    } catch {
      return [];
    }
  });
}
function deleteButlerTasksByIds(taskIds) {
  if (taskIds.length === 0) return;
  const placeholders = taskIds.map(() => "?").join(", ");
  getMemoryDb().run(`DELETE FROM butler_tasks WHERE id IN (${placeholders})`, taskIds);
  scheduleSave();
}
function clearDailyProfiles() {
  getMemoryDb().run("DELETE FROM memory_daily_profiles");
  scheduleSave();
}
let memoryServiceStarted = false;
let unsubscribeTaskCompleted = null;
function extractTextContent$2(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter(
      (entry) => !!entry && typeof entry === "object"
    ).map((entry) => entry.type === "text" ? entry.text ?? "" : "").join("");
  }
  return "";
}
function parseCheckpointMessages(data) {
  const userMessages = [];
  const assistantMessages = [];
  const toolNames = [];
  const first = data[0];
  const messages2 = first?.checkpoint?.channel_values?.messages;
  if (!Array.isArray(messages2)) {
    return { userMessages, assistantMessages, toolNames };
  }
  for (const message of messages2) {
    const type = (typeof message._getType === "function" ? message._getType() : void 0) ?? message.type ?? "";
    const content = extractTextContent$2(message.kwargs?.content ?? message.content);
    if (type === "human" && content.trim()) {
      userMessages.push(content.trim());
    } else if (type === "ai" && content.trim()) {
      assistantMessages.push(content.trim());
    }
    const calls = message.kwargs?.tool_calls ?? message.tool_calls ?? [];
    for (const call of calls) {
      if (call?.name) {
        toolNames.push(call.name);
      }
    }
  }
  return { userMessages, assistantMessages, toolNames };
}
async function loadThreadProcess(threadId) {
  try {
    const checkpointer = await getCheckpointer(threadId);
    const list = [];
    for await (const checkpoint of checkpointer.list(
      { configurable: { thread_id: threadId } },
      { limit: 1 }
    )) {
      list.push(checkpoint);
    }
    return parseCheckpointMessages(list);
  } catch (error) {
    console.warn("[Memory] Failed to load checkpoint history:", error);
    return { userMessages: [], assistantMessages: [], toolNames: [] };
  }
}
async function recordTaskCompletionToMemory(payload) {
  const metadata = payload.metadata || {};
  if (metadata.butlerMain === true || payload.mode === "butler") {
    return;
  }
  const process2 = await loadThreadProcess(payload.threadId);
  const summary = summarizeTaskMemory({
    payload,
    userMessages: process2.userMessages,
    assistantMessages: process2.assistantMessages,
    toolNames: process2.toolNames
  });
  insertTaskSummary(summary);
}
async function initializeMemoryService() {
  if (memoryServiceStarted) return;
  await initializeMemoryDatabase();
  unsubscribeTaskCompleted = onTaskCompleted((payload) => {
    void recordTaskCompletionToMemory(payload);
  });
  memoryServiceStarted = true;
}
async function stopMemoryService() {
  if (unsubscribeTaskCompleted) {
    unsubscribeTaskCompleted();
    unsubscribeTaskCompleted = null;
  }
  memoryServiceStarted = false;
}
function searchMemoryByTask(query, limit = 20) {
  return searchTaskSummaries(query, limit);
}
function listConversationSummaries(limit = 200) {
  return listTaskSummaries(limit);
}
function listDailyProfiles(limit = 60) {
  return listDailyProfiles$1(limit);
}
function removeConversationMemoryByThread(threadId) {
  const normalized = threadId.trim();
  if (!normalized) return;
  deleteTaskSummariesByThread(normalized);
}
function clearAllMemory() {
  clearAllTaskSummaries();
  clearDailyProfiles();
  clearRunMarkers();
}
async function generateDailyProfileOnStartup(now = /* @__PURE__ */ new Date()) {
  const today = getTodayLocalDay(now);
  const runKey = `daily-profile:${today}`;
  if (hasRunMarker(runKey)) {
    return null;
  }
  const targetDay = getYesterdayLocalDay(now);
  const summaries = listTaskSummariesByDay(targetDay);
  const previous = getPreviousDailyProfile(targetDay);
  const input = buildDailyProfileInput({
    day: targetDay,
    summaries,
    previousProfileDay: previous?.day,
    previousProfileText: previous?.profileText
  });
  const profile = upsertDailyProfile(input);
  setRunMarker(runKey, profile.createdAt);
  return profile;
}
function getLatestDailyProfile() {
  const today = getTodayLocalDay(/* @__PURE__ */ new Date());
  return getDailyProfile(today) ?? getPreviousDailyProfile(today);
}
function loadButlerMessages() {
  return listButlerMessages();
}
function appendButlerHistoryMessage(message) {
  appendButlerMessage(message);
}
function clearButlerHistoryMessages() {
  clearButlerMessages();
}
function persistButlerTask(task) {
  upsertButlerTask(task);
}
function loadButlerTasks() {
  const rows = listButlerTasks();
  return rows.map((row) => row.payload);
}
function removeButlerTasks(taskIds) {
  deleteButlerTasksByIds(taskIds);
}
function compactList(values, limit = 6) {
  if (values.length === 0) return "none";
  const head = values.slice(0, limit).join(", ");
  if (values.length <= limit) return head;
  return `${head}, ... (+${values.length - limit})`;
}
function getButlerCapabilitySnapshot() {
  const tools2 = listTools().filter((item) => item.enabledButler && item.hasKey).map((item) => item.name);
  const mcpTools = listRunningMcpTools("butler").map((item) => item.fullName);
  const skills = listAppSkills({ scope: "butler" }).map((item) => item.name);
  const subagents = listSubagentsByScope("butler").map((item) => item.name);
  return {
    tools: tools2,
    mcpTools,
    skills,
    subagents
  };
}
function buildCapabilityPromptBlock(snapshot) {
  return [
    "[Butler Capability Catalog]",
    `tools: ${snapshot.tools.join(", ") || "none"}`,
    `mcp_tools: ${snapshot.mcpTools.join(", ") || "none"}`,
    `skills: ${snapshot.skills.join(", ") || "none"}`,
    `subagents: ${snapshot.subagents.join(", ") || "none"}`
  ].join("\n");
}
function buildCapabilitySummaryLine(snapshot) {
  return [
    "能力目录已同步",
    `Tools(${snapshot.tools.length}): ${compactList(snapshot.tools)}`,
    `MCP(${snapshot.mcpTools.length}): ${compactList(snapshot.mcpTools)}`,
    `Skills(${snapshot.skills.length}): ${compactList(snapshot.skills)}`,
    `Subagents(${snapshot.subagents.length}): ${compactList(snapshot.subagents)}`
  ].join(" | ");
}
const OVERSPLIT_CONFIDENCE_THRESHOLD = 0.6;
const detectorOutputSchema = object({
  verdict: _enum(["valid_multi", "suspected_oversplit"]),
  reason: string().trim().min(1),
  confidence: number().min(0).max(1)
});
function requireProviderState$1() {
  const state = getProviderState();
  if (!state) {
    throw new Error(
      "Provider not configured. Please configure Ollama, OpenAI-compatible, or Multimodal provider in Settings."
    );
  }
  return state;
}
function resolveProviderConfig$1(state, providerId) {
  const config2 = state.configs[providerId];
  if (!config2) {
    throw new Error(`Provider "${providerId}" not configured. Please configure it in Settings.`);
  }
  return config2;
}
function getModelInstance$1() {
  const state = requireProviderState$1();
  const config2 = resolveProviderConfig$1(state, state.active);
  if (!config2.model) {
    throw new Error("Active provider has no model configured.");
  }
  if (config2.type === "ollama") {
    const baseURL = config2.url.endsWith("/v1") ? config2.url : `${config2.url}/v1`;
    return new openai.ChatOpenAI({
      model: config2.model,
      configuration: { baseURL },
      apiKey: "ollama"
    });
  }
  return new openai.ChatOpenAI({
    model: config2.model,
    apiKey: config2.apiKey,
    configuration: { baseURL: config2.url }
  });
}
function extractTextContent$1(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((item) => !!item && typeof item === "object").map((item) => item.type === "text" ? item.text ?? "" : "").join("");
}
function parseJsonObject(text) {
  const raw = text.trim();
  if (!raw) {
    throw new Error("Detector returned empty response.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last < first) {
      throw new Error("Detector output contains no JSON object.");
    }
    return JSON.parse(raw.slice(first, last + 1));
  }
}
function formatIntents(intents) {
  if (intents.length === 0) return "none";
  return intents.map((intent, index2) => {
    const deps = intent.dependsOn.length > 0 ? intent.dependsOn.join(", ") : "none";
    return `${index2 + 1}. [${intent.mode}] ${intent.title} | taskKey=${intent.taskKey} | dependsOn=${deps}`;
  }).join("\n");
}
function normalizeDetectorVerdict(parsed) {
  const confidence = Math.max(0, Math.min(1, parsed.confidence));
  if (parsed.verdict === "suspected_oversplit" && confidence >= OVERSPLIT_CONFIDENCE_THRESHOLD) {
    return {
      verdict: "suspected_oversplit",
      reason: parsed.reason.trim(),
      confidence
    };
  }
  return {
    verdict: "valid_multi",
    reason: parsed.reason.trim(),
    confidence
  };
}
async function detectOversplitByModel(input) {
  try {
    const model = getModelInstance$1();
    const response = await model.invoke([
      new messages.SystemMessage(
        [
          "你是任务粒度判定器，只判断是否疑似过拆。",
          "判定标准：仅当多个任务在语义上彼此独立、可独立交付、失败互不影响时，才是 valid_multi。",
          "如果一个目标只是步骤链（如抓取->去重->发送），应判为 suspected_oversplit。",
          "必须输出 JSON，且仅输出 JSON：",
          '{"verdict":"valid_multi|suspected_oversplit","reason":"...","confidence":0-1}'
        ].join("\n")
      ),
      new messages.HumanMessage(
        [
          "[User Request]",
          input.userMessage.trim(),
          "",
          "[Candidate Plan]",
          formatIntents(input.intents),
          "",
          "[Task]",
          "判断该候选计划是否疑似过拆。confidence 表示你对该 verdict 的置信度。"
        ].join("\n")
      )
    ]);
    const rawText = extractTextContent$1(response.content);
    const parsedJson = parseJsonObject(rawText);
    const parsed = detectorOutputSchema.parse(parsedJson);
    return normalizeDetectorVerdict(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      verdict: "suspected_oversplit",
      reason: `粒度判定失败，按保守策略进入确认流程：${message}`,
      confidence: 1
    };
  }
}
function buildCapabilitiesSection() {
  return {
    id: "capabilities",
    build: ({ prompt }) => [
      "[Capability Summary]",
      prompt.capabilitySummary?.trim() || "none",
      "",
      prompt.capabilityCatalog?.trim() || "[Butler Capability Catalog]\nnone"
    ]
  };
}
function formatMemoryHints(memoryHints) {
  if (memoryHints.length === 0) {
    return "none";
  }
  return memoryHints.map((hint, index2) => {
    const title = hint.title ? ` (${hint.title})` : "";
    return `${index2 + 1}. ${hint.threadId}${title}: ${hint.summaryBrief}`;
  }).join("\n");
}
function formatRecentTasks(tasks) {
  if (tasks.length === 0) return "none";
  return tasks.map((task, index2) => {
    return `${index2 + 1}. [${task.mode}/${task.status}] ${task.title} | thread=${task.threadId} | createdAt=${task.createdAt}`;
  }).join("\n");
}
function buildMemorySection() {
  return {
    id: "memory",
    build: ({ prompt }) => [
      "[Memory Hints]",
      formatMemoryHints(prompt.memoryHints),
      "",
      "[Previous User Message]",
      prompt.previousUserMessage?.trim() || "none",
      "",
      "[Recent Butler Tasks]",
      formatRecentTasks(prompt.recentTasks),
      "",
      "[Daily Profile]",
      prompt.profileText?.trim() || "none",
      "",
      "[Profile Delta]",
      prompt.comparisonText?.trim() || "none"
    ]
  };
}
function formatDispatchPolicy(policy) {
  if (policy === "single_task_first") {
    return [
      "single_task_first",
      "默认将单一业务目标编排为 1 个任务；把步骤写入同一任务的 initialPrompt/loopConfig.contentTemplate。",
      "仅当存在两个及以上语义独立、可独立交付、失败互不影响的目标时，才允许拆分。"
    ];
  }
  return [
    "standard",
    "可创建多个任务，但只有在目标语义独立时才拆分；避免把同一目标的执行步骤拆成 DAG。"
  ];
}
function buildOverviewSection() {
  return {
    id: "overview",
    build: ({ prompt }) => [
      "[User Request]",
      prompt.userMessage.trim(),
      "",
      "[Planning Focus]",
      prompt.planningFocus || "normal",
      "",
      "[Dispatch Policy]",
      ...formatDispatchPolicy(prompt.dispatchPolicy)
    ]
  };
}
function buildRetrySection() {
  return {
    id: "retry",
    build: ({ prompt }) => {
      if (prompt.planningFocus !== "retry_reassign" || !prompt.retryContext) {
        return [];
      }
      const retry = prompt.retryContext;
      return [
        "[Retry Reassign Context]",
        `failed_task_title: ${retry.failedTaskTitle}`,
        `failed_task_mode: ${retry.failedTaskMode}`,
        `forced_mode: ${prompt.forcedMode ?? retry.failedTaskMode}`,
        "",
        "[Failed Task Prompt]",
        retry.failedTaskPrompt,
        "",
        "[Failure Error]",
        retry.failureError,
        "",
        "[Original User Request For Retry]",
        retry.originUserMessage,
        "",
        "[Retry Hard Constraints]",
        "- 只能创建 1 个任务。",
        "- mode 必须与 failed_task_mode 完全一致。",
        "- 新 initialPrompt 必须包含错误根因与修复动作，不得弱化用户原始约束。"
      ];
    }
  };
}
function buildRouterSection() {
  return {
    id: "router",
    build: ({ clarificationPrefix }) => [
      "[Router Instruction]",
      "Use semantic reasoning.",
      "If dispatch is feasible, call creation tools with valid JSON.",
      `If key information is missing, ask a focused follow-up prefixed with "${clarificationPrefix}".`
    ]
  };
}
const DEFAULT_SECTION_PIPELINE = [
  buildOverviewSection(),
  buildRetrySection(),
  buildMemorySection(),
  buildRouterSection(),
  buildCapabilitiesSection()
];
function trimTrailingEmptyLines(lines) {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") {
    end -= 1;
  }
  return lines.slice(0, end);
}
function composeButlerUserPrompt(prompt, options) {
  const sectionBuilders = options?.sections ?? DEFAULT_SECTION_PIPELINE;
  const context2 = {
    prompt,
    clarificationPrefix: options?.clarificationPrefix
  };
  const output = [];
  for (const section of sectionBuilders) {
    const sectionLines = trimTrailingEmptyLines(section.build(context2));
    if (sectionLines.length === 0) continue;
    if (output.length > 0) {
      output.push("");
    }
    output.push(...sectionLines);
  }
  return output.join("\n");
}
const CLARIFICATION_PREFIX = "CLARIFICATION_REQUIRED:";
function getClarificationPrefix() {
  return CLARIFICATION_PREFIX;
}
function formatPerceptionSnapshot(context2) {
  const snapshot = context2.perception.snapshot;
  const calendarLines = snapshot.calendarEvents.slice(0, 5).map((event, index2) => `${index2 + 1}. ${event.title} @ ${event.startAt}`);
  const countdownLines = snapshot.countdownTimers.slice(0, 5).map((timer, index2) => `${index2 + 1}. ${timer.title} @ ${timer.dueAt} (${timer.status})`);
  const mailLines = snapshot.recentMails.slice(0, 5).map(
    (mail, index2) => `${index2 + 1}. ${mail.subject || "(无主题)"} | from=${mail.from || "unknown"}`
  );
  return [
    "[Snapshot Summary]",
    `calendar_count=${snapshot.calendarEvents.length}`,
    `countdown_count=${snapshot.countdownTimers.length}`,
    `mail_rule_count=${snapshot.mailRules.length}`,
    `recent_mail_count=${snapshot.recentMails.length}`,
    "",
    "[Calendar Top 5]",
    calendarLines.length > 0 ? calendarLines.join("\n") : "none",
    "",
    "[Countdown Top 5]",
    countdownLines.length > 0 ? countdownLines.join("\n") : "none",
    "",
    "[Recent Mail Top 5]",
    mailLines.length > 0 ? mailLines.join("\n") : "none"
  ].join("\n");
}
function buildButlerSystemPrompt() {
  return `
你是 OpenAnyWork 的 Butler AI 编排器。
你是唯一的语义路由器，禁止使用关键词匹配策略。

核心目标：
1) 语义理解用户意图。
2) 决定以下其一：
   - 直接回复（不调用工具），
   - 澄清追问（不调用工具），
   - 派发一个或多个任务（调用工具）。
3) 派发时只能使用以下 4 个工具：
   - create_default_task
   - create_ralph_task
   - create_email_task
   - create_loop_task

工具用途说明：
- create_default_task：通用任务模式。适用于信息收集、内容生成、数据整理、问答等一般性任务。
  可选 deliverableFormat（"text" | "data" | "table" | "page"）指定输出格式。
  示例场景：汇总新闻、生成报告、整理资料、翻译文档等。
- create_ralph_task：迭代式开发/实现任务模式。及其复杂的任务，需要反复验证直到满足验收标准。
  必填 acceptanceCriteria（string[]）定义验收条件，可选 maxIterations（number，1-50）限制最大迭代次数。
  示例场景：实现功能模块、修复 Bug、重构代码等需要多轮迭代验证的开发任务，或者需要多角色讨论、研讨、明确问题。。
- create_email_task：邮件处理任务模式。这种模式下是可以通过邮件远程控制任务，例如停止、重启、发送新的命令，结果也可以发送等。
  必填 emailIntent（string）描述邮件意图，可选 recipientHints（string[]）提示收件人，可选 tone（string）指定语气风格。
  示例场景：客户不在电脑旁也可以完成任务。
- create_loop_task：周期/循环任务模式。适用于需要定时或基于事件触发反复执行的任务。
  必填 loopConfig，包含触发器配置，支持三种触发方式：
    - schedule：基于 cron 表达式定时触发。
    - api：定时轮询 API 并根据条件（equals/contains/truthy）判断是否执行。
    - file：监听文件系统变化触发。
  示例场景：定时发送日报、周期性监控服务状态、监听文件变更自动处理等。

每个工具都可以完成复杂任务，不要将一个复杂任务拆分成多个简单任务。除非是完全不相关的任务。

派发规则：
- 一轮对话中可以创建多个任务。
- 注意不要随意创建多个任务，上面所述4个任务都可以完成复杂的任务，不要将一个复杂任务拆分成多个简单任务。除非是完全不相关的任务。
  例如“周期性发送日报”，这种的就不需要拆分为多个任务，周期任务足够完成。
- [Dispatch Policy] 为 single_task_first 时，默认只创建 1 个任务，把检索/去重/发送等步骤写入该任务 prompt，不要拆成步骤 DAG。
- [Dispatch Policy] 为 single_task_first 时，仅允许在“用户请求中包含两个及以上语义独立目标”时拆分多任务。
- 反例（不要这样拆）：
  用户：“创建一个周期任务，每30分钟检索AI新闻，去重并记录到news_send.json，再发给jiafan@duck.com”
  错误拆分：抓新闻任务 + 去重任务 + 邮件任务 + 循环任务。
- 正例（应该这样做）：
  同一请求只创建 1 个 loop 任务，在 loopConfig.contentTemplate 中包含检索、去重记录、发送全流程。
- 每个任务都应该有明确的意图和目标。
- initialPrompt 必须完整保留用户关键约束（范围、时间、对象、格式、验收口径），不得弱化为更笼统描述。
- initialPrompt 必须可执行，至少包含：任务目标、执行约束、输出或验收标准。
- 使用 dependsOn 通过 taskKey 构建依赖图。
- 无依赖的任务可并行执行。
- 有依赖的任务必须通过 dependsOn 保证串行。
- 若输入中出现 [Retry Reassign Context]，你必须：
  - 只创建 1 个任务；
  - mode 必须与失败任务一致；
  - 在 initialPrompt 中显式吸收错误信息并给出修复策略。
- 如果关键信息缺失且无法生成有效的工具 JSON，则不要调用工具。
  以 "${CLARIFICATION_PREFIX}" 为前缀回复，仅询问关键问题。
- 如果能生成有效 JSON，优先派发，避免不必要的追问。

Thread strategy：
- "reuse_last_thread"：继续该 mode 下最近的相关线程。
- "new_thread"：创建新线程。

Handoff：
- method "context"：上游摘要传入下游 prompt。
- method "filesystem"：下游工作区接收 .butler_handoff.json。
- method "both"：同时使用以上两种机制。

JSON 字段约定（所有工具通用）：
- taskKey：本轮唯一标识。
- title：面向用户的任务标题。
- initialPrompt：传给 worker 线程的可执行 prompt。
- threadStrategy："new_thread" | "reuse_last_thread"。
- dependsOn：taskKey[]（可选）。
- handoff：{ method, note?, requiredArtifacts? }（可选）。

Mode 要求：
- default：deliverableFormat?（"text" | "data" | "table" | "page"）
- ralph：acceptanceCriteria（string[]，必填），maxIterations?（number）
- email：emailIntent（必填），recipientHints?（string[]），tone?（string）
- loop：loopConfig（必填且可执行）

输出规则：
- 调用工具后，为用户提供简洁的中文摘要。
- 禁止提及内部隐藏的思维链。
- 禁止在此编排器中直接调用任何业务工具。
`.trim();
}
function buildButlerPerceptionSystemPrompt() {
  return `
你是 OpenAnyWork 的 Butler 事件提醒助手。

目标：
1) 根据输入的监听事件（日历/倒计时/邮件）生成简洁中文提醒。
2) 不要调用任何工具，不要派发任务。
3) 仅输出提醒正文，不要输出 JSON、代码块、前后缀解释。

要求：
- 优先说明“发生了什么”“用户现在应做什么”。
- 1 到 3 句话，控制在 120 字内。
- 语气明确，不夸张。
`.trim();
}
function buildButlerPerceptionUserPrompt(context2) {
  const perception = context2.perception;
  return [
    "[Triggered Event]",
    `id: ${perception.id}`,
    `kind: ${perception.kind}`,
    `triggeredAt: ${perception.triggeredAt}`,
    `title: ${perception.title}`,
    `detail: ${perception.detail || "none"}`,
    "",
    "[Payload]",
    JSON.stringify(perception.payload, null, 2),
    "",
    formatPerceptionSnapshot(context2),
    "",
    "[Instruction]",
    "请直接输出提醒正文。"
  ].join("\n");
}
function parseButlerAssistantText(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { assistantText: "", clarification: false };
  }
  if (trimmed.startsWith(CLARIFICATION_PREFIX)) {
    const stripped = trimmed.slice(CLARIFICATION_PREFIX.length).trim();
    return {
      assistantText: stripped || "请补充关键信息。",
      clarification: true
    };
  }
  return {
    assistantText: trimmed,
    clarification: false
  };
}
const commonFieldsSchema = object({
  taskKey: string().trim().min(1).regex(/^[a-zA-Z0-9_-]+$/, "taskKey must be alphanumeric/underscore/hyphen"),
  title: string().trim().min(1),
  initialPrompt: string().trim().min(1),
  threadStrategy: _enum(["new_thread", "reuse_last_thread"]),
  dependsOn: array(string().trim().min(1)).optional().default([]),
  handoff: object({
    method: _enum(["context", "filesystem", "both"]),
    note: string().trim().optional(),
    requiredArtifacts: array(string().trim().min(1)).optional()
  }).optional()
});
const defaultTaskSchema = commonFieldsSchema.extend({
  deliverableFormat: _enum(["text", "data", "table", "page"]).optional()
});
const ralphTaskSchema = commonFieldsSchema.extend({
  acceptanceCriteria: array(string().trim().min(1)).min(1),
  maxIterations: number().int().min(1).max(50).optional()
});
const emailTaskSchema = commonFieldsSchema.extend({
  emailIntent: string().trim().min(1),
  recipientHints: array(string().trim().min(1)).optional(),
  tone: string().trim().optional()
});
const loopTriggerScheduleSchema = object({
  type: literal("schedule"),
  cron: string().trim().min(1)
});
const loopTriggerApiSchema = object({
  type: literal("api"),
  cron: string().trim().min(1),
  url: string().url(),
  method: _enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  headers: record(string(), string()).optional(),
  bodyJson: record(string(), unknown()).nullable().optional(),
  jsonPath: string().trim().min(1),
  op: _enum(["equals", "contains", "truthy"]),
  expected: string().optional(),
  timeoutMs: number().int().positive().optional()
});
const loopTriggerFileSchema = object({
  type: literal("file"),
  watchPath: string().trim().min(1),
  suffixes: array(string().trim().min(1)).optional(),
  previewMaxLines: number().int().positive(),
  previewMaxBytes: number().int().positive()
});
const loopConfigSchema = object({
  enabled: boolean(),
  contentTemplate: string().trim().min(1),
  trigger: union([loopTriggerScheduleSchema, loopTriggerApiSchema, loopTriggerFileSchema]),
  queue: object({
    policy: literal("strict"),
    mergeWindowSec: number().int().positive()
  }),
  lastRunAt: string().optional(),
  lastError: string().nullable().optional(),
  nextRunAt: string().nullable().optional()
});
const loopTaskSchema = commonFieldsSchema.extend({
  loopConfig: loopConfigSchema
});
function normalizeCommon(input) {
  return {
    taskKey: input.taskKey.trim(),
    title: input.title.trim(),
    initialPrompt: input.initialPrompt.trim(),
    threadStrategy: input.threadStrategy,
    dependsOn: input.dependsOn ?? [],
    handoff: input.handoff ? {
      method: input.handoff.method,
      note: input.handoff.note?.trim() || void 0,
      requiredArtifacts: input.handoff.requiredArtifacts?.map((entry) => entry.trim())
    } : void 0
  };
}
function buildDescription(mode) {
  const example = mode === "default" ? `{"taskKey":"news_1","title":"AI新闻汇总","initialPrompt":"[Task Objective]\\n汇总今天 AI 大模型新闻并形成结构化摘要。\\n\\n[Execution Requirements]\\n1) 覆盖主流来源并去重。\\n2) 记录时间、来源与核心结论。\\n3) 禁止编造事实。\\n\\n[Output & Acceptance]\\n- 输出 Markdown 表格，至少包含标题/来源/时间/要点。","threadStrategy":"new_thread","deliverableFormat":"table"}` : mode === "ralph" ? `{"taskKey":"impl_1","title":"实现任务","initialPrompt":"[Task Objective]\\n实现需求并修复相关缺陷。\\n\\n[Execution Requirements]\\n1) 修改代码并补齐关键测试。\\n2) 记录主要设计取舍。\\n3) 不破坏现有行为。\\n\\n[Output & Acceptance]\\n- 提供变更说明与验证结果。","threadStrategy":"new_thread","acceptanceCriteria":["类型检查通过","核心功能可用"],"maxIterations":5}` : mode === "email" ? `{"taskKey":"mail_1","title":"邮件处理","initialPrompt":"[Task Objective]\\n生成可直接发送的客户回复邮件。\\n\\n[Execution Requirements]\\n1) 回应用户问题并给出下一步。\\n2) 语气专业且简洁。\\n3) 若信息不足先列出待确认点。\\n\\n[Output & Acceptance]\\n- 产出完整邮件正文和主题建议。","threadStrategy":"reuse_last_thread","emailIntent":"reply_to_customer","recipientHints":["alice@example.com"],"tone":"professional"}` : `{"taskKey":"loop_1","title":"循环任务","initialPrompt":"[Task Objective]\\n建立稳定的周期监控任务。\\n\\n[Execution Requirements]\\n1) 每次触发都执行完整处理流程。\\n2) 失败要记录错误并继续下一轮。\\n\\n[Output & Acceptance]\\n- 触发后可产出可审计结果。","threadStrategy":"new_thread","loopConfig":{"enabled":true,"contentTemplate":"检索 AI 新闻，去重后写入 news_send.json，并发送给指定邮箱","trigger":{"type":"schedule","cron":"*/5 * * * *"},"queue":{"policy":"strict","mergeWindowSec":300}}}`;
  return [
    `Create a ${mode} mode task for Butler.`,
    "Use valid JSON only. taskKey must be unique within this turn.",
    "dependsOn references other taskKey values in the same turn.",
    "initialPrompt must preserve user constraints and stay executable.",
    "initialPrompt must include objective, execution requirements, and output/acceptance criteria.",
    `Example: ${example}`
  ].join(" ");
}
function createButlerDispatchTools(params) {
  const { onIntent } = params;
  const createDefaultTask = tools.tool(
    async (input) => {
      const common = normalizeCommon(input);
      onIntent({
        ...common,
        mode: "default",
        deliverableFormat: input.deliverableFormat
      });
      return { ok: true, mode: "default", taskKey: common.taskKey };
    },
    {
      name: "create_default_task",
      description: buildDescription("default"),
      schema: defaultTaskSchema
    }
  );
  const createRalphTask = tools.tool(
    async (input) => {
      const common = normalizeCommon(input);
      onIntent({
        ...common,
        mode: "ralph",
        acceptanceCriteria: input.acceptanceCriteria.map((entry) => entry.trim()),
        maxIterations: input.maxIterations
      });
      return { ok: true, mode: "ralph", taskKey: common.taskKey };
    },
    {
      name: "create_ralph_task",
      description: buildDescription("ralph"),
      schema: ralphTaskSchema
    }
  );
  const createEmailTask = tools.tool(
    async (input) => {
      const common = normalizeCommon(input);
      onIntent({
        ...common,
        mode: "email",
        emailIntent: input.emailIntent.trim(),
        recipientHints: input.recipientHints?.map((entry) => entry.trim()),
        tone: input.tone?.trim()
      });
      return { ok: true, mode: "email", taskKey: common.taskKey };
    },
    {
      name: "create_email_task",
      description: buildDescription("email"),
      schema: emailTaskSchema
    }
  );
  const createLoopTask = tools.tool(
    async (input) => {
      const common = normalizeCommon(input);
      onIntent({
        ...common,
        mode: "loop",
        loopConfig: input.loopConfig
      });
      return { ok: true, mode: "loop", taskKey: common.taskKey };
    },
    {
      name: "create_loop_task",
      description: buildDescription("loop"),
      schema: loopTaskSchema
    }
  );
  return [createDefaultTask, createRalphTask, createEmailTask, createLoopTask];
}
function normalizeOriginUserMessage(originUserMessage) {
  const trimmed = originUserMessage.trim();
  return trimmed || "none";
}
function buildOutputAcceptance(intent) {
  if (intent.mode === "default") {
    const formatLine = intent.deliverableFormat ? `- 输出格式: ${intent.deliverableFormat}` : "- 输出格式: text（默认）";
    return [formatLine, "- 输出必须可直接交付，且覆盖用户关键约束。"].join("\n");
  }
  if (intent.mode === "ralph") {
    return [
      "- 必须满足全部 Acceptance Criteria。",
      "- 给出验证过程与最终结论。",
      intent.maxIterations ? `- 最大迭代轮数: ${intent.maxIterations}` : "- 最大迭代轮数: 按系统默认。"
    ].join("\n");
  }
  if (intent.mode === "email") {
    return ["- 产出可直接发送的邮件内容。", "- 明确邮件目标、对象、语气并避免遗漏关键信息。"].join(
      "\n"
    );
  }
  return [
    "- loopConfig 是执行事实来源，触发与队列策略必须严格遵守。",
    "- 每次触发需输出可审计结果或错误摘要。"
  ].join("\n");
}
function renderTaskPrompt(intent, context2) {
  const sections = [
    `[Original User Request]
${normalizeOriginUserMessage(context2.originUserMessage)}`,
    `[Task Objective]
${intent.title}`,
    `[Execution Requirements]
${intent.initialPrompt}`,
    `[Output & Acceptance]
${buildOutputAcceptance(intent)}`
  ];
  if (intent.mode === "default" && intent.deliverableFormat) {
    sections.push(`[Deliverable Format]
${intent.deliverableFormat}`);
  }
  if (intent.mode === "ralph") {
    sections.push(`[Acceptance Criteria]
- ${intent.acceptanceCriteria.join("\n- ")}`);
    if (intent.maxIterations) {
      sections.push(`[Max Iterations]
${intent.maxIterations}`);
    }
  }
  if (intent.mode === "email") {
    sections.push(`[Email Intent]
${intent.emailIntent}`);
    if (intent.recipientHints && intent.recipientHints.length > 0) {
      sections.push(`[Recipient Hints]
- ${intent.recipientHints.join("\n- ")}`);
    }
    if (intent.tone) {
      sections.push(`[Tone]
${intent.tone}`);
    }
  }
  if (intent.mode === "loop") {
    sections.push(`[Loop Behavior]
Use provided loopConfig as execution source of truth.`);
  }
  return sections.join("\n\n");
}
const DAILY_PROFILE_MARKER = "[Daily Profile]";
const PROFILE_DELTA_MARKER = "[Profile Delta]";
function requireProviderState() {
  const state = getProviderState();
  if (!state) {
    throw new Error(
      "Provider not configured. Please configure Ollama, OpenAI-compatible, or Multimodal provider in Settings."
    );
  }
  return state;
}
function resolveProviderConfig(state, providerId) {
  const config2 = state.configs[providerId];
  if (!config2) {
    throw new Error(`Provider "${providerId}" not configured. Please configure it in Settings.`);
  }
  return config2;
}
function getModelInstance() {
  const state = requireProviderState();
  const config2 = resolveProviderConfig(state, state.active);
  if (!config2.model) {
    throw new Error("Active provider has no model configured.");
  }
  if (config2.type === "ollama") {
    const baseURL = config2.url.endsWith("/v1") ? config2.url : `${config2.url}/v1`;
    return new openai.ChatOpenAI({
      model: config2.model,
      configuration: { baseURL },
      apiKey: "ollama"
    });
  }
  return new openai.ChatOpenAI({
    model: config2.model,
    apiKey: config2.apiKey,
    configuration: { baseURL: config2.url }
  });
}
async function createButlerRuntime(params) {
  const model = getModelInstance();
  const checkpointer = await getCheckpointer(params.threadId);
  const backend = new LocalSandbox({
    rootDir: getOpenworkDir(),
    virtualMode: false,
    timeout: 6e4,
    maxOutputBytes: 5e4
  });
  const tools2 = createButlerDispatchTools({ onIntent: params.onIntent });
  return deepagents.createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt: buildButlerSystemPrompt(),
    tools: tools2,
    subagents: [],
    skills: []
  });
}
async function runButlerOrchestratorTurn(input) {
  const intents = [];
  const agent = await createButlerRuntime({
    threadId: input.threadId,
    onIntent: (intent) => {
      intents.push(intent);
    }
  });
  let userPrompt = composeButlerUserPrompt(
    {
      ...input.promptContext,
      dispatchPolicy: input.promptContext.dispatchPolicy ?? "standard",
      planningFocus: input.promptContext.planningFocus ?? "normal"
    },
    {
      clarificationPrefix: getClarificationPrefix()
    }
  );
  if (!userPrompt.includes(DAILY_PROFILE_MARKER)) {
    console.warn("[Butler] Missing [Daily Profile] in user prompt, injecting fallback section.");
    userPrompt = [
      userPrompt,
      "",
      DAILY_PROFILE_MARKER,
      input.promptContext.profileText?.trim() || "none"
    ].join("\n");
  }
  if (!userPrompt.includes(PROFILE_DELTA_MARKER)) {
    console.warn("[Butler] Missing [Profile Delta] in user prompt, injecting fallback section.");
    userPrompt = [
      userPrompt,
      "",
      PROFILE_DELTA_MARKER,
      input.promptContext.comparisonText?.trim() || "none"
    ].join("\n");
  }
  const stream2 = await agent.stream(
    { messages: [new messages.HumanMessage(userPrompt)] },
    {
      configurable: { thread_id: input.threadId },
      streamMode: ["messages", "values"],
      recursionLimit: 250
    }
  );
  let lastAssistant = "";
  for await (const chunk of stream2) {
    const [mode, data] = chunk;
    if (mode !== "messages") continue;
    const tuple = data;
    const content = tuple?.[0]?.kwargs?.content;
    if (typeof content === "string" && content.trim()) {
      lastAssistant = content;
    } else if (Array.isArray(content)) {
      const text = content.filter(
        (item) => !!item && typeof item === "object"
      ).map((item) => item.type === "text" ? item.text ?? "" : "").join("");
      if (text.trim()) {
        lastAssistant = text;
      }
    }
  }
  const parsed = parseButlerAssistantText(lastAssistant);
  const assistantText = parsed.assistantText || (intents.length > 0 ? "已完成任务编排并开始执行。" : "已记录。");
  return {
    assistantText,
    dispatchIntents: intents,
    clarification: parsed.clarification
  };
}
function extractTextContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.filter(
      (item) => !!item && typeof item === "object" && item.type === "text"
    ).map((item) => item.text?.trim() || "").filter(Boolean).join("").trim();
  }
  return "";
}
async function runButlerPerceptionTurn(input) {
  const model = getModelInstance();
  const systemPrompt = buildButlerPerceptionSystemPrompt();
  const userPrompt = buildButlerPerceptionUserPrompt({
    perception: input.perception
  });
  const result = await model.invoke([new messages.SystemMessage(systemPrompt), new messages.HumanMessage(userPrompt)]);
  const reminderText = extractTextContent(result.content);
  return {
    reminderText: reminderText || "检测到新的监听事件，请及时处理。"
  };
}
function createButlerTaskFolder(rootPath, mode) {
  const now = /* @__PURE__ */ new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const shortCode = crypto.randomBytes(3).toString("hex");
  const folderName = `${day}_${mode}_${shortCode}`;
  const fullPath = path.join(rootPath, folderName);
  fs.mkdirSync(fullPath, { recursive: true });
  return fullPath;
}
function parseMetadata$1(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function createButlerTaskThread(input) {
  const taskId = uuid$1.v4();
  const workspacePath = createButlerTaskFolder(input.rootPath, input.mode);
  const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
  const threadId = input.reuseThreadId || uuid$1.v4();
  const metadataBase = input.reuseThreadId ? parseMetadata$1(getThread(threadId)?.metadata ?? null) : {};
  const metadata = {
    ...metadataBase,
    mode: input.mode,
    workspacePath,
    createdBy: "butler",
    butlerTaskId: taskId,
    nonInterruptible: true,
    disableApprovals: true
  };
  if (input.mode === "ralph") {
    metadata.ralph = { phase: "init", iterations: 0 };
  }
  if (input.mode === "loop" && input.loopConfig) {
    metadata.loop = input.loopConfig;
  }
  if (input.reuseThreadId) {
    updateThread(threadId, { metadata: JSON.stringify(metadata) });
  } else {
    createThread(threadId, metadata);
    updateThread(threadId, { title: input.title, metadata: JSON.stringify(metadata) });
  }
  broadcastThreadsChanged();
  return {
    id: taskId,
    threadId,
    mode: input.mode,
    title: input.title,
    prompt: input.prompt,
    workspacePath,
    createdAt: nowIso2,
    status: "queued",
    requester: input.requester,
    loopConfig: input.loopConfig,
    groupId: input.groupId,
    taskKey: input.taskKey,
    dependsOnTaskIds: input.dependsOnTaskIds,
    handoff: input.handoff,
    sourceTurnId: input.sourceTurnId,
    originUserMessage: input.originUserMessage,
    retryOfTaskId: input.retryOfTaskId,
    retryAttempt: input.retryAttempt
  };
}
async function executeButlerTask(task) {
  try {
    if (task.mode === "loop") {
      const resolvedLoopConfig = task.loopConfig ?? {
        enabled: true,
        contentTemplate: task.prompt,
        trigger: { type: "schedule", cron: "*/5 * * * *" },
        queue: { policy: "strict", mergeWindowSec: 300 },
        lastError: null
      };
      loopManager.updateConfig(task.threadId, resolvedLoopConfig);
      loopManager.start(task.threadId);
      const result2 = "Loop task started and will run according to schedule.";
      emitTaskCompleted({
        threadId: task.threadId,
        result: result2,
        source: "butler"
      });
      return { result: result2 };
    }
    const window = getPreferredMainWindow();
    if (!window) {
      throw new Error("No active window available for task execution.");
    }
    await ensureDockerRunning();
    const dockerRuntime = getDockerRuntimeConfig();
    const dockerConfig = dockerRuntime.config ?? void 0;
    const dockerContainerId = dockerRuntime.containerId ?? void 0;
    const abortController = new AbortController();
    const channel = `agent:stream:${task.threadId}`;
    const result = await runAgentStream({
      threadId: task.threadId,
      workspacePath: task.workspacePath,
      dockerConfig,
      dockerContainerId,
      capabilityScope: "butler",
      disableApprovals: true,
      threadMode: task.mode,
      message: task.prompt,
      window,
      channel,
      abortController,
      ...task.mode === "email" ? {
        forceToolNames: ["send_email"]
      } : {}
    });
    emitTaskCompleted({
      threadId: task.threadId,
      result,
      source: "butler"
    });
    return { result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitTaskCompleted({
      threadId: task.threadId,
      error: message,
      source: "butler"
    });
    return { error: message };
  }
}
const TASK_NOTICE_MARKER = "[TASK_NOTICE_JSON]";
function nowIso$1() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseMetadata(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function extractRecentRounds(messages2, limit) {
  const rounds = [];
  let currentUser = null;
  for (const message of messages2) {
    if (message.role === "user") {
      if (currentUser) {
        rounds.push({
          id: `${currentUser.id}:pending`,
          user: currentUser.content,
          assistant: "",
          ts: currentUser.ts
        });
      }
      currentUser = message;
      continue;
    }
    if (message.role === "assistant" && currentUser) {
      rounds.push({
        id: `${currentUser.id}:${message.id}`,
        user: currentUser.content,
        assistant: message.content,
        ts: message.ts
      });
      currentUser = null;
      continue;
    }
    if (message.role === "assistant") {
      rounds.push({
        id: `notice:${message.id}`,
        user: "[系统通知]",
        assistant: message.content,
        ts: message.ts
      });
    }
  }
  if (currentUser) {
    rounds.push({
      id: `${currentUser.id}:pending`,
      user: currentUser.content,
      assistant: "",
      ts: currentUser.ts
    });
  }
  return rounds.slice(-limit);
}
function broadcast(channel, payload) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}
class ButlerManager {
  initialized = false;
  mainThreadId = "";
  messages = [];
  tasks = /* @__PURE__ */ new Map();
  queue = [];
  running = /* @__PURE__ */ new Set();
  runningThreadIds = /* @__PURE__ */ new Set();
  dependencyChildren = /* @__PURE__ */ new Map();
  unresolvedDeps = /* @__PURE__ */ new Map();
  pendingDispatchChoice = null;
  queuedDispatchChoices = [];
  taskCompletionUnsubscribe = null;
  perceptionQueue = [];
  perceptionQueueRunning = false;
  async initialize() {
    if (this.initialized) return;
    this.mainThreadId = this.ensureMainThread();
    const existingThreadIds = new Set(getAllThreads().map((row) => row.thread_id));
    this.messages = loadButlerMessages().map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      ts: entry.ts
    }));
    const orphanTaskIds = [];
    for (const task of loadButlerTasks()) {
      if (!existingThreadIds.has(task.threadId)) {
        orphanTaskIds.push(task.id);
        continue;
      }
      if (task.status === "running" || task.status === "queued") {
        task.status = "failed";
        task.completedAt = nowIso$1();
        task.resultBrief = task.resultBrief || "任务在应用重启后中断。";
        task.resultDetail = task.resultDetail || task.resultBrief;
        persistButlerTask(task);
      }
      this.tasks.set(task.id, task);
    }
    if (orphanTaskIds.length > 0) {
      removeButlerTasks(orphanTaskIds);
    }
    this.taskCompletionUnsubscribe = onTaskCompleted((payload) => {
      this.handleTaskCompleted(payload);
    });
    this.initialized = true;
    this.broadcastState();
    this.broadcastTasks();
  }
  shutdown() {
    if (this.taskCompletionUnsubscribe) {
      this.taskCompletionUnsubscribe();
      this.taskCompletionUnsubscribe = null;
    }
    this.initialized = false;
  }
  getState() {
    const recentRounds = extractRecentRounds(this.messages, this.getRecentRoundLimit());
    return {
      mainThreadId: this.mainThreadId,
      recentRounds,
      totalMessageCount: this.messages.length,
      activeTaskCount: Array.from(this.tasks.values()).filter(
        (task) => task.status === "queued" || task.status === "running"
      ).length,
      pendingDispatchChoice: this.pendingDispatchChoice ? {
        id: this.pendingDispatchChoice.id,
        awaiting: true,
        createdAt: this.pendingDispatchChoice.createdAt,
        kind: this.pendingDispatchChoice.kind,
        expectedResponse: this.pendingDispatchChoice.expectedResponse,
        hint: this.pendingDispatchChoice.hint
      } : void 0
    };
  }
  listTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async clearHistory() {
    await this.initialize();
    this.messages = [];
    this.pendingDispatchChoice = null;
    this.queuedDispatchChoices = [];
    clearButlerHistoryMessages();
    this.broadcastState();
    return this.getState();
  }
  async clearTasks() {
    await this.initialize();
    const removableIds = Array.from(this.tasks.values()).filter((task) => task.status !== "queued" && task.status !== "running").map((task) => task.id);
    return this.removeTaskRecords(removableIds);
  }
  async removeTasksByThreadId(threadId) {
    await this.initialize();
    const normalized = threadId.trim();
    if (!normalized) return this.listTasks();
    const removableIds = Array.from(this.tasks.values()).filter((task) => task.threadId === normalized).map((task) => task.id);
    return this.removeTaskRecords(removableIds);
  }
  removeTaskRecords(taskIds) {
    const removableIds = Array.from(new Set(taskIds.filter((taskId) => taskId.trim().length > 0)));
    if (removableIds.length === 0) {
      return this.listTasks();
    }
    const removableIdSet = new Set(removableIds);
    for (const taskId of removableIds) {
      const task = this.tasks.get(taskId);
      this.tasks.delete(taskId);
      this.unresolvedDeps.delete(taskId);
      this.dependencyChildren.delete(taskId);
      this.running.delete(taskId);
      if (task?.threadId) {
        this.runningThreadIds.delete(task.threadId);
      }
    }
    this.queue = this.queue.filter((pending) => !removableIdSet.has(pending.taskId));
    for (const unresolved of this.unresolvedDeps.values()) {
      for (const taskId of removableIds) {
        unresolved.delete(taskId);
      }
    }
    for (const children of this.dependencyChildren.values()) {
      for (const taskId of removableIds) {
        children.delete(taskId);
      }
    }
    removeButlerTasks(removableIds);
    this.broadcastTasks();
    this.broadcastState();
    return this.listTasks();
  }
  notifyCompletionNotice(notice) {
    const content = [
      `任务完成通知：${notice.title}`,
      `模式: ${notice.mode} | 来源: ${notice.source}`,
      `线程: ${notice.threadId}`,
      `摘要: ${notice.resultBrief || "任务已完成。"}`,
      `${TASK_NOTICE_MARKER}${JSON.stringify(notice)}`
    ].join("\n");
    this.pushMessage({
      id: uuid$1.v4(),
      role: "assistant",
      content,
      ts: nowIso$1()
    });
    this.broadcastState();
  }
  notifyLifecycleNotice(notice) {
    if (notice.phase === "completed") {
      this.notifyCompletionNotice({
        id: notice.id,
        threadId: notice.threadId,
        title: notice.title,
        resultBrief: notice.resultBrief || "任务已完成。",
        resultDetail: notice.resultDetail || notice.resultBrief || "任务已完成。",
        completedAt: notice.at,
        mode: notice.mode,
        source: notice.source,
        noticeType: "task"
      });
      return;
    }
    const content = [
      `任务启动通知：${notice.title}`,
      `模式: ${notice.mode} | 来源: ${notice.source}`,
      `线程: ${notice.threadId}`,
      `摘要: ${notice.resultBrief || "任务已开始执行。"}`
    ].join("\n");
    this.pushMessage({
      id: uuid$1.v4(),
      role: "assistant",
      content,
      ts: nowIso$1()
    });
    this.broadcastState();
  }
  async ingestPerception(input) {
    await this.initialize();
    return new Promise((resolve) => {
      this.perceptionQueue.push({ input, resolve });
      void this.pumpPerceptionQueue();
    });
  }
  async pumpPerceptionQueue() {
    if (this.perceptionQueueRunning) return;
    this.perceptionQueueRunning = true;
    try {
      while (this.perceptionQueue.length > 0) {
        const job = this.perceptionQueue.shift();
        if (!job) break;
        const notice = await this.processPerception(job.input);
        job.resolve(notice);
      }
    } finally {
      this.perceptionQueueRunning = false;
    }
  }
  async processPerception(input) {
    let reminderText = "";
    try {
      const result = await runButlerPerceptionTurn({
        threadId: this.mainThreadId,
        perception: input
      });
      reminderText = result.reminderText.trim();
    } catch (error) {
      console.warn("[Butler] runButlerPerceptionTurn failed:", error);
    }
    const finalReminder = reminderText || this.buildPerceptionFallbackText(input);
    const completedAt = nowIso$1();
    const notice = {
      id: `event:${input.id}:${completedAt}`,
      threadId: this.mainThreadId,
      title: input.title,
      resultBrief: finalReminder,
      resultDetail: this.buildPerceptionResultDetail(input, finalReminder),
      completedAt,
      mode: "butler",
      source: "butler",
      noticeType: "event",
      eventKind: input.kind
    };
    const content = [
      `事件提醒：${notice.title}`,
      `类型: ${input.kind}`,
      `摘要: ${notice.resultBrief}`,
      `${TASK_NOTICE_MARKER}${JSON.stringify(notice)}`
    ].join("\n");
    this.pushMessage({
      id: uuid$1.v4(),
      role: "assistant",
      content,
      ts: completedAt
    });
    this.broadcastState();
    return notice;
  }
  buildPerceptionFallbackText(input) {
    if (input.kind === "calendar_due_soon") {
      return `你有一个日历事件将在 2 小时内开始：${input.title}。`;
    }
    if (input.kind === "countdown_due") {
      return `倒计时已到点：${input.title}。`;
    }
    if (input.kind === "mail_new") {
      return `收到一封新的邮件，请及时查看：${input.title}。`;
    }
    return `检测到新的监听事件：${input.title}。`;
  }
  buildPerceptionResultDetail(input, reminder) {
    const snapshot = input.snapshot;
    return [
      `提醒: ${reminder}`,
      `事件类型: ${input.kind}`,
      `触发时间: ${input.triggeredAt}`,
      `事件详情: ${input.detail || "none"}`,
      `[快照统计]`,
      `日历事件: ${snapshot.calendarEvents.length}`,
      `倒计时: ${snapshot.countdownTimers.length}`,
      `邮件规则: ${snapshot.mailRules.length}`,
      `最近邮件: ${snapshot.recentMails.length}`
    ].join("\n");
  }
  getCapabilityContext() {
    const capabilitySnapshot = getButlerCapabilitySnapshot();
    return {
      capabilityCatalog: buildCapabilityPromptBlock(capabilitySnapshot),
      capabilitySummary: buildCapabilitySummaryLine(capabilitySnapshot)
    };
  }
  normalizeOriginUserMessage(message) {
    const normalized = message.trim();
    return normalized || "none";
  }
  buildPromptContextBase(params) {
    const { userMessage, capabilityCatalog, capabilitySummary, currentUserMessageId } = params;
    const profile = getLatestDailyProfile();
    const previousUserMessage = currentUserMessageId ? this.findPreviousUserMessage(currentUserMessageId)?.content : this.findLatestUserMessage()?.content;
    const memoryHints = searchMemoryByTask(userMessage, 5);
    const recentTasks = this.listTasks().slice(0, 10).map((task) => ({
      id: task.id,
      title: task.title,
      mode: task.mode,
      status: task.status,
      threadId: task.threadId,
      createdAt: task.createdAt
    }));
    return {
      userMessage,
      capabilityCatalog,
      capabilitySummary,
      profileText: profile?.profileText,
      comparisonText: profile?.comparisonText,
      previousUserMessage,
      memoryHints: memoryHints.map((item) => ({
        threadId: item.threadId,
        title: item.title,
        summaryBrief: item.summaryBrief
      })),
      recentTasks
    };
  }
  async send(message) {
    await this.initialize();
    const trimmed = message.trim();
    if (!trimmed) return this.getState();
    const userMessage = {
      id: uuid$1.v4(),
      role: "user",
      content: trimmed,
      ts: nowIso$1()
    };
    this.pushMessage(userMessage);
    if (this.pendingDispatchChoice) {
      return this.handlePendingDispatchChoice(trimmed);
    }
    const { capabilityCatalog, capabilitySummary } = this.getCapabilityContext();
    const promptContextBase = this.buildPromptContextBase({
      userMessage: trimmed,
      capabilityCatalog,
      capabilitySummary,
      currentUserMessageId: userMessage.id
    });
    const creation = {
      originUserMessage: this.normalizeOriginUserMessage(trimmed)
    };
    const orchestrator = await runButlerOrchestratorTurn({
      threadId: this.mainThreadId,
      promptContext: {
        ...promptContextBase,
        dispatchPolicy: "standard"
      }
    });
    if (orchestrator.dispatchIntents.length === 0) {
      this.pushMessage({
        id: uuid$1.v4(),
        role: "assistant",
        content: orchestrator.assistantText || (orchestrator.clarification ? "请补充关键信息。" : "已记录。"),
        ts: nowIso$1()
      });
      this.broadcastState();
      return this.getState();
    }
    if (orchestrator.dispatchIntents.length <= 1) {
      return this.dispatchIntentsAndReply({
        intents: orchestrator.dispatchIntents,
        assistantText: orchestrator.assistantText || "已完成任务编排并开始执行。",
        capabilitySummary,
        creation
      });
    }
    const detection = await detectOversplitByModel({
      userMessage: trimmed,
      intents: orchestrator.dispatchIntents
    });
    if (detection.verdict === "valid_multi") {
      return this.dispatchIntentsAndReply({
        intents: orchestrator.dispatchIntents,
        assistantText: orchestrator.assistantText || "已完成任务编排并开始执行。",
        capabilitySummary,
        creation
      });
    }
    let optionA;
    try {
      const replanned = await runButlerOrchestratorTurn({
        threadId: this.mainThreadId,
        promptContext: {
          ...promptContextBase,
          dispatchPolicy: "single_task_first"
        }
      });
      const canUseReplan = replanned.dispatchIntents.length === 1 && this.validateDispatchGraph(replanned.dispatchIntents).ok;
      if (canUseReplan) {
        optionA = {
          kind: "dispatch",
          intents: replanned.dispatchIntents,
          assistantText: replanned.assistantText || "已按方案A（单任务优先）执行。",
          summary: this.buildDispatchOptionSummary(replanned.dispatchIntents),
          capabilitySummary,
          creation
        };
      } else {
        optionA = {
          kind: "cancel",
          intents: [],
          assistantText: "已取消本次执行，请重述需求后我会重新编排。",
          summary: "单任务重编排未产生可执行的单任务方案。",
          capabilitySummary,
          creation
        };
      }
    } catch (error) {
      const message2 = error instanceof Error ? error.message : String(error);
      optionA = {
        kind: "cancel",
        intents: [],
        assistantText: "已取消本次执行，请重述需求后我会重新编排。",
        summary: `单任务重编排失败：${message2}`,
        capabilitySummary,
        creation
      };
    }
    const optionB = {
      kind: "dispatch",
      intents: orchestrator.dispatchIntents,
      assistantText: orchestrator.assistantText || "已按方案B（原始拆分）执行。",
      summary: this.buildDispatchOptionSummary(orchestrator.dispatchIntents),
      capabilitySummary,
      creation
    };
    const promptText = this.buildOversplitDispatchChoicePrompt(
      optionA,
      optionB,
      detection.reason,
      detection.confidence
    );
    const choice = {
      kind: "oversplit_ab",
      id: uuid$1.v4(),
      createdAt: nowIso$1(),
      hint: "当前存在待确认的任务编排方案，请在输入框回复 A 或 B。",
      expectedResponse: "ab",
      promptText,
      reason: detection.reason,
      confidence: detection.confidence,
      optionA,
      optionB
    };
    this.schedulePendingDispatchChoice(choice);
    return this.getState();
  }
  handlePendingDispatchChoice(choiceText) {
    const pending = this.pendingDispatchChoice;
    if (!pending) return this.getState();
    let selected;
    if (pending.kind === "oversplit_ab") {
      const choice = this.parseABChoiceText(choiceText);
      if (!choice) {
        this.pushMessage({
          id: uuid$1.v4(),
          role: "assistant",
          content: [
            "当前存在待确认的编排方案。",
            "请回复 A 或 B 进行选择。",
            "A: 单任务优先方案",
            "B: 原始拆分方案"
          ].join("\n"),
          ts: nowIso$1()
        });
        this.broadcastState();
        return this.getState();
      }
      selected = choice === "A" ? pending.optionA : pending.optionB;
    } else {
      const choice = this.parseConfirmCancelChoiceText(choiceText);
      if (!choice) {
        this.pushMessage({
          id: uuid$1.v4(),
          role: "assistant",
          content: [
            "当前存在待确认的失败重分配方案。",
            "请回复 确认 或 取消。",
            "确认: 按建议创建重试任务",
            "取消: 不创建重试任务"
          ].join("\n"),
          ts: nowIso$1()
        });
        this.broadcastState();
        return this.getState();
      }
      selected = choice === "confirm" ? pending.optionConfirm : pending.optionCancel;
    }
    this.pendingDispatchChoice = null;
    if (selected.kind === "cancel") {
      this.pushMessage({
        id: uuid$1.v4(),
        role: "assistant",
        content: selected.assistantText,
        ts: nowIso$1()
      });
      this.broadcastState();
      this.promoteNextQueuedDispatchChoice();
      return this.getState();
    }
    if (selected.intents.length === 0) {
      this.pushMessage({
        id: uuid$1.v4(),
        role: "assistant",
        content: "所选方案没有可执行任务，请重新描述需求。",
        ts: nowIso$1()
      });
      this.broadcastState();
      this.promoteNextQueuedDispatchChoice();
      return this.getState();
    }
    const state = this.dispatchIntentsAndReply({
      intents: selected.intents,
      assistantText: selected.assistantText,
      capabilitySummary: selected.capabilitySummary,
      creation: selected.creation
    });
    this.promoteNextQueuedDispatchChoice();
    return state;
  }
  parseABChoiceText(raw) {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
    if (!normalized) return null;
    const optionA = /* @__PURE__ */ new Set(["a", "1", "方案a", "选a", "a方案", "选择a", "a执行"]);
    if (optionA.has(normalized)) return "A";
    const optionB = /* @__PURE__ */ new Set(["b", "2", "方案b", "选b", "b方案", "选择b", "b执行"]);
    if (optionB.has(normalized)) return "B";
    return null;
  }
  parseConfirmCancelChoiceText(raw) {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
    if (!normalized) return null;
    const confirm = /* @__PURE__ */ new Set(["确认", "同意", "yes", "y", "ok", "好的", "继续"]);
    if (confirm.has(normalized)) return "confirm";
    const cancel = /* @__PURE__ */ new Set(["取消", "拒绝", "no", "n", "不用", "停止"]);
    if (cancel.has(normalized)) return "cancel";
    return null;
  }
  buildOversplitDispatchChoicePrompt(optionA, optionB, reason, confidence) {
    const confidencePct = `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
    return [
      "检测到当前计划可能过度拆分，需你确认执行方案。",
      `判定原因: ${reason}`,
      `判定置信度: ${confidencePct}`,
      "",
      "方案A（单任务优先）",
      optionA.summary,
      "",
      "方案B（原始拆分）",
      optionB.summary,
      "",
      "请回复 A 或 B。"
    ].join("\n");
  }
  buildRetryDispatchChoicePrompt(failedTask, errorMessage, confirmOption) {
    return [
      "检测到任务异常失败，已生成重分配方案。",
      `失败任务: [${failedTask.mode}] ${failedTask.title}`,
      `错误信息: ${errorMessage}`,
      "",
      "建议方案（单任务同模式）",
      confirmOption.summary,
      "",
      "请回复 确认 或 取消。"
    ].join("\n");
  }
  promoteNextQueuedDispatchChoice() {
    if (this.pendingDispatchChoice) return;
    const next = this.queuedDispatchChoices.shift();
    if (!next) return;
    this.pendingDispatchChoice = next;
    this.pushMessage({
      id: uuid$1.v4(),
      role: "assistant",
      content: next.promptText,
      ts: nowIso$1()
    });
    this.broadcastState();
  }
  schedulePendingDispatchChoice(choice) {
    if (this.pendingDispatchChoice) {
      this.queuedDispatchChoices.push(choice);
      this.pushMessage({
        id: uuid$1.v4(),
        role: "assistant",
        content: `检测到新的待确认方案，已加入确认队列（${choice.kind}）。请先处理当前方案。`,
        ts: nowIso$1()
      });
      this.broadcastState();
      return;
    }
    this.pendingDispatchChoice = choice;
    this.pushMessage({
      id: uuid$1.v4(),
      role: "assistant",
      content: choice.promptText,
      ts: nowIso$1()
    });
    this.broadcastState();
  }
  buildDispatchOptionSummary(intents) {
    if (intents.length === 0) return "无任务。";
    const modeCounter = /* @__PURE__ */ new Map();
    for (const intent of intents) {
      const current = modeCounter.get(intent.mode) ?? 0;
      modeCounter.set(intent.mode, current + 1);
    }
    const modeDistribution = Array.from(modeCounter.entries()).map(([mode, count]) => `${mode}:${count}`).join(", ");
    const dependentCount = intents.filter((intent) => intent.dependsOn.length > 0).length;
    const detailLines = intents.map((intent, index2) => {
      const deps = intent.dependsOn.length > 0 ? `dependsOn=${intent.dependsOn.join(",")}` : "independent";
      return `${index2 + 1}. [${intent.mode}] ${intent.title} (${deps})`;
    });
    return [
      `任务数: ${intents.length}`,
      `模式分布: ${modeDistribution}`,
      `依赖任务: ${dependentCount}/${intents.length}`,
      ...detailLines
    ].join("\n");
  }
  dispatchIntentsAndReply(params) {
    const graphValidation = this.validateDispatchGraph(params.intents);
    if (!graphValidation.ok) {
      const clarificationText = [
        params.assistantText || "当前任务计划无法派发。",
        `原因: ${graphValidation.error}`,
        "请补充或修正任务依赖关系后重试。"
      ].join("\n");
      this.pushMessage({
        id: uuid$1.v4(),
        role: "assistant",
        content: clarificationText,
        ts: nowIso$1()
      });
      this.broadcastState();
      return this.getState();
    }
    const groupId = uuid$1.v4();
    const sourceTurnId = uuid$1.v4();
    const created = this.createTasksFromIntents({
      intents: params.intents,
      groupId,
      sourceTurnId,
      creation: params.creation
    });
    this.pendingDispatchChoice = null;
    for (const taskId of created.readyTaskIds) {
      this.enqueueTask(taskId);
    }
    this.broadcastTasks();
    const dispatchedLines = created.tasks.map((task, index2) => {
      const depCount = task.dependsOnTaskIds?.length ?? 0;
      return `${index2 + 1}. [${task.mode}] ${task.title} (${depCount > 0 ? `depends:${depCount}` : "independent"})`;
    });
    const replyLines = [
      params.assistantText || "已完成任务编排并开始执行。",
      `任务组: ${groupId}`,
      `共创建 ${created.tasks.length} 个任务。`,
      ...dispatchedLines,
      params.capabilitySummary
    ];
    if (created.notes.length > 0) {
      replyLines.push("[调度说明]");
      replyLines.push(...created.notes);
    }
    this.pushMessage({
      id: uuid$1.v4(),
      role: "assistant",
      content: replyLines.join("\n"),
      ts: nowIso$1()
    });
    this.broadcastState();
    void this.pumpQueue();
    return this.getState();
  }
  getRecentRoundLimit() {
    const value = getSettings().butler?.recentRounds ?? 5;
    return Math.max(1, value);
  }
  getMaxConcurrent() {
    const value = getSettings().butler?.maxConcurrent ?? 2;
    return Math.max(1, value);
  }
  getRootPath() {
    return getSettings().butler?.rootPath || getSettings().defaultWorkspacePath || "";
  }
  ensureMainThread() {
    const rows = getAllThreads();
    const found = rows.find((row) => {
      const metadata2 = parseMetadata(row.metadata);
      return metadata2.butlerMain === true;
    });
    if (found) return found.thread_id;
    const threadId = uuid$1.v4();
    const metadata = {
      mode: "butler",
      createdBy: "butler",
      butlerMain: true,
      disableApprovals: true
    };
    createThread(threadId, metadata);
    updateThread(threadId, { metadata: JSON.stringify(metadata), title: "Butler AI" });
    broadcastThreadsChanged();
    return threadId;
  }
  pushMessage(message) {
    this.messages.push(message);
    appendButlerHistoryMessage({
      id: message.id,
      role: message.role,
      content: message.content,
      ts: message.ts
    });
  }
  findPreviousUserMessage(currentMessageId) {
    for (let index2 = this.messages.length - 1; index2 >= 0; index2 -= 1) {
      const message = this.messages[index2];
      if (message.id === currentMessageId) continue;
      if (message.role === "user") return message;
    }
    return null;
  }
  findLatestUserMessage() {
    for (let index2 = this.messages.length - 1; index2 >= 0; index2 -= 1) {
      const message = this.messages[index2];
      if (message.role === "user") return message;
    }
    return null;
  }
  validateDispatchGraph(intents) {
    const byKey = /* @__PURE__ */ new Map();
    for (const intent of intents) {
      if (byKey.has(intent.taskKey)) {
        return { ok: false, error: `taskKey 重复: ${intent.taskKey}` };
      }
      byKey.set(intent.taskKey, intent);
    }
    for (const intent of intents) {
      for (const dep of intent.dependsOn) {
        if (!byKey.has(dep)) {
          return {
            ok: false,
            error: `任务 ${intent.taskKey} 依赖不存在的 taskKey: ${dep}`
          };
        }
        if (dep === intent.taskKey) {
          return { ok: false, error: `任务 ${intent.taskKey} 不能依赖自身` };
        }
      }
    }
    const visitState = /* @__PURE__ */ new Map();
    const hasCycle = (taskKey) => {
      const state = visitState.get(taskKey) ?? 0;
      if (state === 1) return true;
      if (state === 2) return false;
      visitState.set(taskKey, 1);
      const intent = byKey.get(taskKey);
      for (const depKey of intent?.dependsOn ?? []) {
        if (hasCycle(depKey)) return true;
      }
      visitState.set(taskKey, 2);
      return false;
    };
    for (const taskKey of byKey.keys()) {
      if (hasCycle(taskKey)) {
        return { ok: false, error: "依赖图存在环，无法调度" };
      }
    }
    return { ok: true };
  }
  createTasksFromIntents(params) {
    const { intents, groupId, sourceTurnId, creation } = params;
    const createdByTaskKey = /* @__PURE__ */ new Map();
    const notes = [];
    for (const intent of intents) {
      const requestedReuse = intent.threadStrategy === "reuse_last_thread";
      const reusableThreadId = requestedReuse ? this.findReusableThreadId(intent.mode) : void 0;
      if (requestedReuse && !reusableThreadId) {
        notes.push(`任务 ${intent.taskKey}: 未找到可复用线程，已自动改为 new_thread。`);
      }
      const task = createButlerTaskThread({
        mode: intent.mode,
        prompt: renderTaskPrompt(intent, { originUserMessage: creation.originUserMessage }),
        title: intent.title,
        rootPath: this.getRootPath(),
        requester: "user",
        loopConfig: intent.mode === "loop" ? intent.loopConfig : void 0,
        groupId,
        taskKey: intent.taskKey,
        handoff: intent.handoff,
        sourceTurnId,
        reuseThreadId: reusableThreadId,
        originUserMessage: creation.originUserMessage,
        retryOfTaskId: creation.retryOfTaskId,
        retryAttempt: creation.retryAttempt
      });
      this.tasks.set(task.id, task);
      createdByTaskKey.set(intent.taskKey, task);
      persistButlerTask(task);
    }
    for (const intent of intents) {
      const task = createdByTaskKey.get(intent.taskKey);
      if (!task) continue;
      const dependsOnTaskIds = intent.dependsOn.map((taskKey) => createdByTaskKey.get(taskKey)?.id).filter((taskId) => !!taskId);
      task.dependsOnTaskIds = dependsOnTaskIds;
      persistButlerTask(task);
      if (dependsOnTaskIds.length > 0) {
        this.unresolvedDeps.set(task.id, new Set(dependsOnTaskIds));
        for (const parentId of dependsOnTaskIds) {
          const children = this.dependencyChildren.get(parentId) ?? /* @__PURE__ */ new Set();
          children.add(task.id);
          this.dependencyChildren.set(parentId, children);
        }
      }
    }
    const tasks = Array.from(createdByTaskKey.values());
    const readyTaskIds = tasks.filter((task) => !task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0).map((task) => task.id);
    return { tasks, readyTaskIds, notes };
  }
  findReusableThreadId(mode) {
    const candidates = this.listTasks().filter((task) => task.mode === mode);
    if (candidates.length === 0) return void 0;
    const preferred = candidates.find(
      (task) => task.status !== "failed" && task.status !== "cancelled"
    );
    return preferred?.threadId ?? candidates[0]?.threadId;
  }
  enqueueTask(taskId) {
    if (this.queue.some((item) => item.taskId === taskId)) return;
    this.queue.push({ taskId });
  }
  canStartTask(task) {
    if (task.status !== "queued") return false;
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) return true;
    for (const parentId of task.dependsOnTaskIds) {
      const parent = this.tasks.get(parentId);
      if (!parent) {
        this.markTaskFailedByDependency(task, `依赖任务不存在: ${parentId}`);
        return false;
      }
      if (parent.status === "failed" || parent.status === "cancelled") {
        this.markTaskFailedByDependency(task, `依赖任务失败: ${parent.title}`);
        return false;
      }
      if (parent.status !== "completed") {
        return false;
      }
    }
    return true;
  }
  async pumpQueue() {
    while (this.running.size < this.getMaxConcurrent() && this.queue.length > 0) {
      const nextIndex = this.queue.findIndex((pending) => {
        const task2 = this.tasks.get(pending.taskId);
        if (!task2) return false;
        if (this.runningThreadIds.has(task2.threadId)) return false;
        return this.canStartTask(task2);
      });
      if (nextIndex < 0) return;
      const [next] = this.queue.splice(nextIndex, 1);
      if (!next) return;
      const task = this.tasks.get(next.taskId);
      if (!task) continue;
      task.status = "running";
      task.startedAt = nowIso$1();
      this.running.add(task.id);
      this.runningThreadIds.add(task.threadId);
      emitTaskStarted({
        threadId: task.threadId,
        source: "butler"
      });
      persistButlerTask(task);
      this.broadcastTasks();
      void this.runTaskAndUpdate(task);
    }
  }
  buildContextPrefix(task) {
    const parentIds = task.dependsOnTaskIds ?? [];
    if (parentIds.length === 0) return "";
    const parents = parentIds.map((id) => this.tasks.get(id)).filter((parent) => !!parent);
    if (parents.length === 0) return "";
    const lines = parents.map((parent, index2) => {
      return `${index2 + 1}. ${parent.title}
mode=${parent.mode}
thread=${parent.threadId}
result_brief=${parent.resultBrief || ""}
result_detail=${parent.resultDetail || ""}`;
    });
    const note = task.handoff?.note ? `
[Handoff Note]
${task.handoff.note}` : "";
    return [`[Butler Upstream Context]`, ...lines, note].filter(Boolean).join("\n\n");
  }
  writeFilesystemHandoff(task) {
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) return;
    const method = task.handoff?.method ?? "both";
    if (method !== "filesystem" && method !== "both") return;
    const upstream = task.dependsOnTaskIds.map((id) => this.tasks.get(id)).filter((parent) => !!parent).map((parent) => ({
      taskId: parent.id,
      taskKey: parent.taskKey,
      title: parent.title,
      mode: parent.mode,
      threadId: parent.threadId,
      workspacePath: parent.workspacePath,
      resultBrief: parent.resultBrief,
      resultDetail: parent.resultDetail,
      completedAt: parent.completedAt
    }));
    const payload = {
      taskId: task.id,
      taskKey: task.taskKey,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      handoff: {
        method,
        note: task.handoff?.note,
        requiredArtifacts: task.handoff?.requiredArtifacts ?? []
      },
      upstream
    };
    try {
      fs.writeFileSync(
        path.join(task.workspacePath, ".butler_handoff.json"),
        JSON.stringify(payload, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.warn("[Butler] Failed to write handoff file:", error);
    }
  }
  buildExecutionPrompt(task) {
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) {
      return task.prompt;
    }
    const method = task.handoff?.method ?? "both";
    const withContext = method === "context" || method === "both";
    const prefix = withContext ? this.buildContextPrefix(task) : "";
    this.writeFilesystemHandoff(task);
    if (!prefix) return task.prompt;
    return `${prefix}

${task.prompt}`;
  }
  async runTaskAndUpdate(task) {
    try {
      const executionPrompt = this.buildExecutionPrompt(task);
      const executionTask = {
        ...task,
        prompt: executionPrompt
      };
      const { result, error } = await executeButlerTask(executionTask);
      const latest = this.tasks.get(task.id);
      if (latest && latest.status === "running") {
        latest.status = error ? "failed" : "completed";
        latest.resultBrief = error || result || latest.resultBrief;
        latest.resultDetail = error || result || latest.resultDetail;
        latest.completedAt = nowIso$1();
        persistButlerTask(latest);
        this.onTaskSettled(latest);
        this.broadcastTasks();
      }
    } finally {
      this.running.delete(task.id);
      this.runningThreadIds.delete(task.threadId);
      this.broadcastTasks();
      void this.pumpQueue();
    }
  }
  markTaskFailedByDependency(task, reason) {
    if (task.status !== "queued") return;
    task.status = "failed";
    task.completedAt = nowIso$1();
    task.resultBrief = reason;
    task.resultDetail = reason;
    persistButlerTask(task);
    this.onTaskSettled(task);
    this.broadcastTasks();
  }
  onTaskSettled(task) {
    this.unresolvedDeps.delete(task.id);
    const children = this.dependencyChildren.get(task.id);
    if (!children || children.size === 0) return;
    for (const childId of children) {
      const child = this.tasks.get(childId);
      if (!child || child.status !== "queued") continue;
      const unresolved = this.unresolvedDeps.get(childId);
      if (unresolved) {
        unresolved.delete(task.id);
      }
      if (task.status !== "completed") {
        this.markTaskFailedByDependency(child, `依赖任务失败: ${task.title}`);
        continue;
      }
      if (!unresolved || unresolved.size === 0) {
        this.unresolvedDeps.delete(childId);
        this.enqueueTask(childId);
      }
    }
  }
  getRetryAttempt(task) {
    const raw = task.retryAttempt;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
    return Math.max(0, Math.floor(raw));
  }
  resolveRetryRootTask(task) {
    let current = task;
    const visited = /* @__PURE__ */ new Set();
    while (current.retryOfTaskId) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      const parent = this.tasks.get(current.retryOfTaskId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }
  isDependencyFailureTask(task) {
    const reason = [task.resultBrief || "", task.resultDetail || ""].join("\n");
    return reason.includes("依赖任务失败:") || reason.includes("依赖任务不存在:");
  }
  async prepareRetryReassignmentForFailure(task, errorMessage) {
    if (task.status !== "failed") return;
    if (this.isDependencyFailureTask(task)) return;
    const root = this.resolveRetryRootTask(task);
    const rootAttempt = Math.max(this.getRetryAttempt(root), this.getRetryAttempt(task));
    if (rootAttempt >= 1) {
      return;
    }
    const originUserMessage = this.normalizeOriginUserMessage(
      task.originUserMessage || task.prompt || task.title
    );
    const { capabilityCatalog, capabilitySummary } = this.getCapabilityContext();
    const promptContextBase = this.buildPromptContextBase({
      userMessage: originUserMessage,
      capabilityCatalog,
      capabilitySummary
    });
    try {
      const replanned = await runButlerOrchestratorTurn({
        threadId: this.mainThreadId,
        promptContext: {
          ...promptContextBase,
          dispatchPolicy: "single_task_first",
          planningFocus: "retry_reassign",
          forcedMode: task.mode,
          retryContext: {
            failedTaskTitle: task.title,
            failedTaskMode: task.mode,
            failedTaskPrompt: task.prompt,
            failureError: errorMessage,
            originUserMessage
          }
        }
      });
      const validSingleTask = replanned.dispatchIntents.length === 1 && replanned.dispatchIntents[0]?.mode === task.mode && this.validateDispatchGraph(replanned.dispatchIntents).ok;
      if (!validSingleTask) {
        this.pushMessage({
          id: uuid$1.v4(),
          role: "assistant",
          content: [
            `任务失败：${task.title}`,
            `错误: ${errorMessage}`,
            "自动重分配未生成可执行的同模式单任务方案，请手动重述需求。"
          ].join("\n"),
          ts: nowIso$1()
        });
        this.broadcastState();
        return;
      }
      const creation = {
        originUserMessage,
        retryOfTaskId: task.id,
        retryAttempt: rootAttempt + 1
      };
      const optionConfirm = {
        kind: "dispatch",
        intents: replanned.dispatchIntents,
        assistantText: replanned.assistantText || "已确认失败重分配方案并开始执行。",
        summary: this.buildDispatchOptionSummary(replanned.dispatchIntents),
        capabilitySummary,
        creation
      };
      const optionCancel = {
        kind: "cancel",
        intents: [],
        assistantText: "已取消本次失败重分配。你可以稍后手动重述需求。",
        summary: "用户取消失败重分配。",
        capabilitySummary,
        creation
      };
      const promptText = this.buildRetryDispatchChoicePrompt(task, errorMessage, optionConfirm);
      const choice = {
        kind: "retry_confirm",
        id: uuid$1.v4(),
        createdAt: nowIso$1(),
        hint: "检测到失败重分配方案，请回复 确认 或 取消。",
        expectedResponse: "confirm_cancel",
        promptText,
        failedTaskId: task.id,
        optionConfirm,
        optionCancel
      };
      this.schedulePendingDispatchChoice(choice);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pushMessage({
        id: uuid$1.v4(),
        role: "assistant",
        content: [
          `任务失败：${task.title}`,
          `错误: ${errorMessage}`,
          `自动重分配生成失败：${message}`,
          "请手动重述需求。"
        ].join("\n"),
        ts: nowIso$1()
      });
      this.broadcastState();
    }
  }
  handleTaskCompleted(payload) {
    const byThread = this.listTasks().filter((task) => task.threadId === payload.threadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const target = byThread.find((task) => task.status === "running") || byThread[0];
    if (target) {
      const nextStatus = payload.error ? "failed" : "completed";
      const wasRunning = target.status === "running";
      target.status = nextStatus;
      target.resultBrief = payload.error || payload.result || target.resultBrief;
      target.resultDetail = payload.error || payload.result || target.resultDetail;
      target.completedAt = payload.finishedAt;
      persistButlerTask(target);
      if (wasRunning) {
        this.onTaskSettled(target);
      }
      this.broadcastTasks();
      if (payload.source === "butler" && payload.error) {
        void this.prepareRetryReassignmentForFailure(target, payload.error);
      }
    }
  }
  broadcastState() {
    broadcast("butler:state-changed", this.getState());
  }
  broadcastTasks() {
    broadcast("butler:tasks-changed", this.listTasks());
  }
}
const butlerManager = new ButlerManager();
function registerThreadHandlers(ipcMain) {
  ipcMain.handle("threads:list", async () => {
    const threads = getAllThreads();
    return threads.map((row) => ({
      thread_id: row.thread_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : void 0,
      status: row.status,
      thread_values: row.thread_values ? JSON.parse(row.thread_values) : void 0,
      title: row.title
    }));
  });
  ipcMain.handle("threads:get", async (_event, threadId) => {
    const row = getThread(threadId);
    if (!row) return null;
    return {
      thread_id: row.thread_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : void 0,
      status: row.status,
      thread_values: row.thread_values ? JSON.parse(row.thread_values) : void 0,
      title: row.title
    };
  });
  ipcMain.handle("threads:create", async (_event, metadata) => {
    const threadId = uuid$1.v4();
    const title = metadata?.title || `Thread ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`;
    const mergedMetadata = {
      mode: "default",
      createdBy: "user",
      ...metadata,
      title
    };
    const thread = createThread(threadId, mergedMetadata);
    updateThread(threadId, { title });
    broadcastThreadsChanged();
    return {
      thread_id: thread.thread_id,
      created_at: new Date(thread.created_at),
      updated_at: new Date(thread.updated_at),
      metadata: thread.metadata ? JSON.parse(thread.metadata) : void 0,
      status: thread.status,
      thread_values: thread.thread_values ? JSON.parse(thread.thread_values) : void 0,
      title
    };
  });
  ipcMain.handle("threads:update", async (_event, { threadId, updates }) => {
    const updateData = {};
    if (updates.title !== void 0) updateData.title = updates.title;
    if (updates.status !== void 0) updateData.status = updates.status;
    if (updates.metadata !== void 0) updateData.metadata = JSON.stringify(updates.metadata);
    if (updates.thread_values !== void 0)
      updateData.thread_values = JSON.stringify(updates.thread_values);
    const row = updateThread(threadId, updateData);
    if (!row) throw new Error("Thread not found");
    broadcastThreadsChanged();
    return {
      thread_id: row.thread_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : void 0,
      status: row.status,
      thread_values: row.thread_values ? JSON.parse(row.thread_values) : void 0,
      title: row.title
    };
  });
  ipcMain.handle(
    "threads:delete",
    async (_event, payload) => {
      const inputThreadId = typeof payload === "string" ? payload : payload?.threadId;
      const options = typeof payload === "string" ? void 0 : payload?.options;
      const threadId = inputThreadId?.trim() || "";
      if (!threadId) {
        throw new Error("Thread id is required.");
      }
      if (options?.deleteMemory) {
        removeConversationMemoryByThread(threadId);
      }
      console.log("[Threads] Deleting thread:", threadId);
      loopManager.cleanupThread(threadId);
      deleteThread(threadId);
      console.log("[Threads] Deleted from metadata store");
      try {
        await butlerManager.removeTasksByThreadId(threadId);
        console.log("[Threads] Synced Butler task cards for deleted thread");
      } catch (e) {
        console.warn("[Threads] Failed to sync Butler tasks:", e);
      }
      try {
        await closeCheckpointer(threadId);
        console.log("[Threads] Closed checkpointer");
      } catch (e) {
        console.warn("[Threads] Failed to close checkpointer:", e);
      }
      try {
        deleteThreadCheckpoint(threadId);
        console.log("[Threads] Deleted checkpoint file");
      } catch (e) {
        console.warn("[Threads] Failed to delete checkpoint file:", e);
      }
      broadcastThreadsChanged();
    }
  );
  ipcMain.handle("threads:history", async (_event, threadId) => {
    try {
      const checkpointer = await getCheckpointer(threadId);
      const history = [];
      const config2 = { configurable: { thread_id: threadId } };
      for await (const checkpoint of checkpointer.list(config2, { limit: 50 })) {
        history.push(checkpoint);
      }
      return history;
    } catch (e) {
      console.warn("Failed to get thread history:", e);
      return [];
    }
  });
  ipcMain.handle("threads:ralphLogTail", async (_event, threadId, limit) => {
    return readRalphLogTail(threadId, typeof limit === "number" ? limit : 200);
  });
  ipcMain.handle("threads:generateTitle", async (_event, message) => {
    return generateTitle(message);
  });
}
const activeWatchers = /* @__PURE__ */ new Map();
const debounceTimers = /* @__PURE__ */ new Map();
const DEBOUNCE_DELAY = 500;
function startWatching(threadId, workspacePath) {
  startWatchingPaths(threadId, [workspacePath]);
}
function startWatchingPaths(threadId, workspacePaths) {
  stopWatching(threadId);
  const watchers = [];
  for (const workspacePath of workspacePaths) {
    if (!workspacePath) continue;
    try {
      const stat = fs__namespace$2.statSync(workspacePath);
      if (!stat.isDirectory()) {
        console.warn(`[WorkspaceWatcher] Path is not a directory: ${workspacePath}`);
        continue;
      }
    } catch (e) {
      console.warn(`[WorkspaceWatcher] Cannot access path: ${workspacePath}`, e);
      continue;
    }
    try {
      const watcher = fs__namespace$2.watch(workspacePath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          const parts = filename.split(path__namespace$1.sep);
          if (parts.some((p) => p.startsWith(".") || p === "node_modules")) {
            return;
          }
        }
        console.log(`[WorkspaceWatcher] ${eventType}: ${filename} in thread ${threadId}`);
        const existingTimer = debounceTimers.get(threadId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
          debounceTimers.delete(threadId);
          notifyRenderer(threadId, workspacePath);
        }, DEBOUNCE_DELAY);
        debounceTimers.set(threadId, timer);
      });
      watcher.on("error", (error) => {
        console.error(`[WorkspaceWatcher] Error watching ${workspacePath}:`, error);
        stopWatching(threadId);
      });
      watchers.push(watcher);
      console.log(`[WorkspaceWatcher] Started watching ${workspacePath} for thread ${threadId}`);
    } catch (e) {
      console.error(`[WorkspaceWatcher] Failed to start watching ${workspacePath}:`, e);
    }
  }
  if (watchers.length > 0) {
    activeWatchers.set(threadId, watchers);
  }
}
function stopWatching(threadId) {
  const watchers = activeWatchers.get(threadId);
  if (watchers) {
    watchers.forEach((watcher) => watcher.close());
    activeWatchers.delete(threadId);
    console.log(`[WorkspaceWatcher] Stopped watching for thread ${threadId}`);
  }
  const timer = debounceTimers.get(threadId);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(threadId);
  }
}
function notifyRenderer(threadId, workspacePath) {
  const windows = electron.BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("workspace:files-changed", {
      threadId,
      workspacePath
    });
  }
}
const store = new Store({
  name: "settings",
  cwd: getOpenworkDir()
});
const PROVIDERS = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" }
];
const AVAILABLE_MODELS = [
  // Anthropic Claude 4.5 series (latest as of Jan 2026)
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    model: "claude-opus-4-5-20251101",
    description: "Premium model with maximum intelligence",
    available: true
  },
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    description: "Best balance of intelligence, speed, and cost for agents",
    available: true
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    description: "Fastest model with near-frontier intelligence",
    available: true
  },
  // Anthropic Claude legacy models
  {
    id: "claude-opus-4-1-20250805",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    model: "claude-opus-4-1-20250805",
    description: "Previous generation premium model with extended thinking",
    available: true
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    description: "Fast and capable previous generation model",
    available: true
  },
  // OpenAI GPT-5 series (latest as of Jan 2026)
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    model: "gpt-5.2",
    description: "Latest flagship with enhanced coding and agentic capabilities",
    available: true
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    model: "gpt-5.1",
    description: "Advanced reasoning and robust performance",
    available: true
  },
  // OpenAI o-series reasoning models
  {
    id: "o3",
    name: "o3",
    provider: "openai",
    model: "o3",
    description: "Advanced reasoning for complex problem-solving",
    available: true
  },
  {
    id: "o3-mini",
    name: "o3 Mini",
    provider: "openai",
    model: "o3-mini",
    description: "Cost-effective reasoning with faster response times",
    available: true
  },
  {
    id: "o4-mini",
    name: "o4 Mini",
    provider: "openai",
    model: "o4-mini",
    description: "Fast, efficient reasoning model succeeding o3",
    available: true
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    model: "o1",
    description: "Premium reasoning for research, coding, math and science",
    available: true
  },
  // OpenAI GPT-4 series
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    model: "gpt-4.1",
    description: "Strong instruction-following with 1M context window",
    available: true
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    model: "gpt-4.1-mini",
    description: "Faster, smaller version balancing performance and efficiency",
    available: true
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    model: "gpt-4.1-nano",
    description: "Most cost-efficient for lighter tasks",
    available: true
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    description: "Versatile model for text generation and comprehension",
    available: true
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    description: "Cost-efficient variant with faster response times",
    available: true
  },
  // Google Gemini models
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    model: "gemini-3-pro-preview",
    description: "State-of-the-art reasoning and multimodal understanding",
    available: true
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    model: "gemini-3-flash-preview",
    description: "Fast frontier-class model with low latency and cost",
    available: true
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    model: "gemini-2.5-pro",
    description: "High-capability model for complex reasoning and coding",
    available: true
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    model: "gemini-2.5-flash",
    description: "Lightning-fast with balance of intelligence and latency",
    available: true
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    model: "gemini-2.5-flash-lite",
    description: "Fast, low-cost, high-performance model",
    available: true
  }
];
function normalizeContainerPath(input) {
  const normalized = input.replace(/\\/g, "/");
  const withLeading = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return path__namespace$1.posix.normalize(withLeading);
}
async function loadDockerFiles(mounts) {
  const files = [];
  async function readDir(baseHostPath, containerRoot, relativePath = "") {
    const entries = await fs__namespace$3.readdir(baseHostPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      const fullPath = path__namespace$1.join(baseHostPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const containerPath = path__namespace$1.posix.join(containerRoot, relPath);
      if (entry.isDirectory()) {
        files.push({
          path: containerPath,
          is_dir: true
        });
        await readDir(fullPath, containerRoot, relPath);
      } else {
        const stat = await fs__namespace$3.stat(fullPath);
        files.push({
          path: containerPath,
          is_dir: false,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        });
      }
    }
  }
  for (const mount of mounts) {
    if (!mount.hostPath) continue;
    const containerRoot = normalizeContainerPath(mount.containerPath || "/workspace");
    await readDir(mount.hostPath, containerRoot);
  }
  return files;
}
function registerModelHandlers(ipcMain) {
  ipcMain.handle("models:list", async () => {
    return AVAILABLE_MODELS.map((model) => ({
      ...model,
      available: hasApiKey(model.provider)
    }));
  });
  ipcMain.handle("models:getDefault", async () => {
    return store.get("defaultModel", "claude-sonnet-4-5-20250929");
  });
  ipcMain.handle("models:setDefault", async (_event, modelId) => {
    store.set("defaultModel", modelId);
  });
  ipcMain.handle("models:setApiKey", async (_event, { provider, apiKey }) => {
    setApiKey(provider, apiKey);
  });
  ipcMain.handle("models:getApiKey", async (_event, provider) => {
    return getApiKey(provider) ?? null;
  });
  ipcMain.handle("models:deleteApiKey", async (_event, provider) => {
    deleteApiKey(provider);
  });
  ipcMain.handle("models:listProviders", async () => {
    return PROVIDERS.map((provider) => ({
      ...provider,
      hasApiKey: hasApiKey(provider.id)
    }));
  });
  ipcMain.handle("provider:getConfig", async () => {
    return getProviderState();
  });
  ipcMain.handle("provider:setConfig", async (_event, config2) => {
    setProviderState(config2);
  });
  ipcMain.on("app:version", (event) => {
    event.returnValue = electron.app.getVersion();
  });
  ipcMain.handle("workspace:get", async (_event, threadId) => {
    if (!threadId) {
      return store.get("workspacePath", null);
    }
    const { getThread: getThread2 } = await Promise.resolve().then(() => index);
    const thread = getThread2(threadId);
    if (!thread?.metadata) return null;
    const metadata = JSON.parse(thread.metadata);
    return metadata.workspacePath || null;
  });
  ipcMain.handle(
    "workspace:set",
    async (_event, { threadId, path: newPath }) => {
      if (!threadId) {
        if (newPath) {
          store.set("workspacePath", newPath);
        } else {
          store.delete("workspacePath");
        }
        return newPath;
      }
      const { getThread: getThread2, updateThread: updateThread2 } = await Promise.resolve().then(() => index);
      const thread = getThread2(threadId);
      if (!thread) return null;
      const metadata = thread.metadata ? JSON.parse(thread.metadata) : {};
      metadata.workspacePath = newPath;
      updateThread2(threadId, { metadata: JSON.stringify(metadata) });
      if (newPath) {
        startWatching(threadId, newPath);
      } else {
        stopWatching(threadId);
      }
      return newPath;
    }
  );
  ipcMain.handle("workspace:select", async (_event, threadId) => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Workspace Folder",
      message: "Choose a folder for the agent to work in"
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    if (threadId) {
      const { getThread: getThread2, updateThread: updateThread2 } = await Promise.resolve().then(() => index);
      const thread = getThread2(threadId);
      if (thread) {
        const metadata = thread.metadata ? JSON.parse(thread.metadata) : {};
        const isEmailThread = metadata.mode === "email";
        const alreadyNotified = metadata.emailWorkspaceNotified === true;
        metadata.workspacePath = selectedPath;
        updateThread2(threadId, { metadata: JSON.stringify(metadata) });
        startWatching(threadId, selectedPath);
        if (isEmailThread && !alreadyNotified) {
          try {
            await sendEmail({
              subject: buildEmailSubject(threadId, "Workspace Linked"),
              text: [
                "Workspace linked for this Openwork email task.",
                "",
                `Work ID: ${threadId}`,
                `Workspace: ${selectedPath}`,
                "Reply to this email to continue the task.",
                ""
              ].join("\n")
            });
            metadata.emailWorkspaceNotified = true;
            updateThread2(threadId, { metadata: JSON.stringify(metadata) });
          } catch (emailError) {
            console.warn("[Workspace] Failed to send workspace email:", emailError);
          }
        }
      }
    } else {
      store.set("workspacePath", selectedPath);
    }
    return selectedPath;
  });
  ipcMain.handle("workspace:loadFromDisk", async (_event, { threadId }) => {
    const { getThread: getThread2 } = await Promise.resolve().then(() => index);
    const thread = getThread2(threadId);
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
    const workspacePath = metadata.workspacePath;
    if (!workspacePath) {
      return { success: false, error: "No workspace folder linked", files: [] };
    }
    try {
      const files = [];
      async function readDir(dirPath, relativePath = "") {
        const entries = await fs__namespace$3.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") {
            continue;
          }
          const fullPath = path__namespace$1.join(dirPath, entry.name);
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            files.push({
              path: "/" + relPath,
              is_dir: true
            });
            await readDir(fullPath, relPath);
          } else {
            const stat = await fs__namespace$3.stat(fullPath);
            files.push({
              path: "/" + relPath,
              is_dir: false,
              size: stat.size,
              modified_at: stat.mtime.toISOString()
            });
          }
        }
      }
      await readDir(workspacePath);
      startWatching(threadId, workspacePath);
      return {
        success: true,
        files,
        workspacePath
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
        files: []
      };
    }
  });
  ipcMain.handle(
    "workspace:readFile",
    async (_event, { threadId, filePath }) => {
      const { getThread: getThread2 } = await Promise.resolve().then(() => index);
      const thread = getThread2(threadId);
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
      const workspacePath = metadata.workspacePath;
      if (!workspacePath) {
        return {
          success: false,
          error: "No workspace folder linked"
        };
      }
      try {
        const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
        const fullPath = path__namespace$1.join(workspacePath, relativePath);
        const resolvedPath = path__namespace$1.resolve(fullPath);
        const resolvedWorkspace = path__namespace$1.resolve(workspacePath);
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
          return { success: false, error: "Access denied: path outside workspace" };
        }
        const stat = await fs__namespace$3.stat(fullPath);
        if (stat.isDirectory()) {
          return { success: false, error: "Cannot read directory as file" };
        }
        const content = await fs__namespace$3.readFile(fullPath, "utf-8");
        return {
          success: true,
          content,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unknown error"
        };
      }
    }
  );
  ipcMain.handle(
    "workspace:readBinaryFile",
    async (_event, { threadId, filePath }) => {
      const { getThread: getThread2 } = await Promise.resolve().then(() => index);
      const thread = getThread2(threadId);
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {};
      const workspacePath = metadata.workspacePath;
      if (!workspacePath) {
        return {
          success: false,
          error: "No workspace folder linked"
        };
      }
      try {
        const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
        const fullPath = path__namespace$1.join(workspacePath, relativePath);
        const resolvedPath = path__namespace$1.resolve(fullPath);
        const resolvedWorkspace = path__namespace$1.resolve(workspacePath);
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
          return { success: false, error: "Access denied: path outside workspace" };
        }
        const stat = await fs__namespace$3.stat(fullPath);
        if (stat.isDirectory()) {
          return { success: false, error: "Cannot read directory as file" };
        }
        const buffer = await fs__namespace$3.readFile(fullPath);
        const base642 = buffer.toString("base64");
        return {
          success: true,
          content: base642,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unknown error"
        };
      }
    }
  );
}
function registerSubagentHandlers(ipcMain) {
  ipcMain.handle("subagents:list", async () => {
    return withSpan("IPC", "subagents:list", void 0, async () => listSubagents());
  });
  ipcMain.handle("subagents:create", async (_event, input) => {
    return withSpan(
      "IPC",
      "subagents:create",
      { name: input.name },
      async () => createSubagent(input)
    );
  });
  ipcMain.handle(
    "subagents:update",
    async (_event, payload) => {
      return withSpan(
        "IPC",
        "subagents:update",
        { id: payload.id, updates: Object.keys(payload.updates || {}) },
        async () => updateSubagent(payload.id, payload.updates)
      );
    }
  );
  ipcMain.handle("subagents:delete", async (_event, id) => {
    logEntry("IPC", "subagents:delete", { id });
    deleteSubagent(id);
    logExit("IPC", "subagents:delete", { id });
  });
}
function registerSkillHandlers(ipcMain) {
  ipcMain.handle("skills:list", async () => {
    return withSpan("IPC", "skills:list", void 0, async () => listAppSkills());
  });
  ipcMain.handle("skills:scan", async () => {
    return withSpan("IPC", "skills:scan", void 0, async () => scanAndImportAgentUserSkills());
  });
  ipcMain.handle(
    "skills:create",
    async (_event, input) => {
      return withSpan(
        "IPC",
        "skills:create",
        { name: input.name, contentLength: input.content?.length ?? 0 },
        async () => createSkill(input)
      );
    }
  );
  ipcMain.handle("skills:install", async (_event, input) => {
    return withSpan(
      "IPC",
      "skills:install",
      { path: input.path },
      async () => installSkillFromPath(input.path)
    );
  });
  ipcMain.handle("skills:delete", async (_event, name) => {
    logEntry("IPC", "skills:delete", { name });
    deleteSkill(name);
    logExit("IPC", "skills:delete", { name });
  });
  ipcMain.handle("skills:setEnabled", async (_event, input) => {
    return withSpan(
      "IPC",
      "skills:setEnabled",
      { name: input.name },
      async () => updateSkillEnabled(input.name, input.enabled)
    );
  });
  ipcMain.handle(
    "skills:setEnabledScope",
    async (_event, input) => {
      return withSpan(
        "IPC",
        "skills:setEnabledScope",
        { name: input.name, scope: input.scope },
        async () => updateSkillEnabled(input.name, input.enabled, input.scope)
      );
    }
  );
  ipcMain.handle("skills:getContent", async (_event, name) => {
    return withSpan("IPC", "skills:getContent", { name }, async () => getSkillContent(name));
  });
  ipcMain.handle("skills:saveContent", async (_event, input) => {
    return withSpan(
      "IPC",
      "skills:saveContent",
      { name: input.name, contentLength: input.content.length },
      async () => saveSkillContent(input.name, input.content)
    );
  });
}
function registerToolHandlers(ipcMain) {
  ipcMain.handle("tools:list", async () => {
    return withSpan("IPC", "tools:list", void 0, async () => listTools());
  });
  ipcMain.handle("tools:setKey", async (_event, payload) => {
    return withSpan(
      "IPC",
      "tools:setKey",
      { name: payload.name, hasKey: !!payload.key },
      async () => updateToolKey(payload.name, payload.key)
    );
  });
  ipcMain.handle("tools:setEnabled", async (_event, payload) => {
    return withSpan(
      "IPC",
      "tools:setEnabled",
      { name: payload.name, enabled: payload.enabled },
      async () => updateToolEnabled(payload.name, payload.enabled)
    );
  });
  ipcMain.handle("tools:setEnabledScope", async (_event, payload) => {
    return withSpan(
      "IPC",
      "tools:setEnabledScope",
      { name: payload.name, enabled: payload.enabled, scope: payload.scope },
      async () => updateToolEnabledByScope(payload.name, payload.enabled, payload.scope)
    );
  });
}
function registerMiddlewareHandlers(ipcMain) {
  ipcMain.handle("middleware:list", async () => {
    return middlewareDefinitions;
  });
}
function runDockerCheck(timeoutMs = 8e3) {
  return new Promise((resolve) => {
    console.log("[DockerIPC] Running docker version check...");
    const proc = node_child_process.spawn("docker", ["version"], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({ available: false, error: "Docker check timed out." });
    }, timeoutMs);
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      console.log("[DockerIPC] docker version exit:", code);
      if (code === 0) {
        console.log("[DockerIPC] docker version output:", stdout.trim());
        resolve({ available: true });
      } else {
        console.warn("[DockerIPC] docker version stderr:", stderr.trim());
        resolve({
          available: false,
          error: stderr.trim() || "Docker is not available."
        });
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      console.error("[DockerIPC] docker version spawn error:", err.message);
      resolve({ available: false, error: err.message });
    });
  });
}
function registerDockerHandlers(ipcMain) {
  ipcMain.handle("docker:check", async () => {
    return runDockerCheck();
  });
  ipcMain.handle("docker:getConfig", async () => {
    return getDockerConfig();
  });
  ipcMain.handle("docker:setConfig", async (_event, config2) => {
    return setDockerConfig(config2);
  });
  ipcMain.handle("docker:status", async () => {
    return getDockerSessionStatus();
  });
  ipcMain.handle("docker:enter", async () => {
    return enterDockerMode();
  });
  ipcMain.handle("docker:exit", async () => {
    return exitDockerMode();
  });
  ipcMain.handle("docker:restart", async () => {
    return restartDockerMode();
  });
  ipcMain.handle("docker:runtimeConfig", async () => {
    return getDockerRuntimeConfig();
  });
  ipcMain.handle("docker:selectMountPath", async (_event, currentPath) => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Mount Folder",
      message: "Choose a folder to mount into the container",
      defaultPath: currentPath || void 0
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
  ipcMain.handle("docker:mountFiles", async () => {
    const config2 = getDockerConfig();
    try {
      const mounts = config2.mounts || [];
      const files = await loadDockerFiles(mounts);
      return {
        success: true,
        files,
        mounts
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        files: []
      };
    }
  });
}
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 6;
function getMimeType(filePath) {
  const ext = path__namespace$1.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
function registerAttachmentHandlers(ipcMain) {
  ipcMain.handle("attachments:pick", async (_event, input) => {
    if (!input || input.kind !== "image") return null;
    const result = await electron.dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      title: "Select Images",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"]
        }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selected = result.filePaths.slice(0, MAX_IMAGES);
    const attachments = [];
    for (const filePath of selected) {
      const stat = await fs__namespace$3.stat(filePath);
      if (stat.size > MAX_IMAGE_BYTES) {
        throw new Error(`Image too large: ${path__namespace$1.basename(filePath)}`);
      }
      const buffer = await fs__namespace$3.readFile(filePath);
      const mimeType = getMimeType(filePath);
      const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      attachments.push({
        kind: "image",
        name: path__namespace$1.basename(filePath),
        mimeType,
        dataUrl,
        size: stat.size
      });
    }
    return attachments;
  });
}
function registerMcpHandlers(ipcMain) {
  ipcMain.handle("mcp:list", async () => {
    return withSpan("IPC", "mcp:list", void 0, async () => listMcpServers());
  });
  ipcMain.handle("mcp:tools", async () => {
    return withSpan("IPC", "mcp:tools", void 0, async () => {
      const classic = listRunningMcpTools("classic");
      const butler = listRunningMcpTools("butler");
      const unique = /* @__PURE__ */ new Map();
      for (const item of [...classic, ...butler]) {
        unique.set(item.fullName, item);
      }
      return Array.from(unique.values());
    });
  });
  ipcMain.handle("mcp:create", async (_event, payload) => {
    return withSpan(
      "IPC",
      "mcp:create",
      { name: payload.name, mode: payload.mode },
      async () => createMcpServer(payload)
    );
  });
  ipcMain.handle("mcp:update", async (_event, payload) => {
    return withSpan(
      "IPC",
      "mcp:update",
      { id: payload.id, updates: Object.keys(payload.updates || {}) },
      async () => updateMcpServer(payload)
    );
  });
  ipcMain.handle("mcp:delete", async (_event, id) => {
    logEntry("IPC", "mcp:delete", { id });
    const result = await deleteMcpServer(id);
    logExit("IPC", "mcp:delete", { id });
    return result;
  });
  ipcMain.handle("mcp:start", async (_event, id) => {
    return withSpan("IPC", "mcp:start", { id }, async () => startMcpServer(id));
  });
  ipcMain.handle("mcp:stop", async (_event, id) => {
    return withSpan("IPC", "mcp:stop", { id }, async () => stopMcpServer(id));
  });
}
function registerLoopHandlers(ipcMain) {
  ipcMain.handle("loop:getConfig", async (_event, threadId) => {
    return loopManager.getConfig(threadId);
  });
  ipcMain.handle(
    "loop:updateConfig",
    async (_event, { threadId, config: config2 }) => {
      return loopManager.updateConfig(threadId, config2);
    }
  );
  ipcMain.handle("loop:start", async (_event, threadId) => {
    return loopManager.start(threadId);
  });
  ipcMain.handle("loop:stop", async (_event, threadId) => {
    return loopManager.stop(threadId);
  });
  ipcMain.handle("loop:status", async (_event, threadId) => {
    return loopManager.getStatus(threadId);
  });
}
function registerButlerHandlers(ipcMain) {
  ipcMain.handle("butler:getState", async () => {
    await butlerManager.initialize();
    return butlerManager.getState();
  });
  ipcMain.handle("butler:send", async (_event, message) => {
    return butlerManager.send(message);
  });
  ipcMain.handle("butler:listTasks", async () => {
    await butlerManager.initialize();
    return butlerManager.listTasks();
  });
  ipcMain.handle("butler:clearHistory", async () => {
    return butlerManager.clearHistory();
  });
  ipcMain.handle("butler:clearTasks", async () => {
    return butlerManager.clearTasks();
  });
}
function registerButlerMonitorHandlers(ipcMain, butlerMonitorManager2) {
  ipcMain.handle("butler-monitor:getSnapshot", async () => {
    return butlerMonitorManager2.getSnapshot();
  });
  ipcMain.handle("butler-monitor:calendar:list", async () => {
    return butlerMonitorManager2.listCalendarEvents();
  });
  ipcMain.handle(
    "butler-monitor:calendar:create",
    async (_event, input) => {
      return butlerMonitorManager2.createCalendarEvent(input);
    }
  );
  ipcMain.handle(
    "butler-monitor:calendar:update",
    async (_event, payload) => {
      return butlerMonitorManager2.updateCalendarEvent(payload.id, payload.updates);
    }
  );
  ipcMain.handle("butler-monitor:calendar:delete", async (_event, id) => {
    butlerMonitorManager2.deleteCalendarEvent(id);
  });
  ipcMain.handle("butler-monitor:countdown:list", async () => {
    return butlerMonitorManager2.listCountdownTimers();
  });
  ipcMain.handle(
    "butler-monitor:countdown:create",
    async (_event, input) => {
      return butlerMonitorManager2.createCountdownTimer(input);
    }
  );
  ipcMain.handle(
    "butler-monitor:countdown:update",
    async (_event, payload) => {
      return butlerMonitorManager2.updateCountdownTimer(payload.id, payload.updates);
    }
  );
  ipcMain.handle("butler-monitor:countdown:delete", async (_event, id) => {
    butlerMonitorManager2.deleteCountdownTimer(id);
  });
  ipcMain.handle("butler-monitor:mail:listRules", async () => {
    return butlerMonitorManager2.listMailRules();
  });
  ipcMain.handle(
    "butler-monitor:mail:createRule",
    async (_event, input) => {
      return butlerMonitorManager2.createMailRule(input);
    }
  );
  ipcMain.handle(
    "butler-monitor:mail:updateRule",
    async (_event, payload) => {
      return butlerMonitorManager2.updateMailRule(payload.id, payload.updates);
    }
  );
  ipcMain.handle("butler-monitor:mail:deleteRule", async (_event, id) => {
    butlerMonitorManager2.deleteMailRule(id);
  });
  ipcMain.handle("butler-monitor:mail:listMessages", async (_event, limit) => {
    return butlerMonitorManager2.listRecentMails(limit);
  });
  ipcMain.handle("butler-monitor:mail:pullNow", async () => {
    return butlerMonitorManager2.pullMailNow();
  });
}
function normalizeId(id) {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error("Prompt id is required.");
  }
  return normalized;
}
function normalizeName(name) {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Prompt name is required.");
  }
  if (normalized.length > 200) {
    throw new Error("Prompt name is too long.");
  }
  return normalized;
}
function normalizeContent(content) {
  const normalized = content.trim();
  if (!normalized) {
    throw new Error("Prompt content is required.");
  }
  return normalized;
}
function toPromptTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}
function readRows(query, params = []) {
  const statement = getDb().prepare(query);
  if (params.length > 0) {
    statement.bind(params);
  }
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}
function readSingleRow(query, params = []) {
  const rows = readRows(query, params);
  return rows.length > 0 ? rows[0] : null;
}
function mapConstraintError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed") && message.includes("prompt_templates.name")) {
    throw new Error("Prompt name already exists.");
  }
  throw error instanceof Error ? error : new Error(message);
}
function listPromptTemplates(query) {
  const trimmed = query?.trim() ?? "";
  const rows = trimmed.length === 0 ? readRows(
    "SELECT id, name, content, created_at, updated_at FROM prompt_templates ORDER BY updated_at DESC"
  ) : readRows(
    `SELECT id, name, content, created_at, updated_at
           FROM prompt_templates
           WHERE name LIKE ? OR content LIKE ?
           ORDER BY updated_at DESC`,
    [`%${trimmed}%`, `%${trimmed}%`]
  );
  return rows.map(toPromptTemplate);
}
function getPromptTemplate(id) {
  const normalizedId = normalizeId(id);
  const row = readSingleRow(
    "SELECT id, name, content, created_at, updated_at FROM prompt_templates WHERE id = ? LIMIT 1",
    [normalizedId]
  );
  if (!row) return null;
  return toPromptTemplate(row);
}
function createPromptTemplate(input) {
  const now = Date.now();
  const next = {
    id: node_crypto.randomUUID(),
    name: normalizeName(input.name),
    content: normalizeContent(input.content),
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };
  try {
    getDb().run(
      `INSERT INTO prompt_templates (id, name, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [next.id, next.name, next.content, now, now]
    );
  } catch (error) {
    mapConstraintError(error);
  }
  markDbDirty();
  return next;
}
function updatePromptTemplate(id, updates) {
  const normalizedId = normalizeId(id);
  const existing = getPromptTemplate(normalizedId);
  if (!existing) {
    throw new Error("Prompt not found.");
  }
  const hasName = updates.name !== void 0;
  const hasContent = updates.content !== void 0;
  if (!hasName && !hasContent) {
    return existing;
  }
  const nextName = hasName ? normalizeName(updates.name ?? "") : existing.name;
  const nextContent = hasContent ? normalizeContent(updates.content ?? "") : existing.content;
  const now = Date.now();
  try {
    getDb().run(
      `UPDATE prompt_templates
       SET name = ?, content = ?, updated_at = ?
       WHERE id = ?`,
      [nextName, nextContent, now, normalizedId]
    );
  } catch (error) {
    mapConstraintError(error);
  }
  markDbDirty();
  return {
    id: existing.id,
    name: nextName,
    content: nextContent,
    createdAt: existing.createdAt,
    updatedAt: new Date(now).toISOString()
  };
}
function deletePromptTemplate(id) {
  const normalizedId = normalizeId(id);
  getDb().run("DELETE FROM prompt_templates WHERE id = ?", [normalizedId]);
  markDbDirty();
}
function registerPromptHandlers(ipcMain) {
  ipcMain.handle("prompts:list", async (_event, query) => {
    return listPromptTemplates(query);
  });
  ipcMain.handle("prompts:get", async (_event, id) => {
    return getPromptTemplate(id);
  });
  ipcMain.handle("prompts:create", async (_event, input) => {
    return createPromptTemplate(input);
  });
  ipcMain.handle(
    "prompts:update",
    async (_event, payload) => {
      return updatePromptTemplate(payload.id, payload.updates);
    }
  );
  ipcMain.handle("prompts:delete", async (_event, id) => {
    deletePromptTemplate(id);
  });
}
function registerMemoryHandlers(ipcMain) {
  ipcMain.handle("memory:listConversationSummaries", async (_event, limit) => {
    const normalizedLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.min(2e3, Math.round(limit))) : 400;
    return listConversationSummaries(normalizedLimit);
  });
  ipcMain.handle("memory:listDailyProfiles", async (_event, limit) => {
    const normalizedLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.min(1e3, Math.round(limit))) : 180;
    return listDailyProfiles(normalizedLimit);
  });
  ipcMain.handle("memory:clearAll", async () => {
    clearAllMemory();
  });
}
let pollInterval = null;
let polling = false;
const processingTaskIds = /* @__PURE__ */ new Set();
let currentIntervalMs = null;
function buildTaskPrompt(task) {
  const body = task.text?.trim() ?? "";
  if (body) return body;
  return stripEmailSubjectPrefix(task.subject) || task.subject || "";
}
function buildErrorEmailBody(title, details) {
  return ["Openwork email task failed.", "", title, "", details, ""].join("\n");
}
async function runAgentToSummary({
  threadId,
  workspacePath,
  message,
  capabilityScope = "classic"
}) {
  await ensureDockerRunning();
  const dockerRuntime = getDockerRuntimeConfig();
  const dockerConfig = dockerRuntime.config ?? void 0;
  const dockerContainerId = dockerRuntime.containerId ?? void 0;
  emitTaskStarted({
    threadId,
    source: "email"
  });
  const agent = await createAgentRuntime({
    threadId,
    workspacePath,
    dockerConfig,
    dockerContainerId,
    threadMode: "email",
    capabilityScope,
    forceToolNames: ["send_email"],
    disableApprovals: true
    // 邮件模式下禁用人工审批，否则会卡在等待审批
  });
  const humanMessage = new messages.HumanMessage(message);
  const stream2 = await agent.stream(
    { messages: [humanMessage] },
    {
      configurable: { thread_id: threadId },
      streamMode: ["messages", "values"],
      recursionLimit: 1e3
    }
  );
  let lastAssistant = "";
  let lastAssistantFromValues = "";
  for await (const chunk of stream2) {
    const [mode, data] = chunk;
    if (mode === "messages") {
      const content = extractAssistantChunkText(data);
      if (content) {
        if (content.startsWith(lastAssistant)) {
          lastAssistant = content;
        } else {
          lastAssistant += content;
        }
      }
    }
    if (mode === "values") {
      const state = data;
      if (Array.isArray(state.messages)) {
        for (const msg of state.messages) {
          const classId = Array.isArray(msg.id) ? msg.id : [];
          const className = classId[classId.length - 1] || "";
          if (!className.includes("AI")) continue;
          const content = extractContent(msg.kwargs?.content);
          if (content) {
            lastAssistantFromValues = content;
          }
        }
      }
    }
  }
  const summary = lastAssistant.trim();
  if (summary) return summary;
  return lastAssistantFromValues.trim();
}
async function processStartWorkTask(task, defaultWorkspacePath) {
  const threadId = uuid$1.v4();
  const metadata = {
    mode: "email",
    createdBy: "user",
    workspacePath: defaultWorkspacePath
  };
  createThread(threadId, metadata);
  const taskPrompt = buildTaskPrompt(task);
  const title = generateTitle(taskPrompt);
  updateThread(threadId, {
    metadata: JSON.stringify(metadata),
    title
  });
  broadcastThreadsChanged();
  const summary = await runAgentToSummary({
    threadId,
    workspacePath: defaultWorkspacePath,
    message: taskPrompt,
    capabilityScope: "classic"
  });
  broadcastThreadHistoryUpdated(threadId);
  emitTaskCompleted({
    threadId,
    result: summary,
    source: "email"
  });
}
async function processReplyTask(task, defaultWorkspacePath) {
  const threadId = task.threadId?.trim();
  if (!threadId) {
    throw new Error("Missing work id in subject.");
  }
  const thread = getThread(threadId);
  if (!thread) {
    throw new Error(`Unknown work id: ${threadId}`);
  }
  const metadata = thread.metadata ? JSON.parse(thread.metadata) : {};
  let workspacePath = metadata.workspacePath;
  if (!workspacePath && defaultWorkspacePath) {
    metadata.workspacePath = defaultWorkspacePath;
    updateThread(threadId, { metadata: JSON.stringify(metadata) });
    workspacePath = defaultWorkspacePath;
  }
  if (!workspacePath) {
    throw new Error("No workspace linked to this task.");
  }
  const taskPrompt = buildTaskPrompt(task);
  const summary = await runAgentToSummary({
    threadId,
    workspacePath,
    message: taskPrompt,
    capabilityScope: metadata.createdBy === "butler" ? "butler" : "classic"
  });
  broadcastThreadHistoryUpdated(threadId);
  emitTaskCompleted({
    threadId,
    result: summary,
    source: "email"
  });
}
async function processEmailTask(task, defaultWorkspacePath) {
  if (processingTaskIds.has(task.id)) return;
  processingTaskIds.add(task.id);
  try {
    if (isStartWorkSubject(task.subject)) {
      if (!defaultWorkspacePath) {
        await sendEmail({
          subject: buildEmailSubject("NEW", "Error - Missing default workspace"),
          text: buildErrorEmailBody(
            "No default workspace configured.",
            "Set a default workspace in Settings → General."
          )
        });
        return;
      }
      await processStartWorkTask(task, defaultWorkspacePath);
    } else if (task.threadId) {
      await processReplyTask(task, defaultWorkspacePath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (task.threadId?.trim()) {
      emitTaskCompleted({
        threadId: task.threadId.trim(),
        error: message,
        source: "email"
      });
    }
    try {
      const threadId = task.threadId?.trim() || "NEW";
      await sendEmail({
        subject: buildEmailSubject(threadId, "Error - Failed to process task"),
        text: buildErrorEmailBody("Processing failed.", message)
      });
    } catch (sendError) {
      console.warn("[EmailWorker] Failed to send error email:", sendError);
    }
  } finally {
    try {
      await markEmailTaskRead(task.id);
    } catch (markError) {
      console.warn("[EmailWorker] Failed to mark email as read:", markError);
    }
    processingTaskIds.delete(task.id);
  }
}
async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const settings = getSettings();
    if (!settings.email?.enabled) return;
    const defaultWorkspacePath = typeof settings.defaultWorkspacePath === "string" && settings.defaultWorkspacePath.trim() ? settings.defaultWorkspacePath.trim() : null;
    const tasks = await fetchUnreadEmailTasks();
    for (const task of tasks) {
      await processEmailTask(task, defaultWorkspacePath);
    }
  } catch (error) {
    console.warn("[EmailWorker] Polling failed:", error);
  } finally {
    polling = false;
  }
}
function normalizePollIntervalSec(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 60;
  }
  return Math.max(1, Math.round(value));
}
function getPollIntervalMsFromSettings() {
  const settings = getSettings();
  const intervalSec = normalizePollIntervalSec(settings.email?.pollIntervalSec);
  return intervalSec * 1e3;
}
function startEmailPolling(intervalMs) {
  const resolvedMs = typeof intervalMs === "number" && Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : getPollIntervalMsFromSettings();
  if (pollInterval) {
    if (currentIntervalMs === resolvedMs) return;
    stopEmailPolling();
  }
  currentIntervalMs = resolvedMs;
  pollInterval = setInterval(() => {
    void pollOnce();
  }, resolvedMs);
  void pollOnce();
}
function stopEmailPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  currentIntervalMs = null;
}
function updateEmailPollingInterval(intervalSec) {
  const normalizedSec = normalizePollIntervalSec(intervalSec);
  const nextMs = normalizedSec * 1e3;
  if (pollInterval && currentIntervalMs === nextMs) return;
  stopEmailPolling();
  startEmailPolling(nextMs);
}
function registerSettingsHandlers(ipcMain, options = {}) {
  ipcMain.handle("settings:get", async () => {
    return getSettings();
  });
  ipcMain.handle("settings:update", async (_event, payload) => {
    const next = updateSettings(payload.updates);
    updateEmailPollingInterval(next.email?.pollIntervalSec);
    options.onSettingsUpdated?.(next);
    return next;
  });
}
function normalizeHeaders(headers) {
  const result = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    result[trimmedKey] = String(value ?? "").trim();
  }
  return result;
}
function ensureJsonContentType(headers) {
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  if (!hasContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}
async function readErrorBody(response) {
  try {
    const text = await response.text();
    return text.slice(0, 2e3);
  } catch {
    return "";
  }
}
function registerSpeechHandlers(ipcMain) {
  ipcMain.handle("speech:stt", async (_event, input) => {
    const settings = getSettings();
    const url = settings.speech?.stt?.url?.trim();
    if (!url) {
      throw new Error("STT URL is not configured.");
    }
    const headers = ensureJsonContentType(normalizeHeaders(settings.speech?.stt?.headers));
    const payload = {
      audioBase64: input.audioBase64,
      mimeType: input.mimeType
    };
    const language = settings.speech?.stt?.language?.trim();
    if (language) {
      payload.language = language;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const details = await readErrorBody(response);
      throw new Error(`STT request failed (${response.status}): ${details || response.statusText}`);
    }
    const data = await response.json();
    if (!data?.text) {
      throw new Error("STT response missing text.");
    }
    return data;
  });
  ipcMain.handle("speech:tts", async (_event, input) => {
    const settings = getSettings();
    const url = settings.speech?.tts?.url?.trim();
    if (!url) {
      throw new Error("TTS URL is not configured.");
    }
    const headers = ensureJsonContentType(normalizeHeaders(settings.speech?.tts?.headers));
    const payload = {
      text: input.text
    };
    const voice = settings.speech?.tts?.voice?.trim();
    if (voice) {
      payload.voice = voice;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const details = await readErrorBody(response);
      throw new Error(`TTS request failed (${response.status}): ${details || response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
    const result = { audioBase64, mimeType };
    return result;
  });
}
const CALENDAR_DUE_SOON_MS = 2 * 60 * 60 * 1e3;
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function compact$2(text, max = 280) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}
function parseIsoTime(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Number.NaN;
}
function normalizeMailSettings() {
  const settings = getSettings().email;
  if (!settings?.enabled) return null;
  if (!settings.imap.host || !settings.imap.user || !settings.imap.pass) return null;
  return {
    host: settings.imap.host,
    port: settings.imap.port,
    secure: settings.imap.secure,
    user: settings.imap.user,
    pass: settings.imap.pass
  };
}
function normalizeMonitorScanIntervalMs() {
  const sec = getSettings().butler?.monitorScanIntervalSec;
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) {
    return 3e4;
  }
  return Math.max(1, Math.round(sec)) * 1e3;
}
function normalizeMonitorPullIntervalMs() {
  const sec = getSettings().butler?.monitorPullIntervalSec;
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) {
    return 6e4;
  }
  return Math.max(1, Math.round(sec)) * 1e3;
}
class ButlerMonitorManager {
  constructor(deps) {
    this.deps = deps;
  }
  started = false;
  timeScanTimer = null;
  mailPollTimer = null;
  timeScanRunning = false;
  mailPollingRunning = false;
  start() {
    if (this.started) return;
    this.started = true;
    this.scheduleTimeScan();
    this.scheduleMailPolling();
    void this.scanTimeTriggers();
    void this.pullMailNow("startup");
    this.emitSnapshotChanged();
  }
  stop() {
    this.started = false;
    if (this.timeScanTimer) {
      clearInterval(this.timeScanTimer);
      this.timeScanTimer = null;
    }
    if (this.mailPollTimer) {
      clearInterval(this.mailPollTimer);
      this.mailPollTimer = null;
    }
  }
  refreshIntervals() {
    if (!this.started) return;
    this.scheduleTimeScan();
    this.scheduleMailPolling();
  }
  getSnapshot() {
    return {
      calendarEvents: this.listCalendarEvents(),
      countdownTimers: this.listCountdownTimers(),
      mailRules: this.listMailRules(),
      recentMails: this.listRecentMails(20)
    };
  }
  listCalendarEvents() {
    return listCalendarWatchEvents();
  }
  createCalendarEvent(input) {
    const event = createCalendarWatchEvent(input);
    void this.scanTimeTriggers();
    this.emitSnapshotChanged();
    return event;
  }
  updateCalendarEvent(id, updates) {
    const event = updateCalendarWatchEvent(id, updates);
    void this.scanTimeTriggers();
    this.emitSnapshotChanged();
    return event;
  }
  deleteCalendarEvent(id) {
    deleteCalendarWatchEvent(id);
    this.emitSnapshotChanged();
  }
  listCountdownTimers() {
    return listCountdownWatchItems();
  }
  createCountdownTimer(input) {
    const timer = createCountdownWatchItem(input);
    void this.scanTimeTriggers();
    this.emitSnapshotChanged();
    return timer;
  }
  updateCountdownTimer(id, updates) {
    const timer = updateCountdownWatchItem(id, updates);
    void this.scanTimeTriggers();
    this.emitSnapshotChanged();
    return timer;
  }
  deleteCountdownTimer(id) {
    deleteCountdownWatchItem(id);
    this.emitSnapshotChanged();
  }
  listMailRules() {
    return listMailWatchRules();
  }
  createMailRule(input) {
    const rule = createMailWatchRule(input);
    void this.pullMailNow("rule_update");
    this.emitSnapshotChanged();
    return rule;
  }
  updateMailRule(id, updates) {
    const rule = updateMailWatchRule(id, updates);
    void this.pullMailNow("rule_update");
    this.emitSnapshotChanged();
    return rule;
  }
  deleteMailRule(id) {
    deleteMailWatchRule(id);
    this.emitSnapshotChanged();
  }
  listRecentMails(limit = 20) {
    return listRecentMailWatchMessages(limit);
  }
  async pullMailNow(source = "manual") {
    this.emitBusEvent({
      type: "pull_requested",
      source,
      at: nowIso()
    });
    if (this.mailPollingRunning) {
      return [];
    }
    this.mailPollingRunning = true;
    try {
      const settings = normalizeMailSettings();
      if (!settings) {
        return [];
      }
      const rules = this.listMailRules().filter((rule) => rule.enabled);
      if (rules.length === 0) {
        return [];
      }
      const client = new imapflow.ImapFlow({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: {
          user: settings.user,
          pass: settings.pass
        },
        socketTimeout: 3e4,
        logger: false
      });
      const fetchedMessages = [];
      try {
        await client.connect();
        for (const rule of rules) {
          const messages2 = await this.pullRuleMessages(client, rule);
          fetchedMessages.push(...messages2);
        }
      } finally {
        try {
          await client.logout();
        } catch {
        }
      }
      if (fetchedMessages.length === 0) {
        this.emitSnapshotChanged();
        return [];
      }
      const inserted = insertMailWatchMessages(fetchedMessages);
      for (const message of inserted) {
        await this.dispatchPerception({
          kind: "mail_new",
          title: `新邮件提醒：${message.subject || "(无主题)"}`,
          detail: [
            `发件人: ${message.from || "未知"}`,
            `主题: ${message.subject || "(无主题)"}`,
            `内容摘要: ${compact$2(message.text, 280) || "无正文"}`
          ].join("\n"),
          payload: {
            mail: message
          }
        });
      }
      this.emitSnapshotChanged();
      return inserted;
    } catch (error) {
      console.warn("[ButlerMonitor] pullMailNow failed:", error);
      return [];
    } finally {
      this.mailPollingRunning = false;
    }
  }
  scheduleTimeScan() {
    if (this.timeScanTimer) {
      clearInterval(this.timeScanTimer);
    }
    const intervalMs = normalizeMonitorScanIntervalMs();
    this.timeScanTimer = setInterval(() => {
      void this.scanTimeTriggers();
    }, intervalMs);
  }
  scheduleMailPolling() {
    if (this.mailPollTimer) {
      clearInterval(this.mailPollTimer);
    }
    const intervalMs = normalizeMonitorPullIntervalMs();
    this.mailPollTimer = setInterval(() => {
      void this.pullMailNow("interval");
    }, intervalMs);
  }
  async scanTimeTriggers() {
    if (this.timeScanRunning) return;
    this.timeScanRunning = true;
    try {
      await this.scanCalendarDueSoon();
      await this.scanCountdownDue();
      this.emitSnapshotChanged();
    } catch (error) {
      console.warn("[ButlerMonitor] scanTimeTriggers failed:", error);
    } finally {
      this.timeScanRunning = false;
    }
  }
  async scanCalendarDueSoon() {
    const events2 = this.listCalendarEvents();
    if (events2.length === 0) return;
    const currentTs = Date.now();
    const triggerTs = nowIso();
    for (const event of events2) {
      if (!event.enabled || event.reminderSentAt) continue;
      const startTs = parseIsoTime(event.startAt);
      if (!Number.isFinite(startTs)) continue;
      const diff = startTs - currentTs;
      if (diff <= 0 || diff > CALENDAR_DUE_SOON_MS) continue;
      const updated = this.updateCalendarEvent(event.id, { reminderSentAt: triggerTs });
      await this.dispatchPerception({
        kind: "calendar_due_soon",
        title: `日历提醒：${updated.title}`,
        detail: [
          `开始时间: ${new Date(updated.startAt).toLocaleString()}`,
          updated.endAt ? `结束时间: ${new Date(updated.endAt).toLocaleString()}` : "",
          updated.location ? `地点: ${updated.location}` : "",
          updated.description ? `说明: ${updated.description}` : ""
        ].filter(Boolean).join("\n"),
        payload: {
          calendarEvent: updated
        }
      });
    }
  }
  async scanCountdownDue() {
    const timers = this.listCountdownTimers();
    if (timers.length === 0) return;
    const currentTs = Date.now();
    const triggerTs = nowIso();
    for (const timer of timers) {
      if (timer.status !== "running" || timer.reminderSentAt) continue;
      const dueTs = parseIsoTime(timer.dueAt);
      if (!Number.isFinite(dueTs)) continue;
      if (dueTs > currentTs) continue;
      const updated = this.updateCountdownTimer(timer.id, {
        status: "completed",
        completedAt: triggerTs,
        reminderSentAt: triggerTs
      });
      await this.dispatchPerception({
        kind: "countdown_due",
        title: `倒计时到点：${updated.title}`,
        detail: [
          `到点时间: ${new Date(updated.dueAt).toLocaleString()}`,
          updated.description ? `说明: ${updated.description}` : ""
        ].filter(Boolean).join("\n"),
        payload: {
          countdown: updated
        }
      });
    }
  }
  async pullRuleMessages(client, rule) {
    const folder = rule.folder?.trim() || "INBOX";
    try {
      await client.mailboxOpen(folder);
    } catch (error) {
      console.warn(
        `[ButlerMonitor] Failed to open mailbox "${folder}" for rule "${rule.name}":`,
        error
      );
      return [];
    }
    const rawUids = await client.search({ all: true });
    const uids = Array.isArray(rawUids) ? rawUids : [];
    const maxUid = uids.length > 0 ? uids.reduce((max, uid) => uid > max ? uid : max, 0) : void 0;
    const previousSeenUid = rule.lastSeenUid ?? 0;
    if (typeof maxUid === "number" && maxUid > previousSeenUid) {
      updateMailWatchRule(rule.id, { lastSeenUid: maxUid });
    }
    const candidateUids = uids.filter((uid) => uid > previousSeenUid).slice(-30);
    if (candidateUids.length === 0) {
      return [];
    }
    const fromFilter = rule.fromContains?.trim().toLowerCase();
    const subjectFilter = rule.subjectContains?.trim().toLowerCase();
    const results = [];
    for await (const message of client.fetch(candidateUids, {
      uid: true,
      envelope: true,
      source: true
    })) {
      if (!message.uid) continue;
      if (!message.source) continue;
      const parsed = await mailparser.simpleParser(message.source);
      const subject = (parsed.subject ?? "").trim();
      const from = (parsed.from?.text ?? "").trim();
      const text = (parsed.text ?? "").trim();
      if (fromFilter && !from.toLowerCase().includes(fromFilter)) {
        continue;
      }
      if (subjectFilter && !subject.toLowerCase().includes(subjectFilter)) {
        continue;
      }
      const receivedAt = parsed.date ? parsed.date.toISOString() : nowIso();
      results.push({
        id: `${rule.id}:${message.uid}`,
        ruleId: rule.id,
        uid: message.uid,
        subject,
        from,
        text: compact$2(text, 4e3),
        receivedAt,
        createdAt: nowIso()
      });
    }
    return results;
  }
  async dispatchPerception(params) {
    const input = {
      id: uuid$1.v4(),
      kind: params.kind,
      triggeredAt: nowIso(),
      title: params.title,
      detail: params.detail,
      payload: params.payload,
      snapshot: this.getSnapshot()
    };
    try {
      const notice = await this.deps.perceptionGateway.ingest(input);
      this.deps.onNotice(notice);
      this.emitBusEvent({
        type: "perception_notice",
        notice,
        at: nowIso()
      });
      this.emitSnapshotChanged();
    } catch (error) {
      console.warn("[ButlerMonitor] dispatchPerception failed:", error);
    }
  }
  emitSnapshotChanged() {
    this.emitBusEvent({
      type: "snapshot_changed",
      snapshot: this.getSnapshot(),
      at: nowIso()
    });
  }
  emitBusEvent(event) {
    this.deps.bus.emit(event);
  }
}
const EVENT_NAME = "butler-monitor:event";
class ButlerMonitorBus {
  emitter = new events.EventEmitter();
  emit(event) {
    this.emitter.emit(EVENT_NAME, event);
  }
  onEvent(listener) {
    this.emitter.on(EVENT_NAME, listener);
    return () => this.emitter.off(EVENT_NAME, listener);
  }
}
const DEFAULT_POPUP_WIDTH = 420;
const DEFAULT_POPUP_HEIGHT = 188;
const DEFAULT_MARGIN = 16;
const DEFAULT_AUTO_CLOSE_MS = 8e3;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
class TaskPopupController {
  constructor(options) {
    this.options = options;
    this.autoCloseMs = options.autoCloseMs ?? DEFAULT_AUTO_CLOSE_MS;
    this.timerRemainingMs = this.autoCloseMs;
  }
  pendingQueue = [];
  autoCloseMs;
  popupWindow = null;
  popupReady = null;
  activeNotice = null;
  autoCloseTimer = null;
  timerStartedAt = 0;
  timerRemainingMs;
  hovered = false;
  enqueue(notice) {
    this.pendingQueue.push(notice);
    void this.showNextIfIdle();
  }
  setHover(hovered) {
    this.hovered = hovered;
    if (!this.activeNotice) return;
    if (hovered) {
      this.pauseTimer();
    } else {
      this.resumeTimer();
    }
  }
  openThread(threadId, noticeId) {
    if (!threadId) return;
    if (noticeId && this.activeNotice && this.activeNotice.id !== noticeId) return;
    this.options.showMainWindow();
    this.options.activateThread(threadId);
    this.dismiss(noticeId);
  }
  dismiss(noticeId) {
    if (noticeId) {
      const queuedIndex = this.pendingQueue.findIndex((item) => item.id === noticeId);
      if (queuedIndex >= 0) {
        this.pendingQueue.splice(queuedIndex, 1);
      }
    }
    if (!this.activeNotice) return;
    if (noticeId && this.activeNotice.id !== noticeId) return;
    this.finishActiveAndContinue();
  }
  clear() {
    this.pendingQueue.length = 0;
    this.finishActiveOnly();
  }
  dispose() {
    this.clear();
    if (this.popupWindow && !this.popupWindow.isDestroyed()) {
      this.popupWindow.destroy();
    }
    this.popupWindow = null;
    this.popupReady = null;
  }
  async showNextIfIdle() {
    if (this.activeNotice || this.pendingQueue.length === 0) {
      return;
    }
    const next = this.pendingQueue.shift();
    if (!next) return;
    this.activeNotice = next;
    this.hovered = false;
    this.timerRemainingMs = this.autoCloseMs;
    const popup = await this.ensurePopupWindow();
    if (!this.activeNotice || popup.isDestroyed()) return;
    this.positionPopupWindow(popup);
    popup.webContents.send("task-popup:show", this.activeNotice);
    if (!popup.isVisible()) {
      popup.showInactive();
    } else {
      popup.moveTop();
    }
    this.resumeTimer();
  }
  finishActiveAndContinue() {
    this.finishActiveOnly();
    void this.showNextIfIdle();
  }
  finishActiveOnly() {
    if (!this.activeNotice) return;
    const closedId = this.activeNotice.id;
    this.activeNotice = null;
    this.hovered = false;
    this.timerRemainingMs = this.autoCloseMs;
    this.clearTimer();
    const popup = this.popupWindow;
    if (popup && !popup.isDestroyed()) {
      popup.webContents.send("task-popup:close", { id: closedId });
      popup.hide();
    }
  }
  resumeTimer() {
    if (!this.activeNotice || this.hovered) return;
    this.clearTimer();
    this.timerStartedAt = Date.now();
    this.autoCloseTimer = setTimeout(() => {
      this.finishActiveAndContinue();
    }, this.timerRemainingMs);
  }
  pauseTimer() {
    if (!this.autoCloseTimer) return;
    const elapsed = Date.now() - this.timerStartedAt;
    this.timerRemainingMs = clamp(this.timerRemainingMs - elapsed, 50, this.autoCloseMs);
    this.clearTimer();
  }
  clearTimer() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }
  async ensurePopupWindow() {
    if (this.popupWindow && !this.popupWindow.isDestroyed()) {
      if (this.popupReady) {
        await this.popupReady;
      }
      return this.popupWindow;
    }
    this.popupWindow = new electron.BrowserWindow({
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      frame: false,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: this.options.preloadPath,
        sandbox: false
      }
    });
    this.popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.popupWindow.setAlwaysOnTop(true, "screen-saver");
    this.popupWindow.on("closed", () => {
      this.popupWindow = null;
      this.popupReady = null;
    });
    this.popupReady = this.loadPopupWindow(this.popupWindow);
    await this.popupReady;
    return this.popupWindow;
  }
  async loadPopupWindow(window) {
    if (this.options.rendererUrl) {
      const url = new URL(this.options.rendererUrl);
      url.searchParams.set("taskPopup", "1");
      await window.loadURL(url.toString());
      return;
    }
    await window.loadFile(this.options.rendererHtmlPath, {
      query: { taskPopup: "1" }
    });
  }
  positionPopupWindow(window) {
    const display = electron.screen.getDisplayNearestPoint(electron.screen.getCursorScreenPoint());
    const workArea = display.workArea;
    const x = Math.round(workArea.x + workArea.width - DEFAULT_POPUP_WIDTH - DEFAULT_MARGIN);
    const y = Math.round(workArea.y + workArea.height - DEFAULT_POPUP_HEIGHT - DEFAULT_MARGIN);
    window.setBounds({
      x,
      y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT
    });
  }
}
const MAX_SEEN_EVENT_IDS$1 = 5e3;
const TASK_DONE_THROTTLE_MS$1 = 6e4;
const MAX_THROTTLE_ENTRIES$1 = 5e3;
function compact$1(text, max = 220) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}
function buildEventId(payload) {
  return `${payload.threadId}:${payload.finishedAt}:${payload.source}`;
}
function parseTimestampMs$1(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
function resolveTaskIdentity$1(payload) {
  const butlerTaskId = payload.metadata.butlerTaskId;
  if (typeof butlerTaskId === "string" && butlerTaskId.trim().length > 0) {
    return `butlerTask:${butlerTaskId.trim()}`;
  }
  const taskKey = payload.metadata.taskKey;
  if (typeof taskKey === "string" && taskKey.trim().length > 0) {
    return `taskKey:${taskKey.trim()}`;
  }
  return `thread:${payload.threadId}`;
}
function buildThrottleKey$1(payload) {
  return `${payload.source}:${resolveTaskIdentity$1(payload)}`;
}
function buildNotice(payload) {
  const id = buildEventId(payload);
  const title = payload.title || "Task Completed";
  const content = payload.error ? `任务失败: ${payload.error}` : payload.result || "任务已完成。";
  const resultBrief = compact$1(content, 260);
  const resultDetail = [
    `任务: ${title}`,
    `模式: ${payload.mode}`,
    `来源: ${payload.source}`,
    payload.error ? `错误: ${compact$1(payload.error, 1200)}` : null,
    payload.result ? `结果: ${compact$1(payload.result, 2400)}` : null
  ].filter((line) => !!line).join("\n");
  return {
    id,
    threadId: payload.threadId,
    title,
    resultBrief,
    resultDetail,
    completedAt: payload.finishedAt,
    mode: payload.mode,
    source: payload.source,
    noticeType: "task"
  };
}
class TaskCompletionBus {
  constructor(deps) {
    this.deps = deps;
  }
  seenEventIds = /* @__PURE__ */ new Set();
  seenEventOrder = [];
  lastReportedAtByTask = /* @__PURE__ */ new Map();
  throttleOrder = [];
  unsubscribe = null;
  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = onTaskCompleted((payload) => {
      this.handleCompletion(payload);
    });
  }
  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.seenEventIds.clear();
    this.seenEventOrder.length = 0;
    this.lastReportedAtByTask.clear();
    this.throttleOrder.length = 0;
  }
  handleCompletion(payload) {
    const eventId = buildEventId(payload);
    if (this.seenEventIds.has(eventId)) {
      return;
    }
    const throttleKey = buildThrottleKey$1(payload);
    const finishedAtMs = parseTimestampMs$1(payload.finishedAt);
    if (this.shouldThrottle(throttleKey, finishedAtMs)) {
      this.markSeen(eventId);
      return;
    }
    this.markSeen(eventId);
    this.markReported(throttleKey, finishedAtMs);
    const notice = buildNotice(payload);
    this.deps.notifyButler(notice);
    this.deps.notifyInAppCard(notice);
    if (payload.source !== "agent") {
      this.deps.notifyThreadHistoryUpdated(payload.threadId);
    }
    if (this.deps.shouldShowDesktopPopup()) {
      this.deps.enqueueDesktopPopup(notice);
    }
  }
  markSeen(eventId) {
    this.seenEventIds.add(eventId);
    this.seenEventOrder.push(eventId);
    if (this.seenEventOrder.length <= MAX_SEEN_EVENT_IDS$1) {
      return;
    }
    const staleId = this.seenEventOrder.shift();
    if (!staleId) return;
    this.seenEventIds.delete(staleId);
  }
  shouldThrottle(taskKey, atMs) {
    const lastAt = this.lastReportedAtByTask.get(taskKey);
    if (lastAt === void 0) return false;
    return atMs - lastAt < TASK_DONE_THROTTLE_MS$1;
  }
  markReported(taskKey, atMs) {
    this.lastReportedAtByTask.set(taskKey, atMs);
    this.throttleOrder.push({ taskKey, atMs });
    while (this.throttleOrder.length > MAX_THROTTLE_ENTRIES$1) {
      const stale = this.throttleOrder.shift();
      if (!stale) return;
      const latest = this.lastReportedAtByTask.get(stale.taskKey);
      if (latest === stale.atMs) {
        this.lastReportedAtByTask.delete(stale.taskKey);
      }
    }
  }
}
const MAX_SEEN_EVENT_IDS = 1e4;
const TASK_DONE_THROTTLE_MS = 6e4;
const MAX_THROTTLE_ENTRIES = 1e4;
function compact(text, max = 220) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}...`;
}
function parseTimestampMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
function resolveStableTaskIdentity(payload) {
  const butlerTaskId = payload.metadata.butlerTaskId;
  if (typeof butlerTaskId === "string" && butlerTaskId.trim().length > 0) {
    return `butlerTask:${butlerTaskId.trim()}`;
  }
  const taskKey = payload.metadata.taskKey;
  if (typeof taskKey === "string" && taskKey.trim().length > 0) {
    return `taskKey:${taskKey.trim()}`;
  }
  return null;
}
function resolveTaskIdentity(payload) {
  const stableIdentity = resolveStableTaskIdentity(payload);
  if (stableIdentity) {
    return stableIdentity;
  }
  return `thread:${payload.threadId}`;
}
function buildThrottleKey(payload) {
  return `${payload.source}:${resolveTaskIdentity(payload)}`;
}
function buildStartedNotice(payload) {
  const stableIdentity = resolveStableTaskIdentity(payload);
  const id = stableIdentity ? `${payload.source}:${stableIdentity}:started` : `${payload.threadId}:${payload.startedAt}:${payload.source}:started`;
  return {
    id,
    phase: "started",
    threadId: payload.threadId,
    title: payload.title || "Task Started",
    mode: payload.mode,
    source: payload.source,
    at: payload.startedAt,
    resultBrief: "任务已开始执行。"
  };
}
function buildCompletedNotice(payload) {
  const id = `${payload.threadId}:${payload.finishedAt}:${payload.source}:completed`;
  const content = payload.error ? `任务失败: ${payload.error}` : payload.result || "任务已完成。";
  const resultBrief = compact(content, 260);
  const resultDetail = [
    `任务: ${payload.title || "Task Completed"}`,
    `模式: ${payload.mode}`,
    `来源: ${payload.source}`,
    payload.error ? `错误: ${compact(payload.error, 1200)}` : null,
    payload.result ? `结果: ${compact(payload.result, 2400)}` : null
  ].filter((line) => !!line).join("\n");
  return {
    id,
    phase: "completed",
    threadId: payload.threadId,
    title: payload.title || "Task Completed",
    mode: payload.mode,
    source: payload.source,
    at: payload.finishedAt,
    resultBrief,
    resultDetail
  };
}
class TaskLifecycleButlerBus {
  constructor(deps) {
    this.deps = deps;
  }
  seenEventIds = /* @__PURE__ */ new Set();
  seenEventOrder = [];
  lastReportedAtByTask = /* @__PURE__ */ new Map();
  throttleOrder = [];
  unsubscribeStarted = null;
  unsubscribeCompleted = null;
  start() {
    if (this.unsubscribeStarted || this.unsubscribeCompleted) return;
    this.unsubscribeStarted = onTaskStarted((payload) => {
      this.handleNotice(buildStartedNotice(payload));
    });
    this.unsubscribeCompleted = onTaskCompleted((payload) => {
      const notice = buildCompletedNotice(payload);
      if (this.shouldThrottleCompletion(payload)) {
        this.markSeen(notice.id);
        return;
      }
      this.handleNotice(notice);
    });
  }
  stop() {
    if (this.unsubscribeStarted) {
      this.unsubscribeStarted();
      this.unsubscribeStarted = null;
    }
    if (this.unsubscribeCompleted) {
      this.unsubscribeCompleted();
      this.unsubscribeCompleted = null;
    }
    this.seenEventIds.clear();
    this.seenEventOrder.length = 0;
    this.lastReportedAtByTask.clear();
    this.throttleOrder.length = 0;
  }
  handleNotice(notice) {
    if (this.seenEventIds.has(notice.id)) return;
    this.markSeen(notice.id);
    this.deps.notifyButler(notice);
  }
  markSeen(eventId) {
    this.seenEventIds.add(eventId);
    this.seenEventOrder.push(eventId);
    if (this.seenEventOrder.length <= MAX_SEEN_EVENT_IDS) {
      return;
    }
    const staleId = this.seenEventOrder.shift();
    if (!staleId) return;
    this.seenEventIds.delete(staleId);
  }
  shouldThrottleCompletion(payload) {
    const taskKey = buildThrottleKey(payload);
    const finishedAtMs = parseTimestampMs(payload.finishedAt);
    const lastAt = this.lastReportedAtByTask.get(taskKey);
    if (lastAt !== void 0 && finishedAtMs - lastAt < TASK_DONE_THROTTLE_MS) {
      return true;
    }
    this.lastReportedAtByTask.set(taskKey, finishedAtMs);
    this.throttleOrder.push({ taskKey, atMs: finishedAtMs });
    while (this.throttleOrder.length > MAX_THROTTLE_ENTRIES) {
      const stale = this.throttleOrder.shift();
      if (!stale) return false;
      const latest = this.lastReportedAtByTask.get(stale.taskKey);
      if (latest === stale.atMs) {
        this.lastReportedAtByTask.delete(stale.taskKey);
      }
    }
    return false;
  }
}
const ACTIONBOOK_BRIDGE_PORT = 19222;
const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><]/g;
const OSC_REGEX = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g;
function sanitizeActionbookOutput(raw) {
  return raw.replace(OSC_REGEX, "").replace(ANSI_REGEX, "").replace(/\r/g, "\n").replace(/\u0007/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
function splitActionbookLines(buffer, incomingChunk) {
  const normalized = sanitizeActionbookOutput(`${buffer}${incomingChunk}`);
  const parts = normalized.split("\n");
  const remainder = parts.pop() ?? "";
  const lines = parts.map((line) => line.trim()).filter(Boolean);
  return { lines, remainder };
}
function parseActionbookLine(line) {
  const parsed = {};
  const tokenMatch = line.match(/Session token:\s*(abk_[a-zA-Z0-9]+)/i);
  if (tokenMatch) {
    parsed.token = tokenMatch[1];
  }
  const tokenFileMatch = line.match(/Token file:\s*(.+)$/i);
  if (tokenFileMatch) {
    parsed.tokenFilePath = tokenFileMatch[1].trim();
  }
  const wsMatch = line.match(/WebSocket server on\s+(ws:\/\/\S+)/i);
  if (wsMatch) {
    parsed.websocketUrl = wsMatch[1];
  }
  const extensionMatch = line.match(/Extension:\s+(.+?)\s+\(v([^)]+)\)/i);
  if (extensionMatch) {
    parsed.extensionPath = extensionMatch[1].trim();
    parsed.extensionVersion = extensionMatch[2].trim();
  }
  if (/Waiting for extension connection/i.test(line)) {
    parsed.waitingForExtension = true;
  }
  return parsed;
}
function parseActionbookStatusLine(output) {
  const text = sanitizeActionbookOutput(output).trim();
  if (!text) {
    return { bridgeRunning: false, message: "No output from status command." };
  }
  if (/Bridge server is running/i.test(text)) {
    return { bridgeRunning: true, message: text };
  }
  if (/Bridge server is not running/i.test(text)) {
    return { bridgeRunning: false, message: text };
  }
  return { bridgeRunning: false, message: text };
}
function parseActionbookPingLine(output) {
  const text = sanitizeActionbookOutput(output).trim();
  if (!text) {
    return { connected: false, message: "No output from ping command." };
  }
  if (/Extension responded/i.test(text)) {
    return { connected: true, message: text };
  }
  if (/Ping failed/i.test(text)) {
    return { connected: false, message: text };
  }
  return { connected: false, message: text };
}
function getActionbookExecutable() {
  return "actionbook";
}
async function runActionbookCommand(args, timeoutMs = 1e4) {
  return new Promise((resolve) => {
    const cmd = getActionbookExecutable();
    let proc;
    try {
      proc = node_child_process.spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: process.env,
        shell: process.platform === "win32"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to execute actionbook.";
      resolve({
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "",
        output: "",
        message
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      if (process.platform === "win32" && proc.pid) {
        node_child_process.spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true
        });
      } else {
        proc.kill("SIGTERM");
      }
      const output = sanitizeActionbookOutput(`${stdout}
${stderr}`).trim();
      resolve({
        ok: false,
        exitCode: null,
        stdout: sanitizeActionbookOutput(stdout),
        stderr: sanitizeActionbookOutput(stderr),
        output,
        message: output || "Actionbook command timed out."
      });
    }, timeoutMs);
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : "Failed to execute actionbook.";
      resolve({
        ok: false,
        exitCode: 1,
        stdout: sanitizeActionbookOutput(stdout),
        stderr: sanitizeActionbookOutput(stderr),
        output: sanitizeActionbookOutput(`${stdout}
${stderr}`).trim(),
        message
      });
    });
    proc.on("close", (exitCode) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      const cleanStdout = sanitizeActionbookOutput(stdout);
      const cleanStderr = sanitizeActionbookOutput(stderr);
      const output = sanitizeActionbookOutput(`${stdout}
${stderr}`).trim();
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout: cleanStdout,
        stderr: cleanStderr,
        output,
        message: output || (exitCode === 0 ? "OK" : "Command failed.")
      });
    });
  });
}
async function checkActionbookCli() {
  const result = await runActionbookCommand(["--version"]);
  if (!result.ok) {
    return {
      ok: false,
      message: result.message || "Actionbook CLI not found."
    };
  }
  const versionMatch = result.output.match(/actionbook\s+([0-9A-Za-z.-]+)/i);
  const version2 = versionMatch?.[1];
  return {
    ok: true,
    message: version2 ? `Actionbook CLI detected (${version2}).` : "Actionbook CLI detected.",
    version: version2
  };
}
function getActionbookSkillCandidates() {
  return [
    path$1.join(node_os.homedir(), ".agents", "skills", "actionbook", "SKILL.md"),
    path$1.join(node_os.homedir(), ".codex", "skills", "actionbook", "SKILL.md"),
    path$1.join(getOpenworkDir(), "skills", "actionbook", "SKILL.md")
  ];
}
function checkActionbookSkill() {
  const skillPath = getActionbookSkillCandidates().find((candidate) => fs$1.existsSync(candidate));
  if (!skillPath) {
    return {
      ok: false,
      message: "Actionbook skill is missing. Install with: npx skills add actionbook/actionbook"
    };
  }
  return {
    ok: true,
    message: "Actionbook skill detected.",
    path: skillPath
  };
}
function resolveActionbookExtensionVersion(manifestPath) {
  try {
    const content = fs$1.readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    return typeof parsed.version === "string" ? parsed.version : void 0;
  } catch {
    return void 0;
  }
}
function resolveActionbookExtensionPath(rawOutput) {
  const line = sanitizeActionbookOutput(rawOutput).split("\n").map((item) => item.trim()).filter(Boolean).at(-1);
  if (!line) return null;
  return line;
}
async function checkActionbookExtension(port) {
  const pathResult = await runActionbookCommand(["extension", "path"]);
  if (!pathResult.ok) {
    return {
      ok: false,
      message: pathResult.message || "Failed to detect Actionbook extension path.",
      bridgeRunning: false,
      extensionConnected: false
    };
  }
  const extensionPath = resolveActionbookExtensionPath(pathResult.stdout || pathResult.output);
  if (!extensionPath) {
    return {
      ok: false,
      message: "Actionbook extension path output is empty.",
      bridgeRunning: false,
      extensionConnected: false
    };
  }
  const manifestPath = path$1.join(extensionPath, "manifest.json");
  if (!fs$1.existsSync(manifestPath)) {
    return {
      ok: false,
      message: "Extension folder found, but manifest.json is missing.",
      path: extensionPath,
      bridgeRunning: false,
      extensionConnected: false
    };
  }
  const statusResult = await runActionbookCommand(["extension", "status", "--port", String(port)]);
  const statusInfo = parseActionbookStatusLine(statusResult.output);
  const pingResult = await runActionbookCommand(["extension", "ping", "--port", String(port)]);
  const pingInfo = parseActionbookPingLine(pingResult.output);
  return {
    ok: true,
    message: "Actionbook extension files detected.",
    path: extensionPath,
    version: resolveActionbookExtensionVersion(manifestPath),
    bridgeRunning: statusInfo.bridgeRunning,
    extensionConnected: pingInfo.connected,
    statusMessage: statusInfo.message,
    pingMessage: pingInfo.message
  };
}
function getActionbookTokenFileCandidates() {
  const localAppData = process.env["LOCALAPPDATA"];
  const xdgDataHome = process.env["XDG_DATA_HOME"];
  const candidates = [];
  if (localAppData) {
    candidates.push(path$1.join(localAppData, "actionbook", "bridge-token"));
  }
  if (xdgDataHome) {
    candidates.push(path$1.join(xdgDataHome, "actionbook", "bridge-token"));
  }
  candidates.push(path$1.join(node_os.homedir(), ".local", "share", "actionbook", "bridge-token"));
  candidates.push(path$1.join(node_os.homedir(), "Library", "Application Support", "actionbook", "bridge-token"));
  return candidates;
}
function readActionbookTokenFromFile() {
  for (const tokenPath of getActionbookTokenFileCandidates()) {
    if (!fs$1.existsSync(tokenPath)) continue;
    try {
      const token = fs$1.readFileSync(tokenPath, "utf-8").trim();
      if (token) {
        return { token, path: tokenPath };
      }
    } catch {
    }
  }
  return null;
}
async function checkActionbookPrerequisites(port) {
  const cli = await checkActionbookCli();
  const skill = checkActionbookSkill();
  const extension = cli.ok ? await checkActionbookExtension(port) : {
    ok: false,
    message: "Actionbook CLI missing. Extension checks skipped.",
    bridgeRunning: false,
    extensionConnected: false
  };
  return {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    cli,
    skill,
    extension
  };
}
class ActionbookBridgeManager {
  port;
  onLine;
  onExit;
  onError;
  process = null;
  stdoutRemainder = "";
  stderrRemainder = "";
  constructor(options) {
    this.port = options.port;
    this.onLine = options.onLine;
    this.onExit = options.onExit;
    this.onError = options.onError;
  }
  isRunning() {
    return !!this.process;
  }
  getPid() {
    return this.process?.pid;
  }
  start() {
    if (this.process) {
      return {
        started: false,
        message: "Actionbook bridge is already running.",
        pid: this.process.pid
      };
    }
    const executable = getActionbookExecutable();
    const args = ["extension", "serve", "--port", String(this.port)];
    let proc;
    try {
      proc = node_child_process.spawn(executable, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: process.env,
        shell: process.platform === "win32"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Actionbook bridge failed to start.";
      this.onError(message);
      return {
        started: false,
        message
      };
    }
    this.process = proc;
    this.stdoutRemainder = "";
    this.stderrRemainder = "";
    proc.stdout.on("data", (chunk) => {
      const parsed = splitActionbookLines(this.stdoutRemainder, chunk.toString());
      this.stdoutRemainder = parsed.remainder;
      for (const line of parsed.lines) {
        this.onLine({ source: "stdout", line });
      }
    });
    proc.stderr.on("data", (chunk) => {
      const parsed = splitActionbookLines(this.stderrRemainder, chunk.toString());
      this.stderrRemainder = parsed.remainder;
      for (const line of parsed.lines) {
        this.onLine({ source: "stderr", line });
      }
    });
    proc.on("error", (error) => {
      const message = error instanceof Error ? error.message : "Actionbook bridge failed to start.";
      this.onError(message);
    });
    proc.on("close", (code, signal) => {
      const stdoutTail = this.stdoutRemainder.trim();
      if (stdoutTail) {
        this.onLine({ source: "stdout", line: stdoutTail });
      }
      const stderrTail = this.stderrRemainder.trim();
      if (stderrTail) {
        this.onLine({ source: "stderr", line: stderrTail });
      }
      this.stdoutRemainder = "";
      this.stderrRemainder = "";
      this.process = null;
      this.onExit(code, signal);
    });
    return {
      started: true,
      message: "Actionbook bridge process started.",
      pid: proc.pid
    };
  }
  async stop() {
    if (!this.process) {
      return {
        stopped: false,
        message: "No managed Actionbook bridge process is running."
      };
    }
    const proc = this.process;
    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        resolve(this.stopNow());
      }, 4e3);
      proc.once("close", () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        resolve({
          stopped: true,
          message: "Managed Actionbook bridge process stopped."
        });
      });
      if (process.platform === "win32") {
        if (proc.pid) {
          const killer = node_child_process.spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true
          });
          killer.on("error", () => {
            proc.kill("SIGKILL");
          });
        } else {
          proc.kill("SIGKILL");
        }
      } else {
        proc.kill("SIGTERM");
      }
    });
  }
  stopNow() {
    if (!this.process) {
      return {
        stopped: false,
        message: "No managed Actionbook bridge process is running."
      };
    }
    const proc = this.process;
    this.process = null;
    this.stdoutRemainder = "";
    this.stderrRemainder = "";
    try {
      if (process.platform === "win32" && proc.pid) {
        const result = node_child_process.spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true
        });
        if (result.error) {
          throw result.error;
        }
      } else {
        proc.kill("SIGKILL");
      }
      return {
        stopped: true,
        message: "Managed Actionbook bridge process force-stopped."
      };
    } catch (error) {
      try {
        proc.kill("SIGKILL");
      } catch {
      }
      const reason = error instanceof Error ? error.message : "Failed to stop managed Actionbook bridge process.";
      return {
        stopped: false,
        message: reason
      };
    }
  }
}
function createDefaultChecks() {
  return {
    checkedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    cli: {
      ok: false,
      message: "Not checked."
    },
    skill: {
      ok: false,
      message: "Not checked."
    },
    extension: {
      ok: false,
      message: "Not checked.",
      bridgeRunning: false,
      extensionConnected: false
    }
  };
}
class ActionbookPluginService {
  port;
  emit;
  bridgeManager;
  sequence = 0;
  state;
  constructor(params) {
    this.port = params.port ?? ACTIONBOOK_BRIDGE_PORT;
    this.emit = params.emit;
    this.state = {
      enabled: params.enabled,
      bridge: {
        running: false,
        managed: false,
        port: this.port
      },
      token: null,
      tokenSource: null,
      checks: createDefaultChecks(),
      milestones: [],
      logs: [],
      lastStatusMessage: null,
      lastPingMessage: null,
      lastError: null
    };
    this.bridgeManager = new ActionbookBridgeManager({
      port: this.port,
      onLine: ({ source, line }) => {
        this.handleBridgeLine(source, line);
      },
      onExit: (code, signal) => {
        this.pushMilestone(
          "bridge_exited",
          code === 0,
          `Bridge exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`
        );
        this.state.bridge = {
          ...this.state.bridge,
          running: false,
          managed: false,
          pid: void 0
        };
        this.emitState();
        void this.refreshChecks();
      },
      onError: (message) => {
        this.recordError(message);
      }
    });
  }
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  async setEnabled(enabled) {
    this.state.enabled = enabled;
    if (!enabled && this.bridgeManager.isRunning()) {
      await this.stopBridge();
    }
    this.emitState();
    return this.getState();
  }
  async refreshChecks() {
    const checks = await checkActionbookPrerequisites(this.port);
    this.state.checks = checks;
    if (checks.extension.statusMessage) {
      this.state.lastStatusMessage = checks.extension.statusMessage;
    }
    if (checks.extension.pingMessage) {
      this.state.lastPingMessage = checks.extension.pingMessage;
    }
    this.syncBridgeStateFromChecks(checks);
    this.applyTokenFromFileFallback();
    this.emitState();
    return this.getState();
  }
  async startBridge() {
    if (!this.state.enabled) {
      this.recordError("Actionbook plugin is disabled.");
      return this.getState();
    }
    if (this.bridgeManager.isRunning()) {
      this.pushMilestone("bridge_started", true, "Managed bridge is already running.");
      this.emitState();
      return this.getState();
    }
    await this.refreshChecks();
    if (this.state.checks.extension.bridgeRunning) {
      this.pushMilestone(
        "bridge_started",
        false,
        "External bridge is already running. Managed start skipped."
      );
      this.syncBridgeStateFromChecks(this.state.checks);
      this.emitState();
      return this.getState();
    }
    const cli = await checkActionbookCli();
    if (!cli.ok) {
      this.recordError(cli.message);
      return this.getState();
    }
    const result = this.bridgeManager.start();
    this.pushSystemLog(result.message);
    this.pushMilestone("bridge_started", result.started, result.message);
    this.state.bridge = result.started ? {
      ...this.state.bridge,
      running: true,
      managed: true,
      pid: result.pid
    } : {
      ...this.state.bridge,
      running: false,
      managed: false,
      pid: void 0
    };
    this.state.lastError = result.started ? null : result.message;
    if (result.started) {
      this.applyTokenFromFileFallback();
    }
    this.emitState();
    return this.getState();
  }
  async stopBridge() {
    const result = await this.bridgeManager.stop();
    this.pushSystemLog(result.message);
    this.pushMilestone("bridge_stopped", result.stopped, result.message);
    await this.refreshChecks();
    return this.getState();
  }
  async runStatusCheck() {
    const result = await runActionbookCommand(["extension", "status", "--port", String(this.port)]);
    const parsed = parseActionbookStatusLine(result.output);
    this.state.lastStatusMessage = parsed.message;
    this.pushMilestone(
      parsed.bridgeRunning ? "status_ok" : "status_fail",
      parsed.bridgeRunning,
      parsed.message
    );
    await this.refreshChecks();
    return this.getState();
  }
  async runPingCheck() {
    const result = await runActionbookCommand(["extension", "ping", "--port", String(this.port)]);
    const parsed = parseActionbookPingLine(result.output);
    this.state.lastPingMessage = parsed.message;
    this.pushMilestone(parsed.connected ? "ping_ok" : "ping_fail", parsed.connected, parsed.message);
    await this.refreshChecks();
    return this.getState();
  }
  async shutdown() {
    if (this.bridgeManager.isRunning()) {
      await this.bridgeManager.stop();
    }
  }
  shutdownNow() {
    const result = this.bridgeManager.stopNow();
    if (!result.stopped) return;
    this.state.bridge = {
      ...this.state.bridge,
      running: false,
      managed: false,
      pid: void 0
    };
  }
  handleBridgeLine(source, rawLine) {
    const line = sanitizeActionbookOutput(rawLine).trim();
    if (!line) return;
    this.pushLog(source, line);
    const parsed = parseActionbookLine(line);
    if (parsed.websocketUrl) {
      this.state.bridge = {
        ...this.state.bridge,
        running: true,
        managed: true,
        pid: this.bridgeManager.getPid()
      };
      this.pushMilestone("bridge_started", true, `Bridge listening: ${parsed.websocketUrl}`);
    }
    if (parsed.waitingForExtension) {
      this.pushMilestone(
        "bridge_waiting_extension",
        true,
        "Bridge is waiting for extension connection."
      );
    }
    if (parsed.extensionPath) {
      this.state.checks.extension.path = parsed.extensionPath;
    }
    if (parsed.extensionVersion) {
      this.state.checks.extension.version = parsed.extensionVersion;
    }
    if (parsed.token) {
      this.setToken(parsed.token, "log");
      this.pushMilestone("token_found", true, "Session token captured from bridge logs.");
    } else if (parsed.tokenFilePath) {
      const tokenFromPath = this.readTokenAtPath(parsed.tokenFilePath);
      if (tokenFromPath) {
        this.setToken(tokenFromPath, "file");
        this.pushMilestone("token_file_found", true, "Session token loaded from token file path.");
      }
    }
    this.state.lastError = null;
    this.emitState();
  }
  syncBridgeStateFromChecks(checks) {
    if (this.bridgeManager.isRunning()) {
      this.state.bridge = {
        ...this.state.bridge,
        running: true,
        managed: true,
        pid: this.bridgeManager.getPid()
      };
      return;
    }
    if (checks.extension.bridgeRunning) {
      this.state.bridge = {
        ...this.state.bridge,
        running: true,
        managed: false,
        pid: void 0
      };
      return;
    }
    this.state.bridge = {
      ...this.state.bridge,
      running: false,
      managed: false,
      pid: void 0
    };
  }
  applyTokenFromFileFallback() {
    if (this.state.token && this.state.tokenSource === "log") return;
    const fileToken = readActionbookTokenFromFile();
    if (!fileToken) return;
    this.setToken(fileToken.token, "file");
    this.pushMilestone("token_file_found", true, `Session token loaded from ${fileToken.path}`);
  }
  setToken(token, source) {
    if (this.state.token === token && this.state.tokenSource === source) {
      return;
    }
    this.state.token = token;
    this.state.tokenSource = source;
  }
  readTokenAtPath(tokenPath) {
    if (!fs$1.existsSync(tokenPath)) return null;
    try {
      const token = fs$1.readFileSync(tokenPath, "utf-8").trim();
      return token || null;
    } catch {
      return null;
    }
  }
  pushLog(source, line) {
    const entry = {
      id: this.nextId("log"),
      at: (/* @__PURE__ */ new Date()).toISOString(),
      source,
      line
    };
    this.state.logs = [...this.state.logs, entry].slice(-300);
  }
  pushSystemLog(line) {
    this.pushLog("system", line);
  }
  pushMilestone(type, ok, message) {
    const last = this.state.milestones[this.state.milestones.length - 1];
    if (last && last.type === type && last.message === message) return;
    const milestone = {
      id: this.nextId("milestone"),
      at: (/* @__PURE__ */ new Date()).toISOString(),
      type,
      ok,
      message
    };
    this.state.milestones = [...this.state.milestones, milestone].slice(-120);
  }
  recordError(message) {
    this.state.lastError = message;
    this.pushSystemLog(message);
    this.pushMilestone("error", false, message);
    this.emitState();
  }
  emitState() {
    this.emit({
      type: "state",
      state: this.getState()
    });
  }
  nextId(prefix) {
    this.sequence += 1;
    return `${prefix}-${Date.now()}-${this.sequence}`;
  }
}
const PRESET_PLUGIN_DEFINITIONS = [
  {
    id: "actionbook",
    name: "Actionbook",
    description: "Browser automation plugin with extension bridge, runtime checks, and guided setup."
  }
];
function buildPresetPluginItems(enabledById) {
  return PRESET_PLUGIN_DEFINITIONS.map((plugin) => ({
    ...plugin,
    enabled: !!enabledById[plugin.id]
  }));
}
const ACTIONBOOK_EVENT_NAME = "plugins:actionbook:event";
function resolvePluginEnabledMap() {
  const settings = getSettings();
  return {
    actionbook: !!settings.plugins?.actionbook?.enabled
  };
}
function writePluginEnabledState(input) {
  updateSettings({
    plugins: {
      actionbook: {
        enabled: !!input.actionbook
      }
    }
  });
}
class PluginHost {
  emitter = new node_events.EventEmitter();
  actionbook;
  hydrated = false;
  constructor() {
    this.actionbook = new ActionbookPluginService({
      enabled: false,
      emit: (event) => {
        this.emitter.emit(ACTIONBOOK_EVENT_NAME, event);
      }
    });
  }
  async hydrateFromSettings() {
    if (this.hydrated) return;
    const enabledMap = resolvePluginEnabledMap();
    await this.actionbook.setEnabled(enabledMap.actionbook);
    await this.actionbook.refreshChecks();
    this.hydrated = true;
  }
  listPlugins() {
    return buildPresetPluginItems(resolvePluginEnabledMap());
  }
  async setEnabled(input) {
    await this.hydrateFromSettings();
    const enabledMap = resolvePluginEnabledMap();
    enabledMap[input.id] = input.enabled;
    writePluginEnabledState(enabledMap);
    if (input.id === "actionbook") {
      await this.actionbook.setEnabled(input.enabled);
      if (input.enabled) {
        await this.actionbook.refreshChecks();
      }
    }
    const plugin = this.listPlugins().find((item) => item.id === input.id);
    if (!plugin) {
      throw new Error(`Unknown plugin id: ${input.id}`);
    }
    return plugin;
  }
  async getActionbookState() {
    await this.hydrateFromSettings();
    return this.actionbook.getState();
  }
  async refreshActionbookChecks() {
    await this.hydrateFromSettings();
    return this.actionbook.refreshChecks();
  }
  async startActionbookBridge() {
    await this.hydrateFromSettings();
    return this.actionbook.startBridge();
  }
  async stopActionbookBridge() {
    await this.hydrateFromSettings();
    return this.actionbook.stopBridge();
  }
  async runActionbookStatus() {
    await this.hydrateFromSettings();
    return this.actionbook.runStatusCheck();
  }
  async runActionbookPing() {
    await this.hydrateFromSettings();
    return this.actionbook.runPingCheck();
  }
  onActionbookEvent(listener) {
    this.emitter.on(ACTIONBOOK_EVENT_NAME, listener);
    return () => this.emitter.off(ACTIONBOOK_EVENT_NAME, listener);
  }
  async shutdown() {
    await this.actionbook.shutdown();
  }
  shutdownNow() {
    this.actionbook.shutdownNow();
  }
}
const pluginHost = new PluginHost();
const ACTIONBOOK_EVENT_CHANNEL = "plugins:actionbook:event";
function registerPluginsIpc(ipcMain) {
  void pluginHost.hydrateFromSettings();
  ipcMain.handle("plugins:list", async () => {
    return withSpan("IPC", "plugins:list", void 0, async () => pluginHost.listPlugins());
  });
  ipcMain.handle("plugins:setEnabled", async (_event, input) => {
    return withSpan(
      "IPC",
      "plugins:setEnabled",
      { id: input.id, enabled: input.enabled },
      async () => pluginHost.setEnabled(input)
    );
  });
  ipcMain.handle("plugins:actionbook:getState", async () => {
    return withSpan(
      "IPC",
      "plugins:actionbook:getState",
      void 0,
      async () => pluginHost.getActionbookState()
    );
  });
  ipcMain.handle("plugins:actionbook:refreshChecks", async () => {
    return withSpan(
      "IPC",
      "plugins:actionbook:refreshChecks",
      void 0,
      async () => pluginHost.refreshActionbookChecks()
    );
  });
  ipcMain.handle("plugins:actionbook:start", async () => {
    return withSpan(
      "IPC",
      "plugins:actionbook:start",
      void 0,
      async () => pluginHost.startActionbookBridge()
    );
  });
  ipcMain.handle("plugins:actionbook:stop", async () => {
    return withSpan(
      "IPC",
      "plugins:actionbook:stop",
      void 0,
      async () => pluginHost.stopActionbookBridge()
    );
  });
  ipcMain.handle("plugins:actionbook:status", async () => {
    return withSpan(
      "IPC",
      "plugins:actionbook:status",
      void 0,
      async () => pluginHost.runActionbookStatus()
    );
  });
  ipcMain.handle("plugins:actionbook:ping", async () => {
    return withSpan(
      "IPC",
      "plugins:actionbook:ping",
      void 0,
      async () => pluginHost.runActionbookPing()
    );
  });
  const unsubscribe = pluginHost.onActionbookEvent((event) => {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      win.webContents.send(ACTIONBOOK_EVENT_CHANNEL, event);
    }
  });
  return () => {
    unsubscribe();
  };
}
process.on("uncaughtException", (error) => {
  console.error("[Main] Uncaught exception:", error);
  const message = error instanceof Error ? error.message : String(error);
  broadcastToast("error", `Uncaught error: ${message}`);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled rejection:", reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  broadcastToast("error", `Unhandled error: ${message}`);
});
let mainWindow = null;
let quickInputWindow = null;
let tray = null;
let taskPopupController = null;
let taskCompletionBus = null;
let taskLifecycleButlerBus = null;
let butlerMonitorManager = null;
let butlerMonitorBus = null;
let unsubscribeButlerMonitorBus = null;
let unsubscribePluginEvents = null;
let isQuitting = false;
const isDev = !electron.app.isPackaged;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1920,
    height: 1200,
    minWidth: 1536,
    minHeight: 960,
    show: false,
    frame: false,
    // Frameless mode
    backgroundColor: "#0D0D0F",
    // titleBarStyle: "hiddenInset", // Removed for custom controls
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  electron.ipcMain.on("window-minimize", () => {
    mainWindow?.minimize();
  });
  electron.ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  electron.ipcMain.on("window-close", () => {
    mainWindow?.close();
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideMainWindowToTray();
  });
  mainWindow.on("show", () => {
    if (mainWindow?.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow?.setSkipTaskbar(false);
    taskPopupController?.clear();
    updateTrayMenu();
  });
  mainWindow.on("hide", () => {
    updateTrayMenu();
  });
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function hideMainWindowToTray() {
  if (!mainWindow) return;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
  updateTrayMenu();
}
function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setSkipTaskbar(false);
  updateTrayMenu();
}
function activateThread(threadId) {
  if (!threadId || !mainWindow) return;
  mainWindow.webContents.send("threads:activate", threadId);
}
function createQuickInputWindow() {
  if (quickInputWindow) return;
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  const defaultQuickInputWidth = 860;
  const windowWidth = Math.min(Math.round(defaultQuickInputWidth * 1.5), Math.max(640, width - 80));
  const windowHeight = 156;
  const x = Math.round((width - windowWidth) / 2);
  const y = Math.round((height - windowHeight) / 4);
  quickInputWindow = new electron.BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  quickInputWindow.on("closed", () => {
    quickInputWindow = null;
  });
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    const url = new URL(process.env["ELECTRON_RENDERER_URL"]);
    url.searchParams.set("quickInput", "1");
    quickInputWindow.loadURL(url.toString());
  } else {
    quickInputWindow.loadFile(path.join(__dirname, "../renderer/index.html"), {
      query: { quickInput: "1" }
    });
  }
}
function toggleQuickInput() {
  if (!quickInputWindow) {
    createQuickInputWindow();
  }
  if (!quickInputWindow) return;
  if (quickInputWindow.isVisible()) {
    quickInputWindow.hide();
    return;
  }
  quickInputWindow.show();
  quickInputWindow.focus();
}
function updateTrayMenu() {
  if (!tray) return;
  const isVisible = !!mainWindow && mainWindow.isVisible();
  const activeRuns2 = getActiveRunCount();
  const menu = electron.Menu.buildFromTemplate([
    {
      label: `Active conversations: ${activeRuns2}`,
      enabled: false
    },
    {
      label: isVisible ? "Hide Window" : "Show Window",
      click: () => {
        if (isVisible) {
          hideMainWindowToTray();
        } else {
          showMainWindow();
        }
      }
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}
function createTray() {
  const iconPath = path.join(__dirname, "../../resources/icon.png");
  let icon = electron.nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = electron.nativeImage.createEmpty();
  }
  tray = new electron.Tray(icon);
  tray.setToolTip("Openwork");
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      hideMainWindowToTray();
    } else {
      showMainWindow();
    }
  });
  updateTrayMenu();
}
electron.app.whenReady().then(async () => {
  if (process.platform === "win32") {
    electron.app.setAppUserModelId(isDev ? process.execPath : "com.langchain.openwork");
  }
  if (process.platform === "darwin" && electron.app.dock) {
    const iconPath = path.join(__dirname, "../../resources/icon.png");
    try {
      const icon = electron.nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        electron.app.dock.setIcon(icon);
      }
    } catch {
    }
  }
  if (isDev) {
    electron.app.on("browser-window-created", (_, window) => {
      window.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
          window.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
    });
  }
  await initializeDatabase();
  await initializeMemoryService();
  await generateDailyProfileOnStartup();
  await butlerManager.initialize();
  butlerMonitorBus = new ButlerMonitorBus();
  butlerMonitorManager = new ButlerMonitorManager({
    bus: butlerMonitorBus,
    perceptionGateway: {
      ingest: async (input) => {
        return butlerManager.ingestPerception(input);
      }
    },
    onNotice: (notice) => {
      broadcastTaskCard(notice);
      if (!mainWindow || !mainWindow.isVisible() || mainWindow.isMinimized()) {
        taskPopupController?.enqueue(notice);
      }
    }
  });
  unsubscribeButlerMonitorBus = butlerMonitorBus.onEvent((event) => {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      win.webContents.send("butler-monitor:event", event);
    }
  });
  loopManager.resetAllOnStartup();
  registerAgentHandlers(electron.ipcMain);
  registerThreadHandlers(electron.ipcMain);
  registerModelHandlers(electron.ipcMain);
  registerSubagentHandlers(electron.ipcMain);
  registerSkillHandlers(electron.ipcMain);
  registerToolHandlers(electron.ipcMain);
  registerMiddlewareHandlers(electron.ipcMain);
  registerDockerHandlers(electron.ipcMain);
  registerAttachmentHandlers(electron.ipcMain);
  registerMcpHandlers(electron.ipcMain);
  registerSettingsHandlers(electron.ipcMain, {
    onSettingsUpdated: () => {
      butlerMonitorManager?.refreshIntervals();
    }
  });
  registerSpeechHandlers(electron.ipcMain);
  registerLoopHandlers(electron.ipcMain);
  registerButlerHandlers(electron.ipcMain);
  if (butlerMonitorManager) {
    registerButlerMonitorHandlers(electron.ipcMain, butlerMonitorManager);
  }
  registerPromptHandlers(electron.ipcMain);
  registerMemoryHandlers(electron.ipcMain);
  unsubscribePluginEvents = registerPluginsIpc(electron.ipcMain);
  await startAutoMcpServers();
  createWindow();
  createTray();
  const rendererHtmlPath = path.join(__dirname, "../renderer/index.html");
  const preloadPath = path.join(__dirname, "../preload/index.js");
  const rendererUrl = isDev ? process.env["ELECTRON_RENDERER_URL"] : void 0;
  taskPopupController = new TaskPopupController({
    rendererUrl,
    rendererHtmlPath,
    preloadPath,
    showMainWindow,
    activateThread
  });
  taskCompletionBus = new TaskCompletionBus({
    notifyButler: () => {
    },
    notifyInAppCard: (notice) => {
      broadcastTaskCard(notice);
    },
    notifyThreadHistoryUpdated: (threadId) => {
      broadcastThreadHistoryUpdated(threadId);
    },
    shouldShowDesktopPopup: () => {
      if (!mainWindow) return false;
      return !mainWindow.isVisible() || mainWindow.isMinimized();
    },
    enqueueDesktopPopup: (notice) => {
      taskPopupController?.enqueue(notice);
    }
  });
  taskCompletionBus.start();
  taskLifecycleButlerBus = new TaskLifecycleButlerBus({
    notifyButler: (notice) => {
      butlerManager.notifyLifecycleNotice(notice);
    }
  });
  taskLifecycleButlerBus.start();
  butlerMonitorManager?.start();
  electron.ipcMain.on("app:show-main", () => {
    showMainWindow();
  });
  electron.ipcMain.on("app:activate-thread", (_event, threadId) => {
    showMainWindow();
    activateThread(threadId);
  });
  electron.ipcMain.on("app:open-settings", () => {
    showMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("app:open-settings");
    }
  });
  electron.ipcMain.on("app:open-butler", () => {
    showMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("app:open-butler");
    }
  });
  electron.ipcMain.on("quick-input:hide", () => {
    quickInputWindow?.hide();
  });
  electron.ipcMain.on("task-popup:hover", (_event, payload) => {
    const hovered = typeof payload === "boolean" ? payload : !!(payload && typeof payload === "object" && payload.hovered);
    taskPopupController?.setHover(hovered);
  });
  electron.ipcMain.on("task-popup:open-thread", (_event, payload) => {
    let threadId = "";
    let noticeId;
    if (typeof payload === "string") {
      threadId = payload;
    } else if (payload && typeof payload === "object") {
      const parsed = payload;
      if (typeof parsed.threadId === "string") {
        threadId = parsed.threadId;
      }
      if (typeof parsed.noticeId === "string") {
        noticeId = parsed.noticeId;
      }
    }
    if (!threadId) return;
    taskPopupController?.openThread(threadId, noticeId);
  });
  electron.ipcMain.on("task-popup:dismiss", (_event, payload) => {
    let noticeId;
    if (typeof payload === "string") {
      noticeId = payload;
    } else if (payload && typeof payload === "object") {
      const parsed = payload;
      if (typeof parsed.noticeId === "string") {
        noticeId = parsed.noticeId;
      }
    }
    taskPopupController?.dismiss(noticeId);
  });
  startEmailPolling();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  const shortcutRegistered = electron.globalShortcut.register("Control+Alt+Space", () => {
    toggleQuickInput();
  });
  if (!shortcutRegistered) {
    console.warn("[Main] Failed to register global shortcut Control+Alt+Space");
  }
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  isQuitting = true;
  electron.globalShortcut.unregisterAll();
  taskCompletionBus?.stop();
  taskCompletionBus = null;
  taskLifecycleButlerBus?.stop();
  taskLifecycleButlerBus = null;
  taskPopupController?.dispose();
  taskPopupController = null;
  stopEmailPolling();
  butlerMonitorManager?.stop();
  butlerMonitorManager = null;
  if (unsubscribeButlerMonitorBus) {
    unsubscribeButlerMonitorBus();
    unsubscribeButlerMonitorBus = null;
  }
  if (unsubscribePluginEvents) {
    unsubscribePluginEvents();
    unsubscribePluginEvents = null;
  }
  butlerMonitorBus = null;
  loopManager.stopAll();
  butlerManager.shutdown();
  pluginHost.shutdownNow();
  void stopMemoryService();
  void flushMemoryDatabase();
});
