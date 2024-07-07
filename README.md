A JavaScript logging utility.

# Logger

The logger utility exposes a RootLogger with the following functions:

- `log(message)`: Allows you to log a message at the current log level.
- `as(level)`: Returns a handler that logs the message at the given level. Allows you to log a message at a different level without the pitfalls of having to change the Logger's level itself.
- `getLogger(namespace)`: Allows you to get - create if not present - a Logger of a specific namespace. Namespaces use dot notation for children (e.g.: '\*.App.Util.Math').
- `level(level)`: Sets the current log level used by the `log` function.
- `minLevel(level)`: Sets the minimum level at which messages are displayed when logging; attempts to log at a severity below this will be ignored.
- `enabled(state)`: Allows you to set whether the Logger will log messages of any level or not.
- `[level]`: Using arbitrary values with index access allows for custom log levels without any setup, as long as they don't conflict with an already existing property.
