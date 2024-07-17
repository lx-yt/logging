type Arguments = unknown[];

type Handler = (...args: Arguments) => void;

type Color = [number, number, number];

interface Theme {
  bg: Color;
  fg: Color;
}

interface HandlerConfig {
  handler: Handler;
  levelValue: number;
}

interface Logger {
  (level: string): Handler;

  trace: Handler;
  debug: Handler;
  log: Handler;
  info: Handler;
  warn: Handler;
  error: Handler;
  fatal: Handler;

  as: (level: string) => Handler;

  // TODO: #1 use Map instead.
  loggers: Map<string, Logger>;
  getLogger: (namespace: string, config?: LoggerConfig) => Logger;

  getHandlers: () => Record<string, HandlerConfig>;

  namespace: string;

  level: string;
  minLevel: string;

  enabled: boolean;
  // TODO!: add a way to override enabled for all children, permanently (setting enabled recursively would still allow them to reset it themselves in code)
}

interface LoggerConfig {
  level?: string;
  minLevel?: string;
  enabled?: boolean;
}

// TODO!: define global config that affects all loggers (e.g.: to set minLevel for all loggers)
//const globalConfig: LoggerConfig = {};

// TODO: replace this by just accessing the respective logger's config property and adding a "loadedConfigs" variable from which to read the persistent configs.
const namespaceConfigs: Record<string, LoggerConfig> = {};

const loadNamespaceConfigsFromLocalStorage = () => {
  const nc = window.localStorage.getItem("LOGGING_NAMESPACE_CONFIG");
  if (nc) {
    const ncObj = JSON.parse(nc) as Record<string, LoggerConfig>;

    for (const [key, value] of Object.entries(ncObj)) {
      namespaceConfigs[key] = value;
    }
  }
};
loadNamespaceConfigsFromLocalStorage();

// TODO: find a way to enforce a global config without overriding the original namespace values.
const getNamespaceConfig = (namespace: string) => {
  return { ...namespaceConfigs[namespace], ...namespaceConfigs["*"] };
};

const handlers: Record<string, HandlerConfig> = {};
handlers["NONE"] = { handler: console.log.bind(console), levelValue: 0 };

const defineRelativeHandler = (
  name: string,
  siblingName: string,
  relation: -1 | 0 | 1,
  handler: Handler,
  override = false
) => {
  name = name.toUpperCase();
  siblingName = siblingName.toUpperCase();
  const sibling = handlers[siblingName];
  if (sibling === undefined) {
    console.warn(`No handler named '${siblingName}' found`); // Using basic console.warn inside the logging module to avoid potential problems.
    return;
  }

  const targetLevel = sibling.levelValue + (relation === 1 ? 1 : 0);

  if (relation !== 0) {
    for (const [, value] of Object.entries(handlers)) {
      if (value.levelValue >= targetLevel) {
        value.levelValue++;
      }
    }
  }

  if (handlers[name] === undefined || override) {
    handlers[name] = { handler, levelValue: targetLevel };
  }
};

const getHandlers = () => {
  return { ...handlers };
};

const colorize = (
  text: string,
  r: number | undefined,
  g: number | undefined,
  b: number | undefined,
  fgR: number | undefined,
  fgG: number | undefined,
  fgB: number | undefined
) => {
  if (r === undefined) {
    r = Math.floor(Math.random() * 200);
  }
  if (g === undefined) {
    g = Math.floor(Math.random() * 200);
  }
  if (b === undefined) {
    b = Math.floor(Math.random() * 200);
  }

  if (fgR === undefined) {
    fgR = Math.floor(Math.random() * 200);
  }
  if (fgG === undefined) {
    fgG = Math.floor(Math.random() * 200);
  }
  if (fgB === undefined) {
    fgB = Math.floor(Math.random() * 200);
  }
  return `\x1b[48;2;${r.toString()};${g.toString()};${b.toString()};38;2;${fgR.toString()};${fgG.toString()};${fgB.toString()}m${text}`;
};

const themes: Record<string, Theme> = {
  NONE: { bg: [255, 255, 255], fg: [0, 0, 0] },
  TRACE: { bg: [255, 255, 200], fg: [0, 0, 0] },
  DEBUG: { bg: [200, 255, 200], fg: [0, 0, 0] },
  LOG: { bg: [230, 230, 230], fg: [0, 0, 0] },
  INFO: { bg: [200, 255, 255], fg: [0, 0, 0] },
  WARN: { bg: [255, 180, 0], fg: [0, 0, 0] },
  ERROR: { bg: [255, 130, 130], fg: [0, 0, 0] },
  FATAL: { bg: [255, 0, 0], fg: [255, 255, 255] },
};

const theme = (text: string, themeName: string) => {
  const theme = themes[themeName] ?? {
    bg: [255, 255, 255],
    fg: [0, 0, 0],
  };
  return colorize(
    text,
    theme.bg[0],
    theme.bg[1],
    theme.bg[2],
    theme.fg[0],
    theme.fg[1],
    theme.fg[2]
  );
};

const defineConsoleHandler = (
  name: string,
  methodName: string,
  sibling: string,
  relation: -1 | 0 | 1
) => {
  name = name.toUpperCase();
  methodName = methodName.toLowerCase();
  sibling = sibling.toUpperCase();
  if (
    !["trace", "debug", "log", "info", "warn", "error"].includes(methodName)
  ) {
    throw new Error(`Invalid console method name: ${methodName}`);
  }
  const handler =
    console[
      methodName as "trace" | "debug" | "log" | "info" | "warn" | "error"
    ].bind(console);

  defineRelativeHandler(
    name.toUpperCase(),
    sibling.toUpperCase(),
    relation,
    handler
  );
};

defineConsoleHandler("TRACE", "trace", "NONE", 1);
defineConsoleHandler("DEBUG", "debug", "TRACE", 1);
defineConsoleHandler("LOG", "log", "DEBUG", 1);
defineConsoleHandler("INFO", "info", "LOG", 1);
defineConsoleHandler("WARN", "warn", "INFO", 1);
defineConsoleHandler("ERROR", "error", "WARN", 1);
defineRelativeHandler("FATAL", "error", 1, console.error.bind(console));

if (!handlers["LOG"]) {
  throw new Error("No handler named 'LOG' found");
}
const DEFAULT_LEVEL = "LOG";
const DEFAULT_MIN_LEVEL = "INFO";

const DEFAULT_HANDLER_CONFIG = handlers[DEFAULT_LEVEL];

const getHandlerConfig = (level: string) =>
  handlers[level.toUpperCase()] ?? DEFAULT_HANDLER_CONFIG;

const getLoggerRec = (
  startAt: Logger,
  namespace: string,
  config?: LoggerConfig
) => {
  const namespaces = namespace.split(":");
  let logger = startAt;
  for (const name of namespaces) {
    logger = logger.getLogger(name, config);
  }
  return logger;
};

const getLoggerGlobally = (namespace: string, config?: LoggerConfig) => {
  if (namespace === "*") {
    return RootLogger;
  }
  //removing '*:' prefix since that just represents that we want to start at the RootLogger level, and would otherwise cause an infinite loop
  return getLoggerRec(RootLogger, namespace.slice(2), config);
};

const createPrefix = (level: string, namespace: string) => {
  let l = `[${level}]`;
  if (themes[level] !== undefined) {
    l = theme(l, level);
  }
  const n = `[${namespace}]`;
  return l + n;
};

// TODO!: consider having everything configurable be overidable by namespaceConfig. Prioritize globalConfig over namespaceConfig over config parameter.

const createLogger = (namespace: string, config?: LoggerConfig) => {
  const {
    level: configLevel,
    minLevel: configMinLevel,
    enabled: configEnabled,
  } = config ?? {};

  const { enabled: namespaceEnabled, minLevel: namespaceMinLevel } =
    getNamespaceConfig(namespace);

  const _namespace = namespace;

  let _level: string;
  let _minLevelConfig = {
    name: "",
    levelValue: 0,
  };

  let handlerConfig: HandlerConfig;

  let _enabled = namespaceEnabled ?? configEnabled ?? true;

  const logger: Logger = (() => {
    const l = Object.assign(
      (level: string) => {
        const upperCaseLevel = level.toUpperCase();
        const handlerConfig = handlers[upperCaseLevel];
        const handler = handlerConfig?.handler;
        if (handler === undefined || handlerConfig === undefined) {
          const fallbackHandler = handlers["ERROR"];
          if (!fallbackHandler) {
            throw new Error("No handler named 'ERROR' found");
          }
          return fallbackHandler.handler.bind(
            null, // TODO: make sure it is okay for this to not be console or whatever would be needed for methods that log to somewhere else.
            createPrefix(upperCaseLevel, _namespace) + "[Invalid logging level]"
          );
        }
        if (
          !logger.enabled ||
          handlerConfig.levelValue < _minLevelConfig.levelValue
        ) {
          return () => {
            /* do nothing */
          };
        }
        return handler.bind(
          null, // TODO: make sure it is okay for this to not be console or whatever would be needed for methods that log to somewhere else.
          createPrefix(upperCaseLevel, _namespace)
        );
      },
      // TODO: now that direct logging uses a simple call on the Logger itself, as() should become the unsafe variant.
      {
        as: (level: string) => {
          const local_handlerConfig = handlers[level.toUpperCase()];
          if (local_handlerConfig === undefined) {
            throw new Error(
              `No handler named '${level.toUpperCase()}' found (Original case: '${level}').`
            );
          }
          if (
            !logger.enabled ||
            local_handlerConfig.levelValue < _minLevelConfig.levelValue
          ) {
            return () => {
              /* do nothing */
            };
          }
          return local_handlerConfig.handler.bind(
            null, // TODO: make sure it is okay for this to not be console or whatever would be needed for methods that log to somewhere else.
            createPrefix(level.toUpperCase(), _namespace)
          );
        },

        // TODO: make this immutable
        loggers: new Map<string, Logger>(),

        getLogger: (namespace: string, config?: LoggerConfig) => {
          if (namespace.startsWith("*")) {
            return getLoggerGlobally(namespace, config);
          } else if (namespace.includes(":")) {
            return getLoggerRec(logger, namespace, config);
          }
          let l = logger.loggers.get(namespace);
          if (!l) {
            l = createLogger(logger.namespace + ":" + namespace, config);
            logger.loggers.set(namespace, l);
          }
          return l;
        },

        getHandlers: getHandlers,

        // bad... but Object.defineProperty doesn't affect types
        trace: () => {
          /* do nothing */
        },
        debug: () => {
          /* do nothing */
        },
        log: () => {
          /* do nothing */
        },
        info: () => {
          /* do nothing */
        },
        warn: () => {
          /* do nothing */
        },
        error: () => {
          /* do nothing */
        },
        fatal: () => {
          /* do nothing */
        },
        namespace: "",
        level: "",
        minLevel: "",
        enabled: true,
      }
    );

    ["trace", "debug", "info", "warn", "error", "fatal"].forEach((key) => {
      Object.defineProperty(l, key, {
        get() {
          const hc = getHandlerConfig(key);
          if (!logger.enabled || hc.levelValue < _minLevelConfig.levelValue) {
            return () => {
              /* do nothing */
            };
          }
          return hc.handler.bind(
            null, // TODO: make sure it is okay for this to not be console or whatever would be needed for methods that log to somewhere else.
            createPrefix(key.toUpperCase(), _namespace)
          );
        },
      });
    });

    Object.defineProperty(l, "log", {
      get() {
        if (
          !logger.enabled ||
          handlerConfig.levelValue < _minLevelConfig.levelValue
        ) {
          return () => {
            /* do nothing */
          };
        }
        return handlerConfig.handler;
      },
    });

    Object.defineProperty(l, "namespace", {
      get() {
        return _namespace;
      },
    });

    Object.defineProperty(l, "level", {
      get() {
        return _level;
      },

      set(name: string) {
        _level = name.toUpperCase();
        const local_handlerConfig = getHandlerConfig(_level);
        handlerConfig = {
          ...local_handlerConfig,
          handler: local_handlerConfig.handler.bind(
            null, // TODO: make sure it is okay for this to not be console or whatever would be needed for methods that log to somewhere else.
            createPrefix(_level, _namespace)
          ),
        };
      },
    });

    Object.defineProperty(l, "minLevel", {
      get() {
        return _minLevelConfig.name;
      },

      set(name: string) {
        const local_handlerConfig = getHandlerConfig(name);
        _minLevelConfig = {
          name: name.toUpperCase(),
          levelValue: local_handlerConfig.levelValue,
        };
      },
    });

    Object.defineProperty(l, "enabled", {
      get() {
        return _enabled;
      },

      set(enabled: boolean) {
        const namespaceConfig = getNamespaceConfig(namespace);
        const namespaceEnabled = namespaceConfig.enabled;
        if (namespaceEnabled === false) {
          enabled = false;
          return;
        }
        _enabled = enabled;
      },
    });

    return l;
  })();

  logger.level = configLevel ?? DEFAULT_LEVEL;
  logger.minLevel = namespaceMinLevel ?? configMinLevel ?? DEFAULT_MIN_LEVEL;

  return logger;
};

const RootLogger = createLogger("*");

export { RootLogger, defineRelativeHandler as defineHandler, themes };
