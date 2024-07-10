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

  test("should create a logger with child namespace", () => {
    const logger = RootLogger.getLogger("test:namespace");
    expect(logger).toBeDefined();
    expect(logger.namespace).toBe("*:test:namespace");
  });

  test("should create a logger and get the same one", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger).toBeDefined();
    expect(RootLogger.getLogger("test")).toBe(logger);
  });

  test("should create a logger with namespace and config", () => {
    const logger = RootLogger.getLogger("test:next", {
      level: "info",
    });
    expect(logger).toBeDefined();
    expect(logger.namespace).toBe("*:test:next");
    expect(logger.level).toBe("INFO");
  });

  test("should create a logger with namespace and config and get the same one without overriding config", () => {
    const logger = RootLogger.getLogger("test:next", {
      level: "info",
    });
    expect(logger).toBeDefined();
    expect(RootLogger.getLogger("test:next", { level: "info" })).toBe(logger);
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

  test("should call with a custom level", () => {
    const logger = RootLogger.getLogger("test");
    expect(logger("test1")).toBeDefined();
    expect(logger("test2")).toBeDefined();
    expect(logger("test3")).toBeDefined();
    expect(logger("test4")).toBeDefined();
    expect(logger("test5")).toBeDefined();
    expect(logger("test6")).toBeDefined();
  });

  test("should log as a existing level", () => {
    const logger = RootLogger.getLogger("test");
    expect(() => {
      logger.as("info")("test");
    }).not.toThrow();
  });

  test("should not log as an unknown level", () => {
    const logger = RootLogger.getLogger("test");
    expect(() => {
      logger.as("test")("test");
    }).toThrowError("No handler named 'test' found.");
  });
});
