import { describe, test, expect, beforeAll, beforeEach } from "vitest";
import { RootLogger, defineHandler, themes } from "./logging";

const id = (() => {
  let runningId = 0;
  return (name?: string) => (name ?? "") + (runningId++).toString();
})();

let testId = id("TEST_");

const messages: string[] = [];

const handlerForTests = (...args: unknown[]) => {
  messages.push(args.join(" "));
};

describe("defineHandler", () => {
  beforeEach(() => {
    testId = id("TEST_");
  });

  test("should define a handler", () => {
    defineHandler(testId, "NONE", 0, handlerForTests);
    expect(RootLogger.getHandlers()[testId]).toBeDefined();
    expect(RootLogger.getHandlers()[testId]?.handler).toBe(handlerForTests);
    expect(RootLogger.getHandlers()[testId]?.levelValue).toBe(
      RootLogger.getHandlers()["NONE"]?.levelValue
    );
  });

  test("should not redefine an existing handler", () => {
    const newHandlerForTests = (...args: unknown[]) => {
      handlerForTests(...args);
    };
    defineHandler(testId, "NONE", 0, handlerForTests);
    defineHandler(testId, "NONE", 0, newHandlerForTests);
    expect(RootLogger.getHandlers()[testId]?.handler).toBe(handlerForTests);
  });

  test("should redefine an existing handler by using override", () => {
    const newHandlerForTests = (...args: unknown[]) => {
      handlerForTests(...args);
    };
    defineHandler(testId, "NONE", 0, handlerForTests);
    defineHandler(testId, "NONE", 0, newHandlerForTests, true);
    expect(RootLogger.getHandlers()[testId]?.handler).toBe(newHandlerForTests);
  });

  test("should define handler at a specific level", () => {
    defineHandler(testId, "INFO", 0, handlerForTests);
    expect(RootLogger.getHandlers()[testId]?.levelValue).toBe(
      RootLogger.getHandlers()["INFO"]?.levelValue
    );
  });

  test("should define a handler above a specific level", () => {
    defineHandler(testId, "TRACE", 1, handlerForTests);
    expect(RootLogger.getHandlers()[testId]?.levelValue).toBeDefined();
    expect(RootLogger.getHandlers()[testId]?.levelValue).toBe(
      (RootLogger.getHandlers()["TRACE"]?.levelValue ?? 0) + 1
    );
  });

  test("should define a handler below a specific level", () => {
    defineHandler(testId, "FATAL", -1, handlerForTests);
    expect(RootLogger.getHandlers()[testId]?.levelValue).toBeDefined();
    expect(RootLogger.getHandlers()[testId]?.levelValue).toBe(
      (RootLogger.getHandlers()["FATAL"]?.levelValue ?? 0) - 1
    );
  });
});

describe("creating Loggers", () => {
  beforeEach(() => {
    RootLogger.loggers = {};
  });

  test("should create a logger", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger).toBeDefined();
    expect(logger.namespace).toBe("*:test");
  });

  test("should create a logger and get the same one on the next call", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger).toBeDefined();
    expect(RootLogger.getLogger("test")).toBe(logger);
  });

  test("should create a logger with namespace and config", () => {
    const logger = RootLogger.getLogger("test:next", {
      level: "error",
    });
    expect(logger).toBeDefined();
    expect(logger.namespace).toBe("*:test:next");
    expect(logger.level).toBe("ERROR");
  });

  test("should create a logger with namespace and config and get the same one without overriding config", () => {
    const logger = RootLogger.getLogger("test:next", {
      level: "error",
    });
    expect(logger).toBeDefined();
    const sameLogger = RootLogger.getLogger("test:next", { level: "log" });
    expect(sameLogger).toBe(logger);
    expect(sameLogger.level).toBe("ERROR");
    expect(logger.namespace).toBe("*:test:next");
  });

  test("should set the level", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger.level).toBe("LOG");
    logger.level = "debug";
    expect(logger.level).toBe("DEBUG");
  });

  test("should set the minLevel", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger.minLevel).toBe("INFO");
    logger.minLevel = "debug";
    expect(logger.minLevel).toBe("DEBUG");
  });

  test("should set the enabled", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger.enabled).toBe(true);
    logger.enabled = false;
    expect(logger.enabled).toBe(false);
  });

  test("should create a logger at namespace depth 3 from logger at namespace depth 1", () => {
    const logger = RootLogger.getLogger("test:namespace");
    expect(logger).toBeDefined();
    expect(logger.namespace).toBe("*:test:namespace");
  });

  test("should create loggers in between when creating logger at namespace depth 4 from namespace depth 1", () => {
    const logger = RootLogger.getLogger("second:third:fourth");

    const r = RootLogger;
    const rs = r.loggers["second"];
    const rst = r.loggers["second"]?.loggers["third"];
    const rstf = r.loggers["second"]?.loggers["third"]?.loggers["fourth"];

    expect(logger).toBeDefined();
    expect(logger).toBe(rstf);
    expect(logger.namespace).toBe("*:second:third:fourth");

    // should not contain child loggers; testing before .getLogger calls to avoid pollution if they create new loggers.
    expect(r.loggers).toEqual({ second: rs });
    expect(rs?.loggers).toEqual({ third: rst });
    expect(rst?.loggers).toEqual({ fourth: rstf });
    expect(rstf?.loggers).toEqual({});
    expect(logger.loggers).toEqual({});

    // relative
    expect(r.getLogger("second")).toBe(rs);
    expect(r.getLogger("second:third")).toBe(rst);
    expect(r.getLogger("second:third:fourth")).toBe(rstf);

    // global
    expect(r.getLogger("*")).toBe(r);
    expect(r.getLogger("*:second")).toBe(rs);
    expect(r.getLogger("*:second:third")).toBe(rst);
    expect(r.getLogger("*:second:third:fourth")).toBe(rstf);

    // should be creating new ones, since they can't be found
    const rt = r.getLogger("third");
    const rtf = r.getLogger("third:fourth");
    const rf = r.getLogger("fourth");

    expect(rt).not.toBe(rst);
    expect(rt.namespace).toBe("*:third");
    expect(rtf).not.toBe(rstf);
    expect(rtf.namespace).toBe("*:third:fourth");
    expect(rf).not.toBe(rstf);
    expect(rf.namespace).toBe("*:fourth");
  });

  test("should find loggers above its namespace by using absolute path starting with '*:'", () => {
    const logger = RootLogger.getLogger("second:third:fourth");

    const r = RootLogger;
    const rs = r.loggers["second"];
    const rst = r.loggers["second"]?.loggers["third"];
    const rstf = r.loggers["second"]?.loggers["third"]?.loggers["fourth"];

    expect(logger).toBe(rstf);

    expect(logger.getLogger("*")).toBe(r);
    expect(logger.getLogger("*:second")).toBe(rs);
    expect(logger.getLogger("*:second:third")).toBe(rst);
    expect(logger.getLogger("*:second:third:fourth")).toBe(rstf);
  });

  test("should not find loggers above its namespace without using absolute path by starting with '*:'", () => {
    const logger = RootLogger.getLogger("second:third:fourth");
    const r = RootLogger;
    const rs = r.loggers["second"];
    const rst = r.loggers["second"]?.loggers["third"];
    const rstf = r.loggers["second"]?.loggers["third"]?.loggers["fourth"];

    expect(logger).toBeDefined();

    const ls = logger.getLogger("second");
    const lst = logger.getLogger("second:third");
    const lstf = logger.getLogger("second:third:fourth");

    expect(ls).not.toBe(rs);
    expect(lst).not.toBe(rst);
    expect(lstf).not.toBe(rstf);

    expect(ls.namespace).toBe("*:second:third:fourth:second");
    expect(lst.namespace).toBe("*:second:third:fourth:second:third");
    expect(lstf.namespace).toBe("*:second:third:fourth:second:third:fourth");
  });
});

describe("logging", () => {
  beforeAll(() => {
    for (const name of Object.keys(themes)) {
      delete themes[name]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
    }

    ["TRACE", "DEBUG", "LOG", "INFO", "WARN", "ERROR", "FATAL"].forEach(
      (name: string) => {
        defineHandler(name, name, 0, handlerForTests, true);
      }
    );
  });

  beforeEach(() => {
    return () => {
      messages.length = 0;
      Object.keys(RootLogger.loggers).forEach((key) => {
        delete RootLogger.loggers[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
      });
    };
  });

  test("should have logging levels for TRACE, DEBUG, LOG, INFO, WARN, ERROR, FATAL", () => {
    expect(RootLogger.getHandlers()["TRACE"]).toBeDefined();
    expect(RootLogger.getHandlers()["DEBUG"]).toBeDefined();
    expect(RootLogger.getHandlers()["LOG"]).toBeDefined();
    expect(RootLogger.getHandlers()["INFO"]).toBeDefined();
    expect(RootLogger.getHandlers()["WARN"]).toBeDefined();
    expect(RootLogger.getHandlers()["ERROR"]).toBeDefined();
    expect(RootLogger.getHandlers()["FATAL"]).toBeDefined();
  });

  test.each([
    ["TRACE", false],
    ["DEBUG", false],
    ["LOG", false],
    ["INFO", true],
    ["WARN", true],
    ["ERROR", true],
    ["FATAL", true],
  ])("should log a message only if above the min level", (level, expected) => {
    const logger = RootLogger.getLogger(testId);
    logger.as(level)("test");
    expect(messages).toEqual(expected ? [`[${level}][*:${testId}] test`] : []);
  });

  test("should log after minLevel is set below", () => {
    const logger = RootLogger.getLogger(testId);
    logger.log("before");
    logger.minLevel = "debug";
    logger.log("after");
    expect(messages).toEqual([`[LOG][*:${testId}] after`]);
  });

  test("should not log after minLevel is set above", () => {
    const logger = RootLogger.getLogger(testId);
    logger.as("info")("before");
    logger.minLevel = "ERROR";
    logger.as("info")("after");
    expect(messages).toEqual([`[INFO][*:${testId}] before`]);
  });

  test("should call with a custom level", () => {
    const logger = RootLogger.getLogger(testId);
    const handler = logger("customLevel");
    handler("test");
    expect(handler).toBeDefined();
    expect(messages).toEqual([
      `[CUSTOMLEVEL][*:${testId}][Invalid logging level] test`,
    ]);
  });

  test("should log as a existing level", () => {
    const logger = RootLogger.getLogger(testId);
    logger.as("info")("test");
    expect(messages).toEqual([`[INFO][*:${testId}] test`]);
  });

  test("should not log as an unknown level when using as(level) and throw", () => {
    const logger = RootLogger.getLogger("test");
    expect(() => logger.as("customLevel")).toThrowError(
      "No handler named 'CUSTOMLEVEL' found (Original case: 'customLevel')."
    );
  });

  test("should ignore case", () => {
    const logger = RootLogger.getLogger(testId);
    logger("iNfO")("Call signature");
    expect(messages[messages.length - 1]).toEqual(
      `[INFO][*:${testId}] Call signature`
    );
    logger.as("iNfO")("as()");
    expect(messages[messages.length - 1]).toEqual(`[INFO][*:${testId}] as()`);
    logger.level = "iNfO";
    expect(logger.level).toBe("INFO");
    logger.minLevel = "dEbUg";
    expect(logger.minLevel).toBe("DEBUG");
  });

  test("log after changing level", () => {
    const logger = RootLogger.getLogger(testId);
    logger.level = "warn";
    logger.log("test");
    expect(messages).toEqual([`[WARN][*:${testId}] test`]);
  });

  test("log using the methods for each basic logging level", () => {
    const logger = RootLogger.getLogger(testId);

    logger.trace("test");
    logger.debug("test");
    logger.log("test");
    logger.info("test");
    logger.warn("test");
    logger.error("test");
    logger.fatal("test");

    expect(messages).toEqual([
      `[INFO][*:${testId}] test`,
      `[WARN][*:${testId}] test`,
      `[ERROR][*:${testId}] test`,
      `[FATAL][*:${testId}] test`,
    ]);
  });

  test("log using the methods for each basic logging level with minimum minLevel", () => {
    const logger = RootLogger.getLogger(testId);
    logger.minLevel = "none";

    logger.trace("test");
    logger.debug("test");
    logger.log("test");
    logger.info("test");
    logger.warn("test");
    logger.error("test");
    logger.fatal("test");

    expect(messages).toEqual([
      `[TRACE][*:${testId}] test`,
      `[DEBUG][*:${testId}] test`,
      `[LOG][*:${testId}] test`,
      `[INFO][*:${testId}] test`,
      `[WARN][*:${testId}] test`,
      `[ERROR][*:${testId}] test`,
      `[FATAL][*:${testId}] test`,
    ]);
  });
});
