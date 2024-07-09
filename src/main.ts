import { RootLogger } from "./logging";

const logger = RootLogger.getLogger("main");
logger.minLevel = "debug";
logger.log("Hello, world!");
