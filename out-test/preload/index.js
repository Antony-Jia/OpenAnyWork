"use strict";
const electron = require("electron");
const electronAPI = {
  ipcRenderer: {
    send: (channel, ...args) => electron.ipcRenderer.send(channel, ...args),
    on: (channel, listener) => {
      const wrappedListener = (_event, ...args) => listener(...args);
      electron.ipcRenderer.on(channel, wrappedListener);
      return () => electron.ipcRenderer.removeListener(channel, wrappedListener);
    },
    once: (channel, listener) => {
      const wrappedListener = (_event, ...args) => listener(...args);
      electron.ipcRenderer.once(channel, wrappedListener);
    },
    invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args)
  },
  process: {
    platform: process.platform,
    versions: process.versions
  }
};
const api = {
  agent: {
    // Send message and receive events via callback
    invoke: (threadId, message, onEvent, modelId) => {
      const channel = `agent:stream:${threadId}`;
      const handler = (_, data) => {
        onEvent(data);
        if (data.type === "done" || data.type === "error") {
          electron.ipcRenderer.removeListener(channel, handler);
        }
      };
      electron.ipcRenderer.on(channel, handler);
      electron.ipcRenderer.send("agent:invoke", { threadId, message, modelId });
      return () => {
        electron.ipcRenderer.removeListener(channel, handler);
      };
    },
    // Stream agent events for useStream transport
    streamAgent: (threadId, message, command, onEvent, modelId) => {
      const channel = `agent:stream:${threadId}`;
      const handler = (_, data) => {
        onEvent(data);
        if (data.type === "done" || data.type === "error") {
          electron.ipcRenderer.removeListener(channel, handler);
        }
      };
      electron.ipcRenderer.on(channel, handler);
      if (command) {
        electron.ipcRenderer.send("agent:resume", { threadId, command, modelId });
      } else {
        electron.ipcRenderer.send("agent:invoke", { threadId, message, modelId });
      }
      return () => {
        electron.ipcRenderer.removeListener(channel, handler);
      };
    },
    interrupt: (threadId, decision, onEvent) => {
      const channel = `agent:stream:${threadId}`;
      const handler = (_, data) => {
        onEvent?.(data);
        if (data.type === "done" || data.type === "error") {
          electron.ipcRenderer.removeListener(channel, handler);
        }
      };
      electron.ipcRenderer.on(channel, handler);
      electron.ipcRenderer.send("agent:interrupt", { threadId, decision });
      return () => {
        electron.ipcRenderer.removeListener(channel, handler);
      };
    },
    cancel: (threadId) => {
      return electron.ipcRenderer.invoke("agent:cancel", { threadId });
    }
  },
  threads: {
    list: () => {
      return electron.ipcRenderer.invoke("threads:list");
    },
    get: (threadId) => {
      return electron.ipcRenderer.invoke("threads:get", threadId);
    },
    create: (metadata) => {
      return electron.ipcRenderer.invoke("threads:create", metadata);
    },
    update: (threadId, updates) => {
      return electron.ipcRenderer.invoke("threads:update", { threadId, updates });
    },
    delete: (threadId, options) => {
      if (options) {
        return electron.ipcRenderer.invoke("threads:delete", { threadId, options });
      }
      return electron.ipcRenderer.invoke("threads:delete", threadId);
    },
    getHistory: (threadId) => {
      return electron.ipcRenderer.invoke("threads:history", threadId);
    },
    getRalphLogTail: (threadId, limit) => {
      return electron.ipcRenderer.invoke("threads:ralphLogTail", threadId, limit);
    },
    generateTitle: (message) => {
      return electron.ipcRenderer.invoke("threads:generateTitle", message);
    }
  },
  loop: {
    getConfig: (threadId) => {
      return electron.ipcRenderer.invoke("loop:getConfig", threadId);
    },
    updateConfig: (threadId, config) => {
      return electron.ipcRenderer.invoke("loop:updateConfig", { threadId, config });
    },
    start: (threadId) => {
      return electron.ipcRenderer.invoke("loop:start", threadId);
    },
    stop: (threadId) => {
      return electron.ipcRenderer.invoke("loop:stop", threadId);
    },
    status: (threadId) => {
      return electron.ipcRenderer.invoke("loop:status", threadId);
    }
  },
  butler: {
    getState: () => {
      return electron.ipcRenderer.invoke("butler:getState");
    },
    send: (message) => {
      return electron.ipcRenderer.invoke("butler:send", message);
    },
    listTasks: () => {
      return electron.ipcRenderer.invoke("butler:listTasks");
    },
    clearHistory: () => {
      return electron.ipcRenderer.invoke("butler:clearHistory");
    },
    clearTasks: () => {
      return electron.ipcRenderer.invoke("butler:clearTasks");
    },
    onTaskUpdate: (callback) => {
      const handler = (_, tasks) => callback(tasks);
      electron.ipcRenderer.on("butler:tasks-changed", handler);
      return () => electron.ipcRenderer.removeListener("butler:tasks-changed", handler);
    },
    onTaskCompleted: (callback) => {
      const handler = (_, card) => callback(card);
      electron.ipcRenderer.on("app:task-card", handler);
      return () => electron.ipcRenderer.removeListener("app:task-card", handler);
    }
  },
  butlerMonitor: {
    getSnapshot: () => {
      return electron.ipcRenderer.invoke("butler-monitor:getSnapshot");
    },
    listCalendarEvents: () => {
      return electron.ipcRenderer.invoke("butler-monitor:calendar:list");
    },
    createCalendarEvent: (input) => {
      return electron.ipcRenderer.invoke("butler-monitor:calendar:create", input);
    },
    updateCalendarEvent: (id, updates) => {
      return electron.ipcRenderer.invoke("butler-monitor:calendar:update", { id, updates });
    },
    deleteCalendarEvent: (id) => {
      return electron.ipcRenderer.invoke("butler-monitor:calendar:delete", id);
    },
    listCountdownTimers: () => {
      return electron.ipcRenderer.invoke("butler-monitor:countdown:list");
    },
    createCountdownTimer: (input) => {
      return electron.ipcRenderer.invoke("butler-monitor:countdown:create", input);
    },
    updateCountdownTimer: (id, updates) => {
      return electron.ipcRenderer.invoke("butler-monitor:countdown:update", { id, updates });
    },
    deleteCountdownTimer: (id) => {
      return electron.ipcRenderer.invoke("butler-monitor:countdown:delete", id);
    },
    listMailRules: () => {
      return electron.ipcRenderer.invoke("butler-monitor:mail:listRules");
    },
    createMailRule: (input) => {
      return electron.ipcRenderer.invoke("butler-monitor:mail:createRule", input);
    },
    updateMailRule: (id, updates) => {
      return electron.ipcRenderer.invoke("butler-monitor:mail:updateRule", { id, updates });
    },
    deleteMailRule: (id) => {
      return electron.ipcRenderer.invoke("butler-monitor:mail:deleteRule", id);
    },
    listRecentMails: (limit) => {
      return electron.ipcRenderer.invoke("butler-monitor:mail:listMessages", limit);
    },
    pullMailNow: () => {
      return electron.ipcRenderer.invoke("butler-monitor:mail:pullNow");
    },
    onEvent: (callback) => {
      const handler = (_, event) => callback(event);
      electron.ipcRenderer.on("butler-monitor:event", handler);
      return () => electron.ipcRenderer.removeListener("butler-monitor:event", handler);
    }
  },
  prompts: {
    list: (query) => {
      return electron.ipcRenderer.invoke("prompts:list", query);
    },
    get: (id) => {
      return electron.ipcRenderer.invoke("prompts:get", id);
    },
    create: (input) => {
      return electron.ipcRenderer.invoke("prompts:create", input);
    },
    update: (id, updates) => {
      return electron.ipcRenderer.invoke("prompts:update", { id, updates });
    },
    delete: (id) => {
      return electron.ipcRenderer.invoke("prompts:delete", id);
    }
  },
  memory: {
    listConversationSummaries: (limit) => {
      return electron.ipcRenderer.invoke("memory:listConversationSummaries", limit);
    },
    listDailyProfiles: (limit) => {
      return electron.ipcRenderer.invoke("memory:listDailyProfiles", limit);
    },
    clearAll: () => {
      return electron.ipcRenderer.invoke("memory:clearAll");
    }
  },
  models: {
    list: () => {
      return electron.ipcRenderer.invoke("models:list");
    },
    listProviders: () => {
      return electron.ipcRenderer.invoke("models:listProviders");
    },
    getDefault: () => {
      return electron.ipcRenderer.invoke("models:getDefault");
    },
    setDefault: (modelId) => {
      return electron.ipcRenderer.invoke("models:setDefault", modelId);
    },
    setApiKey: (provider, apiKey) => {
      return electron.ipcRenderer.invoke("models:setApiKey", { provider, apiKey });
    },
    getApiKey: (provider) => {
      return electron.ipcRenderer.invoke("models:getApiKey", provider);
    },
    deleteApiKey: (provider) => {
      return electron.ipcRenderer.invoke("models:deleteApiKey", provider);
    }
  },
  provider: {
    getConfig: () => {
      return electron.ipcRenderer.invoke("provider:getConfig");
    },
    setConfig: (config) => {
      return electron.ipcRenderer.invoke("provider:setConfig", config);
    }
  },
  attachments: {
    pick: (input) => {
      return electron.ipcRenderer.invoke("attachments:pick", input);
    }
  },
  subagents: {
    list: () => {
      return electron.ipcRenderer.invoke("subagents:list");
    },
    create: (input) => {
      return electron.ipcRenderer.invoke("subagents:create", input);
    },
    update: (id, updates) => {
      return electron.ipcRenderer.invoke("subagents:update", { id, updates });
    },
    delete: (id) => {
      return electron.ipcRenderer.invoke("subagents:delete", id);
    }
  },
  skills: {
    list: () => {
      return electron.ipcRenderer.invoke("skills:list");
    },
    scan: () => {
      return electron.ipcRenderer.invoke("skills:scan");
    },
    create: (input) => {
      return electron.ipcRenderer.invoke("skills:create", input);
    },
    install: (input) => {
      return electron.ipcRenderer.invoke("skills:install", input);
    },
    delete: (name) => {
      return electron.ipcRenderer.invoke("skills:delete", name);
    },
    setEnabled: (input) => {
      return electron.ipcRenderer.invoke("skills:setEnabled", input);
    },
    setEnabledScope: (input) => {
      return electron.ipcRenderer.invoke("skills:setEnabledScope", input);
    },
    getContent: (name) => {
      return electron.ipcRenderer.invoke("skills:getContent", name);
    },
    saveContent: (input) => {
      return electron.ipcRenderer.invoke("skills:saveContent", input);
    }
  },
  tools: {
    list: () => {
      return electron.ipcRenderer.invoke("tools:list");
    },
    setKey: (input) => {
      return electron.ipcRenderer.invoke("tools:setKey", input);
    },
    setEnabled: (input) => {
      return electron.ipcRenderer.invoke("tools:setEnabled", input);
    },
    setEnabledScope: (input) => {
      return electron.ipcRenderer.invoke("tools:setEnabledScope", input);
    }
  },
  middleware: {
    list: () => {
      return electron.ipcRenderer.invoke("middleware:list");
    }
  },
  docker: {
    check: () => {
      return electron.ipcRenderer.invoke("docker:check");
    },
    getConfig: () => {
      return electron.ipcRenderer.invoke("docker:getConfig");
    },
    setConfig: (config) => {
      return electron.ipcRenderer.invoke("docker:setConfig", config);
    },
    status: () => {
      return electron.ipcRenderer.invoke("docker:status");
    },
    enter: () => {
      return electron.ipcRenderer.invoke("docker:enter");
    },
    exit: () => {
      return electron.ipcRenderer.invoke("docker:exit");
    },
    restart: () => {
      return electron.ipcRenderer.invoke("docker:restart");
    },
    runtimeConfig: () => {
      return electron.ipcRenderer.invoke("docker:runtimeConfig");
    },
    selectMountPath: (currentPath) => {
      return electron.ipcRenderer.invoke("docker:selectMountPath", currentPath);
    },
    mountFiles: () => {
      return electron.ipcRenderer.invoke("docker:mountFiles");
    }
  },
  settings: {
    get: () => {
      return electron.ipcRenderer.invoke("settings:get");
    },
    update: (input) => {
      return electron.ipcRenderer.invoke("settings:update", input);
    }
  },
  plugins: {
    list: () => {
      return electron.ipcRenderer.invoke("plugins:list");
    },
    setEnabled: (input) => {
      return electron.ipcRenderer.invoke("plugins:setEnabled", input);
    },
    actionbookGetState: () => {
      return electron.ipcRenderer.invoke("plugins:actionbook:getState");
    },
    actionbookRefreshChecks: () => {
      return electron.ipcRenderer.invoke("plugins:actionbook:refreshChecks");
    },
    actionbookStart: () => {
      return electron.ipcRenderer.invoke("plugins:actionbook:start");
    },
    actionbookStop: () => {
      return electron.ipcRenderer.invoke("plugins:actionbook:stop");
    },
    actionbookStatus: () => {
      return electron.ipcRenderer.invoke("plugins:actionbook:status");
    },
    actionbookPing: () => {
      return electron.ipcRenderer.invoke("plugins:actionbook:ping");
    },
    onActionbookEvent: (callback) => {
      const handler = (_, event) => callback(event);
      electron.ipcRenderer.on("plugins:actionbook:event", handler);
      return () => electron.ipcRenderer.removeListener("plugins:actionbook:event", handler);
    }
  },
  speech: {
    stt: (input) => {
      return electron.ipcRenderer.invoke("speech:stt", input);
    },
    tts: (input) => {
      return electron.ipcRenderer.invoke("speech:tts", input);
    }
  },
  mcp: {
    list: () => {
      return electron.ipcRenderer.invoke("mcp:list");
    },
    tools: () => {
      return electron.ipcRenderer.invoke("mcp:tools");
    },
    create: (input) => {
      return electron.ipcRenderer.invoke("mcp:create", input);
    },
    update: (input) => {
      return electron.ipcRenderer.invoke("mcp:update", input);
    },
    delete: (id) => {
      return electron.ipcRenderer.invoke("mcp:delete", id);
    },
    start: (id) => {
      return electron.ipcRenderer.invoke("mcp:start", id);
    },
    stop: (id) => {
      return electron.ipcRenderer.invoke("mcp:stop", id);
    }
  },
  workspace: {
    get: (threadId) => {
      return electron.ipcRenderer.invoke("workspace:get", threadId);
    },
    set: (threadId, path) => {
      return electron.ipcRenderer.invoke("workspace:set", { threadId, path });
    },
    select: (threadId) => {
      return electron.ipcRenderer.invoke("workspace:select", threadId);
    },
    loadFromDisk: (threadId) => {
      return electron.ipcRenderer.invoke("workspace:loadFromDisk", { threadId });
    },
    readFile: (threadId, filePath) => {
      return electron.ipcRenderer.invoke("workspace:readFile", { threadId, filePath });
    },
    readBinaryFile: (threadId, filePath) => {
      return electron.ipcRenderer.invoke("workspace:readBinaryFile", { threadId, filePath });
    },
    // Listen for file changes in the workspace
    onFilesChanged: (callback) => {
      const handler = (_, data) => {
        callback(data);
      };
      electron.ipcRenderer.on("workspace:files-changed", handler);
      return () => {
        electron.ipcRenderer.removeListener("workspace:files-changed", handler);
      };
    }
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
