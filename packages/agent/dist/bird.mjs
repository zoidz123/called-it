#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.endsWith("...")) {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (option.description) {
          return `${option.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatItemList(heading, items, helper) {
      if (items.length === 0)
        return [];
      return [helper.styleTitle(heading), ...items, ""];
    }
    groupItems(unsortedItems, visibleItems, getGroup) {
      const result = new Map;
      unsortedItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group))
          result.set(group, []);
      });
      visibleItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) {
          result.set(group, []);
        }
        result.get(group).push(item);
      });
      return result;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
      const optionGroups = this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:");
      optionGroups.forEach((options, group) => {
        const optionList = options.map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList(group, optionList, helper));
      });
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
      }
      const commandGroups = this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:");
      commandGroups.forEach((commands, group) => {
        const commandList = commands.map((sub) => {
          return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
        });
        output = output.concat(this.formatItemList(group, commandList, helper));
      });
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
      this.helpGroupHeading = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    helpGroup(heading) {
      this.helpGroupHeading = heading;
      return this;
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process2 = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
      this._helpGroupHeading = undefined;
      this._defaultCommandGroup = undefined;
      this._defaultOptionGroup = undefined;
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      this._outputConfiguration = {
        ...this._outputConfiguration,
        ...configuration
      };
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, parseArg, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof parseArg === "function") {
        argument.default(defaultValue).argParser(parseArg);
      } else {
        argument.default(parseArg);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument?.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        if (enableOrNameAndArgs && this._defaultCommandGroup) {
          this._initCommandGroup(this._getHelpCommand());
        }
        return this;
      }
      const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      if (enableOrNameAndArgs || description)
        this._initCommandGroup(helpCommand);
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      this._initCommandGroup(helpCommand);
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this._initOptionGroup(option);
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this._initCommandGroup(command);
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._collectValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise?.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent?.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(args) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      const negativeNumberArg = (arg) => {
        if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg))
          return false;
        return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
      };
      let activeVariadicOption = null;
      let activeGroup = null;
      let i = 0;
      while (i < args.length || activeGroup) {
        const arg = activeGroup ?? args[i++];
        activeGroup = null;
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args.slice(i));
          break;
        }
        if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args[i++];
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                value = args[i++];
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              activeGroup = `-${arg.slice(2)}`;
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            unknown.push(...args.slice(i));
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg, ...args.slice(i));
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg, ...args.slice(i));
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg, ...args.slice(i));
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    helpGroup(heading) {
      if (heading === undefined)
        return this._helpGroupHeading ?? "";
      this._helpGroupHeading = heading;
      return this;
    }
    commandsGroup(heading) {
      if (heading === undefined)
        return this._defaultCommandGroup ?? "";
      this._defaultCommandGroup = heading;
      return this;
    }
    optionsGroup(heading) {
      if (heading === undefined)
        return this._defaultOptionGroup ?? "";
      this._defaultOptionGroup = heading;
      return this;
    }
    _initOptionGroup(option) {
      if (this._defaultOptionGroup && !option.helpGroupHeading)
        option.helpGroup(this._defaultOptionGroup);
    }
    _initCommandGroup(cmd) {
      if (this._defaultCommandGroup && !cmd.helpGroup())
        cmd.helpGroup(this._defaultCommandGroup);
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          if (this._helpOption === null)
            this._helpOption = undefined;
          if (this._defaultOptionGroup) {
            this._initOptionGroup(this._getHelpOption());
          }
        } else {
          this._helpOption = null;
        }
        return this;
      }
      this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
      if (flags || description)
        this._initOptionGroup(this._helpOption);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      this._initOptionGroup(option);
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process2.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
      return false;
    if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// ../../node_modules/.bun/json5@2.2.3/node_modules/json5/lib/unicode.js
var require_unicode = __commonJS((exports, module) => {
  exports.Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
  exports.ID_Start = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
  exports.ID_Continue = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
});

// ../../node_modules/.bun/json5@2.2.3/node_modules/json5/lib/util.js
var require_util = __commonJS((exports, module) => {
  var unicode = require_unicode();
  module.exports = {
    isSpaceSeparator(c) {
      return typeof c === "string" && unicode.Space_Separator.test(c);
    },
    isIdStartChar(c) {
      return typeof c === "string" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "$" || c === "_" || unicode.ID_Start.test(c));
    },
    isIdContinueChar(c) {
      return typeof c === "string" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c === "$" || c === "_" || c === "‌" || c === "‍" || unicode.ID_Continue.test(c));
    },
    isDigit(c) {
      return typeof c === "string" && /[0-9]/.test(c);
    },
    isHexDigit(c) {
      return typeof c === "string" && /[0-9A-Fa-f]/.test(c);
    }
  };
});

// ../../node_modules/.bun/json5@2.2.3/node_modules/json5/lib/parse.js
var require_parse = __commonJS((exports, module) => {
  var util = require_util();
  var source;
  var parseState;
  var stack;
  var pos;
  var line;
  var column;
  var token;
  var key;
  var root;
  module.exports = function parse(text, reviver) {
    source = String(text);
    parseState = "start";
    stack = [];
    pos = 0;
    line = 1;
    column = 0;
    token = undefined;
    key = undefined;
    root = undefined;
    do {
      token = lex();
      parseStates[parseState]();
    } while (token.type !== "eof");
    if (typeof reviver === "function") {
      return internalize({ "": root }, "", reviver);
    }
    return root;
  };
  function internalize(holder, name, reviver) {
    const value = holder[name];
    if (value != null && typeof value === "object") {
      if (Array.isArray(value)) {
        for (let i = 0;i < value.length; i++) {
          const key2 = String(i);
          const replacement = internalize(value, key2, reviver);
          if (replacement === undefined) {
            delete value[key2];
          } else {
            Object.defineProperty(value, key2, {
              value: replacement,
              writable: true,
              enumerable: true,
              configurable: true
            });
          }
        }
      } else {
        for (const key2 in value) {
          const replacement = internalize(value, key2, reviver);
          if (replacement === undefined) {
            delete value[key2];
          } else {
            Object.defineProperty(value, key2, {
              value: replacement,
              writable: true,
              enumerable: true,
              configurable: true
            });
          }
        }
      }
    }
    return reviver.call(holder, name, value);
  }
  var lexState;
  var buffer;
  var doubleQuote;
  var sign;
  var c;
  function lex() {
    lexState = "default";
    buffer = "";
    doubleQuote = false;
    sign = 1;
    for (;; ) {
      c = peek();
      const token2 = lexStates[lexState]();
      if (token2) {
        return token2;
      }
    }
  }
  function peek() {
    if (source[pos]) {
      return String.fromCodePoint(source.codePointAt(pos));
    }
  }
  function read() {
    const c2 = peek();
    if (c2 === `
`) {
      line++;
      column = 0;
    } else if (c2) {
      column += c2.length;
    } else {
      column++;
    }
    if (c2) {
      pos += c2.length;
    }
    return c2;
  }
  var lexStates = {
    default() {
      switch (c) {
        case "\t":
        case "\v":
        case "\f":
        case " ":
        case " ":
        case "\uFEFF":
        case `
`:
        case "\r":
        case "\u2028":
        case "\u2029":
          read();
          return;
        case "/":
          read();
          lexState = "comment";
          return;
        case undefined:
          read();
          return newToken("eof");
      }
      if (util.isSpaceSeparator(c)) {
        read();
        return;
      }
      return lexStates[parseState]();
    },
    comment() {
      switch (c) {
        case "*":
          read();
          lexState = "multiLineComment";
          return;
        case "/":
          read();
          lexState = "singleLineComment";
          return;
      }
      throw invalidChar(read());
    },
    multiLineComment() {
      switch (c) {
        case "*":
          read();
          lexState = "multiLineCommentAsterisk";
          return;
        case undefined:
          throw invalidChar(read());
      }
      read();
    },
    multiLineCommentAsterisk() {
      switch (c) {
        case "*":
          read();
          return;
        case "/":
          read();
          lexState = "default";
          return;
        case undefined:
          throw invalidChar(read());
      }
      read();
      lexState = "multiLineComment";
    },
    singleLineComment() {
      switch (c) {
        case `
`:
        case "\r":
        case "\u2028":
        case "\u2029":
          read();
          lexState = "default";
          return;
        case undefined:
          read();
          return newToken("eof");
      }
      read();
    },
    value() {
      switch (c) {
        case "{":
        case "[":
          return newToken("punctuator", read());
        case "n":
          read();
          literal("ull");
          return newToken("null", null);
        case "t":
          read();
          literal("rue");
          return newToken("boolean", true);
        case "f":
          read();
          literal("alse");
          return newToken("boolean", false);
        case "-":
        case "+":
          if (read() === "-") {
            sign = -1;
          }
          lexState = "sign";
          return;
        case ".":
          buffer = read();
          lexState = "decimalPointLeading";
          return;
        case "0":
          buffer = read();
          lexState = "zero";
          return;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          buffer = read();
          lexState = "decimalInteger";
          return;
        case "I":
          read();
          literal("nfinity");
          return newToken("numeric", Infinity);
        case "N":
          read();
          literal("aN");
          return newToken("numeric", NaN);
        case '"':
        case "'":
          doubleQuote = read() === '"';
          buffer = "";
          lexState = "string";
          return;
      }
      throw invalidChar(read());
    },
    identifierNameStartEscape() {
      if (c !== "u") {
        throw invalidChar(read());
      }
      read();
      const u = unicodeEscape();
      switch (u) {
        case "$":
        case "_":
          break;
        default:
          if (!util.isIdStartChar(u)) {
            throw invalidIdentifier();
          }
          break;
      }
      buffer += u;
      lexState = "identifierName";
    },
    identifierName() {
      switch (c) {
        case "$":
        case "_":
        case "‌":
        case "‍":
          buffer += read();
          return;
        case "\\":
          read();
          lexState = "identifierNameEscape";
          return;
      }
      if (util.isIdContinueChar(c)) {
        buffer += read();
        return;
      }
      return newToken("identifier", buffer);
    },
    identifierNameEscape() {
      if (c !== "u") {
        throw invalidChar(read());
      }
      read();
      const u = unicodeEscape();
      switch (u) {
        case "$":
        case "_":
        case "‌":
        case "‍":
          break;
        default:
          if (!util.isIdContinueChar(u)) {
            throw invalidIdentifier();
          }
          break;
      }
      buffer += u;
      lexState = "identifierName";
    },
    sign() {
      switch (c) {
        case ".":
          buffer = read();
          lexState = "decimalPointLeading";
          return;
        case "0":
          buffer = read();
          lexState = "zero";
          return;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          buffer = read();
          lexState = "decimalInteger";
          return;
        case "I":
          read();
          literal("nfinity");
          return newToken("numeric", sign * Infinity);
        case "N":
          read();
          literal("aN");
          return newToken("numeric", NaN);
      }
      throw invalidChar(read());
    },
    zero() {
      switch (c) {
        case ".":
          buffer += read();
          lexState = "decimalPoint";
          return;
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
        case "x":
        case "X":
          buffer += read();
          lexState = "hexadecimal";
          return;
      }
      return newToken("numeric", sign * 0);
    },
    decimalInteger() {
      switch (c) {
        case ".":
          buffer += read();
          lexState = "decimalPoint";
          return;
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    decimalPointLeading() {
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalFraction";
        return;
      }
      throw invalidChar(read());
    },
    decimalPoint() {
      switch (c) {
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalFraction";
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    decimalFraction() {
      switch (c) {
        case "e":
        case "E":
          buffer += read();
          lexState = "decimalExponent";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    decimalExponent() {
      switch (c) {
        case "+":
        case "-":
          buffer += read();
          lexState = "decimalExponentSign";
          return;
      }
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalExponentInteger";
        return;
      }
      throw invalidChar(read());
    },
    decimalExponentSign() {
      if (util.isDigit(c)) {
        buffer += read();
        lexState = "decimalExponentInteger";
        return;
      }
      throw invalidChar(read());
    },
    decimalExponentInteger() {
      if (util.isDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    hexadecimal() {
      if (util.isHexDigit(c)) {
        buffer += read();
        lexState = "hexadecimalInteger";
        return;
      }
      throw invalidChar(read());
    },
    hexadecimalInteger() {
      if (util.isHexDigit(c)) {
        buffer += read();
        return;
      }
      return newToken("numeric", sign * Number(buffer));
    },
    string() {
      switch (c) {
        case "\\":
          read();
          buffer += escape();
          return;
        case '"':
          if (doubleQuote) {
            read();
            return newToken("string", buffer);
          }
          buffer += read();
          return;
        case "'":
          if (!doubleQuote) {
            read();
            return newToken("string", buffer);
          }
          buffer += read();
          return;
        case `
`:
        case "\r":
          throw invalidChar(read());
        case "\u2028":
        case "\u2029":
          separatorChar(c);
          break;
        case undefined:
          throw invalidChar(read());
      }
      buffer += read();
    },
    start() {
      switch (c) {
        case "{":
        case "[":
          return newToken("punctuator", read());
      }
      lexState = "value";
    },
    beforePropertyName() {
      switch (c) {
        case "$":
        case "_":
          buffer = read();
          lexState = "identifierName";
          return;
        case "\\":
          read();
          lexState = "identifierNameStartEscape";
          return;
        case "}":
          return newToken("punctuator", read());
        case '"':
        case "'":
          doubleQuote = read() === '"';
          lexState = "string";
          return;
      }
      if (util.isIdStartChar(c)) {
        buffer += read();
        lexState = "identifierName";
        return;
      }
      throw invalidChar(read());
    },
    afterPropertyName() {
      if (c === ":") {
        return newToken("punctuator", read());
      }
      throw invalidChar(read());
    },
    beforePropertyValue() {
      lexState = "value";
    },
    afterPropertyValue() {
      switch (c) {
        case ",":
        case "}":
          return newToken("punctuator", read());
      }
      throw invalidChar(read());
    },
    beforeArrayValue() {
      if (c === "]") {
        return newToken("punctuator", read());
      }
      lexState = "value";
    },
    afterArrayValue() {
      switch (c) {
        case ",":
        case "]":
          return newToken("punctuator", read());
      }
      throw invalidChar(read());
    },
    end() {
      throw invalidChar(read());
    }
  };
  function newToken(type, value) {
    return {
      type,
      value,
      line,
      column
    };
  }
  function literal(s) {
    for (const c2 of s) {
      const p = peek();
      if (p !== c2) {
        throw invalidChar(read());
      }
      read();
    }
  }
  function escape() {
    const c2 = peek();
    switch (c2) {
      case "b":
        read();
        return "\b";
      case "f":
        read();
        return "\f";
      case "n":
        read();
        return `
`;
      case "r":
        read();
        return "\r";
      case "t":
        read();
        return "\t";
      case "v":
        read();
        return "\v";
      case "0":
        read();
        if (util.isDigit(peek())) {
          throw invalidChar(read());
        }
        return "\x00";
      case "x":
        read();
        return hexEscape();
      case "u":
        read();
        return unicodeEscape();
      case `
`:
      case "\u2028":
      case "\u2029":
        read();
        return "";
      case "\r":
        read();
        if (peek() === `
`) {
          read();
        }
        return "";
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        throw invalidChar(read());
      case undefined:
        throw invalidChar(read());
    }
    return read();
  }
  function hexEscape() {
    let buffer2 = "";
    let c2 = peek();
    if (!util.isHexDigit(c2)) {
      throw invalidChar(read());
    }
    buffer2 += read();
    c2 = peek();
    if (!util.isHexDigit(c2)) {
      throw invalidChar(read());
    }
    buffer2 += read();
    return String.fromCodePoint(parseInt(buffer2, 16));
  }
  function unicodeEscape() {
    let buffer2 = "";
    let count = 4;
    while (count-- > 0) {
      const c2 = peek();
      if (!util.isHexDigit(c2)) {
        throw invalidChar(read());
      }
      buffer2 += read();
    }
    return String.fromCodePoint(parseInt(buffer2, 16));
  }
  var parseStates = {
    start() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      push();
    },
    beforePropertyName() {
      switch (token.type) {
        case "identifier":
        case "string":
          key = token.value;
          parseState = "afterPropertyName";
          return;
        case "punctuator":
          pop();
          return;
        case "eof":
          throw invalidEOF();
      }
    },
    afterPropertyName() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      parseState = "beforePropertyValue";
    },
    beforePropertyValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      push();
    },
    beforeArrayValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      if (token.type === "punctuator" && token.value === "]") {
        pop();
        return;
      }
      push();
    },
    afterPropertyValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      switch (token.value) {
        case ",":
          parseState = "beforePropertyName";
          return;
        case "}":
          pop();
      }
    },
    afterArrayValue() {
      if (token.type === "eof") {
        throw invalidEOF();
      }
      switch (token.value) {
        case ",":
          parseState = "beforeArrayValue";
          return;
        case "]":
          pop();
      }
    },
    end() {}
  };
  function push() {
    let value;
    switch (token.type) {
      case "punctuator":
        switch (token.value) {
          case "{":
            value = {};
            break;
          case "[":
            value = [];
            break;
        }
        break;
      case "null":
      case "boolean":
      case "numeric":
      case "string":
        value = token.value;
        break;
    }
    if (root === undefined) {
      root = value;
    } else {
      const parent = stack[stack.length - 1];
      if (Array.isArray(parent)) {
        parent.push(value);
      } else {
        Object.defineProperty(parent, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    if (value !== null && typeof value === "object") {
      stack.push(value);
      if (Array.isArray(value)) {
        parseState = "beforeArrayValue";
      } else {
        parseState = "beforePropertyName";
      }
    } else {
      const current = stack[stack.length - 1];
      if (current == null) {
        parseState = "end";
      } else if (Array.isArray(current)) {
        parseState = "afterArrayValue";
      } else {
        parseState = "afterPropertyValue";
      }
    }
  }
  function pop() {
    stack.pop();
    const current = stack[stack.length - 1];
    if (current == null) {
      parseState = "end";
    } else if (Array.isArray(current)) {
      parseState = "afterArrayValue";
    } else {
      parseState = "afterPropertyValue";
    }
  }
  function invalidChar(c2) {
    if (c2 === undefined) {
      return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
    }
    return syntaxError(`JSON5: invalid character '${formatChar(c2)}' at ${line}:${column}`);
  }
  function invalidEOF() {
    return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
  }
  function invalidIdentifier() {
    column -= 5;
    return syntaxError(`JSON5: invalid identifier character at ${line}:${column}`);
  }
  function separatorChar(c2) {
    console.warn(`JSON5: '${formatChar(c2)}' in strings is not valid ECMAScript; consider escaping`);
  }
  function formatChar(c2) {
    const replacements = {
      "'": "\\'",
      '"': "\\\"",
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "\t": "\\t",
      "\v": "\\v",
      "\x00": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    if (replacements[c2]) {
      return replacements[c2];
    }
    if (c2 < " ") {
      const hexString = c2.charCodeAt(0).toString(16);
      return "\\x" + ("00" + hexString).substring(hexString.length);
    }
    return c2;
  }
  function syntaxError(message) {
    const err = new SyntaxError(message);
    err.lineNumber = line;
    err.columnNumber = column;
    return err;
  }
});

// ../../node_modules/.bun/json5@2.2.3/node_modules/json5/lib/stringify.js
var require_stringify = __commonJS((exports, module) => {
  var util = require_util();
  module.exports = function stringify(value, replacer, space) {
    const stack = [];
    let indent = "";
    let propertyList;
    let replacerFunc;
    let gap = "";
    let quote;
    if (replacer != null && typeof replacer === "object" && !Array.isArray(replacer)) {
      space = replacer.space;
      quote = replacer.quote;
      replacer = replacer.replacer;
    }
    if (typeof replacer === "function") {
      replacerFunc = replacer;
    } else if (Array.isArray(replacer)) {
      propertyList = [];
      for (const v of replacer) {
        let item;
        if (typeof v === "string") {
          item = v;
        } else if (typeof v === "number" || v instanceof String || v instanceof Number) {
          item = String(v);
        }
        if (item !== undefined && propertyList.indexOf(item) < 0) {
          propertyList.push(item);
        }
      }
    }
    if (space instanceof Number) {
      space = Number(space);
    } else if (space instanceof String) {
      space = String(space);
    }
    if (typeof space === "number") {
      if (space > 0) {
        space = Math.min(10, Math.floor(space));
        gap = "          ".substr(0, space);
      }
    } else if (typeof space === "string") {
      gap = space.substr(0, 10);
    }
    return serializeProperty("", { "": value });
    function serializeProperty(key, holder) {
      let value2 = holder[key];
      if (value2 != null) {
        if (typeof value2.toJSON5 === "function") {
          value2 = value2.toJSON5(key);
        } else if (typeof value2.toJSON === "function") {
          value2 = value2.toJSON(key);
        }
      }
      if (replacerFunc) {
        value2 = replacerFunc.call(holder, key, value2);
      }
      if (value2 instanceof Number) {
        value2 = Number(value2);
      } else if (value2 instanceof String) {
        value2 = String(value2);
      } else if (value2 instanceof Boolean) {
        value2 = value2.valueOf();
      }
      switch (value2) {
        case null:
          return "null";
        case true:
          return "true";
        case false:
          return "false";
      }
      if (typeof value2 === "string") {
        return quoteString(value2, false);
      }
      if (typeof value2 === "number") {
        return String(value2);
      }
      if (typeof value2 === "object") {
        return Array.isArray(value2) ? serializeArray(value2) : serializeObject(value2);
      }
      return;
    }
    function quoteString(value2) {
      const quotes = {
        "'": 0.1,
        '"': 0.2
      };
      const replacements = {
        "'": "\\'",
        '"': "\\\"",
        "\\": "\\\\",
        "\b": "\\b",
        "\f": "\\f",
        "\n": "\\n",
        "\r": "\\r",
        "\t": "\\t",
        "\v": "\\v",
        "\x00": "\\0",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029"
      };
      let product = "";
      for (let i = 0;i < value2.length; i++) {
        const c = value2[i];
        switch (c) {
          case "'":
          case '"':
            quotes[c]++;
            product += c;
            continue;
          case "\x00":
            if (util.isDigit(value2[i + 1])) {
              product += "\\x00";
              continue;
            }
        }
        if (replacements[c]) {
          product += replacements[c];
          continue;
        }
        if (c < " ") {
          let hexString = c.charCodeAt(0).toString(16);
          product += "\\x" + ("00" + hexString).substring(hexString.length);
          continue;
        }
        product += c;
      }
      const quoteChar = quote || Object.keys(quotes).reduce((a, b) => quotes[a] < quotes[b] ? a : b);
      product = product.replace(new RegExp(quoteChar, "g"), replacements[quoteChar]);
      return quoteChar + product + quoteChar;
    }
    function serializeObject(value2) {
      if (stack.indexOf(value2) >= 0) {
        throw TypeError("Converting circular structure to JSON5");
      }
      stack.push(value2);
      let stepback = indent;
      indent = indent + gap;
      let keys = propertyList || Object.keys(value2);
      let partial = [];
      for (const key of keys) {
        const propertyString = serializeProperty(key, value2);
        if (propertyString !== undefined) {
          let member = serializeKey(key) + ":";
          if (gap !== "") {
            member += " ";
          }
          member += propertyString;
          partial.push(member);
        }
      }
      let final;
      if (partial.length === 0) {
        final = "{}";
      } else {
        let properties;
        if (gap === "") {
          properties = partial.join(",");
          final = "{" + properties + "}";
        } else {
          let separator = `,
` + indent;
          properties = partial.join(separator);
          final = `{
` + indent + properties + `,
` + stepback + "}";
        }
      }
      stack.pop();
      indent = stepback;
      return final;
    }
    function serializeKey(key) {
      if (key.length === 0) {
        return quoteString(key, true);
      }
      const firstChar = String.fromCodePoint(key.codePointAt(0));
      if (!util.isIdStartChar(firstChar)) {
        return quoteString(key, true);
      }
      for (let i = firstChar.length;i < key.length; i++) {
        if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
          return quoteString(key, true);
        }
      }
      return key;
    }
    function serializeArray(value2) {
      if (stack.indexOf(value2) >= 0) {
        throw TypeError("Converting circular structure to JSON5");
      }
      stack.push(value2);
      let stepback = indent;
      indent = indent + gap;
      let partial = [];
      for (let i = 0;i < value2.length; i++) {
        const propertyString = serializeProperty(String(i), value2);
        partial.push(propertyString !== undefined ? propertyString : "null");
      }
      let final;
      if (partial.length === 0) {
        final = "[]";
      } else {
        if (gap === "") {
          let properties = partial.join(",");
          final = "[" + properties + "]";
        } else {
          let separator = `,
` + indent;
          let properties = partial.join(separator);
          final = `[
` + indent + properties + `,
` + stepback + "]";
        }
      }
      stack.pop();
      indent = stepback;
      return final;
    }
  };
});

// ../../node_modules/.bun/json5@2.2.3/node_modules/json5/lib/index.js
var require_lib = __commonJS((exports, module) => {
  var parse = require_parse();
  var stringify = require_stringify();
  var JSON5 = {
    parse,
    stringify
  };
  module.exports = JSON5;
});

// ../../node_modules/.bun/commander@14.0.3/node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/cli/pagination.js
function parsePositiveIntFlag(raw, flagName) {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `Invalid ${flagName}. Expected a positive integer.` };
  }
  return { ok: true, value };
}
function parseNonNegativeIntFlag(raw, flagName, defaultValue) {
  const value = Number.parseInt(raw ?? String(defaultValue), 10);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: `Invalid ${flagName}. Expected a non-negative integer.` };
  }
  return { ok: true, value };
}
function parsePaginationFlags(cmdOpts, opts) {
  const maxPagesImpliesPagination = opts?.maxPagesImpliesPagination ?? false;
  const includeDelay = opts?.includeDelay ?? false;
  const defaultDelayMs = opts?.defaultDelayMs ?? 1000;
  const maxPages = parsePositiveIntFlag(cmdOpts.maxPages, "--max-pages");
  if (!maxPages.ok) {
    return maxPages;
  }
  const usePagination = Boolean(cmdOpts.all || cmdOpts.cursor || maxPagesImpliesPagination && maxPages.value !== undefined);
  let pageDelayMs;
  if (includeDelay) {
    const delay = parseNonNegativeIntFlag(cmdOpts.delay, "--delay", defaultDelayMs);
    if (!delay.ok) {
      return delay;
    }
    pageDelayMs = delay.value;
  }
  return {
    ok: true,
    usePagination,
    maxPages: maxPages.value,
    cursor: cmdOpts.cursor,
    pageDelayMs
  };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/extract-bookmark-folder-id.js
var BOOKMARK_FOLDER_URL_REGEX = /(?:twitter\.com|x\.com)\/i\/bookmarks\/(\d+)/i;
var BOOKMARK_FOLDER_ID_REGEX = /^\d{5,}$/;
function extractBookmarkFolderId(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const urlMatch = BOOKMARK_FOLDER_URL_REGEX.exec(trimmed);
  if (urlMatch) {
    return urlMatch[1];
  }
  if (BOOKMARK_FOLDER_ID_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/thread-filters.js
var sortByCreatedAt = (tweets) => tweets.slice().sort((a, b) => {
  const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
  const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
  return aTime - bTime;
});
function filterAuthorChain(tweets, bookmarkedTweet) {
  const author = bookmarkedTweet.author.username;
  const byId = new Map(tweets.map((tweet) => [tweet.id, tweet]));
  const chainIds = new Set;
  let current = bookmarkedTweet;
  while (current && current.author.username === author) {
    chainIds.add(current.id);
    const parentId = current.inReplyToStatusId;
    if (!parentId) {
      break;
    }
    const parent = byId.get(parentId);
    if (!parent || parent.author.username !== author) {
      break;
    }
    current = parent;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const tweet of tweets) {
      if (tweet.author.username !== author) {
        continue;
      }
      if (chainIds.has(tweet.id)) {
        continue;
      }
      if (tweet.inReplyToStatusId && chainIds.has(tweet.inReplyToStatusId)) {
        chainIds.add(tweet.id);
        changed = true;
      }
    }
  }
  return sortByCreatedAt(tweets.filter((tweet) => chainIds.has(tweet.id)));
}
function filterAuthorOnly(tweets, bookmarkedTweet) {
  const author = bookmarkedTweet.author.username;
  return tweets.filter((tweet) => tweet.author.username === author);
}
function filterFullChain(tweets, bookmarkedTweet, options = {}) {
  const byId = new Map(tweets.map((tweet) => [tweet.id, tweet]));
  const repliesByParent = new Map;
  for (const tweet of tweets) {
    if (!tweet.inReplyToStatusId) {
      continue;
    }
    const list = repliesByParent.get(tweet.inReplyToStatusId) ?? [];
    list.push(tweet);
    repliesByParent.set(tweet.inReplyToStatusId, list);
  }
  const chainIds = new Set;
  const ancestorIds = [];
  chainIds.add(bookmarkedTweet.id);
  let current = bookmarkedTweet;
  while (current?.inReplyToStatusId) {
    const parent = byId.get(current.inReplyToStatusId);
    if (!parent) {
      break;
    }
    if (!chainIds.has(parent.id)) {
      chainIds.add(parent.id);
      ancestorIds.push(parent.id);
    }
    current = parent;
  }
  const addDescendants = (startIds) => {
    const queue = [...startIds];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) {
        continue;
      }
      if (!chainIds.has(currentId)) {
        chainIds.add(currentId);
      }
      const replies = repliesByParent.get(currentId) ?? [];
      for (const reply of replies) {
        if (chainIds.has(reply.id)) {
          continue;
        }
        chainIds.add(reply.id);
        queue.push(reply.id);
      }
    }
  };
  addDescendants([bookmarkedTweet.id]);
  if (options.includeAncestorBranches) {
    for (const ancestorId of ancestorIds) {
      addDescendants([ancestorId]);
    }
  }
  return sortByCreatedAt(tweets.filter((tweet) => chainIds.has(tweet.id)));
}
function addThreadMetadata(tweet, allConversationTweets) {
  const author = tweet.author.username;
  const hasSelfReplies = allConversationTweets.some((candidate) => candidate.inReplyToStatusId === tweet.id && candidate.author.username === author);
  const isRoot = !tweet.inReplyToStatusId;
  let threadPosition;
  if (isRoot && !hasSelfReplies) {
    threadPosition = "standalone";
  } else if (isRoot && hasSelfReplies) {
    threadPosition = "root";
  } else if (!isRoot && hasSelfReplies) {
    threadPosition = "middle";
  } else {
    threadPosition = "end";
  }
  return {
    ...tweet,
    isThread: hasSelfReplies || !isRoot,
    threadPosition,
    hasSelfReplies,
    threadRootId: tweet.conversationId ?? null
  };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-base.js
import { randomBytes, randomUUID } from "node:crypto";

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/runtime-query-ids.js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
var DEFAULT_CACHE_FILENAME = "query-ids-cache.json";
var DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
var DISCOVERY_PAGES = [
  "https://x.com/?lang=en",
  "https://x.com/explore",
  "https://x.com/notifications",
  "https://x.com/settings/profile"
];
var BUNDLE_URL_REGEX = /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/[A-Za-z0-9.-]+\.js/g;
var QUERY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
var OPERATION_PATTERNS = [
  {
    regex: /e\.exports=\{queryId\s*:\s*["']([^"']+)["']\s*,\s*operationName\s*:\s*["']([^"']+)["']/gs,
    operationGroup: 2,
    queryIdGroup: 1
  },
  {
    regex: /e\.exports=\{operationName\s*:\s*["']([^"']+)["']\s*,\s*queryId\s*:\s*["']([^"']+)["']/gs,
    operationGroup: 1,
    queryIdGroup: 2
  },
  {
    regex: /operationName\s*[:=]\s*["']([^"']+)["'](.{0,4000}?)queryId\s*[:=]\s*["']([^"']+)["']/gs,
    operationGroup: 1,
    queryIdGroup: 3
  },
  {
    regex: /queryId\s*[:=]\s*["']([^"']+)["'](.{0,4000}?)operationName\s*[:=]\s*["']([^"']+)["']/gs,
    operationGroup: 3,
    queryIdGroup: 1
  }
];
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: HEADERS });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 120)}`);
  }
  return response.text();
}
function resolveDefaultCachePath() {
  const override = process.env.BIRD_QUERY_IDS_CACHE;
  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return path.join(homedir(), ".config", "bird", DEFAULT_CACHE_FILENAME);
}
function parseSnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw;
  const fetchedAt = typeof record.fetchedAt === "string" ? record.fetchedAt : null;
  const ttlMs = typeof record.ttlMs === "number" && Number.isFinite(record.ttlMs) ? record.ttlMs : null;
  const ids = record.ids && typeof record.ids === "object" ? record.ids : null;
  const discovery = record.discovery && typeof record.discovery === "object" ? record.discovery : null;
  if (!fetchedAt || !ttlMs || !ids || !discovery) {
    return null;
  }
  const pages = Array.isArray(discovery.pages) ? discovery.pages : null;
  const bundles = Array.isArray(discovery.bundles) ? discovery.bundles : null;
  if (!pages || !bundles) {
    return null;
  }
  const normalizedIds = {};
  for (const [key, value] of Object.entries(ids)) {
    if (typeof value === "string" && value.trim().length > 0) {
      normalizedIds[key] = value.trim();
    }
  }
  return {
    fetchedAt,
    ttlMs,
    ids: normalizedIds,
    discovery: {
      pages: pages.filter((p) => typeof p === "string"),
      bundles: bundles.filter((b) => typeof b === "string")
    }
  };
}
async function readSnapshotFromDisk(cachePath) {
  try {
    const raw = await readFile(cachePath, "utf8");
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}
async function writeSnapshotToDisk(cachePath, snapshot) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(snapshot, null, 2)}
`, "utf8");
}
async function discoverBundles(fetchImpl) {
  const bundles = new Set;
  for (const page of DISCOVERY_PAGES) {
    try {
      const html = await fetchText(fetchImpl, page);
      for (const match of html.matchAll(BUNDLE_URL_REGEX)) {
        bundles.add(match[0]);
      }
    } catch {}
  }
  const discovered = [...bundles];
  if (discovered.length === 0) {
    throw new Error("No client bundles discovered; x.com layout may have changed.");
  }
  return discovered;
}
function extractOperations(bundleContents, bundleLabel, targets, discovered) {
  for (const pattern of OPERATION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    while (true) {
      const match = pattern.regex.exec(bundleContents);
      if (match === null) {
        break;
      }
      const operationName = match[pattern.operationGroup];
      const queryId = match[pattern.queryIdGroup];
      if (!operationName || !queryId) {
        continue;
      }
      if (!targets.has(operationName)) {
        continue;
      }
      if (!QUERY_ID_REGEX.test(queryId)) {
        continue;
      }
      if (discovered.has(operationName)) {
        continue;
      }
      discovered.set(operationName, { queryId, bundle: bundleLabel });
      if (discovered.size === targets.size) {
        return;
      }
    }
  }
}
async function fetchAndExtract(fetchImpl, bundleUrls, targets) {
  const discovered = new Map;
  const CONCURRENCY = 6;
  for (let i = 0;i < bundleUrls.length; i += CONCURRENCY) {
    const chunk = bundleUrls.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (url) => {
      if (discovered.size === targets.size) {
        return;
      }
      const label = url.split("/").at(-1) ?? url;
      try {
        const js = await fetchText(fetchImpl, url);
        extractOperations(js, label, targets, discovered);
      } catch {}
    }));
    if (discovered.size === targets.size) {
      break;
    }
  }
  return discovered;
}
function createRuntimeQueryIdStore(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const cachePath = options.cachePath ? path.resolve(options.cachePath) : resolveDefaultCachePath();
  let memorySnapshot = null;
  let loadOnce = null;
  let refreshInFlight = null;
  const loadSnapshot = async () => {
    if (memorySnapshot) {
      return memorySnapshot;
    }
    if (!loadOnce) {
      loadOnce = (async () => {
        const fromDisk = await readSnapshotFromDisk(cachePath);
        memorySnapshot = fromDisk;
        return fromDisk;
      })();
    }
    return loadOnce;
  };
  const getSnapshotInfo = async () => {
    const snapshot = await loadSnapshot();
    if (!snapshot) {
      return null;
    }
    const fetchedAtMs = new Date(snapshot.fetchedAt).getTime();
    const ageMs = Number.isFinite(fetchedAtMs) ? Math.max(0, Date.now() - fetchedAtMs) : Number.POSITIVE_INFINITY;
    const effectiveTtl = Number.isFinite(snapshot.ttlMs) ? snapshot.ttlMs : ttlMs;
    const isFresh = ageMs <= effectiveTtl;
    return { snapshot, cachePath, ageMs, isFresh };
  };
  const getQueryId = async (operationName) => {
    const info = await getSnapshotInfo();
    if (!info) {
      return null;
    }
    return info.snapshot.ids[operationName] ?? null;
  };
  const refresh = async (operationNames, opts = {}) => {
    if (refreshInFlight) {
      return refreshInFlight;
    }
    refreshInFlight = (async () => {
      const current = await getSnapshotInfo();
      if (!opts.force && current?.isFresh) {
        return current;
      }
      const targets = new Set(operationNames);
      const bundleUrls = await discoverBundles(fetchImpl);
      const discovered = await fetchAndExtract(fetchImpl, bundleUrls, targets);
      if (discovered.size === 0) {
        return current ?? null;
      }
      const ids = {};
      for (const name of operationNames) {
        const entry = discovered.get(name);
        if (entry?.queryId) {
          ids[name] = entry.queryId;
        }
      }
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs,
        ids,
        discovery: {
          pages: [...DISCOVERY_PAGES],
          bundles: bundleUrls.map((url) => url.split("/").at(-1) ?? url)
        }
      };
      await writeSnapshotToDisk(cachePath, snapshot);
      memorySnapshot = snapshot;
      return getSnapshotInfo();
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  };
  return {
    cachePath,
    ttlMs,
    getSnapshotInfo,
    getQueryId,
    refresh,
    clearMemory() {
      memorySnapshot = null;
      loadOnce = null;
    }
  };
}
var runtimeQueryIds = createRuntimeQueryIdStore();
// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/query-ids.json
var query_ids_default = {
  CreateTweet: "nmdAQXJDxw6-0KKF2on7eA",
  CreateRetweet: "LFho5rIi4xcKO90p9jwG7A",
  CreateFriendship: "8h9JVdV8dlSyqyRDJEPCsA",
  DestroyFriendship: "ppXWuagMNXgvzx6WoXBW0Q",
  FavoriteTweet: "lI07N6Otwv1PhnEgXILM7A",
  DeleteBookmark: "Wlmlj2-xzyS1GN3a6cj-mQ",
  TweetDetail: "_NvJCnIjOW__EP5-RF197A",
  SearchTimeline: "6AAys3t42mosm_yTI_QENg",
  Bookmarks: "RV1g3b8n_SGOHwkqKYSCFw",
  BookmarkFolderTimeline: "KJIQpsvxrTfRIlbaRIySHQ",
  Following: "mWYeougg_ocJS2Vr1Vt28w",
  Followers: "SFYY3WsgwjlXSLlfnEUE4A",
  Likes: "ETJflBunfqNa1uE1mBPCaw",
  ExploreSidebar: "lpSN4M6qpimkF4nRFPE3nQ",
  ExplorePage: "kheAINB_4pzRDqkzG3K-ng",
  GenericTimelineById: "uGSr7alSjR9v6QJAIaqSKQ",
  TrendHistory: "Sj4T-jSB9pr0Mxtsc1UKZQ",
  AboutAccountQuery: "zs_jFPFT78rBpXv9Z3U2YQ"
};

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-constants.js
var TWITTER_API_BASE = "https://x.com/i/api/graphql";
var TWITTER_GRAPHQL_POST_URL = "https://x.com/i/api/graphql";
var TWITTER_UPLOAD_URL = "https://upload.twitter.com/i/media/upload.json";
var TWITTER_MEDIA_METADATA_URL = "https://x.com/i/api/1.1/media/metadata/create.json";
var TWITTER_STATUS_UPDATE_URL = "https://x.com/i/api/1.1/statuses/update.json";
var SETTINGS_SCREEN_NAME_REGEX = /"screen_name":"([^"]+)"/;
var SETTINGS_USER_ID_REGEX = /"user_id"\s*:\s*"(\d+)"/;
var SETTINGS_NAME_REGEX = /"name":"([^"\\]*(?:\\.[^"\\]*)*)"/;
var FALLBACK_QUERY_IDS = {
  CreateTweet: "TAJw1rBsjAtdNgTdlo2oeg",
  CreateRetweet: "ojPdsZsimiJrUGLR1sjUtA",
  DeleteRetweet: "iQtK4dl5hBmXewYZuEOKVw",
  CreateFriendship: "8h9JVdV8dlSyqyRDJEPCsA",
  DestroyFriendship: "ppXWuagMNXgvzx6WoXBW0Q",
  FavoriteTweet: "lI07N6Otwv1PhnEgXILM7A",
  UnfavoriteTweet: "ZYKSe-w7KEslx3JhSIk5LA",
  CreateBookmark: "aoDbu3RHznuiSkQ9aNM67Q",
  DeleteBookmark: "Wlmlj2-xzyS1GN3a6cj-mQ",
  TweetDetail: "97JF30KziU00483E_8elBA",
  SearchTimeline: "M1jEez78PEfVfbQLvlWMvQ",
  UserArticlesTweets: "8zBy9h4L90aDL02RsBcCFg",
  UserTweets: "Wms1GvIiHXAPBaCr9KblaA",
  Bookmarks: "RV1g3b8n_SGOHwkqKYSCFw",
  Following: "BEkNpEt5pNETESoqMsTEGA",
  Followers: "kuFUYP9eV1FPoEy4N-pi7w",
  Likes: "JR2gceKucIKcVNB_9JkhsA",
  BookmarkFolderTimeline: "KJIQpsvxrTfRIlbaRIySHQ",
  ListOwnerships: "wQcOSjSQ8NtgxIwvYl1lMg",
  ListMemberships: "BlEXXdARdSeL_0KyKHHvvg",
  ListLatestTweetsTimeline: "2TemLyqrMpTeAmysdbnVqw",
  ListByRestId: "wXzyA5vM_aVkBL9G8Vp3kw",
  HomeTimeline: "edseUwk9sP5Phz__9TIRnA",
  HomeLatestTimeline: "iOEZpOdfekFsxSlPQCQtPg",
  ExploreSidebar: "lpSN4M6qpimkF4nRFPE3nQ",
  ExplorePage: "kheAINB_4pzRDqkzG3K-ng",
  GenericTimelineById: "uGSr7alSjR9v6QJAIaqSKQ",
  TrendHistory: "Sj4T-jSB9pr0Mxtsc1UKZQ",
  AboutAccountQuery: "zs_jFPFT78rBpXv9Z3U2YQ"
};
var QUERY_IDS = {
  ...FALLBACK_QUERY_IDS,
  ...query_ids_default
};
var TARGET_QUERY_ID_OPERATIONS = Object.keys(FALLBACK_QUERY_IDS);

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-utils.js
function normalizeQuoteDepth(value) {
  if (value === undefined || value === null) {
    return 1;
  }
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.floor(value));
}
function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return;
}
function collectTextFields(value, keys, output) {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextFields(item, keys, output);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (keys.has(key)) {
        if (typeof nested === "string") {
          const trimmed = nested.trim();
          if (trimmed) {
            output.push(trimmed);
          }
          continue;
        }
      }
      collectTextFields(nested, keys, output);
    }
  }
}
function uniqueOrdered(values) {
  const seen = new Set;
  const result = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
function renderContentState(contentState) {
  if (!contentState?.blocks || contentState.blocks.length === 0) {
    return;
  }
  const entityMap = new Map;
  const rawEntityMap = contentState.entityMap ?? [];
  if (Array.isArray(rawEntityMap)) {
    for (const entry of rawEntityMap) {
      const key = Number.parseInt(entry.key, 10);
      if (!Number.isNaN(key)) {
        entityMap.set(key, entry.value);
      }
    }
  } else {
    for (const [key, value] of Object.entries(rawEntityMap)) {
      const keyNumber = Number.parseInt(key, 10);
      if (!Number.isNaN(keyNumber)) {
        entityMap.set(keyNumber, value);
      }
    }
  }
  const outputLines = [];
  let orderedListCounter = 0;
  let previousBlockType;
  for (const block of contentState.blocks) {
    if (block.type !== "ordered-list-item" && previousBlockType === "ordered-list-item") {
      orderedListCounter = 0;
    }
    switch (block.type) {
      case "unstyled": {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(text);
        }
        break;
      }
      case "header-one": {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(`# ${text}`);
        }
        break;
      }
      case "header-two": {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(`## ${text}`);
        }
        break;
      }
      case "header-three": {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(`### ${text}`);
        }
        break;
      }
      case "unordered-list-item": {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(`- ${text}`);
        }
        break;
      }
      case "ordered-list-item": {
        orderedListCounter++;
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(`${orderedListCounter}. ${text}`);
        }
        break;
      }
      case "blockquote": {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(`> ${text}`);
        }
        break;
      }
      case "atomic": {
        const entityContent = renderAtomicBlock(block, entityMap);
        if (entityContent) {
          outputLines.push(entityContent);
        }
        break;
      }
      default: {
        const text = renderBlockText(block, entityMap);
        if (text) {
          outputLines.push(text);
        }
      }
    }
    previousBlockType = block.type;
  }
  const result = outputLines.join(`

`);
  return result.trim() || undefined;
}
function renderBlockText(block, entityMap) {
  let text = block.text;
  const linkRanges = (block.entityRanges ?? []).filter((range) => {
    const entity = entityMap.get(range.key);
    return entity?.type === "LINK" && entity.data.url;
  }).sort((a, b) => b.offset - a.offset);
  for (const range of linkRanges) {
    const entity = entityMap.get(range.key);
    if (entity?.data.url) {
      const linkText = text.slice(range.offset, range.offset + range.length);
      const markdownLink = `[${linkText}](${entity.data.url})`;
      text = text.slice(0, range.offset) + markdownLink + text.slice(range.offset + range.length);
    }
  }
  return text.trim();
}
function renderAtomicBlock(block, entityMap) {
  const entityRanges = block.entityRanges ?? [];
  if (entityRanges.length === 0) {
    return;
  }
  const entityKey = entityRanges[0].key;
  const entity = entityMap.get(entityKey);
  if (!entity) {
    return;
  }
  switch (entity.type) {
    case "MARKDOWN":
      return entity.data.markdown?.trim();
    case "DIVIDER":
      return "---";
    case "TWEET":
      if (entity.data.tweetId) {
        return `[Embedded Tweet: https://x.com/i/status/${entity.data.tweetId}]`;
      }
      return;
    case "LINK":
      if (entity.data.url) {
        return `[Link: ${entity.data.url}]`;
      }
      return;
    case "IMAGE":
      return "[Image]";
    default:
      return;
  }
}
function extractArticleText(result) {
  const article = result?.article;
  if (!article) {
    return;
  }
  const articleResult = article.article_results?.result ?? article;
  if (process.env.BIRD_DEBUG_ARTICLE === "1") {
    console.error("[bird][debug][article] payload:", JSON.stringify({
      rest_id: result?.rest_id,
      article: articleResult,
      note_tweet: result?.note_tweet?.note_tweet_results?.result ?? null
    }, null, 2));
  }
  const title = firstText(articleResult.title, article.title);
  const contentState = article.article_results?.result?.content_state;
  const richBody = renderContentState(contentState);
  if (richBody) {
    if (title) {
      const normalizedTitle = title.trim();
      const trimmedBody = richBody.trimStart();
      const headingMatches = [`# ${normalizedTitle}`, `## ${normalizedTitle}`, `### ${normalizedTitle}`];
      const hasTitle = trimmedBody === normalizedTitle || trimmedBody.startsWith(`${normalizedTitle}
`) || headingMatches.some((heading) => trimmedBody.startsWith(heading));
      if (!hasTitle) {
        return `${title}

${richBody}`;
      }
    }
    return richBody;
  }
  let body = firstText(articleResult.plain_text, article.plain_text, articleResult.body?.text, articleResult.body?.richtext?.text, articleResult.body?.rich_text?.text, articleResult.content?.text, articleResult.content?.richtext?.text, articleResult.content?.rich_text?.text, articleResult.text, articleResult.richtext?.text, articleResult.rich_text?.text, article.body?.text, article.body?.richtext?.text, article.body?.rich_text?.text, article.content?.text, article.content?.richtext?.text, article.content?.rich_text?.text, article.text, article.richtext?.text, article.rich_text?.text);
  if (body && title && body.trim() === title.trim()) {
    body = undefined;
  }
  if (!body) {
    const collected = [];
    collectTextFields(articleResult, new Set(["text", "title"]), collected);
    collectTextFields(article, new Set(["text", "title"]), collected);
    const unique = uniqueOrdered(collected);
    const filtered = title ? unique.filter((value) => value !== title) : unique;
    if (filtered.length > 0) {
      body = filtered.join(`

`);
    }
  }
  if (title && body && !body.startsWith(title)) {
    return `${title}

${body}`;
  }
  return body ?? title;
}
function extractNoteTweetText(result) {
  const note = result?.note_tweet?.note_tweet_results?.result;
  if (!note) {
    return;
  }
  return firstText(note.text, note.richtext?.text, note.rich_text?.text, note.content?.text, note.content?.richtext?.text, note.content?.rich_text?.text);
}
function extractTweetText(result) {
  return extractArticleText(result) ?? extractNoteTweetText(result) ?? firstText(result?.legacy?.full_text);
}
function extractArticleMetadata(result) {
  const article = result?.article;
  if (!article) {
    return;
  }
  const articleResult = article.article_results?.result ?? article;
  const title = firstText(articleResult.title, article.title);
  if (!title) {
    return;
  }
  const previewText = firstText(articleResult.preview_text, article.preview_text);
  return { title, previewText };
}
function extractMedia(result) {
  const rawMedia = result?.legacy?.extended_entities?.media ?? result?.legacy?.entities?.media;
  if (!rawMedia || rawMedia.length === 0) {
    return;
  }
  const media = [];
  for (const item of rawMedia) {
    if (!item.type || !item.media_url_https) {
      continue;
    }
    const mediaItem = {
      type: item.type,
      url: item.media_url_https
    };
    const sizes = item.sizes;
    if (sizes?.large) {
      mediaItem.width = sizes.large.w;
      mediaItem.height = sizes.large.h;
    } else if (sizes?.medium) {
      mediaItem.width = sizes.medium.w;
      mediaItem.height = sizes.medium.h;
    }
    if (sizes?.small) {
      mediaItem.previewUrl = `${item.media_url_https}:small`;
    }
    if ((item.type === "video" || item.type === "animated_gif") && item.video_info?.variants) {
      const mp4Variants = item.video_info.variants.filter((v) => v.content_type === "video/mp4" && typeof v.url === "string");
      const mp4WithBitrate = mp4Variants.filter((v) => typeof v.bitrate === "number").sort((a, b) => b.bitrate - a.bitrate);
      const selectedVariant = mp4WithBitrate[0] ?? mp4Variants[0];
      if (selectedVariant) {
        mediaItem.videoUrl = selectedVariant.url;
      }
      if (typeof item.video_info.duration_millis === "number") {
        mediaItem.durationMs = item.video_info.duration_millis;
      }
    }
    media.push(mediaItem);
  }
  return media.length > 0 ? media : undefined;
}
function unwrapTweetResult(result) {
  if (!result) {
    return;
  }
  if (result.tweet) {
    return result.tweet;
  }
  return result;
}
function mapTweetResult(result, quoteDepthOrOptions) {
  const options = typeof quoteDepthOrOptions === "number" ? { quoteDepth: quoteDepthOrOptions } : quoteDepthOrOptions;
  const { quoteDepth, includeRaw = false } = options;
  const userResult = result?.core?.user_results?.result;
  const userLegacy = userResult?.legacy;
  const userCore = userResult?.core;
  const username = userLegacy?.screen_name ?? userCore?.screen_name;
  const name = userLegacy?.name ?? userCore?.name ?? username;
  const userId = userResult?.rest_id;
  if (!result?.rest_id || !username) {
    return;
  }
  const text = extractTweetText(result);
  if (!text) {
    return;
  }
  let quotedTweet;
  if (quoteDepth > 0) {
    const quotedResult = unwrapTweetResult(result.quoted_status_result?.result);
    if (quotedResult) {
      quotedTweet = mapTweetResult(quotedResult, { quoteDepth: quoteDepth - 1, includeRaw });
    }
  }
  const media = extractMedia(result);
  const article = extractArticleMetadata(result);
  const tweetData = {
    id: result.rest_id,
    text,
    createdAt: result.legacy?.created_at,
    replyCount: result.legacy?.reply_count,
    retweetCount: result.legacy?.retweet_count,
    likeCount: result.legacy?.favorite_count,
    conversationId: result.legacy?.conversation_id_str,
    inReplyToStatusId: result.legacy?.in_reply_to_status_id_str ?? undefined,
    author: {
      username,
      name: name || username
    },
    authorId: userId,
    quotedTweet,
    media,
    article
  };
  if (includeRaw) {
    tweetData._raw = result;
  }
  return tweetData;
}
function findTweetInInstructions(instructions, tweetId) {
  if (!instructions) {
    return;
  }
  for (const instruction of instructions) {
    for (const entry of instruction.entries || []) {
      const result = entry.content?.itemContent?.tweet_results?.result;
      if (result?.rest_id === tweetId) {
        return result;
      }
    }
  }
  return;
}
function collectTweetResultsFromEntry(entry) {
  const results = [];
  const pushResult = (result) => {
    if (result?.rest_id) {
      results.push(result);
    }
  };
  const content = entry.content;
  pushResult(content?.itemContent?.tweet_results?.result);
  pushResult(content?.item?.itemContent?.tweet_results?.result);
  for (const item of content?.items ?? []) {
    pushResult(item?.item?.itemContent?.tweet_results?.result);
    pushResult(item?.itemContent?.tweet_results?.result);
    pushResult(item?.content?.itemContent?.tweet_results?.result);
  }
  return results;
}
function parseTweetsFromInstructions(instructions, quoteDepthOrOptions) {
  const options = typeof quoteDepthOrOptions === "number" ? { quoteDepth: quoteDepthOrOptions } : quoteDepthOrOptions;
  const { quoteDepth, includeRaw = false } = options;
  const tweets = [];
  const seen = new Set;
  for (const instruction of instructions ?? []) {
    for (const entry of instruction.entries ?? []) {
      const results = collectTweetResultsFromEntry(entry);
      for (const result of results) {
        const mapped = mapTweetResult(result, { quoteDepth, includeRaw });
        if (!mapped || seen.has(mapped.id)) {
          continue;
        }
        seen.add(mapped.id);
        tweets.push(mapped);
      }
    }
  }
  return tweets;
}
function extractCursorFromInstructions(instructions, cursorType = "Bottom") {
  for (const instruction of instructions ?? []) {
    for (const entry of instruction.entries ?? []) {
      const content = entry.content;
      if (content?.cursorType === cursorType && typeof content.value === "string" && content.value.length > 0) {
        return content.value;
      }
    }
  }
  return;
}
function parseUsersFromInstructions(instructions) {
  if (!instructions) {
    return [];
  }
  const users = [];
  for (const instruction of instructions) {
    if (!instruction.entries) {
      continue;
    }
    for (const entry of instruction.entries) {
      const content = entry?.content;
      const rawUserResult = content?.itemContent?.user_results?.result;
      const userResult = rawUserResult?.__typename === "UserWithVisibilityResults" && rawUserResult.user ? rawUserResult.user : rawUserResult;
      if (!userResult || userResult.__typename !== "User") {
        continue;
      }
      const legacy = userResult.legacy;
      const core = userResult.core;
      const username = legacy?.screen_name ?? core?.screen_name;
      if (!userResult.rest_id || !username) {
        continue;
      }
      users.push({
        id: userResult.rest_id,
        username,
        name: legacy?.name ?? core?.name ?? username,
        description: legacy?.description,
        followersCount: legacy?.followers_count,
        followingCount: legacy?.friends_count,
        isBlueVerified: userResult.is_blue_verified,
        profileImageUrl: legacy?.profile_image_url_https ?? userResult.avatar?.image_url,
        createdAt: legacy?.created_at ?? core?.created_at
      });
    }
  }
  return users;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-base.js
class TwitterClientBase {
  authToken;
  ct0;
  cookieHeader;
  userAgent;
  timeoutMs;
  quoteDepth;
  clientUuid;
  clientDeviceId;
  clientUserId;
  constructor(options) {
    if (!options.cookies.authToken || !options.cookies.ct0) {
      throw new Error("Both authToken and ct0 cookies are required");
    }
    this.authToken = options.cookies.authToken;
    this.ct0 = options.cookies.ct0;
    this.cookieHeader = options.cookies.cookieHeader || `auth_token=${this.authToken}; ct0=${this.ct0}`;
    this.userAgent = options.userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    this.timeoutMs = options.timeoutMs;
    this.quoteDepth = normalizeQuoteDepth(options.quoteDepth);
    this.clientUuid = randomUUID();
    this.clientDeviceId = randomUUID();
  }
  async sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  async getQueryId(operationName) {
    const cached = await runtimeQueryIds.getQueryId(operationName);
    return cached ?? QUERY_IDS[operationName];
  }
  async refreshQueryIds() {
    if (false) {}
    try {
      await runtimeQueryIds.refresh(TARGET_QUERY_ID_OPERATIONS, { force: true });
    } catch {}
  }
  async withRefreshedQueryIdsOn404(attempt) {
    const firstAttempt = await attempt();
    if (firstAttempt.success || !firstAttempt.had404) {
      return { result: firstAttempt, refreshed: false };
    }
    await this.refreshQueryIds();
    const secondAttempt = await attempt();
    return { result: secondAttempt, refreshed: true };
  }
  async getTweetDetailQueryIds() {
    const primary = await this.getQueryId("TweetDetail");
    return Array.from(new Set([primary, "97JF30KziU00483E_8elBA", "aFvUsJm2c-oDkJV75blV6g"]));
  }
  async getSearchTimelineQueryIds() {
    const primary = await this.getQueryId("SearchTimeline");
    return Array.from(new Set([primary, "M1jEez78PEfVfbQLvlWMvQ", "5h0kNbk3ii97rmfY6CdgAA", "Tp1sewRU1AsZpBWhqCZicQ"]));
  }
  async fetchWithTimeout(url, init) {
    if (!this.timeoutMs || this.timeoutMs <= 0) {
      return fetch(url, init);
    }
    const controller = new AbortController;
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
  getHeaders() {
    return this.getJsonHeaders();
  }
  createTransactionId() {
    return randomBytes(16).toString("hex");
  }
  getBaseHeaders() {
    const headers = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      "x-csrf-token": this.ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
      "x-client-uuid": this.clientUuid,
      "x-twitter-client-deviceid": this.clientDeviceId,
      "x-client-transaction-id": this.createTransactionId(),
      cookie: this.cookieHeader,
      "user-agent": this.userAgent,
      origin: "https://x.com",
      referer: "https://x.com/"
    };
    if (this.clientUserId) {
      headers["x-twitter-client-user-id"] = this.clientUserId;
    }
    return headers;
  }
  getJsonHeaders() {
    return {
      ...this.getBaseHeaders(),
      "content-type": "application/json"
    };
  }
  getUploadHeaders() {
    return this.getBaseHeaders();
  }
  async ensureClientUserId() {
    if (false) {}
    if (this.clientUserId) {
      return;
    }
    const result = await this.getCurrentUser();
    if (result.success && result.user?.id) {
      this.clientUserId = result.user.id;
    }
  }
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-bookmarks.js
function withBookmarks(Base) {
  class TwitterClientBookmarks extends Base {
    constructor(...args) {
      super(...args);
    }
    async unbookmark(tweetId) {
      const variables = { tweet_id: tweetId };
      let queryId = await this.getQueryId("DeleteBookmark");
      let urlWithOperation = `${TWITTER_API_BASE}/${queryId}/DeleteBookmark`;
      const buildBody = () => JSON.stringify({ variables, queryId });
      const buildHeaders = () => ({ ...this.getHeaders(), referer: `https://x.com/i/status/${tweetId}` });
      let body = buildBody();
      const parseResponse = async (response) => {
        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          return { success: false, error: data.errors.map((e) => e.message).join(", ") };
        }
        return { success: true };
      };
      try {
        let response = await this.fetchWithTimeout(urlWithOperation, {
          method: "POST",
          headers: buildHeaders(),
          body
        });
        if (response.status === 404) {
          await this.refreshQueryIds();
          queryId = await this.getQueryId("DeleteBookmark");
          urlWithOperation = `${TWITTER_API_BASE}/${queryId}/DeleteBookmark`;
          body = buildBody();
          response = await this.fetchWithTimeout(urlWithOperation, {
            method: "POST",
            headers: buildHeaders(),
            body
          });
          if (response.status === 404) {
            const retry = await this.fetchWithTimeout(TWITTER_GRAPHQL_POST_URL, {
              method: "POST",
              headers: buildHeaders(),
              body
            });
            return parseResponse(retry);
          }
        }
        return parseResponse(response);
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  return TwitterClientBookmarks;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-engagement.js
function withEngagement(Base) {
  class TwitterClientEngagement extends Base {
    constructor(...args) {
      super(...args);
    }
    async performEngagementMutation(operationName, tweetId) {
      await this.ensureClientUserId();
      const variables = operationName === "DeleteRetweet" ? { tweet_id: tweetId, source_tweet_id: tweetId } : { tweet_id: tweetId };
      let queryId = await this.getQueryId(operationName);
      let urlWithOperation = `${TWITTER_API_BASE}/${queryId}/${operationName}`;
      const buildBody = () => JSON.stringify({ variables, queryId });
      const buildHeaders = () => ({ ...this.getHeaders(), referer: `https://x.com/i/status/${tweetId}` });
      let body = buildBody();
      const parseResponse = async (response) => {
        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          return { success: false, error: data.errors.map((e) => e.message).join(", ") };
        }
        return { success: true };
      };
      try {
        let response = await this.fetchWithTimeout(urlWithOperation, {
          method: "POST",
          headers: buildHeaders(),
          body
        });
        if (response.status === 404) {
          await this.refreshQueryIds();
          queryId = await this.getQueryId(operationName);
          urlWithOperation = `${TWITTER_API_BASE}/${queryId}/${operationName}`;
          body = buildBody();
          response = await this.fetchWithTimeout(urlWithOperation, {
            method: "POST",
            headers: buildHeaders(),
            body
          });
          if (response.status === 404) {
            const retry = await this.fetchWithTimeout(TWITTER_GRAPHQL_POST_URL, {
              method: "POST",
              headers: buildHeaders(),
              body
            });
            return parseResponse(retry);
          }
        }
        return parseResponse(response);
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    async like(tweetId) {
      return this.performEngagementMutation("FavoriteTweet", tweetId);
    }
    async unlike(tweetId) {
      return this.performEngagementMutation("UnfavoriteTweet", tweetId);
    }
    async retweet(tweetId) {
      return this.performEngagementMutation("CreateRetweet", tweetId);
    }
    async unretweet(tweetId) {
      return this.performEngagementMutation("DeleteRetweet", tweetId);
    }
    async bookmark(tweetId) {
      return this.performEngagementMutation("CreateBookmark", tweetId);
    }
  }
  return TwitterClientEngagement;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-follow.js
function withFollow(Base) {
  class TwitterClientFollow extends Base {
    constructor(...args) {
      super(...args);
    }
    async follow(userId) {
      await this.ensureClientUserId();
      const restResult = await this.followViaRest(userId, "create");
      if (restResult.success) {
        return restResult;
      }
      return this.followViaGraphQL(userId, true);
    }
    async unfollow(userId) {
      await this.ensureClientUserId();
      const restResult = await this.followViaRest(userId, "destroy");
      if (restResult.success) {
        return restResult;
      }
      return this.followViaGraphQL(userId, false);
    }
    async followViaRest(userId, action) {
      const urls = [
        `https://x.com/i/api/1.1/friendships/${action}.json`,
        `https://api.twitter.com/1.1/friendships/${action}.json`
      ];
      const params = new URLSearchParams({
        user_id: userId,
        skip_status: "true"
      });
      let lastError;
      for (const url of urls) {
        try {
          const response = await this.fetchWithTimeout(url, {
            method: "POST",
            headers: {
              ...this.getBaseHeaders(),
              "content-type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
          });
          if (!response.ok) {
            const text = await response.text();
            try {
              const errorData = JSON.parse(text);
              if (errorData.errors && errorData.errors.length > 0) {
                const error = errorData.errors[0];
                if (error.code === 160) {
                  return { success: true };
                }
                if (error.code === 162) {
                  return { success: false, error: "You have been blocked from following this account" };
                }
                if (error.code === 108) {
                  return { success: false, error: "User not found" };
                }
                lastError = `${error.message} (code ${error.code})`;
                continue;
              }
            } catch {}
            lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            continue;
          }
          const data = await response.json();
          if (data.errors && data.errors.length > 0) {
            lastError = data.errors.map((e) => e.message).join(", ");
            continue;
          }
          if (data.id_str || data.screen_name) {
            return {
              success: true,
              userId: data.id_str,
              username: data.screen_name
            };
          }
          return { success: true };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      return { success: false, error: lastError ?? `Unknown error during ${action}` };
    }
    async followViaGraphQL(userId, follow) {
      const operationName = follow ? "CreateFriendship" : "DestroyFriendship";
      const variables = {
        user_id: userId
      };
      const tryOnce = async () => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getFollowQueryIds(follow);
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/${operationName}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "POST",
              headers: this.getHeaders(),
              body: JSON.stringify({ variables, queryId })
            });
            if (response.status === 404) {
              had404 = true;
              lastError = "HTTP 404";
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
              continue;
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              lastError = data.errors.map((e) => e.message).join(", ");
              continue;
            }
            const result = data.data?.user?.result;
            return {
              success: true,
              userId: result?.rest_id,
              username: result?.legacy?.screen_name,
              had404
            };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return {
          success: false,
          error: lastError ?? `Unknown error during ${operationName}`,
          had404
        };
      };
      const firstAttempt = await tryOnce();
      if (firstAttempt.success) {
        return { success: true, userId: firstAttempt.userId, username: firstAttempt.username };
      }
      if (firstAttempt.had404) {
        await this.refreshQueryIds();
        const secondAttempt = await tryOnce();
        if (secondAttempt.success) {
          return { success: true, userId: secondAttempt.userId, username: secondAttempt.username };
        }
        return { success: false, error: secondAttempt.error };
      }
      return { success: false, error: firstAttempt.error };
    }
    async getFollowQueryIds(follow) {
      const primary = await this.getQueryId(follow ? "CreateFriendship" : "DestroyFriendship");
      const fallbacks = follow ? ["8h9JVdV8dlSyqyRDJEPCsA", "OPwKc1HXnBT_bWXfAlo-9g"] : ["ppXWuagMNXgvzx6WoXBW0Q", "8h9JVdV8dlSyqyRDJEPCsA"];
      return Array.from(new Set([primary, ...fallbacks]));
    }
  }
  return TwitterClientFollow;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/runtime-features.js
import { existsSync, readFileSync } from "node:fs";
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import path2 from "node:path";
// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/features.json
var features_default = {
  global: {
    responsive_web_grok_annotations_enabled: false,
    post_ctas_fetch_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true
  },
  sets: {
    lists: {
      blue_business_profile_image_shape_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_text_conversations_enabled: false,
      interactive_text_enabled: true,
      vibe_api_enabled: true,
      responsive_web_twitter_blue_verified_badge_is_enabled: true
    }
  }
};

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/runtime-features.js
var DEFAULT_CACHE_FILENAME2 = "features.json";
var cachedOverrides = null;
function normalizeFeatureMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "boolean") {
      result[key] = entry;
    }
  }
  return result;
}
function normalizeOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { global: {}, sets: {} };
  }
  const record = value;
  const global = normalizeFeatureMap(record.global);
  const sets = {};
  const rawSets = record.sets && typeof record.sets === "object" && !Array.isArray(record.sets) ? record.sets : {};
  for (const [setName, setValue] of Object.entries(rawSets)) {
    const normalized = normalizeFeatureMap(setValue);
    if (Object.keys(normalized).length > 0) {
      sets[setName] = normalized;
    }
  }
  return { global, sets };
}
function mergeOverrides(base, next) {
  const sets = { ...base.sets };
  for (const [setName, overrides] of Object.entries(next.sets)) {
    const existing = sets[setName];
    sets[setName] = existing ? { ...existing, ...overrides } : { ...overrides };
  }
  return {
    global: { ...base.global, ...next.global },
    sets
  };
}
function toFeatureOverrides(overrides) {
  const result = {};
  if (Object.keys(overrides.global).length > 0) {
    result.global = overrides.global;
  }
  const setEntries = Object.entries(overrides.sets).filter(([, value]) => Object.keys(value).length > 0);
  if (setEntries.length > 0) {
    result.sets = Object.fromEntries(setEntries);
  }
  return result;
}
function resolveFeaturesCachePath() {
  const override = process.env.BIRD_FEATURES_CACHE ?? process.env.BIRD_FEATURES_PATH;
  if (override && override.trim().length > 0) {
    return path2.resolve(override.trim());
  }
  return path2.join(homedir2(), ".config", "bird", DEFAULT_CACHE_FILENAME2);
}
function readOverridesFromFile(cachePath) {
  if (!existsSync(cachePath)) {
    return null;
  }
  try {
    const raw = readFileSync(cachePath, "utf8");
    return normalizeOverrides(JSON.parse(raw));
  } catch {
    return null;
  }
}
function readOverridesFromEnv() {
  const raw = process.env.BIRD_FEATURES_JSON;
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  try {
    return normalizeOverrides(JSON.parse(raw));
  } catch {
    return null;
  }
}
function writeOverridesToDisk(cachePath, overrides) {
  const payload = toFeatureOverrides(overrides);
  return mkdir2(path2.dirname(cachePath), { recursive: true }).then(() => writeFile2(cachePath, `${JSON.stringify(payload, null, 2)}
`, "utf8"));
}
function loadFeatureOverrides() {
  if (cachedOverrides) {
    return cachedOverrides;
  }
  const base = normalizeOverrides(features_default);
  const fromFile = readOverridesFromFile(resolveFeaturesCachePath());
  const fromEnv = readOverridesFromEnv();
  let merged = base;
  if (fromFile) {
    merged = mergeOverrides(merged, fromFile);
  }
  if (fromEnv) {
    merged = mergeOverrides(merged, fromEnv);
  }
  cachedOverrides = merged;
  return merged;
}
function getFeatureOverridesSnapshot() {
  const overrides = toFeatureOverrides(loadFeatureOverrides());
  return {
    cachePath: resolveFeaturesCachePath(),
    overrides
  };
}
function applyFeatureOverrides(setName, base) {
  const overrides = loadFeatureOverrides();
  const globalOverrides = overrides.global;
  const setOverrides = overrides.sets[setName];
  if (Object.keys(globalOverrides).length === 0 && (!setOverrides || Object.keys(setOverrides).length === 0)) {
    return base;
  }
  if (setOverrides) {
    return {
      ...base,
      ...globalOverrides,
      ...setOverrides
    };
  }
  return {
    ...base,
    ...globalOverrides
  };
}
async function refreshFeatureOverridesCache() {
  const cachePath = resolveFeaturesCachePath();
  const base = normalizeOverrides(features_default);
  const fromFile = readOverridesFromFile(cachePath);
  const merged = mergeOverrides(base, fromFile ?? { global: {}, sets: {} });
  await writeOverridesToDisk(cachePath, merged);
  cachedOverrides = null;
  return { cachePath, overrides: toFeatureOverrides(merged) };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-features.js
function buildArticleFeatures() {
  return applyFeatureOverrides("article", {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  });
}
function buildTweetDetailFeatures() {
  return applyFeatureOverrides("tweetDetail", {
    ...buildArticleFeatures(),
    responsive_web_graphql_exclude_directive_enabled: true,
    communities_web_enable_tweet_community_results_fetch: true,
    responsive_web_twitter_article_plain_text_enabled: true,
    responsive_web_twitter_article_seed_tweet_detail_enabled: true,
    responsive_web_twitter_article_seed_tweet_summary_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    verified_phone_label_enabled: false
  });
}
function buildArticleFieldToggles() {
  return {
    withPayments: false,
    withAuxiliaryUserLabels: false,
    withArticleRichContentState: true,
    withArticlePlainText: true,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false
  };
}
function buildSearchFeatures() {
  return applyFeatureOverrides("search", {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    articles_preview_enabled: true,
    responsive_web_enhance_cards_enabled: false
  });
}
function buildTweetCreateFeatures() {
  return applyFeatureOverrides("tweetCreate", {
    rweb_video_screen_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    articles_preview_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  });
}
function buildTimelineFeatures() {
  return applyFeatureOverrides("timeline", {
    ...buildSearchFeatures(),
    blue_business_profile_image_shape_enabled: true,
    responsive_web_text_conversations_enabled: false,
    tweetypie_unmention_optimization_enabled: true,
    vibe_api_enabled: true,
    responsive_web_twitter_blue_verified_badge_is_enabled: true,
    interactive_text_enabled: true,
    longform_notetweets_richtext_consumption_enabled: true,
    responsive_web_media_download_video_enabled: false
  });
}
function buildBookmarksFeatures() {
  return applyFeatureOverrides("bookmarks", {
    ...buildTimelineFeatures(),
    graphql_timeline_v2_bookmark_timeline: true
  });
}
function buildLikesFeatures() {
  return applyFeatureOverrides("likes", buildTimelineFeatures());
}
function buildListsFeatures() {
  return applyFeatureOverrides("lists", {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false,
    blue_business_profile_image_shape_enabled: false,
    responsive_web_text_conversations_enabled: false,
    tweetypie_unmention_optimization_enabled: true,
    vibe_api_enabled: false,
    interactive_text_enabled: false
  });
}
function buildHomeTimelineFeatures() {
  return applyFeatureOverrides("homeTimeline", {
    ...buildTimelineFeatures()
  });
}
function buildUserTweetsFeatures() {
  return applyFeatureOverrides("userTweets", {
    rweb_video_screen_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: false,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  });
}
function buildFollowingFeatures() {
  return applyFeatureOverrides("following", {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: false,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: true,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: false,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: false,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: false,
    responsive_web_grok_imagine_annotation_enabled: false,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  });
}
function buildExploreFeatures() {
  return applyFeatureOverrides("explore", {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: true,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    post_ctas_fetch_enabled: true,
    rweb_video_timestamps_enabled: true
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-home.js
var QUERY_UNSPECIFIED_REGEX = /query:\s*unspecified/i;
function isQueryIdMismatch(errors) {
  return errors.some((error) => QUERY_UNSPECIFIED_REGEX.test(error.message ?? ""));
}
function withHome(Base) {

  class TwitterClientHome extends Base {
    constructor(...args) {
      super(...args);
    }
    async getHomeTimelineQueryIds() {
      const primary = await this.getQueryId("HomeTimeline");
      return Array.from(new Set([primary, "edseUwk9sP5Phz__9TIRnA"]));
    }
    async getHomeLatestTimelineQueryIds() {
      const primary = await this.getQueryId("HomeLatestTimeline");
      return Array.from(new Set([primary, "iOEZpOdfekFsxSlPQCQtPg"]));
    }
    async getHomeTimeline(count = 20, options = {}) {
      return this.fetchHomeTimeline("HomeTimeline", count, options);
    }
    async getHomeLatestTimeline(count = 20, options = {}) {
      return this.fetchHomeTimeline("HomeLatestTimeline", count, options);
    }
    async fetchHomeTimeline(operation, count, options) {
      const { includeRaw = false } = options;
      const features = buildHomeTimelineFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor;
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = operation === "HomeTimeline" ? await this.getHomeTimelineQueryIds() : await this.getHomeLatestTimelineQueryIds();
        for (const queryId of queryIds) {
          const variables = {
            count: pageCount,
            includePromotedContent: true,
            latestControlAvailable: true,
            requestContext: "launch",
            withCommunity: true,
            ...pageCursor ? { cursor: pageCursor } : {}
          };
          const params = new URLSearchParams({
            variables: JSON.stringify(variables),
            features: JSON.stringify(features)
          });
          const url = `${TWITTER_API_BASE}/${queryId}/${operation}?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              const errorMessage = data.errors.map((e) => e.message).join(", ");
              return {
                success: false,
                error: errorMessage,
                had404: had404 || isQueryIdMismatch(data.errors)
              };
            }
            const instructions = data.data?.home?.home_timeline_urt?.instructions;
            const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
            const nextCursor = extractCursorFromInstructions(instructions);
            return { success: true, tweets: pageTweets, cursor: nextCursor, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching home timeline", had404 };
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (firstAttempt.had404) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      while (tweets.length < count) {
        const pageCount = Math.min(pageSize, count - tweets.length);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (tweets.length >= count) {
            break;
          }
        }
        if (!page.cursor || page.cursor === cursor || page.tweets.length === 0 || added === 0) {
          break;
        }
        cursor = page.cursor;
      }
      return { success: true, tweets };
    }
  }
  return TwitterClientHome;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-lists.js
function parseList(listResult) {
  if (!listResult.id_str || !listResult.name) {
    return null;
  }
  const owner = listResult.user_results?.result;
  return {
    id: listResult.id_str,
    name: listResult.name,
    description: listResult.description,
    memberCount: listResult.member_count,
    subscriberCount: listResult.subscriber_count,
    isPrivate: listResult.mode?.toLowerCase() === "private",
    createdAt: listResult.created_at,
    owner: owner ? {
      id: owner.rest_id ?? "",
      username: owner.legacy?.screen_name ?? "",
      name: owner.legacy?.name ?? ""
    } : undefined
  };
}
function parseListsFromInstructions(instructions) {
  const lists = [];
  if (!instructions) {
    return lists;
  }
  for (const instruction of instructions) {
    if (!instruction.entries) {
      continue;
    }
    for (const entry of instruction.entries) {
      const listResult = entry.content?.itemContent?.list;
      if (listResult) {
        const parsed = parseList(listResult);
        if (parsed) {
          lists.push(parsed);
        }
      }
    }
  }
  return lists;
}
function withLists(Base) {

  class TwitterClientLists extends Base {
    constructor(...args) {
      super(...args);
    }
    async getListOwnershipsQueryIds() {
      const primary = await this.getQueryId("ListOwnerships");
      return Array.from(new Set([primary, "wQcOSjSQ8NtgxIwvYl1lMg"]));
    }
    async getListMembershipsQueryIds() {
      const primary = await this.getQueryId("ListMemberships");
      return Array.from(new Set([primary, "BlEXXdARdSeL_0KyKHHvvg"]));
    }
    async getListTimelineQueryIds() {
      const primary = await this.getQueryId("ListLatestTweetsTimeline");
      return Array.from(new Set([primary, "2TemLyqrMpTeAmysdbnVqw"]));
    }
    async getOwnedLists(count = 100) {
      const userResult = await this.getCurrentUser();
      if (!userResult.success || !userResult.user) {
        return { success: false, error: userResult.error ?? "Could not determine current user" };
      }
      const variables = {
        userId: userResult.user.id,
        count,
        isListMembershipShown: true,
        isListMemberTargetUserId: userResult.user.id
      };
      const features = buildListsFeatures();
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features)
      });
      const tryOnce = async () => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getListOwnershipsQueryIds();
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/ListOwnerships?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              return { success: false, error: data.errors.map((e) => e.message).join(", "), had404 };
            }
            const instructions = data.data?.user?.result?.timeline?.timeline?.instructions;
            const lists = parseListsFromInstructions(instructions);
            return { success: true, lists, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching owned lists", had404 };
      };
      const firstAttempt = await tryOnce();
      if (firstAttempt.success) {
        return { success: true, lists: firstAttempt.lists };
      }
      if (firstAttempt.had404) {
        await this.refreshQueryIds();
        const secondAttempt = await tryOnce();
        if (secondAttempt.success) {
          return { success: true, lists: secondAttempt.lists };
        }
        return { success: false, error: secondAttempt.error };
      }
      return { success: false, error: firstAttempt.error };
    }
    async getListMemberships(count = 100) {
      const userResult = await this.getCurrentUser();
      if (!userResult.success || !userResult.user) {
        return { success: false, error: userResult.error ?? "Could not determine current user" };
      }
      const variables = {
        userId: userResult.user.id,
        count,
        isListMembershipShown: true,
        isListMemberTargetUserId: userResult.user.id
      };
      const features = buildListsFeatures();
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features)
      });
      const tryOnce = async () => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getListMembershipsQueryIds();
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/ListMemberships?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              return { success: false, error: data.errors.map((e) => e.message).join(", "), had404 };
            }
            const instructions = data.data?.user?.result?.timeline?.timeline?.instructions;
            const lists = parseListsFromInstructions(instructions);
            return { success: true, lists, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching list memberships", had404 };
      };
      const firstAttempt = await tryOnce();
      if (firstAttempt.success) {
        return { success: true, lists: firstAttempt.lists };
      }
      if (firstAttempt.had404) {
        await this.refreshQueryIds();
        const secondAttempt = await tryOnce();
        if (secondAttempt.success) {
          return { success: true, lists: secondAttempt.lists };
        }
        return { success: false, error: secondAttempt.error };
      }
      return { success: false, error: firstAttempt.error };
    }
    async getListTimeline(listId, count = 20, options = {}) {
      return this.getListTimelinePaged(listId, count, options);
    }
    async getAllListTimeline(listId, options) {
      return this.getListTimelinePaged(listId, Number.POSITIVE_INFINITY, options);
    }
    async getListTimelinePaged(listId, limit, options = {}) {
      const features = buildListsFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor = options.cursor;
      let nextCursor;
      let pagesFetched = 0;
      const { includeRaw = false, maxPages } = options;
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getListTimelineQueryIds();
        const variables = {
          listId,
          count: pageCount,
          ...pageCursor ? { cursor: pageCursor } : {}
        };
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features)
        });
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/ListLatestTweetsTimeline?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              return { success: false, error: data.errors.map((e) => e.message).join(", "), had404 };
            }
            const instructions = data.data?.list?.tweets_timeline?.timeline?.instructions;
            const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
            const nextCursor2 = extractCursorFromInstructions(instructions);
            return { success: true, tweets: pageTweets, cursor: nextCursor2, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching list timeline", had404 };
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (firstAttempt.had404) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      const unlimited = limit === Number.POSITIVE_INFINITY;
      while (unlimited || tweets.length < limit) {
        const pageCount = unlimited ? pageSize : Math.min(pageSize, limit - tweets.length);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        pagesFetched += 1;
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (!unlimited && tweets.length >= limit) {
            break;
          }
        }
        const pageCursor = page.cursor;
        if (!pageCursor || pageCursor === cursor || page.tweets.length === 0 || added === 0) {
          nextCursor = undefined;
          break;
        }
        if (maxPages && pagesFetched >= maxPages) {
          nextCursor = pageCursor;
          break;
        }
        cursor = pageCursor;
        nextCursor = pageCursor;
      }
      return { success: true, tweets, nextCursor };
    }
  }
  return TwitterClientLists;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-media.js
function withMedia(Base) {
  class TwitterClientMedia extends Base {
    constructor(...args) {
      super(...args);
    }
    mediaCategoryForMime(mimeType) {
      if (mimeType.startsWith("image/")) {
        if (mimeType === "image/gif") {
          return "tweet_gif";
        }
        return "tweet_image";
      }
      if (mimeType.startsWith("video/")) {
        return "tweet_video";
      }
      return null;
    }
    async uploadMedia(input) {
      const category = this.mediaCategoryForMime(input.mimeType);
      if (!category) {
        return { success: false, error: `Unsupported media type: ${input.mimeType}` };
      }
      try {
        const initParams = new URLSearchParams({
          command: "INIT",
          total_bytes: String(input.data.byteLength),
          media_type: input.mimeType,
          media_category: category
        });
        const initResp = await this.fetchWithTimeout(TWITTER_UPLOAD_URL, {
          method: "POST",
          headers: this.getUploadHeaders(),
          body: initParams
        });
        if (!initResp.ok) {
          const text = await initResp.text();
          return { success: false, error: `HTTP ${initResp.status}: ${text.slice(0, 200)}` };
        }
        const initBody = await initResp.json();
        const mediaId = typeof initBody.media_id_string === "string" ? initBody.media_id_string : initBody.media_id !== undefined ? String(initBody.media_id) : undefined;
        if (!mediaId) {
          return { success: false, error: "Media upload INIT did not return media_id" };
        }
        const chunkSize = 5 * 1024 * 1024;
        let segmentIndex = 0;
        for (let offset = 0;offset < input.data.byteLength; offset += chunkSize) {
          const chunk = input.data.slice(offset, Math.min(input.data.byteLength, offset + chunkSize));
          const form = new FormData;
          form.set("command", "APPEND");
          form.set("media_id", mediaId);
          form.set("segment_index", String(segmentIndex));
          form.set("media", new Blob([chunk], { type: input.mimeType }), "media");
          const appendResp = await this.fetchWithTimeout(TWITTER_UPLOAD_URL, {
            method: "POST",
            headers: this.getUploadHeaders(),
            body: form
          });
          if (!appendResp.ok) {
            const text = await appendResp.text();
            return { success: false, error: `HTTP ${appendResp.status}: ${text.slice(0, 200)}` };
          }
          segmentIndex += 1;
        }
        const finalizeParams = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
        const finalizeResp = await this.fetchWithTimeout(TWITTER_UPLOAD_URL, {
          method: "POST",
          headers: this.getUploadHeaders(),
          body: finalizeParams
        });
        if (!finalizeResp.ok) {
          const text = await finalizeResp.text();
          return { success: false, error: `HTTP ${finalizeResp.status}: ${text.slice(0, 200)}` };
        }
        const finalizeBody = await finalizeResp.json();
        const info = finalizeBody.processing_info;
        if (info?.state && info.state !== "succeeded") {
          let attempts = 0;
          while (attempts < 20) {
            if (info.state === "failed") {
              const msg = info.error?.message || info.error?.name || "Media processing failed";
              return { success: false, error: msg };
            }
            const delaySecs = Number.isFinite(info.check_after_secs) ? Math.max(1, info.check_after_secs) : 2;
            await this.sleep(delaySecs * 1000);
            const statusUrl = `${TWITTER_UPLOAD_URL}?${new URLSearchParams({
              command: "STATUS",
              media_id: mediaId
            }).toString()}`;
            const statusResp = await this.fetchWithTimeout(statusUrl, {
              method: "GET",
              headers: this.getUploadHeaders()
            });
            if (!statusResp.ok) {
              const text = await statusResp.text();
              return { success: false, error: `HTTP ${statusResp.status}: ${text.slice(0, 200)}` };
            }
            const statusBody = await statusResp.json();
            if (!statusBody.processing_info) {
              break;
            }
            info.state = statusBody.processing_info.state;
            info.check_after_secs = statusBody.processing_info.check_after_secs;
            info.error = statusBody.processing_info.error;
            if (info.state === "succeeded") {
              break;
            }
            attempts += 1;
          }
        }
        if (input.alt && input.mimeType.startsWith("image/")) {
          const metaResp = await this.fetchWithTimeout(TWITTER_MEDIA_METADATA_URL, {
            method: "POST",
            headers: this.getJsonHeaders(),
            body: JSON.stringify({ media_id: mediaId, alt_text: { text: input.alt } })
          });
          if (!metaResp.ok) {
            const text = await metaResp.text();
            return { success: false, error: `HTTP ${metaResp.status}: ${text.slice(0, 200)}` };
          }
        }
        return { success: true, mediaId };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  return TwitterClientMedia;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-news.js
var POST_COUNT_REGEX = /[\d.]+[KMB]?\s*posts?/i;
var POST_COUNT_MATCH_REGEX = /([\d.]+)([KMB]?)\s*posts?/i;
var TIMELINE_IDS = {
  forYou: "VGltZWxpbmU6DAC2CwABAAAAB2Zvcl95b3UAAA==",
  trending: "VGltZWxpbmU6DAC2CwABAAAACHRyZW5kaW5nAAA=",
  news: "VGltZWxpbmU6DAC2CwABAAAABG5ld3MAAA==",
  sports: "VGltZWxpbmU6DAC2CwABAAAABnNwb3J0cwAA",
  entertainment: "VGltZWxpbmU6DAC2CwABAAAADWVudGVydGFpbm1lbnQAAA=="
};
function withNews(Base) {

  class TwitterClientNews extends Base {
    constructor(...args) {
      super(...args);
    }
    async getNews(count = 10, options = {}) {
      const { includeRaw = false, withTweets = false, tweetsPerItem = 5, aiOnly = false, tabs = ["forYou", "news", "sports", "entertainment"] } = options;
      const debug = process.env.BIRD_DEBUG === "1";
      if (debug) {
        console.error(`[getNews] Fetching from tabs: ${tabs.join(", ")}`);
      }
      const allItems = [];
      const seenHeadlines = new Set;
      for (const tab of tabs) {
        const timelineId = TIMELINE_IDS[tab];
        if (!timelineId) {
          continue;
        }
        try {
          const tabItems = await this.fetchTimelineTab(tab, timelineId, count, aiOnly, includeRaw);
          for (const item of tabItems) {
            if (!seenHeadlines.has(item.headline)) {
              seenHeadlines.add(item.headline);
              allItems.push(item);
            }
          }
          if (debug) {
            console.error(`[getNews] Tab ${tab}: found ${tabItems.length} items, total unique: ${allItems.length}`);
          }
          if (allItems.length >= count) {
            break;
          }
        } catch (error) {
          if (debug) {
            console.error(`[getNews] Error fetching tab ${tab}:`, error);
          }
        }
      }
      if (allItems.length === 0) {
        return { success: false, error: "No news items found" };
      }
      const items = allItems.slice(0, count);
      if (withTweets) {
        await this.enrichWithTweets(items, tweetsPerItem, includeRaw);
      }
      return { success: true, items };
    }
    async fetchTimelineTab(tabName, timelineId, maxCount, aiOnly, includeRaw) {
      const queryId = await this.getQueryId("GenericTimelineById");
      const features = buildExploreFeatures();
      const variables = {
        timelineId,
        count: maxCount * 2,
        includePromotedContent: false
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features)
      });
      const url = `${TWITTER_API_BASE}/${queryId}/GenericTimelineById?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, {
        method: "GET",
        headers: this.getHeaders()
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      const data = await response.json();
      if (process.env.BIRD_DEBUG_JSON) {
        const fs = await import("node:fs/promises");
        const debugPath = process.env.BIRD_DEBUG_JSON.replace(".json", `-${tabName}.json`);
        await fs.writeFile(debugPath, JSON.stringify(data, null, 2)).catch(() => {});
      }
      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors.map((e) => e.message).join("; "));
      }
      return this.parseTimelineTabItems(data, tabName, maxCount, aiOnly, includeRaw);
    }
    parseTimelineTabItems(data, source, maxCount, aiOnly, includeRaw) {
      const items = [];
      const seenHeadlines = new Set;
      const timeline = data?.data?.timeline?.timeline;
      if (!timeline) {
        return [];
      }
      const instructions = timeline.instructions || [];
      for (const instruction of instructions) {
        const entries = instruction.entries ?? (instruction.entry ? [instruction.entry] : []);
        if (!entries || entries.length === 0) {
          continue;
        }
        for (const entry of entries) {
          if (items.length >= maxCount) {
            break;
          }
          const content = entry.content;
          if (!content) {
            continue;
          }
          if (content.itemContent) {
            const newsItem = this.parseNewsItemFromContent(content.itemContent, entry.entryId, source, seenHeadlines, aiOnly, includeRaw);
            if (newsItem) {
              items.push(newsItem);
            }
          }
          const itemsArray = content?.items || [];
          for (const data2 of itemsArray) {
            if (items.length >= maxCount) {
              break;
            }
            const itemContent = data2?.itemContent || data2?.item?.itemContent;
            if (!itemContent) {
              continue;
            }
            const newsItem = this.parseNewsItemFromContent(itemContent, entry.entryId, source, seenHeadlines, aiOnly, includeRaw);
            if (newsItem) {
              items.push(newsItem);
            }
          }
        }
      }
      return items;
    }
    parseNewsItemFromContent(itemContent, entryId, source, seenHeadlines, aiOnly, includeRaw) {
      const headline = itemContent.name || itemContent.title;
      if (!headline) {
        return null;
      }
      const trendMetadata = itemContent?.trend_metadata;
      const trendUrl = itemContent.trend_url?.url || trendMetadata?.url?.url;
      const socialContext = itemContent?.social_context?.text || "";
      const hasNewsCategory = socialContext.includes("News") || socialContext.includes("hours ago");
      const isFullSentence = headline.split(" ").length >= 5;
      const isExplicitlyAiTrend = itemContent.is_ai_trend === true;
      const isAiNews = isExplicitlyAiTrend || isFullSentence && hasNewsCategory;
      if (aiOnly && !isAiNews) {
        return null;
      }
      if (seenHeadlines.has(headline)) {
        return null;
      }
      seenHeadlines.add(headline);
      let postCount;
      let timeAgo;
      let category = "Trending";
      const socialCtx = itemContent?.social_context;
      if (socialCtx?.text) {
        const socialContextText = socialCtx.text;
        const parts = socialContextText.split("·").map((s) => s.trim());
        for (const part of parts) {
          if (part.includes("ago")) {
            timeAgo = part;
          } else if (part.match(POST_COUNT_REGEX)) {
            const match = part.match(POST_COUNT_MATCH_REGEX);
            if (match) {
              let num = Number.parseFloat(match[1]);
              const suffix = match[2]?.toUpperCase();
              if (suffix === "K") {
                num *= 1000;
              } else if (suffix === "M") {
                num *= 1e6;
              } else if (suffix === "B") {
                num *= 1e9;
              }
              postCount = Math.round(num);
            }
          } else {
            category = part;
          }
        }
      }
      if (trendMetadata?.meta_description) {
        const metaDesc = trendMetadata.meta_description;
        const postMatch = metaDesc.match(POST_COUNT_MATCH_REGEX);
        if (postMatch) {
          let num = Number.parseFloat(postMatch[1]);
          const suffix = postMatch[2]?.toUpperCase();
          if (suffix === "K") {
            num *= 1000;
          } else if (suffix === "M") {
            num *= 1e6;
          } else if (suffix === "B") {
            num *= 1e9;
          }
          postCount = Math.round(num);
        }
      }
      if (trendMetadata?.domain_context && (category === "Trending" || category === "News")) {
        category = trendMetadata.domain_context;
      }
      const item = {
        id: trendUrl ?? (entryId ? `${entryId}-${headline}` : `${source}-${headline}`),
        headline,
        category: isAiNews ? `AI · ${category}` : category,
        timeAgo,
        postCount,
        description: itemContent.description,
        url: trendUrl
      };
      if (includeRaw) {
        item._raw = itemContent;
      }
      return item;
    }
    async enrichWithTweets(items, tweetsPerItem, includeRaw) {
      const debug = process.env.BIRD_DEBUG === "1";
      for (const item of items) {
        try {
          const searchQuery = item.headline;
          if (!searchQuery) {
            continue;
          }
          if ("search" in this && typeof this.search === "function") {
            const result = await this.search(searchQuery, tweetsPerItem, { includeRaw });
            if (result.success && result.tweets) {
              item.tweets = result.tweets;
            }
          }
        } catch {
          if (debug) {
            console.error("[getNews] Failed to enrich item with tweets:", item.headline);
          }
        }
      }
    }
  }
  return TwitterClientNews;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-posting.js
function withPosting(Base) {
  class TwitterClientPosting extends Base {
    constructor(...args) {
      super(...args);
    }
    async tweet(text, mediaIds) {
      const variables = {
        tweet_text: text,
        dark_request: false,
        media: {
          media_entities: (mediaIds ?? []).map((id) => ({ media_id: id, tagged_users: [] })),
          possibly_sensitive: false
        },
        semantic_annotation_ids: []
      };
      const features = buildTweetCreateFeatures();
      return this.createTweet(variables, features);
    }
    async reply(text, replyToTweetId, mediaIds) {
      const variables = {
        tweet_text: text,
        reply: {
          in_reply_to_tweet_id: replyToTweetId,
          exclude_reply_user_ids: []
        },
        dark_request: false,
        media: {
          media_entities: (mediaIds ?? []).map((id) => ({ media_id: id, tagged_users: [] })),
          possibly_sensitive: false
        },
        semantic_annotation_ids: []
      };
      const features = buildTweetCreateFeatures();
      return this.createTweet(variables, features);
    }
    async createTweet(variables, features) {
      await this.ensureClientUserId();
      let queryId = await this.getQueryId("CreateTweet");
      let urlWithOperation = `${TWITTER_API_BASE}/${queryId}/CreateTweet`;
      const buildBody = () => JSON.stringify({ variables, features, queryId });
      let body = buildBody();
      try {
        const headers = { ...this.getHeaders(), referer: "https://x.com/compose/post" };
        let response = await this.fetchWithTimeout(urlWithOperation, {
          method: "POST",
          headers,
          body
        });
        if (response.status === 404) {
          await this.refreshQueryIds();
          queryId = await this.getQueryId("CreateTweet");
          urlWithOperation = `${TWITTER_API_BASE}/${queryId}/CreateTweet`;
          body = buildBody();
          response = await this.fetchWithTimeout(urlWithOperation, {
            method: "POST",
            headers: { ...this.getHeaders(), referer: "https://x.com/compose/post" },
            body
          });
          if (response.status === 404) {
            const retry = await this.fetchWithTimeout(TWITTER_GRAPHQL_POST_URL, {
              method: "POST",
              headers: { ...this.getHeaders(), referer: "https://x.com/compose/post" },
              body
            });
            if (!retry.ok) {
              const text = await retry.text();
              return { success: false, error: `HTTP ${retry.status}: ${text.slice(0, 200)}` };
            }
            const data2 = await retry.json();
            if (data2.errors && data2.errors.length > 0) {
              const fallback = await this.tryStatusUpdateFallback(data2.errors, variables);
              if (fallback) {
                return fallback;
              }
              return { success: false, error: this.formatErrors(data2.errors) };
            }
            const tweetId2 = data2.data?.create_tweet?.tweet_results?.result?.rest_id;
            if (tweetId2) {
              return { success: true, tweetId: tweetId2 };
            }
            return { success: false, error: "Tweet created but no ID returned" };
          }
        }
        if (!response.ok) {
          const text = await response.text();
          return {
            success: false,
            error: `HTTP ${response.status}: ${text.slice(0, 200)}`
          };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          const fallback = await this.tryStatusUpdateFallback(data.errors, variables);
          if (fallback) {
            return fallback;
          }
          return {
            success: false,
            error: this.formatErrors(data.errors)
          };
        }
        const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;
        if (tweetId) {
          return {
            success: true,
            tweetId
          };
        }
        return {
          success: false,
          error: "Tweet created but no ID returned"
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    formatErrors(errors) {
      return errors.map((error) => typeof error.code === "number" ? `${error.message} (${error.code})` : error.message).join(", ");
    }
    statusUpdateInputFromCreateTweetVariables(variables) {
      const text = typeof variables.tweet_text === "string" ? variables.tweet_text : null;
      if (!text) {
        return null;
      }
      const reply = variables.reply;
      const inReplyToTweetId = reply && typeof reply === "object" && typeof reply.in_reply_to_tweet_id === "string" ? reply.in_reply_to_tweet_id : undefined;
      const media = variables.media;
      const mediaEntities = media && typeof media === "object" ? media.media_entities : undefined;
      const mediaIds = Array.isArray(mediaEntities) ? mediaEntities.map((entity) => entity && typeof entity === "object" && ("media_id" in entity) ? entity.media_id : undefined).filter((value) => typeof value === "string" || typeof value === "number").map((value) => String(value)) : undefined;
      return { text, inReplyToTweetId, mediaIds: mediaIds && mediaIds.length > 0 ? mediaIds : undefined };
    }
    async postStatusUpdate(input) {
      const params = new URLSearchParams;
      params.set("status", input.text);
      if (input.inReplyToTweetId) {
        params.set("in_reply_to_status_id", input.inReplyToTweetId);
        params.set("auto_populate_reply_metadata", "true");
      }
      if (input.mediaIds && input.mediaIds.length > 0) {
        params.set("media_ids", input.mediaIds.join(","));
      }
      try {
        const response = await this.fetchWithTimeout(TWITTER_STATUS_UPDATE_URL, {
          method: "POST",
          headers: {
            ...this.getBaseHeaders(),
            "content-type": "application/x-www-form-urlencoded",
            referer: "https://x.com/compose/post"
          },
          body: params.toString()
        });
        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          return { success: false, error: this.formatErrors(data.errors) };
        }
        const tweetId = typeof data.id_str === "string" ? data.id_str : data.id !== undefined ? String(data.id) : undefined;
        if (tweetId) {
          return { success: true, tweetId };
        }
        return { success: false, error: "Tweet created but no ID returned" };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    async tryStatusUpdateFallback(errors, variables) {
      if (!errors.some((error) => error.code === 226)) {
        return null;
      }
      const input = this.statusUpdateInputFromCreateTweetVariables(variables);
      if (!input) {
        return null;
      }
      const fallback = await this.postStatusUpdate(input);
      if (fallback.success) {
        return fallback;
      }
      return {
        success: false,
        error: `${this.formatErrors(errors)} | fallback: ${fallback.error ?? "Unknown error"}`
      };
    }
  }
  return TwitterClientPosting;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-search.js
var RAW_QUERY_MISSING_REGEX = /must be defined/i;
function isQueryIdMismatch2(payload) {
  try {
    const parsed = JSON.parse(payload);
    return parsed.errors?.some((error) => {
      if (error?.extensions?.code === "GRAPHQL_VALIDATION_FAILED") {
        return true;
      }
      if (error?.path?.includes("rawQuery") && RAW_QUERY_MISSING_REGEX.test(error.message ?? "")) {
        return true;
      }
      return false;
    }) ?? false;
  } catch {
    return false;
  }
}
function withSearch(Base) {

  class TwitterClientSearch extends Base {
    constructor(...args) {
      super(...args);
    }
    async search(query, count = 20, options = {}) {
      return this.searchPaged(query, count, options);
    }
    async getAllSearchResults(query, options) {
      return this.searchPaged(query, Number.POSITIVE_INFINITY, options);
    }
    async searchPaged(query, limit, options = {}) {
      const features = buildSearchFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor = options.cursor;
      let nextCursor;
      let pagesFetched = 0;
      const { includeRaw = false, maxPages } = options;
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getSearchTimelineQueryIds();
        for (const queryId of queryIds) {
          const variables = {
            rawQuery: query,
            count: pageCount,
            querySource: "typed_query",
            product: "Latest",
            ...pageCursor ? { cursor: pageCursor } : {}
          };
          const params = new URLSearchParams({
            variables: JSON.stringify(variables)
          });
          const url = `${TWITTER_API_BASE}/${queryId}/SearchTimeline?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "POST",
              headers: this.getHeaders(),
              body: JSON.stringify({ features, queryId })
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              const shouldRefreshQueryIds = (response.status === 400 || response.status === 422) && isQueryIdMismatch2(text);
              return {
                success: false,
                error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
                had404: had404 || shouldRefreshQueryIds
              };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              const shouldRefreshQueryIds = data.errors.some((error) => error?.extensions?.code === "GRAPHQL_VALIDATION_FAILED");
              return {
                success: false,
                error: data.errors.map((e) => e.message).join(", "),
                had404: had404 || shouldRefreshQueryIds
              };
            }
            const instructions = data.data?.search_by_raw_query?.search_timeline?.timeline?.instructions;
            const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
            const nextCursor2 = extractCursorFromInstructions(instructions);
            return { success: true, tweets: pageTweets, cursor: nextCursor2, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching search results", had404 };
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (firstAttempt.had404) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      const unlimited = limit === Number.POSITIVE_INFINITY;
      while (unlimited || tweets.length < limit) {
        const pageCount = unlimited ? pageSize : Math.min(pageSize, limit - tweets.length);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        pagesFetched += 1;
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (!unlimited && tweets.length >= limit) {
            break;
          }
        }
        const pageCursor = page.cursor;
        if (!pageCursor || pageCursor === cursor || page.tweets.length === 0 || added === 0) {
          nextCursor = undefined;
          break;
        }
        if (maxPages && pagesFetched >= maxPages) {
          nextCursor = pageCursor;
          break;
        }
        cursor = pageCursor;
        nextCursor = pageCursor;
      }
      return { success: true, tweets, nextCursor };
    }
  }
  return TwitterClientSearch;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-timelines.js
function withTimelines(Base) {
  class TwitterClientTimelines extends Base {
    constructor(...args) {
      super(...args);
    }
    logBookmarksDebug(message, data) {
      if (process.env.BIRD_DEBUG_BOOKMARKS !== "1") {
        return;
      }
      if (data) {
        console.error(`[bird][debug][bookmarks] ${message}`, JSON.stringify(data));
      } else {
        console.error(`[bird][debug][bookmarks] ${message}`);
      }
    }
    async getBookmarksQueryIds() {
      const primary = await this.getQueryId("Bookmarks");
      return Array.from(new Set([primary, "RV1g3b8n_SGOHwkqKYSCFw", "tmd4ifV8RHltzn8ymGg1aw"]));
    }
    async getBookmarkFolderQueryIds() {
      const primary = await this.getQueryId("BookmarkFolderTimeline");
      return Array.from(new Set([primary, "KJIQpsvxrTfRIlbaRIySHQ"]));
    }
    async getLikesQueryIds() {
      const primary = await this.getQueryId("Likes");
      return Array.from(new Set([primary, "JR2gceKucIKcVNB_9JkhsA"]));
    }
    async getBookmarks(count = 20, options = {}) {
      return this.getBookmarksPaged(count, options);
    }
    async getAllBookmarks(options) {
      return this.getBookmarksPaged(Number.POSITIVE_INFINITY, options);
    }
    async getLikes(count = 20, options = {}) {
      return this.getLikesPaged(count, options);
    }
    async getAllLikes(options) {
      return this.getLikesPaged(Number.POSITIVE_INFINITY, options);
    }
    async getLikesPaged(limit, options = {}) {
      const userResult = await this.getCurrentUser();
      if (!userResult.success || !userResult.user) {
        return { success: false, error: userResult.error ?? "Could not determine current user" };
      }
      const userId = userResult.user.id;
      const features = buildLikesFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor = options.cursor;
      let nextCursor;
      let pagesFetched = 0;
      const { includeRaw = false, maxPages } = options;
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getLikesQueryIds();
        for (const queryId of queryIds) {
          const variables = {
            userId,
            count: pageCount,
            includePromotedContent: false,
            withClientEventToken: false,
            withBirdwatchNotes: false,
            withVoice: true,
            ...pageCursor ? { cursor: pageCursor } : {}
          };
          const params = new URLSearchParams({
            variables: JSON.stringify(variables),
            features: JSON.stringify(features)
          });
          const url = `${TWITTER_API_BASE}/${queryId}/Likes?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            const instructions = data.data?.user?.result?.timeline?.timeline?.instructions;
            if (data.errors && data.errors.length > 0) {
              const message = data.errors.map((e) => e.message).join(", ");
              if (!instructions) {
                if (message.includes("Query: Unspecified")) {
                  lastError = message;
                  continue;
                }
                return { success: false, error: message, had404 };
              }
            }
            const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
            const extractedCursor = extractCursorFromInstructions(instructions);
            return { success: true, tweets: pageTweets, cursor: extractedCursor, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching likes", had404 };
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        const shouldRefresh = firstAttempt.had404 || typeof firstAttempt.error === "string" && firstAttempt.error.includes("Query: Unspecified");
        if (shouldRefresh) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      const unlimited = limit === Number.POSITIVE_INFINITY;
      while (unlimited || tweets.length < limit) {
        const pageCount = unlimited ? pageSize : Math.min(pageSize, limit - tweets.length);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        pagesFetched += 1;
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (!unlimited && tweets.length >= limit) {
            break;
          }
        }
        const pageCursor = page.cursor;
        if (!pageCursor || pageCursor === cursor || page.tweets.length === 0 || added === 0) {
          nextCursor = undefined;
          break;
        }
        if (maxPages && pagesFetched >= maxPages) {
          nextCursor = pageCursor;
          break;
        }
        cursor = pageCursor;
        nextCursor = pageCursor;
      }
      return { success: true, tweets, nextCursor };
    }
    async getBookmarkFolderTimeline(folderId, count = 20, options = {}) {
      return this.getBookmarkFolderTimelinePaged(folderId, count, options);
    }
    async getAllBookmarkFolderTimeline(folderId, options) {
      return this.getBookmarkFolderTimelinePaged(folderId, Number.POSITIVE_INFINITY, options);
    }
    async getBookmarksPaged(limit, options = {}) {
      const features = buildBookmarksFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor = options.cursor;
      let nextCursor;
      let pagesFetched = 0;
      const { includeRaw = false, maxPages } = options;
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getBookmarksQueryIds();
        const variables = {
          count: pageCount,
          includePromotedContent: false,
          withDownvotePerspective: false,
          withReactionsMetadata: false,
          withReactionsPerspective: false,
          ...pageCursor ? { cursor: pageCursor } : {}
        };
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features)
        });
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/Bookmarks?${params.toString()}`;
          try {
            this.logBookmarksDebug("request bookmarks page", {
              queryId,
              pageCount,
              hasCursor: Boolean(pageCursor)
            });
            const response = await this.fetchWithRetry(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              this.logBookmarksDebug("bookmarks 404", { queryId });
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              this.logBookmarksDebug("bookmarks non-200", {
                queryId,
                status: response.status,
                body: text.slice(0, 200)
              });
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            const instructions = data.data?.bookmark_timeline_v2?.timeline?.instructions;
            const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
            const nextCursor2 = extractCursorFromInstructions(instructions);
            if (data.errors && data.errors.length > 0) {
              this.logBookmarksDebug("bookmarks graphql errors (non-fatal)", { queryId, errors: data.errors });
              if (!instructions) {
                lastError = data.errors.map((e) => e.message).join(", ");
                continue;
              }
            }
            this.logBookmarksDebug("bookmarks page parsed", {
              queryId,
              tweets: pageTweets.length,
              hasNextCursor: Boolean(nextCursor2)
            });
            return { success: true, tweets: pageTweets, cursor: nextCursor2, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            this.logBookmarksDebug("bookmarks request error", { queryId, error: lastError });
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching bookmarks", had404 };
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (firstAttempt.had404) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      const unlimited = limit === Number.POSITIVE_INFINITY;
      while (unlimited || tweets.length < limit) {
        const pageCount = unlimited ? pageSize : Math.min(pageSize, limit - tweets.length);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        pagesFetched += 1;
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (!unlimited && tweets.length >= limit) {
            break;
          }
        }
        const pageCursor = page.cursor;
        if (!pageCursor || pageCursor === cursor || page.tweets.length === 0 || added === 0) {
          nextCursor = undefined;
          break;
        }
        if (maxPages && pagesFetched >= maxPages) {
          nextCursor = pageCursor;
          break;
        }
        cursor = pageCursor;
        nextCursor = pageCursor;
      }
      return { success: true, tweets, nextCursor };
    }
    async getBookmarkFolderTimelinePaged(folderId, limit, options = {}) {
      const features = buildBookmarksFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor = options.cursor;
      let nextCursor;
      let pagesFetched = 0;
      const { includeRaw = false, maxPages } = options;
      const buildVariables = (pageCount, pageCursor, includeCount) => ({
        bookmark_collection_id: folderId,
        includePromotedContent: true,
        ...includeCount ? { count: pageCount } : {},
        ...pageCursor ? { cursor: pageCursor } : {}
      });
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getBookmarkFolderQueryIds();
        const tryOnce = async (variables) => {
          const params = new URLSearchParams({
            variables: JSON.stringify(variables),
            features: JSON.stringify(features)
          });
          for (const queryId of queryIds) {
            const url = `${TWITTER_API_BASE}/${queryId}/BookmarkFolderTimeline?${params.toString()}`;
            try {
              this.logBookmarksDebug("request bookmark folder page", {
                queryId,
                pageCount,
                hasCursor: Boolean(pageCursor),
                includeCount: Object.hasOwn(variables, "count")
              });
              const response = await this.fetchWithRetry(url, {
                method: "GET",
                headers: this.getHeaders()
              });
              if (response.status === 404) {
                had404 = true;
                lastError = `HTTP ${response.status}`;
                this.logBookmarksDebug("bookmark folder 404", { queryId });
                continue;
              }
              if (!response.ok) {
                const text = await response.text();
                this.logBookmarksDebug("bookmark folder non-200", {
                  queryId,
                  status: response.status,
                  body: text.slice(0, 200)
                });
                return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
              }
              const data = await response.json();
              const instructions = data.data?.bookmark_collection_timeline?.timeline?.instructions;
              const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
              const nextCursor2 = extractCursorFromInstructions(instructions);
              if (data.errors && data.errors.length > 0) {
                this.logBookmarksDebug("bookmark folder graphql errors (non-fatal)", { queryId, errors: data.errors });
                if (!instructions) {
                  lastError = data.errors.map((e) => e.message).join(", ");
                  continue;
                }
              }
              this.logBookmarksDebug("bookmark folder page parsed", {
                queryId,
                tweets: pageTweets.length,
                hasNextCursor: Boolean(nextCursor2)
              });
              return { success: true, tweets: pageTweets, cursor: nextCursor2, had404 };
            } catch (error) {
              lastError = error instanceof Error ? error.message : String(error);
              this.logBookmarksDebug("bookmark folder request error", { queryId, error: lastError });
            }
          }
          return { success: false, error: lastError ?? "Unknown error fetching bookmark folder", had404 };
        };
        let attempt = await tryOnce(buildVariables(pageCount, pageCursor, true));
        if (!attempt.success && attempt.error?.includes('Variable "$count"')) {
          attempt = await tryOnce(buildVariables(pageCount, pageCursor, false));
        }
        if (!attempt.success && attempt.error?.includes('Variable "$cursor"') && pageCursor) {
          return {
            success: false,
            error: "Bookmark folder pagination rejected the cursor parameter",
            had404: attempt.had404
          };
        }
        return attempt;
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (firstAttempt.had404) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      const unlimited = limit === Number.POSITIVE_INFINITY;
      while (unlimited || tweets.length < limit) {
        const pageCount = unlimited ? pageSize : Math.min(pageSize, limit - tweets.length);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        pagesFetched += 1;
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (!unlimited && tweets.length >= limit) {
            break;
          }
        }
        const pageCursor = page.cursor;
        if (!pageCursor || pageCursor === cursor || page.tweets.length === 0 || added === 0) {
          nextCursor = undefined;
          break;
        }
        if (maxPages && pagesFetched >= maxPages) {
          nextCursor = pageCursor;
          break;
        }
        cursor = pageCursor;
        nextCursor = pageCursor;
      }
      return { success: true, tweets, nextCursor };
    }
    async fetchWithRetry(url, init) {
      const maxRetries = 2;
      const baseDelayMs = 500;
      const retryable = new Set([429, 500, 502, 503, 504]);
      for (let attempt = 0;attempt <= maxRetries; attempt += 1) {
        const response = await this.fetchWithTimeout(url, init);
        if (!retryable.has(response.status) || attempt === maxRetries) {
          return response;
        }
        this.logBookmarksDebug("retrying bookmarks request", {
          status: response.status,
          attempt
        });
        const retryAfter = response.headers?.get?.("retry-after");
        const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : Number.NaN;
        const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : baseDelayMs * 2 ** attempt + Math.floor(Math.random() * baseDelayMs);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
      return this.fetchWithTimeout(url, init);
    }
  }
  return TwitterClientTimelines;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/paginate-cursor.js
async function paginateCursor(opts) {
  const { maxPages, pageDelayMs = 1000 } = opts;
  const seen = new Set;
  const items = [];
  let cursor = opts.cursor;
  let pagesFetched = 0;
  while (true) {
    if (pagesFetched > 0 && pageDelayMs > 0) {
      await opts.sleep(pageDelayMs);
    }
    const page = await opts.fetchPage(cursor);
    if (!page.success) {
      if (items.length > 0) {
        return { success: false, error: page.error, items, nextCursor: cursor };
      }
      return page;
    }
    pagesFetched += 1;
    for (const item of page.items) {
      const key = opts.getKey(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(item);
    }
    const pageCursor = page.cursor;
    if (!pageCursor || pageCursor === cursor) {
      return { success: true, items, nextCursor: undefined };
    }
    if (maxPages !== undefined && pagesFetched >= maxPages) {
      return { success: true, items, nextCursor: pageCursor };
    }
    cursor = pageCursor;
  }
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-tweet-detail.js
function withTweetDetails(Base) {
  class TwitterClientTweetDetails extends Base {
    constructor(...args) {
      super(...args);
    }
    async fetchUserArticlePlainText(userId, tweetId) {
      const variables = {
        userId,
        count: 20,
        includePromotedContent: true,
        withVoice: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withCommunity: true,
        withSafetyModeUserFields: true,
        withSuperFollowsUserFields: true,
        withDownvotePerspective: false,
        withReactionsMetadata: false,
        withReactionsPerspective: false,
        withSuperFollowsTweetFields: true,
        withSuperFollowsReplyCount: false,
        withClientEventToken: false
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(buildArticleFeatures()),
        fieldToggles: JSON.stringify(buildArticleFieldToggles())
      });
      const queryId = await this.getQueryId("UserArticlesTweets");
      const url = `${TWITTER_API_BASE}/${queryId}/UserArticlesTweets?${params.toString()}`;
      try {
        const response = await this.fetchWithTimeout(url, { method: "GET", headers: this.getHeaders() });
        if (!response.ok) {
          return {};
        }
        const data = await response.json();
        const instructions = data.data?.user?.result?.timeline?.timeline?.instructions ?? [];
        for (const instruction of instructions) {
          for (const entry of instruction.entries ?? []) {
            const result = entry.content?.itemContent?.tweet_results?.result;
            if (result?.rest_id !== tweetId) {
              continue;
            }
            const articleResult = result.article?.article_results?.result;
            const title = firstText(articleResult?.title, result.article?.title);
            const plainText = firstText(articleResult?.plain_text, result.article?.plain_text);
            return { title, plainText };
          }
        }
      } catch {
        return {};
      }
      return {};
    }
    async fetchTweetDetail(tweetId, cursor) {
      const variables = {
        focalTweetId: tweetId,
        with_rux_injections: false,
        rankingMode: "Relevance",
        includePromotedContent: true,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
        ...cursor ? { cursor } : {}
      };
      const features = {
        ...buildTweetDetailFeatures(),
        articles_preview_enabled: true,
        articles_rest_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        rweb_video_timestamps_enabled: true
      };
      const fieldToggles = {
        ...buildArticleFieldToggles(),
        withArticleRichContentState: true
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features),
        fieldToggles: JSON.stringify(fieldToggles)
      });
      try {
        const parseResponse = async (response) => {
          if (!response.ok) {
            const text = await response.text();
            return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
          }
          const data = await response.json();
          if (data.errors && data.errors.length > 0) {
            const hasUsableData = Boolean(data.data?.tweetResult?.result || data.data?.threaded_conversation_with_injections_v2?.instructions?.length);
            if (!hasUsableData) {
              return { success: false, error: data.errors.map((e) => e.message).join(", ") };
            }
          }
          return { success: true, data: data.data ?? {} };
        };
        let lastError;
        let had404 = false;
        const tryOnce = async () => {
          const queryIds = await this.getTweetDetailQueryIds();
          for (const queryId of queryIds) {
            const url = `${TWITTER_API_BASE}/${queryId}/TweetDetail?${params.toString()}`;
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status !== 404) {
              return await parseResponse(response);
            }
            had404 = true;
            const postResponse = await this.fetchWithTimeout(`${TWITTER_API_BASE}/${queryId}/TweetDetail`, {
              method: "POST",
              headers: this.getHeaders(),
              body: JSON.stringify({ variables, features, queryId })
            });
            if (postResponse.status !== 404) {
              return await parseResponse(postResponse);
            }
            lastError = "HTTP 404";
          }
          return { success: false, error: lastError ?? "Unknown error fetching tweet detail" };
        };
        const firstAttempt = await tryOnce();
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (had404) {
          await this.refreshQueryIds();
          return await tryOnce();
        }
        return firstAttempt;
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    async getTweet(tweetId, options = {}) {
      const { includeRaw = false } = options;
      const response = await this.fetchTweetDetail(tweetId);
      if (!response.success) {
        return response;
      }
      const tweetResult = response.data.tweetResult?.result ?? findTweetInInstructions(response.data.threaded_conversation_with_injections_v2?.instructions, tweetId);
      const mapped = mapTweetResult(tweetResult, { quoteDepth: this.quoteDepth, includeRaw });
      if (mapped) {
        if (tweetResult?.article) {
          const title = firstText(tweetResult.article.article_results?.result?.title, tweetResult.article.title);
          const articleText = extractArticleText(tweetResult);
          if (title && (!articleText || articleText.trim() === title.trim())) {
            const userId = tweetResult.core?.user_results?.result?.rest_id;
            if (userId) {
              const fallback = await this.fetchUserArticlePlainText(userId, tweetId);
              if (fallback.plainText) {
                mapped.text = fallback.title ? `${fallback.title}

${fallback.plainText}` : fallback.plainText;
              }
            }
          }
        }
        return { success: true, tweet: mapped };
      }
      return { success: false, error: "Tweet not found in response" };
    }
    async getReplies(tweetId, options = {}) {
      const { includeRaw = false } = options;
      const response = await this.fetchTweetDetail(tweetId);
      if (!response.success) {
        return response;
      }
      const instructions = response.data.threaded_conversation_with_injections_v2?.instructions;
      const tweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
      const replies = tweets.filter((tweet) => tweet.inReplyToStatusId === tweetId);
      return { success: true, tweets: replies };
    }
    async getThread(tweetId, options = {}) {
      const { includeRaw = false } = options;
      const response = await this.fetchTweetDetail(tweetId);
      if (!response.success) {
        return response;
      }
      const instructions = response.data.threaded_conversation_with_injections_v2?.instructions;
      const tweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
      const target = tweets.find((t) => t.id === tweetId);
      const rootId = target?.conversationId || tweetId;
      const thread = tweets.filter((tweet) => tweet.conversationId === rootId);
      thread.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return aTime - bTime;
      });
      return { success: true, tweets: thread };
    }
    async getRepliesPaged(tweetId, options = {}) {
      const { includeRaw = false, maxPages, pageDelayMs = 1000 } = options;
      const result = await paginateCursor({
        cursor: options.cursor,
        maxPages,
        pageDelayMs,
        sleep: async (ms) => this.sleep(ms),
        getKey: (tweet) => tweet.id,
        fetchPage: async (cursor) => {
          const response = await this.fetchTweetDetail(tweetId, cursor);
          if (!response.success) {
            return response;
          }
          const instructions = response.data.threaded_conversation_with_injections_v2?.instructions;
          const tweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
          const replies = tweets.filter((tweet) => tweet.inReplyToStatusId === tweetId);
          const pageCursor = extractCursorFromInstructions(instructions);
          return { success: true, items: replies, cursor: pageCursor };
        }
      });
      if (result.success) {
        return { success: true, tweets: result.items, nextCursor: result.nextCursor };
      }
      if (result.items) {
        return { success: false, tweets: result.items, nextCursor: result.nextCursor, error: result.error };
      }
      return { success: false, error: result.error };
    }
    async getThreadPaged(tweetId, options = {}) {
      const { includeRaw = false, maxPages, pageDelayMs = 1000 } = options;
      let rootId;
      const result = await paginateCursor({
        cursor: options.cursor,
        maxPages,
        pageDelayMs,
        sleep: async (ms) => this.sleep(ms),
        getKey: (tweet) => tweet.id,
        fetchPage: async (cursor) => {
          const response = await this.fetchTweetDetail(tweetId, cursor);
          if (!response.success) {
            return response;
          }
          const instructions = response.data.threaded_conversation_with_injections_v2?.instructions;
          const tweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
          if (!rootId) {
            const target = tweets.find((t) => t.id === tweetId);
            rootId = target?.conversationId || tweetId;
          }
          const threadTweets = tweets.filter((tweet) => tweet.conversationId === rootId);
          const pageCursor = extractCursorFromInstructions(instructions);
          return { success: true, items: threadTweets, cursor: pageCursor };
        }
      });
      const sortedTweets = (result.items ?? []).slice().sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return aTime - bTime;
      });
      if (result.success) {
        return { success: true, tweets: sortedTweets, nextCursor: result.nextCursor };
      }
      if (result.items) {
        return { success: false, tweets: sortedTweets, nextCursor: result.nextCursor, error: result.error };
      }
      return { success: false, error: result.error };
    }
  }
  return TwitterClientTweetDetails;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/normalize-handle.js
var HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;
function normalizeHandle(input) {
  const raw = (input ?? "").trim();
  if (!raw) {
    return null;
  }
  const withoutAt = raw.startsWith("@") ? raw.slice(1) : raw;
  const handle = withoutAt.trim();
  if (!handle) {
    return null;
  }
  if (!HANDLE_REGEX.test(handle)) {
    return null;
  }
  return handle;
}
function mentionsQueryFromUserOption(userOption) {
  if (typeof userOption === "undefined") {
    return { query: null, error: null };
  }
  const handle = normalizeHandle(userOption);
  if (!handle) {
    return {
      query: null,
      error: "Invalid --user handle. Expected something like @steipete (letters, digits, underscore; max 15)."
    };
  }
  return { query: `@${handle}`, error: null };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-user-lookup.js
function withUserLookup(Base) {
  class TwitterClientUserLookup extends Base {
    constructor(...args) {
      super(...args);
    }
    async getUserByScreenNameGraphQL(screenName) {
      const queryIds = ["xc8f1g7BYqr6VTzTbvNlGw", "qW5u-DAuXpMEG0zA1F7UGQ", "sLVLhk0bGj3MVFEKTdax1w"];
      const variables = {
        screen_name: screenName,
        withSafetyModeUserFields: true
      };
      const features = {
        hidden_profile_subscriptions_enabled: true,
        hidden_profile_likes_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        subscriptions_verification_info_is_identity_verified_enabled: true,
        subscriptions_verification_info_verified_since_enabled: true,
        highlights_tweets_tab_ui_enabled: true,
        responsive_web_twitter_article_notes_tab_enabled: true,
        subscriptions_feature_can_gift_premium: true,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        blue_business_profile_image_shape_enabled: true
      };
      const fieldToggles = {
        withAuxiliaryUserLabels: false
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features),
        fieldToggles: JSON.stringify(fieldToggles)
      });
      let lastError;
      for (const queryId of queryIds) {
        const url = `${TWITTER_API_BASE}/${queryId}/UserByScreenName?${params.toString()}`;
        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders()
          });
          if (!response.ok) {
            const text = await response.text();
            if (response.status === 404) {
              lastError = `HTTP ${response.status}`;
              continue;
            }
            lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            continue;
          }
          const data = await response.json();
          if (data.data?.user?.result?.__typename === "UserUnavailable") {
            return { success: false, error: `User @${screenName} not found or unavailable` };
          }
          const userResult = data.data?.user?.result;
          const userId = userResult?.rest_id;
          const username = userResult?.legacy?.screen_name ?? userResult?.core?.screen_name;
          const name = userResult?.legacy?.name ?? userResult?.core?.name;
          if (userId && username) {
            return {
              success: true,
              userId,
              username,
              name
            };
          }
          if (data.errors && data.errors.length > 0) {
            lastError = data.errors.map((e) => e.message).join(", ");
            continue;
          }
          lastError = "Could not parse user data from response";
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      return { success: false, error: lastError ?? "Unknown error looking up user" };
    }
    async getUserIdByUsername(username) {
      const cleanUsername = normalizeHandle(username);
      if (!cleanUsername) {
        return { success: false, error: `Invalid username: ${username}` };
      }
      const graphqlResult = await this.getUserByScreenNameGraphQL(cleanUsername);
      if (graphqlResult.success) {
        return graphqlResult;
      }
      if (graphqlResult.error?.includes("not found or unavailable")) {
        return graphqlResult;
      }
      const urls = [
        `https://x.com/i/api/1.1/users/show.json?screen_name=${encodeURIComponent(cleanUsername)}`,
        `https://api.twitter.com/1.1/users/show.json?screen_name=${encodeURIComponent(cleanUsername)}`
      ];
      let lastError = graphqlResult.error;
      for (const url of urls) {
        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders()
          });
          if (!response.ok) {
            const text = await response.text();
            if (response.status === 404) {
              return { success: false, error: `User @${cleanUsername} not found` };
            }
            lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            continue;
          }
          const data = await response.json();
          const userId = data.id_str ?? (data.id ? String(data.id) : null);
          if (!userId) {
            lastError = "Could not parse user ID from response";
            continue;
          }
          return {
            success: true,
            userId,
            username: data.screen_name ?? cleanUsername,
            name: data.name
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      return { success: false, error: lastError ?? "Unknown error looking up user" };
    }
    async getAboutAccountQueryIds() {
      const primary = await this.getQueryId("AboutAccountQuery");
      return Array.from(new Set([primary, "zs_jFPFT78rBpXv9Z3U2YQ"]));
    }
    async getUserAboutAccount(username) {
      const cleanUsername = normalizeHandle(username);
      if (!cleanUsername) {
        return { success: false, error: `Invalid username: ${username}` };
      }
      const variables = {
        screenName: cleanUsername
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables)
      });
      const tryOnce = async () => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getAboutAccountQueryIds();
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/AboutAccountQuery?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (!response.ok) {
              const text = await response.text();
              if (response.status === 404) {
                had404 = true;
                lastError = `HTTP ${response.status}`;
                continue;
              }
              lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
              continue;
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              lastError = data.errors.map((e) => e.message).join(", ");
              continue;
            }
            const aboutProfile = data.data?.user_result_by_screen_name?.result?.about_profile;
            if (!aboutProfile) {
              lastError = "Missing about_profile in response";
              continue;
            }
            return {
              success: true,
              aboutProfile: {
                accountBasedIn: aboutProfile.account_based_in,
                source: aboutProfile.source,
                createdCountryAccurate: aboutProfile.created_country_accurate,
                locationAccurate: aboutProfile.location_accurate,
                learnMoreUrl: aboutProfile.learn_more_url
              },
              had404
            };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return {
          success: false,
          error: lastError ?? "Unknown error fetching account details",
          had404
        };
      };
      const { result } = await this.withRefreshedQueryIdsOn404(tryOnce);
      if (result.success) {
        return { success: true, aboutProfile: result.aboutProfile };
      }
      return { success: false, error: result.error };
    }
  }
  return TwitterClientUserLookup;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-user-tweets.js
function withUserTweets(Base) {
  class TwitterClientUserTweets extends Base {
    constructor(...args) {
      super(...args);
    }
    async getUserTweetsQueryIds() {
      const primary = await this.getQueryId("UserTweets");
      return Array.from(new Set([primary, "Wms1GvIiHXAPBaCr9KblaA"]));
    }
    async getUserTweets(userId, count = 20, options = {}) {
      return this.getUserTweetsPaged(userId, count, options);
    }
    async getUserTweetsPaged(userId, limit, options = {}) {
      if (!Number.isFinite(limit) || limit <= 0) {
        return { success: false, error: `Invalid limit: ${limit}` };
      }
      const { includeRaw = false, maxPages, pageDelayMs = 1000 } = options;
      const features = buildUserTweetsFeatures();
      const pageSize = 20;
      const seen = new Set;
      const tweets = [];
      let cursor = options.cursor;
      let nextCursor;
      let pagesFetched = 0;
      const hardMaxPages = 10;
      const computedMaxPages = Math.max(1, Math.ceil(limit / pageSize));
      const effectiveMaxPages = Math.min(hardMaxPages, maxPages ?? computedMaxPages);
      const fetchPage = async (pageCount, pageCursor) => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getUserTweetsQueryIds();
        const variables = {
          userId,
          count: pageCount,
          includePromotedContent: false,
          withQuickPromoteEligibilityTweetFields: true,
          withVoice: true,
          ...pageCursor ? { cursor: pageCursor } : {}
        };
        const fieldToggles = {
          withArticlePlainText: false
        };
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features),
          fieldToggles: JSON.stringify(fieldToggles)
        });
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/UserTweets?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              const errorMsg = data.errors.map((e) => e.message).join(", ");
              if (errorMsg.includes("User has been suspended") || errorMsg.includes("User not found")) {
                return { success: false, error: errorMsg, had404 };
              }
              if (!data.data?.user?.result?.timeline?.timeline?.instructions) {
                return { success: false, error: errorMsg, had404 };
              }
            }
            const instructions = data.data?.user?.result?.timeline?.timeline?.instructions;
            const pageTweets = parseTweetsFromInstructions(instructions, { quoteDepth: this.quoteDepth, includeRaw });
            const pageCursorValue = extractCursorFromInstructions(instructions);
            return { success: true, tweets: pageTweets, cursor: pageCursorValue, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching user tweets", had404 };
      };
      const fetchWithRefresh = async (pageCount, pageCursor) => {
        const firstAttempt = await fetchPage(pageCount, pageCursor);
        if (firstAttempt.success) {
          return firstAttempt;
        }
        if (firstAttempt.had404) {
          await this.refreshQueryIds();
          const secondAttempt = await fetchPage(pageCount, pageCursor);
          if (secondAttempt.success) {
            return secondAttempt;
          }
          return { success: false, error: secondAttempt.error };
        }
        return { success: false, error: firstAttempt.error };
      };
      while (tweets.length < limit) {
        if (pagesFetched > 0 && pageDelayMs > 0) {
          await this.sleep(pageDelayMs);
        }
        const remaining = limit - tweets.length;
        const pageCount = Math.min(pageSize, remaining);
        const page = await fetchWithRefresh(pageCount, cursor);
        if (!page.success) {
          return { success: false, error: page.error };
        }
        pagesFetched += 1;
        let added = 0;
        for (const tweet of page.tweets) {
          if (seen.has(tweet.id)) {
            continue;
          }
          seen.add(tweet.id);
          tweets.push(tweet);
          added += 1;
          if (tweets.length >= limit) {
            break;
          }
        }
        const pageCursor = page.cursor;
        if (!pageCursor || pageCursor === cursor || page.tweets.length === 0 || added === 0) {
          nextCursor = undefined;
          break;
        }
        if (pagesFetched >= effectiveMaxPages) {
          nextCursor = pageCursor;
          break;
        }
        cursor = pageCursor;
        nextCursor = pageCursor;
      }
      return { success: true, tweets, nextCursor };
    }
  }
  return TwitterClientUserTweets;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client-users.js
function withUsers(Base) {
  class TwitterClientUsers extends Base {
    constructor(...args) {
      super(...args);
    }
    async getFollowingQueryIds() {
      const primary = await this.getQueryId("Following");
      return Array.from(new Set([primary, "BEkNpEt5pNETESoqMsTEGA"]));
    }
    async getFollowersQueryIds() {
      const primary = await this.getQueryId("Followers");
      return Array.from(new Set([primary, "kuFUYP9eV1FPoEy4N-pi7w"]));
    }
    parseUsersFromRestResponse(users) {
      return (users ?? []).map((u) => {
        const id = typeof u.id_str === "string" ? u.id_str : typeof u.id === "number" ? String(u.id) : null;
        const username = typeof u.screen_name === "string" ? u.screen_name : null;
        if (!id || !username) {
          return null;
        }
        return {
          id,
          username,
          name: typeof u.name === "string" && u.name.length > 0 ? u.name : username,
          description: typeof u.description === "string" ? u.description : undefined,
          followersCount: typeof u.followers_count === "number" ? u.followers_count : undefined,
          followingCount: typeof u.friends_count === "number" ? u.friends_count : undefined,
          isBlueVerified: typeof u.verified === "boolean" ? u.verified : undefined,
          profileImageUrl: typeof u.profile_image_url_https === "string" ? u.profile_image_url_https : undefined,
          createdAt: typeof u.created_at === "string" ? u.created_at : undefined
        };
      }).filter((u) => u !== null);
    }
    async getFollowersViaRest(userId, count, cursor) {
      const params = new URLSearchParams({
        user_id: userId,
        count: String(count),
        skip_status: "true",
        include_user_entities: "false"
      });
      if (cursor) {
        params.set("cursor", cursor);
      }
      const urls = [
        `https://x.com/i/api/1.1/followers/list.json?${params.toString()}`,
        `https://api.twitter.com/1.1/followers/list.json?${params.toString()}`
      ];
      let lastError;
      for (const url of urls) {
        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders()
          });
          if (!response.ok) {
            const text = await response.text();
            lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            continue;
          }
          const data = await response.json();
          const users = this.parseUsersFromRestResponse(data.users);
          const nextCursor = data.next_cursor_str && data.next_cursor_str !== "0" ? data.next_cursor_str : undefined;
          return { success: true, users, nextCursor };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      return { success: false, error: lastError ?? "Unknown error fetching followers" };
    }
    async getFollowingViaRest(userId, count, cursor) {
      const params = new URLSearchParams({
        user_id: userId,
        count: String(count),
        skip_status: "true",
        include_user_entities: "false"
      });
      if (cursor) {
        params.set("cursor", cursor);
      }
      const urls = [
        `https://x.com/i/api/1.1/friends/list.json?${params.toString()}`,
        `https://api.twitter.com/1.1/friends/list.json?${params.toString()}`
      ];
      let lastError;
      for (const url of urls) {
        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders()
          });
          if (!response.ok) {
            const text = await response.text();
            lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            continue;
          }
          const data = await response.json();
          const users = this.parseUsersFromRestResponse(data.users);
          const nextCursor = data.next_cursor_str && data.next_cursor_str !== "0" ? data.next_cursor_str : undefined;
          return { success: true, users, nextCursor };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      return { success: false, error: lastError ?? "Unknown error fetching following" };
    }
    async getCurrentUser() {
      const candidateUrls = [
        "https://x.com/i/api/account/settings.json",
        "https://api.twitter.com/1.1/account/settings.json",
        "https://x.com/i/api/account/verify_credentials.json?skip_status=true&include_entities=false",
        "https://api.twitter.com/1.1/account/verify_credentials.json?skip_status=true&include_entities=false"
      ];
      let lastError;
      for (const url of candidateUrls) {
        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders()
          });
          if (!response.ok) {
            const text = await response.text();
            lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            continue;
          }
          let data;
          try {
            data = await response.json();
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            continue;
          }
          const username = typeof data?.screen_name === "string" ? data.screen_name : typeof data?.user?.screen_name === "string" ? data.user.screen_name : null;
          const name = typeof data?.name === "string" ? data.name : typeof data?.user?.name === "string" ? data.user.name : username ?? "";
          const userId = typeof data?.user_id === "string" ? data.user_id : typeof data?.user_id_str === "string" ? data.user_id_str : typeof data?.user?.id_str === "string" ? data.user.id_str : typeof data?.user?.id === "string" ? data.user.id : null;
          if (username && userId) {
            this.clientUserId = userId;
            return {
              success: true,
              user: {
                id: userId,
                username,
                name: name || username
              }
            };
          }
          lastError = "Could not determine current user from response";
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      const profilePages = ["https://x.com/settings/account", "https://twitter.com/settings/account"];
      for (const page of profilePages) {
        try {
          const response = await this.fetchWithTimeout(page, {
            headers: {
              cookie: this.cookieHeader,
              "user-agent": this.userAgent
            }
          });
          if (!response.ok) {
            lastError = `HTTP ${response.status} (settings page)`;
            continue;
          }
          const html = await response.text();
          const usernameMatch = SETTINGS_SCREEN_NAME_REGEX.exec(html);
          const idMatch = SETTINGS_USER_ID_REGEX.exec(html);
          const nameMatch = SETTINGS_NAME_REGEX.exec(html);
          const username = usernameMatch?.[1];
          const userId = idMatch?.[1];
          const name = nameMatch?.[1]?.replace(/\\"/g, '"');
          if (username && userId) {
            return {
              success: true,
              user: {
                id: userId,
                username,
                name: name || username
              }
            };
          }
          lastError = "Could not parse settings page for user info";
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      return {
        success: false,
        error: lastError ?? "Unknown error fetching current user"
      };
    }
    async getFollowing(userId, count = 20, cursor) {
      const variables = {
        userId,
        count,
        includePromotedContent: false
      };
      if (cursor) {
        variables.cursor = cursor;
      }
      const features = buildFollowingFeatures();
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features)
      });
      const tryOnce = async () => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getFollowingQueryIds();
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/Following?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              return { success: false, error: data.errors.map((e) => e.message).join(", "), had404 };
            }
            const instructions = data.data?.user?.result?.timeline?.timeline?.instructions;
            const users = parseUsersFromInstructions(instructions);
            const nextCursor = extractCursorFromInstructions(instructions);
            return { success: true, users, nextCursor, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching following", had404 };
      };
      const { result, refreshed } = await this.withRefreshedQueryIdsOn404(tryOnce);
      if (result.success) {
        return { success: true, users: result.users, nextCursor: result.nextCursor };
      }
      if (refreshed) {
        const restAttempt = await this.getFollowingViaRest(userId, count, cursor);
        if (restAttempt.success) {
          return restAttempt;
        }
      }
      return { success: false, error: result.error };
    }
    async getFollowers(userId, count = 20, cursor) {
      const variables = {
        userId,
        count,
        includePromotedContent: false
      };
      if (cursor) {
        variables.cursor = cursor;
      }
      const features = buildFollowingFeatures();
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features)
      });
      const tryOnce = async () => {
        let lastError;
        let had404 = false;
        const queryIds = await this.getFollowersQueryIds();
        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/Followers?${params.toString()}`;
          try {
            const response = await this.fetchWithTimeout(url, {
              method: "GET",
              headers: this.getHeaders()
            });
            if (response.status === 404) {
              had404 = true;
              lastError = `HTTP ${response.status}`;
              continue;
            }
            if (!response.ok) {
              const text = await response.text();
              return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}`, had404 };
            }
            const data = await response.json();
            if (data.errors && data.errors.length > 0) {
              return { success: false, error: data.errors.map((e) => e.message).join(", "), had404 };
            }
            const instructions = data.data?.user?.result?.timeline?.timeline?.instructions;
            const users = parseUsersFromInstructions(instructions);
            const nextCursor = extractCursorFromInstructions(instructions);
            return { success: true, users, nextCursor, had404 };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        return { success: false, error: lastError ?? "Unknown error fetching followers", had404 };
      };
      const { result, refreshed } = await this.withRefreshedQueryIdsOn404(tryOnce);
      if (result.success) {
        return { success: true, users: result.users, nextCursor: result.nextCursor };
      }
      if (refreshed) {
        const restAttempt = await this.getFollowersViaRest(userId, count, cursor);
        if (restAttempt.success) {
          return restAttempt;
        }
      }
      return { success: false, error: result.error };
    }
  }
  return TwitterClientUsers;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/twitter-client.js
var MixedTwitterClient = withNews(withUserTweets(withUserLookup(withUsers(withLists(withHome(withTimelines(withSearch(withTweetDetails(withPosting(withEngagement(withFollow(withBookmarks(withMedia(TwitterClientBase))))))))))))));

class TwitterClient extends MixedTwitterClient {
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/bookmarks.js
function registerBookmarksCommand(program2, ctx) {
  program2.command("bookmarks").description("Get your bookmarked tweets").option("-n, --count <number>", "Number of bookmarks to fetch", "20").option("--folder-id <id>", "Bookmark folder (collection) id").option("--all", "Fetch all bookmarks (paged)").option("--max-pages <number>", "Stop after N pages when using --all").option("--cursor <string>", "Resume pagination from a cursor").option("--expand-root-only", "Only expand threads when bookmarked tweet is root").option("--author-chain", "Only include author self-reply chains connected to the bookmark").option("--author-only", "Include all tweets from bookmarked tweet author in thread").option("--full-chain-only", "Save entire reply chain connected to the bookmarked tweet").option("--include-ancestor-branches", "Include sibling branches for ancestors when using --full-chain-only").option("--include-parent", "Include direct parent tweet for non-root bookmarks").option("--thread-meta", "Add metadata fields (isThread, threadPosition, etc.)").option("--sort-chronological", "Sort output globally oldest -> newest").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "20", 10);
    const pagination = parsePaginationFlags(cmdOpts);
    if (!pagination.ok) {
      console.error(`${ctx.p("err")}${pagination.error}`);
      process.exit(1);
    }
    const maxPages = pagination.maxPages;
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const usePagination = pagination.usePagination;
    if (maxPages !== undefined && !usePagination) {
      console.error(`${ctx.p("err")}--max-pages requires --all or --cursor.`);
      process.exit(1);
    }
    if (!usePagination && (!Number.isFinite(count) || count <= 0)) {
      console.error(`${ctx.p("err")}Invalid --count. Expected a positive integer.`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    const folderId = cmdOpts.folderId ? extractBookmarkFolderId(cmdOpts.folderId) : null;
    if (cmdOpts.folderId && !folderId) {
      console.error(`${ctx.p("err")}Invalid --folder-id. Expected numeric ID or https://x.com/i/bookmarks/<id>.`);
      process.exit(1);
    }
    const includeRaw = cmdOpts.jsonFull ?? false;
    const timelineOptions = { includeRaw };
    const paginationOptions = { includeRaw, maxPages, cursor: pagination.cursor };
    const result = folderId ? usePagination ? await client.getAllBookmarkFolderTimeline(folderId, paginationOptions) : await client.getBookmarkFolderTimeline(folderId, count, timelineOptions) : usePagination ? await client.getAllBookmarks(paginationOptions) : await client.getBookmarks(count, timelineOptions);
    if (!result.success) {
      console.error(`${ctx.p("err")}Failed to fetch bookmarks: ${result.error}`);
      process.exit(1);
    }
    if (cmdOpts.authorChain && (cmdOpts.authorOnly || cmdOpts.fullChainOnly)) {
      console.error(`${ctx.p("warn")}--author-chain already limits to the connected self-reply chain; ` + "other chain filters are redundant.");
    }
    if (cmdOpts.includeAncestorBranches && !cmdOpts.fullChainOnly) {
      console.error(`${ctx.p("warn")}--include-ancestor-branches only applies with --full-chain-only.`);
    }
    const bookmarks = result.tweets;
    if (!bookmarks || bookmarks.length === 0) {
      const emptyMessage2 = folderId ? "No bookmarks found in folder." : "No bookmarks found.";
      const isJson2 = Boolean(cmdOpts.json || cmdOpts.jsonFull);
      ctx.printTweetsResult(result, { json: isJson2, usePagination, emptyMessage: emptyMessage2 });
      return;
    }
    const expandedResults = [];
    const threadCache = new Map;
    const includeMeta = Boolean(cmdOpts.threadMeta);
    const includeParent = Boolean(cmdOpts.includeParent);
    const expandRootOnly = Boolean(cmdOpts.expandRootOnly);
    const filterAuthorChainFlag = Boolean(cmdOpts.authorChain);
    const filterAuthorOnlyFlag = Boolean(cmdOpts.authorOnly);
    const filterFullChainFlag = Boolean(cmdOpts.fullChainOnly);
    const includeAncestorBranches = Boolean(cmdOpts.includeAncestorBranches) && filterFullChainFlag;
    const useChronologicalSort = Boolean(cmdOpts.sortChronological);
    const shouldAttemptExpand = expandRootOnly || filterAuthorChainFlag || filterAuthorOnlyFlag || filterFullChainFlag;
    const shouldFetchThread = shouldAttemptExpand || includeMeta;
    const fetchThread = async (tweet) => {
      const cachedKey = tweet.conversationId ?? tweet.id;
      const cached = threadCache.get(cachedKey);
      if (cached) {
        return cached;
      }
      const threadResult = await client.getThread(tweet.id, { includeRaw });
      if (!threadResult.success) {
        console.error(`${ctx.p("warn")}Failed to expand thread for ${tweet.id}: ${threadResult.error ?? "Unknown error"}`);
        return null;
      }
      if (!threadResult.tweets) {
        console.error(`${ctx.p("warn")}No thread tweets returned for ${tweet.id}.`);
        return null;
      }
      const rootKey = threadResult.tweets[0]?.conversationId ?? cachedKey;
      threadCache.set(rootKey, threadResult.tweets);
      return threadResult.tweets;
    };
    const delayBetweenExpansionsMs = 1000;
    for (let index = 0;index < bookmarks.length; index += 1) {
      const bookmark = bookmarks[index];
      const isRoot = !bookmark.inReplyToStatusId;
      let threadTweets = null;
      if (shouldFetchThread) {
        if (!expandRootOnly || isRoot || includeMeta) {
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayBetweenExpansionsMs));
          }
          threadTweets = await fetchThread(bookmark);
        }
      }
      let outputTweets = [bookmark];
      if (shouldAttemptExpand) {
        if (expandRootOnly && !isRoot) {
          outputTweets = [bookmark];
        } else if (threadTweets) {
          if (filterAuthorChainFlag) {
            outputTweets = filterAuthorChain(threadTweets, bookmark);
          } else {
            outputTweets = filterFullChainFlag ? filterFullChain(threadTweets, bookmark, { includeAncestorBranches }) : threadTweets;
            if (filterAuthorOnlyFlag) {
              outputTweets = filterAuthorOnly(outputTweets, bookmark);
            }
          }
        }
      }
      if (includeParent && bookmark.inReplyToStatusId) {
        const alreadyIncluded = outputTweets.some((tweet) => tweet.id === bookmark.inReplyToStatusId);
        if (!alreadyIncluded) {
          const parentFromThread = threadTweets?.find((tweet) => tweet.id === bookmark.inReplyToStatusId);
          if (parentFromThread) {
            expandedResults.push(parentFromThread);
          } else {
            const parentResult = await client.getTweet(bookmark.inReplyToStatusId, { includeRaw });
            if (parentResult.success && parentResult.tweet) {
              expandedResults.push(parentResult.tweet);
            }
          }
        }
      }
      expandedResults.push(...outputTweets);
    }
    let finalResults = expandedResults;
    if (includeMeta) {
      finalResults = expandedResults.map((tweet) => {
        const cacheKey = tweet.conversationId ?? tweet.id;
        let conversationTweets = threadCache.get(cacheKey);
        if (!conversationTweets) {
          conversationTweets = [tweet];
        }
        return addThreadMetadata(tweet, conversationTweets);
      });
    }
    const uniqueTweets = Array.from(new Map(finalResults.map((tweet) => [tweet.id, tweet])).values());
    if (useChronologicalSort) {
      uniqueTweets.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return aTime - bTime;
      });
    }
    const emptyMessage = folderId ? "No bookmarks found in folder." : "No bookmarks found.";
    const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
    ctx.printTweetsResult({ tweets: uniqueTweets, nextCursor: result.nextCursor }, { json: isJson, usePagination, emptyMessage });
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/check.js
function registerCheckCommand(program2, ctx) {
  program2.command("check").description("Check credential availability").action(async () => {
    const opts = program2.opts();
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    console.log(`${ctx.p("info")}Credential check`);
    console.log("─".repeat(40));
    if (cookies.authToken) {
      console.log(`${ctx.p("ok")}auth_token: ${cookies.authToken.slice(0, 10)}...`);
    } else {
      console.log(`${ctx.p("err")}auth_token: not found`);
    }
    if (cookies.ct0) {
      console.log(`${ctx.p("ok")}ct0: ${cookies.ct0.slice(0, 10)}...`);
    } else {
      console.log(`${ctx.p("err")}ct0: not found`);
    }
    if (cookies.source) {
      console.log(`${ctx.l("source")}${cookies.source}`);
    }
    if (warnings.length > 0) {
      console.log(`
${ctx.p("warn")}Warnings:`);
      for (const warning of warnings) {
        console.log(`   - ${warning}`);
      }
    }
    if (cookies.authToken && cookies.ct0) {
      console.log(`
${ctx.p("ok")}Ready to tweet!`);
    } else {
      console.log(`
${ctx.p("err")}Missing credentials. Options:`);
      console.log("   1. Login to x.com in Safari/Chrome/Firefox");
      console.log("   2. Set AUTH_TOKEN and CT0 environment variables");
      console.log("   3. Use --auth-token and --ct0 flags");
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/follow.js
var ONLY_DIGITS_REGEX = /^\d+$/;
async function resolveUserId(client, usernameOrId, ctx) {
  const raw = usernameOrId.trim();
  const isNumeric = ONLY_DIGITS_REGEX.test(raw);
  const handle = normalizeHandle(raw);
  if (handle) {
    const lookup = await client.getUserIdByUsername(handle);
    if (lookup.success && lookup.userId) {
      return { userId: lookup.userId, username: lookup.username };
    }
    if (!isNumeric) {
      console.error(`${ctx.p("err")}Failed to find user @${handle}: ${lookup.error ?? "Unknown error"}`);
      return null;
    }
  }
  if (isNumeric) {
    return { userId: raw };
  }
  console.error(`${ctx.p("err")}Invalid username: ${usernameOrId}`);
  return null;
}
function registerFollowCommands(program2, ctx) {
  program2.command("follow").description("Follow a user").argument("<username-or-id>", "Username (with or without @) or user ID to follow").action(async (usernameOrId) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    const resolved = await resolveUserId(client, usernameOrId, ctx);
    if (!resolved) {
      process.exit(1);
    }
    const { userId, username } = resolved;
    const displayName = username ? `@${username}` : userId;
    const result = await client.follow(userId);
    if (result.success) {
      const finalName = result.username ? `@${result.username}` : displayName;
      console.log(`${ctx.p("ok")}Now following ${finalName}`);
    } else {
      console.error(`${ctx.p("err")}Failed to follow ${displayName}: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("unfollow").description("Unfollow a user").argument("<username-or-id>", "Username (with or without @) or user ID to unfollow").action(async (usernameOrId) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    const resolved = await resolveUserId(client, usernameOrId, ctx);
    if (!resolved) {
      process.exit(1);
    }
    const { userId, username } = resolved;
    const displayName = username ? `@${username}` : userId;
    const result = await client.unfollow(userId);
    if (result.success) {
      const finalName = result.username ? `@${result.username}` : displayName;
      console.log(`${ctx.p("ok")}Unfollowed ${finalName}`);
    } else {
      console.error(`${ctx.p("err")}Failed to unfollow ${displayName}: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/help.js
function registerHelpCommand(program2, ctx) {
  program2.command("help [command]").description("Show help for a command").action((commandName) => {
    if (!commandName) {
      program2.outputHelp();
      return;
    }
    const cmd = program2.commands.find((c) => c.name() === commandName);
    if (!cmd) {
      console.error(`${ctx.p("err")}Unknown command: ${commandName}`);
      process.exitCode = 2;
      return;
    }
    cmd.outputHelp();
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/home.js
function registerHomeCommand(program2, ctx) {
  program2.command("home").description('Get your home timeline ("For You" feed)').option("-n, --count <number>", "Number of tweets to fetch", "20").option("--following", 'Get "Following" feed (chronological) instead of "For You"').option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "20", 10);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    if (!Number.isFinite(count) || count <= 0) {
      console.error(`${ctx.p("err")}Invalid --count. Expected a positive integer.`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const result = cmdOpts.following ? await client.getHomeLatestTimeline(count, { includeRaw }) : await client.getHomeTimeline(count, { includeRaw });
    if (result.success) {
      const feedType = cmdOpts.following ? "Following" : "For You";
      const emptyMessage = `No tweets found in ${feedType} timeline.`;
      const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
      ctx.printTweets(result.tweets, { json: isJson, emptyMessage });
    } else {
      console.error(`${ctx.p("err")}Failed to fetch home timeline: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/extract-list-id.js
var LIST_URL_REGEX = /(?:twitter\.com|x\.com)\/i\/lists\/(\d+)/i;
var LIST_ID_REGEX = /^\d{5,}$/;
function extractListId(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const urlMatch = LIST_URL_REGEX.exec(trimmed);
  if (urlMatch) {
    return urlMatch[1];
  }
  if (LIST_ID_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/output.js
var STATUS = {
  ok: { emoji: "✅", text: "OK:", plain: "[ok]" },
  warn: { emoji: "⚠️", text: "Warning:", plain: "[warn]" },
  err: { emoji: "❌", text: "Error:", plain: "[err]" },
  info: { emoji: "ℹ️", text: "Info:", plain: "[info]" },
  hint: { emoji: "ℹ️", text: "Hint:", plain: "[hint]" }
};
var LABELS = {
  url: { emoji: "\uD83D\uDD17", text: "URL:", plain: "url:" },
  date: { emoji: "\uD83D\uDCC5", text: "Date:", plain: "date:" },
  source: { emoji: "\uD83D\uDCCD", text: "Source:", plain: "source:" },
  engine: { emoji: "⚙️", text: "Engine:", plain: "engine:" },
  credentials: { emoji: "\uD83D\uDD11", text: "Credentials:", plain: "credentials:" },
  user: { emoji: "\uD83D\uDE4B", text: "User:", plain: "user:" },
  userId: { emoji: "\uD83E\uDEAA", text: "User ID:", plain: "user_id:" },
  email: { emoji: "\uD83D\uDCE7", text: "Email:", plain: "email:" }
};
function resolveOutputConfigFromArgv(argv, env, isTty) {
  const hasNoColorEnv = Object.hasOwn(env, "NO_COLOR") || env.TERM === "dumb";
  const defaultColor = isTty && !hasNoColorEnv;
  const plain = argv.includes("--plain");
  const emoji = !plain && !argv.includes("--no-emoji");
  const color = !plain && !argv.includes("--no-color") && defaultColor;
  const hyperlinks = !plain && isTty;
  return { plain, emoji, color, hyperlinks };
}
function resolveOutputConfigFromCommander(opts, env, isTty) {
  const hasNoColorEnv = Object.hasOwn(env, "NO_COLOR") || env.TERM === "dumb";
  const defaultColor = isTty && !hasNoColorEnv;
  const plain = Boolean(opts.plain);
  const emoji = !plain && (opts.emoji ?? true);
  const color = !plain && (opts.color ?? true) && defaultColor;
  const hyperlinks = !plain && isTty;
  return { plain, emoji, color, hyperlinks };
}
function statusPrefix(kind, cfg) {
  if (cfg.plain) {
    return `${STATUS[kind].plain} `;
  }
  if (cfg.emoji) {
    return `${STATUS[kind].emoji} `;
  }
  return `${STATUS[kind].text} `;
}
function labelPrefix(kind, cfg) {
  if (cfg.plain) {
    return `${LABELS[kind].plain} `;
  }
  if (cfg.emoji) {
    return `${LABELS[kind].emoji} `;
  }
  return `${LABELS[kind].text} `;
}
function formatStatsLine(stats, cfg) {
  const likeCount = stats.likeCount ?? 0;
  const retweetCount = stats.retweetCount ?? 0;
  const replyCount = stats.replyCount ?? 0;
  if (cfg.plain) {
    return `likes: ${likeCount}  retweets: ${retweetCount}  replies: ${replyCount}`;
  }
  if (!cfg.emoji) {
    return `Likes ${likeCount}  Retweets ${retweetCount}  Replies ${replyCount}`;
  }
  return `❤️ ${likeCount}  \uD83D\uDD01 ${retweetCount}  \uD83D\uDCAC ${replyCount}`;
}
function formatTweetUrl(tweetId) {
  return `https://x.com/i/status/${tweetId}`;
}
function hyperlink(url, text, cfg) {
  const displayText = text ?? url;
  if (!cfg?.hyperlinks) {
    return displayText;
  }
  const safeUrl = url.replaceAll("\x1B", "").replaceAll("\x07", "");
  const safeText = displayText.replaceAll("\x1B", "").replaceAll("\x07", "");
  return `\x1B]8;;${safeUrl}\x07${safeText}\x1B]8;;\x07`;
}
function formatTweetUrlLine(tweetId, cfg) {
  const url = formatTweetUrl(tweetId);
  return `${labelPrefix("url", cfg)}${hyperlink(url, url, cfg)}`;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/lists.js
function printLists(lists, ctx) {
  if (lists.length === 0) {
    console.log("No lists found.");
    return;
  }
  for (const list of lists) {
    const visibility = list.isPrivate ? "[private]" : "[public]";
    console.log(`${list.name} ${ctx.colors.muted(visibility)}`);
    if (list.description) {
      console.log(`  ${list.description.slice(0, 100)}${list.description.length > 100 ? "..." : ""}`);
    }
    console.log(`  ${ctx.p("info")}${list.memberCount?.toLocaleString() ?? 0} members`);
    if (list.owner) {
      console.log(`  ${ctx.colors.muted(`Owner: @${list.owner.username}`)}`);
    }
    const listUrl = `https://x.com/i/lists/${list.id}`;
    console.log(`  ${ctx.colors.accent(hyperlink(listUrl, listUrl, ctx.getOutput()))}`);
    console.log("──────────────────────────────────────────────────");
  }
}
function registerListsCommand(program2, ctx) {
  program2.command("lists").description("Get your Twitter lists").option("--member-of", "Show lists you are a member of (instead of owned lists)").option("-n, --count <number>", "Number of lists to fetch", "100").option("--json", "Output as JSON").action(async (cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "100", 10);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    const result = cmdOpts.memberOf ? await client.getListMemberships(count) : await client.getOwnedLists(count);
    if (result.success && result.lists) {
      if (cmdOpts.json) {
        console.log(JSON.stringify(result.lists, null, 2));
      } else {
        const emptyMessage = cmdOpts.memberOf ? "You are not a member of any lists." : "You do not own any lists.";
        if (result.lists.length === 0) {
          console.log(emptyMessage);
        } else {
          printLists(result.lists, ctx);
        }
      }
    } else {
      console.error(`${ctx.p("err")}Failed to fetch lists: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("list-timeline <list-id-or-url>").description("Get tweets from a list timeline").option("-n, --count <number>", "Number of tweets to fetch", "20").option("--all", "Fetch all tweets from list (paged). WARNING: your account might get banned using this flag").option("--max-pages <number>", "Fetch N pages (implies --all)").option("--cursor <string>", "Resume pagination from a cursor").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (listIdOrUrl, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "20", 10);
    const pagination = parsePaginationFlags(cmdOpts, { maxPagesImpliesPagination: true });
    if (!pagination.ok) {
      console.error(`${ctx.p("err")}${pagination.error}`);
      process.exit(1);
    }
    const listId = extractListId(listIdOrUrl);
    if (!listId) {
      console.error(`${ctx.p("err")}Invalid list ID or URL. Expected numeric ID or https://x.com/i/lists/<id>.`);
      process.exit(2);
    }
    const usePagination = pagination.usePagination;
    if (!usePagination && (!Number.isFinite(count) || count <= 0)) {
      console.error(`${ctx.p("err")}Invalid --count. Expected a positive integer.`);
      process.exit(1);
    }
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const timelineOptions = { includeRaw };
    const paginationOptions = { includeRaw, maxPages: pagination.maxPages, cursor: pagination.cursor };
    const result = usePagination ? await client.getAllListTimeline(listId, paginationOptions) : await client.getListTimeline(listId, count, timelineOptions);
    if (result.success) {
      const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
      ctx.printTweetsResult(result, {
        json: isJson,
        usePagination,
        emptyMessage: "No tweets found in this list."
      });
    } else {
      console.error(`${ctx.p("err")}Failed to fetch list timeline: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/news.js
function formatPostCount(count) {
  if (count >= 1e6) {
    return `${(count / 1e6).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}
function printNewsItems(items, ctx, opts = {}) {
  if (opts.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  if (items.length === 0) {
    console.log(opts.emptyMessage ?? "No news items found.");
    return;
  }
  for (const item of items) {
    const categoryLabel = item.category ? `[${item.category}]` : "";
    console.log(`
${ctx.colors.accent(categoryLabel)} ${ctx.colors.command(item.headline)}`);
    if (item.description) {
      console.log(`  ${ctx.colors.muted(item.description)}`);
    }
    const meta = [];
    if (item.timeAgo) {
      meta.push(item.timeAgo);
    }
    if (item.postCount) {
      meta.push(`${formatPostCount(item.postCount)} posts`);
    }
    if (meta.length > 0) {
      console.log(`  ${ctx.colors.muted(meta.join(" | "))}`);
    }
    if (item.url) {
      console.log(`  ${ctx.l("url")}${item.url}`);
    }
    if (item.tweets && item.tweets.length > 0) {
      console.log(`  ${ctx.colors.section("Related tweets:")}`);
      const tweetLimit = opts.tweetLimit ?? item.tweets.length;
      for (const tweet of item.tweets.slice(0, tweetLimit)) {
        console.log(`    @${tweet.author.username}: ${tweet.text.slice(0, 100)}${tweet.text.length > 100 ? "..." : ""}`);
      }
    }
    console.log(ctx.colors.muted("─".repeat(50)));
  }
}
function registerNewsCommand(program2, ctx) {
  program2.command("news").alias("trending").description("Fetch AI-curated news and trending topics from Explore tabs").option("-n, --count <number>", "Number of items to fetch", "10").option("--ai-only", "Show only AI-curated news items").option("--with-tweets", "Also fetch related tweets for each news item").option("--tweets-per-item <number>", "Number of tweets to fetch per news item (default: 5)", "5").option("--for-you", "Fetch only from For You tab").option("--news-only", "Fetch only from News tab").option("--sports", "Fetch only from Sports tab").option("--entertainment", "Fetch only from Entertainment tab").option("--trending-only", "Fetch only from Trending tab").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "10", 10);
    const tweetsPerItem = Number.parseInt(cmdOpts.tweetsPerItem || "5", 10);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (Number.isNaN(count) || count < 1) {
      console.error(`${ctx.p("err")}--count must be a positive number`);
      process.exit(1);
    }
    if (Number.isNaN(tweetsPerItem) || tweetsPerItem < 1) {
      console.error(`${ctx.p("err")}--tweets-per-item must be a positive number`);
      process.exit(1);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const tabs = [];
    if (cmdOpts.forYou) {
      tabs.push("forYou");
    }
    if (cmdOpts.newsOnly) {
      tabs.push("news");
    }
    if (cmdOpts.sports) {
      tabs.push("sports");
    }
    if (cmdOpts.entertainment) {
      tabs.push("entertainment");
    }
    if (cmdOpts.trendingOnly) {
      tabs.push("trending");
    }
    const tabsToFetch = tabs.length > 0 ? tabs : undefined;
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const withTweets = cmdOpts.withTweets ?? false;
    const aiOnly = cmdOpts.aiOnly ?? false;
    const result = await client.getNews(count, {
      includeRaw,
      withTweets,
      tweetsPerItem,
      aiOnly,
      tabs: tabsToFetch
    });
    if (result.success) {
      printNewsItems(result.items, ctx, {
        json: cmdOpts.json || cmdOpts.jsonFull,
        emptyMessage: "No news items found.",
        tweetLimit: withTweets ? tweetsPerItem : undefined
      });
    } else {
      console.error(`${ctx.p("err")}Failed to fetch news: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/post.js
async function uploadMediaOrExit(client, media, ctx) {
  if (media.length === 0) {
    return;
  }
  const uploaded = [];
  for (const item of media) {
    const res = await client.uploadMedia({ data: item.buffer, mimeType: item.mime, alt: item.alt });
    if (!res.success || !res.mediaId) {
      console.error(`${ctx.p("err")}Media upload failed: ${res.error ?? "Unknown error"}`);
      process.exit(1);
    }
    uploaded.push(res.mediaId);
  }
  return uploaded;
}
function registerPostCommands(program2, ctx) {
  program2.command("tweet").description("Post a new tweet").argument("<text>", "Tweet text").action(async (text) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    let media = [];
    try {
      media = ctx.loadMedia({ media: opts.media ?? [], alts: opts.alt ?? [] });
    } catch (error) {
      console.error(`${ctx.p("err")}${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    if (cookies.source) {
      console.error(`${ctx.l("source")}${cookies.source}`);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const mediaIds = await uploadMediaOrExit(client, media, ctx);
    const result = await client.tweet(text, mediaIds);
    if (result.success) {
      console.log(`${ctx.p("ok")}Tweet posted successfully!`);
      console.log(formatTweetUrlLine(result.tweetId, ctx.getOutput()));
    } else {
      console.error(`${ctx.p("err")}Failed to post tweet: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("reply").description("Reply to an existing tweet").argument("<tweet-id-or-url>", "Tweet ID or URL to reply to").argument("<text>", "Reply text").action(async (tweetIdOrUrl, text) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    let media = [];
    try {
      media = ctx.loadMedia({ media: opts.media ?? [], alts: opts.alt ?? [] });
    } catch (error) {
      console.error(`${ctx.p("err")}${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    const tweetId = ctx.extractTweetId(tweetIdOrUrl);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    if (cookies.source) {
      console.error(`${ctx.l("source")}${cookies.source}`);
    }
    console.error(`${ctx.p("info")}Replying to tweet: ${tweetId}`);
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const mediaIds = await uploadMediaOrExit(client, media, ctx);
    const result = await client.reply(text, tweetId, mediaIds);
    if (result.success) {
      console.log(`${ctx.p("ok")}Reply posted successfully!`);
      console.log(formatTweetUrlLine(result.tweetId, ctx.getOutput()));
    } else {
      console.error(`${ctx.p("err")}Failed to post reply: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/query-ids.js
function countFeatureOverrides(overrides) {
  let count = 0;
  if (overrides.global) {
    count += Object.keys(overrides.global).length;
  }
  if (overrides.sets) {
    for (const setOverrides of Object.values(overrides.sets)) {
      count += Object.keys(setOverrides).length;
    }
  }
  return count;
}
function registerQueryIdsCommand(program2, ctx) {
  program2.command("query-ids").description("Show or refresh cached Twitter GraphQL query IDs").option("--json", "Output as JSON").option("--fresh", "Force refresh (downloads X client bundles)", false).action(async (cmdOpts) => {
    const operations = [
      "CreateTweet",
      "CreateRetweet",
      "FavoriteTweet",
      "TweetDetail",
      "SearchTimeline",
      "UserArticlesTweets",
      "Bookmarks",
      "Following",
      "Followers",
      "Likes"
    ];
    if (cmdOpts.fresh) {
      console.error(`${ctx.p("info")}Refreshing GraphQL query IDs…`);
      await runtimeQueryIds.refresh(operations, { force: true });
      console.error(`${ctx.p("info")}Refreshing feature overrides…`);
      await refreshFeatureOverridesCache();
    }
    const featureSnapshot = getFeatureOverridesSnapshot();
    const info = await runtimeQueryIds.getSnapshotInfo();
    if (!info) {
      if (cmdOpts.json) {
        console.log(JSON.stringify({
          cached: false,
          cachePath: runtimeQueryIds.cachePath,
          featuresPath: featureSnapshot.cachePath,
          features: featureSnapshot.overrides
        }, null, 2));
        return;
      }
      console.log(`${ctx.p("warn")}No cached query IDs yet.`);
      console.log(`${ctx.p("info")}Run: bird query-ids --fresh`);
      console.log(`features_path: ${featureSnapshot.cachePath}`);
      return;
    }
    if (cmdOpts.json) {
      console.log(JSON.stringify({
        cached: true,
        cachePath: info.cachePath,
        fetchedAt: info.snapshot.fetchedAt,
        isFresh: info.isFresh,
        ageMs: info.ageMs,
        ids: info.snapshot.ids,
        discovery: info.snapshot.discovery,
        featuresPath: featureSnapshot.cachePath,
        features: featureSnapshot.overrides
      }, null, 2));
      return;
    }
    console.log(`${ctx.p("ok")}GraphQL query IDs cached`);
    console.log(`path: ${info.cachePath}`);
    console.log(`fetched_at: ${info.snapshot.fetchedAt}`);
    console.log(`fresh: ${info.isFresh ? "yes" : "no"}`);
    console.log(`ops: ${Object.keys(info.snapshot.ids).length}`);
    console.log(`features_path: ${featureSnapshot.cachePath}`);
    console.log(`features: ${countFeatureOverrides(featureSnapshot.overrides)}`);
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/read.js
function registerReadCommands(program2, ctx) {
  program2.command("read").description("Read/fetch a tweet by ID or URL").argument("<tweet-id-or-url>", "Tweet ID or URL to read").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (tweetIdOrUrl, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const tweetId = ctx.extractTweetId(tweetIdOrUrl);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const result = await client.getTweet(tweetId, { includeRaw });
    if (result.success && result.tweet) {
      if (cmdOpts.json || cmdOpts.jsonFull) {
        console.log(JSON.stringify(result.tweet, null, 2));
      } else {
        ctx.printTweets([result.tweet], { showSeparator: false });
        console.log(formatStatsLine(result.tweet, ctx.getOutput()));
      }
    } else {
      console.error(`${ctx.p("err")}Failed to read tweet: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("replies").description("List replies to a tweet (by ID or URL)").argument("<tweet-id-or-url>", "Tweet ID or URL").option("--all", "Fetch all replies (paged)").option("--max-pages <number>", "Fetch N pages (implies pagination)").option("--delay <ms>", "Delay in ms between page fetches", "1000").option("--cursor <string>", "Resume pagination from a cursor").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (tweetIdOrUrl, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const tweetId = ctx.extractTweetId(tweetIdOrUrl);
    const pagination = parsePaginationFlags(cmdOpts, { maxPagesImpliesPagination: true, includeDelay: true });
    if (!pagination.ok) {
      console.error(`${ctx.p("err")}${pagination.error}`);
      process.exit(1);
    }
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const result = pagination.usePagination ? await client.getRepliesPaged(tweetId, {
      includeRaw,
      maxPages: pagination.maxPages,
      cursor: pagination.cursor,
      pageDelayMs: pagination.pageDelayMs
    }) : await client.getReplies(tweetId, { includeRaw });
    const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
    if (result.tweets) {
      ctx.printTweetsResult(result, {
        json: isJson,
        usePagination: pagination.usePagination,
        emptyMessage: "No replies found."
      });
      if (result.nextCursor && !isJson) {
        console.error(`${ctx.p("info")}More replies available. Use --cursor "${result.nextCursor}" to continue.`);
      }
    }
    if (!result.success) {
      console.error(`${ctx.p("err")}Failed to fetch replies: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("thread").description("Show the full conversation thread containing the tweet").argument("<tweet-id-or-url>", "Tweet ID or URL").option("--all", "Fetch all thread tweets (paged)").option("--max-pages <number>", "Fetch N pages (implies pagination)").option("--delay <ms>", "Delay in ms between page fetches", "1000").option("--cursor <string>", "Resume pagination from a cursor").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (tweetIdOrUrl, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const tweetId = ctx.extractTweetId(tweetIdOrUrl);
    const pagination = parsePaginationFlags(cmdOpts, { maxPagesImpliesPagination: true, includeDelay: true });
    if (!pagination.ok) {
      console.error(`${ctx.p("err")}${pagination.error}`);
      process.exit(1);
    }
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const result = pagination.usePagination ? await client.getThreadPaged(tweetId, {
      includeRaw,
      maxPages: pagination.maxPages,
      cursor: pagination.cursor,
      pageDelayMs: pagination.pageDelayMs
    }) : await client.getThread(tweetId, { includeRaw });
    const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
    if (result.tweets) {
      ctx.printTweetsResult(result, {
        json: isJson,
        usePagination: pagination.usePagination,
        emptyMessage: "No thread tweets found."
      });
      if (result.nextCursor && !isJson) {
        console.error(`${ctx.p("info")}More thread tweets available. Use --cursor "${result.nextCursor}" to continue.`);
      }
    }
    if (!result.success) {
      console.error(`${ctx.p("err")}Failed to fetch thread: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/search.js
function registerSearchCommands(program2, ctx) {
  program2.command("search").description("Search for tweets").argument("<query>", 'Search query (e.g., "@clawdbot" or "from:clawdbot")').option("-n, --count <number>", "Number of tweets to fetch", "10").option("--all", "Fetch all search results (paged)").option("--max-pages <number>", "Stop after N pages when using --all").option("--cursor <string>", "Resume pagination from a cursor").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (query, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "10", 10);
    const pagination = parsePaginationFlags(cmdOpts);
    if (!pagination.ok) {
      console.error(`${ctx.p("err")}${pagination.error}`);
      process.exit(1);
    }
    const maxPages = pagination.maxPages;
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const usePagination = pagination.usePagination;
    if (maxPages !== undefined && !usePagination) {
      console.error(`${ctx.p("err")}--max-pages requires --all or --cursor.`);
      process.exit(1);
    }
    if (!usePagination && (!Number.isFinite(count) || count <= 0)) {
      console.error(`${ctx.p("err")}Invalid --count. Expected a positive integer.`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const searchOptions = { includeRaw };
    const paginationOptions = { includeRaw, maxPages, cursor: pagination.cursor };
    const result = usePagination ? await client.getAllSearchResults(query, paginationOptions) : await client.search(query, count, searchOptions);
    if (result.success) {
      const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
      ctx.printTweetsResult(result, {
        json: isJson,
        usePagination: Boolean(usePagination),
        emptyMessage: "No tweets found."
      });
    } else {
      console.error(`${ctx.p("err")}Search failed: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("mentions").description("Find tweets mentioning a user (defaults to current user)").option("-u, --user <handle>", "User handle (e.g. @steipete)").option("-n, --count <number>", "Number of tweets to fetch", "10").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "10", 10);
    const fromUserOpt = mentionsQueryFromUserOption(cmdOpts.user);
    if (fromUserOpt.error) {
      console.error(`${ctx.p("err")}${fromUserOpt.error}`);
      process.exit(2);
    }
    let query = fromUserOpt.query;
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    if (!query) {
      const who = await client.getCurrentUser();
      const handle = normalizeHandle(who.user?.username);
      if (handle) {
        query = `@${handle}`;
      } else {
        console.error(`${ctx.p("err")}Could not determine current user (${who.error ?? "Unknown error"}). Use --user <handle>.`);
        process.exit(1);
      }
    }
    const includeRaw = cmdOpts.jsonFull ?? false;
    const result = await client.search(query, count, { includeRaw });
    if (result.success) {
      ctx.printTweets(result.tweets, {
        json: cmdOpts.json || cmdOpts.jsonFull,
        emptyMessage: "No mentions found."
      });
    } else {
      console.error(`${ctx.p("err")}Failed to fetch mentions: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/unbookmark.js
function registerUnbookmarkCommand(program2, ctx) {
  program2.command("unbookmark").description("Remove bookmarked tweets").argument("<tweet-id-or-url...>", "Tweet IDs or URLs to remove from bookmarks").action(async (tweetIdOrUrls) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    let failures = 0;
    for (const input of tweetIdOrUrls) {
      const tweetId = ctx.extractTweetId(input);
      const result = await client.unbookmark(tweetId);
      if (result.success) {
        console.log(`${ctx.p("ok")}Removed bookmark for ${tweetId}`);
      } else {
        failures += 1;
        console.error(`${ctx.p("err")}Failed to remove bookmark for ${tweetId}: ${result.error}`);
      }
    }
    if (failures > 0) {
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/user-tweets.js
function registerUserTweetsCommand(program2, ctx) {
  const formatExample = (cmd, desc) => `  ${ctx.colors.command(cmd)}
    ${ctx.colors.muted(desc)}`;
  program2.command("user-tweets").description("Get tweets from a user's profile timeline").argument("<handle>", "Username to fetch tweets from (e.g., @steipete or steipete)").option("-n, --count <number>", "Number of tweets to fetch", "20").option("--max-pages <number>", "Stop after N pages (max: 10)").option("--delay <ms>", "Delay in ms between page fetches", "1000").option("--cursor <string>", "Resume pagination from a cursor").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").addHelpText("after", () => `
${ctx.colors.section("Command Examples")}
${[
    formatExample("bird user-tweets @steipete", "Get recent tweets from a user"),
    formatExample("bird user-tweets steipete -n 10", "Get 10 tweets (@ is optional)"),
    formatExample("bird user-tweets @steipete -n 50", "Fetch 50 tweets (paged)"),
    formatExample("bird user-tweets @steipete --max-pages 3 -n 200", "Safety cap (max 3 pages)"),
    formatExample("bird user-tweets @steipete --json", "Output as JSON"),
    formatExample('bird user-tweets @steipete --cursor "DAABCg..."', "Resume from cursor")
  ].join(`
`)}`).action(async (handle, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "20", 10);
    const maxPagesParsed = parsePositiveIntFlag(cmdOpts.maxPages, "--max-pages");
    if (!maxPagesParsed.ok) {
      console.error(`${ctx.p("err")}${maxPagesParsed.error}`);
      process.exit(2);
    }
    const maxPages = maxPagesParsed.value;
    const delayParsed = parseNonNegativeIntFlag(cmdOpts.delay, "--delay", 1000);
    if (!delayParsed.ok) {
      console.error(`${ctx.p("err")}${delayParsed.error}`);
      process.exit(2);
    }
    const pageDelayMs = delayParsed.value;
    if (!Number.isFinite(count) || count <= 0) {
      console.error(`${ctx.p("err")}Invalid --count. Expected a positive integer.`);
      process.exit(2);
    }
    const pageSize = 20;
    const hardMaxPages = 10;
    const hardMaxTweets = pageSize * hardMaxPages;
    if (count > hardMaxTweets) {
      console.error(`${ctx.p("err")}Invalid --count. Max ${hardMaxTweets} tweets per run (safety cap: ${hardMaxPages} pages). Use --cursor to continue.`);
      process.exit(2);
    }
    if (maxPages !== undefined && maxPages > hardMaxPages) {
      console.error(`${ctx.p("err")}Invalid --max-pages. Expected a positive integer (max: ${hardMaxPages}).`);
      process.exit(2);
    }
    const username = normalizeHandle(handle);
    if (!username) {
      console.error(`${ctx.p("err")}Invalid handle: ${handle}`);
      process.exit(2);
    }
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    console.error(`${ctx.p("info")}Looking up @${username}...`);
    const userLookup = await client.getUserIdByUsername(username);
    if (!userLookup.success || !userLookup.userId) {
      console.error(`${ctx.p("err")}${userLookup.error || `Could not find user @${username}`}`);
      process.exit(1);
    }
    const displayName = userLookup.name ? `${userLookup.name} (@${userLookup.username})` : `@${userLookup.username}`;
    console.error(`${ctx.p("info")}Fetching tweets from ${displayName}...`);
    const includeRaw = cmdOpts.jsonFull ?? false;
    const wantsPaginationOutput = Boolean(cmdOpts.cursor) || maxPages !== undefined || count > pageSize;
    const result = await client.getUserTweetsPaged(userLookup.userId, count, {
      includeRaw,
      maxPages,
      cursor: cmdOpts.cursor,
      pageDelayMs
    });
    if (result.success) {
      const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
      ctx.printTweetsResult(result, {
        json: isJson,
        usePagination: wantsPaginationOutput,
        emptyMessage: `No tweets found for @${username}.`
      });
      if (result.nextCursor && !cmdOpts.json && !cmdOpts.jsonFull) {
        console.error(`${ctx.p("info")}More tweets available. Use --cursor "${result.nextCursor}" to continue.`);
      }
    } else {
      console.error(`${ctx.p("err")}Failed to fetch tweets: ${result.error}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/commands/users.js
function formatAboutProfile(profile, ctx, handle) {
  const lines = [`${ctx.p("info")}Account information for @${handle}:`];
  if (profile.accountBasedIn) {
    lines.push(`  Account based in: ${profile.accountBasedIn}`);
  }
  if (profile.createdCountryAccurate !== undefined) {
    lines.push(`  Creation country accurate: ${profile.createdCountryAccurate ? "Yes" : "No"}`);
  }
  if (profile.locationAccurate !== undefined) {
    lines.push(`  Location accurate: ${profile.locationAccurate ? "Yes" : "No"}`);
  }
  if (profile.source) {
    lines.push(`${ctx.l("source")}${profile.source}`);
  }
  if (profile.learnMoreUrl) {
    lines.push(`  Learn more: ${profile.learnMoreUrl}`);
  }
  return lines;
}
function printUsers(users, ctx) {
  for (const user of users) {
    console.log(`@${user.username} (${user.name})`);
    if (user.description) {
      console.log(`  ${user.description.slice(0, 100)}${user.description.length > 100 ? "..." : ""}`);
    }
    if (user.followersCount !== undefined) {
      console.log(`  ${ctx.p("info")}${user.followersCount.toLocaleString()} followers`);
    }
    console.log("──────────────────────────────────────────────────");
  }
}
async function resolveUserIdOrExit(client, requestedUserId, ctx) {
  if (requestedUserId) {
    return requestedUserId;
  }
  const currentUser = await client.getCurrentUser();
  if (!currentUser.success || !currentUser.user?.id) {
    console.error(`${ctx.p("err")}Failed to get current user: ${currentUser.error || "Unknown error"}`);
    process.exit(1);
  }
  return currentUser.user.id;
}
async function runUserListCommand(program2, ctx, spec, cmdOpts) {
  const opts = program2.opts();
  const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
  const count = Number.parseInt(cmdOpts.count || "20", 10);
  const maxPages = cmdOpts.maxPages ? Number.parseInt(cmdOpts.maxPages, 10) : undefined;
  const usePagination = cmdOpts.all || cmdOpts.cursor;
  if (maxPages !== undefined && !cmdOpts.all) {
    console.error(`${ctx.p("err")}--max-pages requires --all.`);
    process.exit(1);
  }
  if (maxPages !== undefined && (!Number.isFinite(maxPages) || maxPages <= 0)) {
    console.error(`${ctx.p("err")}Invalid --max-pages. Expected a positive integer.`);
    process.exit(1);
  }
  const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
  for (const warning of warnings) {
    console.error(`${ctx.p("warn")}${warning}`);
  }
  if (!cookies.authToken || !cookies.ct0) {
    console.error(`${ctx.p("err")}Missing required credentials`);
    process.exit(1);
  }
  const client = new TwitterClient({ cookies, timeoutMs });
  const userId = await resolveUserIdOrExit(client, cmdOpts.user, ctx);
  if (cmdOpts.all) {
    const allUsers = [];
    const seen = new Set;
    let cursor = cmdOpts.cursor;
    let pageNum = 0;
    let nextCursor;
    while (true) {
      pageNum += 1;
      if (!cmdOpts.json) {
        console.error(`${ctx.p("info")}Fetching page ${pageNum}...`);
      }
      const result2 = await spec.fetch(client, userId, count, cursor);
      if (!result2.success || !result2.users) {
        console.error(`${ctx.p("err")}Failed to fetch ${spec.name}: ${result2.error}`);
        process.exit(1);
      }
      let added = 0;
      for (const user of result2.users) {
        if (!seen.has(user.id)) {
          seen.add(user.id);
          allUsers.push(user);
          added += 1;
        }
      }
      const pageCursor = result2.nextCursor;
      if (!pageCursor || result2.users.length === 0 || added === 0 || pageCursor === cursor) {
        nextCursor = undefined;
        break;
      }
      if (maxPages && pageNum >= maxPages) {
        nextCursor = pageCursor;
        break;
      }
      cursor = pageCursor;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (cmdOpts.json) {
      console.log(JSON.stringify({ users: allUsers, nextCursor: nextCursor ?? null }, null, 2));
    } else {
      console.error(`${ctx.p("info")}Total: ${allUsers.length} users`);
      if (nextCursor) {
        console.error(`${ctx.p("info")}Stopped at --max-pages. Use --cursor to continue.`);
        console.error(`${ctx.p("info")}Next cursor: ${nextCursor}`);
      }
      printUsers(allUsers, ctx);
    }
    return;
  }
  const result = await spec.fetch(client, userId, count, cmdOpts.cursor);
  if (result.success && result.users) {
    if (cmdOpts.json) {
      if (usePagination) {
        console.log(JSON.stringify({ users: result.users, nextCursor: result.nextCursor ?? null }, null, 2));
      } else {
        console.log(JSON.stringify(result.users, null, 2));
      }
    } else {
      if (result.users.length === 0) {
        console.log("No users found.");
      } else {
        printUsers(result.users, ctx);
        if (result.nextCursor) {
          console.error(`${ctx.p("info")}Next cursor: ${result.nextCursor}`);
        }
      }
    }
  } else {
    console.error(`${ctx.p("err")}Failed to fetch ${spec.name}: ${result.error}`);
    process.exit(1);
  }
}
function registerUserCommands(program2, ctx) {
  const registerUserListCommand = (spec) => {
    program2.command(spec.name).description(spec.description).option("--user <userId>", `User ID to get ${spec.name} for (defaults to current user)`).option("-n, --count <number>", "Number of users to fetch per page", "20").option("--cursor <cursor>", "Cursor for pagination (from previous response)").option("--all", "Fetch all users (paginate automatically)").option("--max-pages <number>", "Stop after N pages when using --all").option("--json", "Output as JSON").action(async (cmdOpts) => runUserListCommand(program2, ctx, spec, cmdOpts));
  };
  registerUserListCommand({
    name: "following",
    description: "Get users that you (or another user) follow",
    fetch: (client, userId, count, cursor) => client.getFollowing(userId, count, cursor)
  });
  registerUserListCommand({
    name: "followers",
    description: "Get users that follow you (or another user)",
    fetch: (client, userId, count, cursor) => client.getFollowers(userId, count, cursor)
  });
  program2.command("likes").description("Get your liked tweets").option("-n, --count <number>", "Number of likes to fetch", "20").option("--all", "Fetch all likes (paged)").option("--max-pages <number>", "Stop after N pages when using --all").option("--cursor <string>", "Resume pagination from a cursor").option("--json", "Output as JSON").option("--json-full", "Output as JSON with full raw API response in _raw field").action(async (cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const count = Number.parseInt(cmdOpts.count || "20", 10);
    const maxPages = cmdOpts.maxPages ? Number.parseInt(cmdOpts.maxPages, 10) : undefined;
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const usePagination = cmdOpts.all || cmdOpts.cursor;
    if (maxPages !== undefined && !usePagination) {
      console.error(`${ctx.p("err")}--max-pages requires --all or --cursor.`);
      process.exit(1);
    }
    if (!usePagination && (!Number.isFinite(count) || count <= 0)) {
      console.error(`${ctx.p("err")}Invalid --count. Expected a positive integer.`);
      process.exit(1);
    }
    if (maxPages !== undefined && (!Number.isFinite(maxPages) || maxPages <= 0)) {
      console.error(`${ctx.p("err")}Invalid --max-pages. Expected a positive integer.`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const includeRaw = cmdOpts.jsonFull ?? false;
    const timelineOptions = { includeRaw };
    const paginationOptions = { includeRaw, maxPages, cursor: cmdOpts.cursor };
    const result = usePagination ? await client.getAllLikes(paginationOptions) : await client.getLikes(count, timelineOptions);
    if (result.success) {
      const isJson = Boolean(cmdOpts.json || cmdOpts.jsonFull);
      ctx.printTweetsResult(result, {
        json: isJson,
        usePagination: Boolean(usePagination),
        emptyMessage: "No liked tweets found."
      });
    } else {
      console.error(`${ctx.p("err")}Failed to fetch likes: ${result.error}`);
      process.exit(1);
    }
  });
  program2.command("whoami").description("Show which Twitter account the current credentials belong to").action(async () => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const quoteDepth = ctx.resolveQuoteDepthFromOptions(opts);
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    if (cookies.source) {
      console.error(`${ctx.l("source")}${cookies.source}`);
    }
    const client = new TwitterClient({ cookies, timeoutMs, quoteDepth });
    const result = await client.getCurrentUser();
    const credentialSource = cookies.source ?? "env/auto-detected cookies";
    if (result.success && result.user) {
      console.log(`${ctx.l("user")}@${result.user.username} (${result.user.name})`);
      console.log(`${ctx.l("userId")}${result.user.id}`);
      console.log(`${ctx.l("engine")}graphql`);
      console.log(`${ctx.l("credentials")}${credentialSource}`);
    } else {
      console.error(`${ctx.p("err")}Failed to determine current user: ${result.error ?? "Unknown error"}`);
      process.exit(1);
    }
  });
  program2.command("about").description("Get account origin and location information for a user").argument("<username>", "Twitter username (with or without @)").option("--json", "Output as JSON").action(async (username, cmdOpts) => {
    const opts = program2.opts();
    const timeoutMs = ctx.resolveTimeoutFromOptions(opts);
    const normalizedHandle = normalizeHandle(username);
    if (!normalizedHandle) {
      console.error(`${ctx.p("err")}Invalid username: ${username}`);
      process.exit(1);
    }
    const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);
    for (const warning of warnings) {
      console.error(`${ctx.p("warn")}${warning}`);
    }
    if (!cookies.authToken || !cookies.ct0) {
      console.error(`${ctx.p("err")}Missing required credentials`);
      process.exit(1);
    }
    const client = new TwitterClient({ cookies, timeoutMs });
    const result = await client.getUserAboutAccount(normalizedHandle);
    if (result.success && result.aboutProfile) {
      if (cmdOpts.json) {
        console.log(JSON.stringify(result.aboutProfile, null, 2));
      } else {
        for (const line of formatAboutProfile(result.aboutProfile, ctx, normalizedHandle)) {
          console.log(line);
        }
      }
    } else {
      console.error(`${ctx.p("err")}Failed to fetch account information: ${result.error ?? "Unknown error"}`);
      process.exit(1);
    }
  });
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/version.js
import fs from "node:fs";
import path3 from "node:path";
import { fileURLToPath } from "node:url";
var FALLBACK_VERSION = "unknown";
var REF_PREFIX_REGEX = /^ref:\s*/i;
var LINE_SPLIT_REGEX = /\r?\n/;
var GITDIR_REGEX = /gitdir:\s*(.+)\s*$/i;
function readPackageVersionFromJsonFile(candidate) {
  try {
    const raw = fs.readFileSync(candidate, "utf8");
    const json = JSON.parse(raw);
    if (json && typeof json.version === "string" && json.version.trim().length > 0) {
      return json.version.trim();
    }
    return null;
  } catch {
    return null;
  }
}
function readVersionFromTextFile(candidate) {
  try {
    const raw = fs.readFileSync(candidate, "utf8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}
function resolveStartDir(importMetaUrl) {
  if (typeof importMetaUrl === "string" && importMetaUrl.trim().length > 0) {
    try {
      return path3.dirname(fileURLToPath(importMetaUrl));
    } catch {}
  }
  if (false) {}
  return process.cwd();
}
function resolvePackageVersion(importMetaUrl) {
  const injected = typeof process !== "undefined" && typeof process.env.BIRD_VERSION === "string" ? process.env.BIRD_VERSION.trim() : "";
  if (injected.length > 0) {
    return injected;
  }
  let dir = resolveStartDir(importMetaUrl);
  for (let i = 0;i < 10; i += 1) {
    const version = readPackageVersionFromJsonFile(path3.join(dir, "package.json")) ?? readVersionFromTextFile(path3.join(dir, "VERSION"));
    if (version) {
      return version;
    }
    const parent = path3.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return FALLBACK_VERSION;
}
function truncateSha(sha, length = 8) {
  const trimmed = sha.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= length) {
    return trimmed;
  }
  return trimmed.slice(0, length);
}
function resolveGitShaFromGitDir(gitDir) {
  const headPath = path3.join(gitDir, "HEAD");
  let head = "";
  try {
    head = fs.readFileSync(headPath, "utf8").trim();
  } catch {
    return null;
  }
  if (!head) {
    return null;
  }
  if (!head.startsWith("ref:")) {
    const sha = truncateSha(head);
    return sha.length > 0 ? sha : null;
  }
  const ref = head.replace(REF_PREFIX_REGEX, "").trim();
  if (!ref) {
    return null;
  }
  const refPath = path3.join(gitDir, ref);
  try {
    const sha = truncateSha(fs.readFileSync(refPath, "utf8"));
    return sha.length > 0 ? sha : null;
  } catch {}
  const packedRefsPath = path3.join(gitDir, "packed-refs");
  try {
    const packed = fs.readFileSync(packedRefsPath, "utf8");
    const lines = packed.split(LINE_SPLIT_REGEX);
    for (const line of lines) {
      if (!line || line.startsWith("#") || line.startsWith("^")) {
        continue;
      }
      const [shaRaw, refName] = line.split(" ");
      if (refName?.trim() === ref) {
        const sha = truncateSha(shaRaw ?? "");
        return sha.length > 0 ? sha : null;
      }
    }
  } catch {}
  return null;
}
function resolveGitSha(importMetaUrl) {
  const injected = typeof process !== "undefined" && typeof process.env.BIRD_GIT_SHA === "string" ? process.env.BIRD_GIT_SHA.trim() : "";
  if (injected.length > 0) {
    return truncateSha(injected);
  }
  let dir = resolveStartDir(importMetaUrl);
  for (let i = 0;i < 10; i += 1) {
    const dotGit = path3.join(dir, ".git");
    try {
      const stat = fs.statSync(dotGit);
      if (stat.isDirectory()) {
        const sha = resolveGitShaFromGitDir(dotGit);
        if (sha) {
          return sha;
        }
      } else if (stat.isFile()) {
        const txt = fs.readFileSync(dotGit, "utf8");
        const match = GITDIR_REGEX.exec(txt);
        const gitDir = match?.[1]?.trim();
        if (gitDir) {
          const resolved = path3.isAbsolute(gitDir) ? gitDir : path3.resolve(dir, gitDir);
          const sha = resolveGitShaFromGitDir(resolved);
          if (sha) {
            return sha;
          }
        }
      }
    } catch {}
    const parent = path3.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}
function formatVersionLine(importMetaUrl) {
  const version = resolvePackageVersion(importMetaUrl);
  const sha = resolveGitSha(importMetaUrl);
  return sha ? `${version} (${sha})` : version;
}
function getCliVersion() {
  return formatVersionLine(import.meta.url);
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/cli/shared.js
var import_json5 = __toESM(require_lib(), 1);
import { existsSync as existsSync9, readFileSync as readFileSync4 } from "node:fs";
import { homedir as homedir9 } from "node:os";
import { join } from "node:path";

// ../../node_modules/.bun/kleur@4.1.5/node_modules/kleur/index.mjs
var FORCE_COLOR;
var NODE_DISABLE_COLORS;
var NO_COLOR;
var TERM;
var isTTY = true;
if (typeof process !== "undefined") {
  ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {});
  isTTY = process.stdout && process.stdout.isTTY;
}
var $ = {
  enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== "dumb" && (FORCE_COLOR != null && FORCE_COLOR !== "0" || isTTY),
  reset: init(0, 0),
  bold: init(1, 22),
  dim: init(2, 22),
  italic: init(3, 23),
  underline: init(4, 24),
  inverse: init(7, 27),
  hidden: init(8, 28),
  strikethrough: init(9, 29),
  black: init(30, 39),
  red: init(31, 39),
  green: init(32, 39),
  yellow: init(33, 39),
  blue: init(34, 39),
  magenta: init(35, 39),
  cyan: init(36, 39),
  white: init(37, 39),
  gray: init(90, 39),
  grey: init(90, 39),
  bgBlack: init(40, 49),
  bgRed: init(41, 49),
  bgGreen: init(42, 49),
  bgYellow: init(43, 49),
  bgBlue: init(44, 49),
  bgMagenta: init(45, 49),
  bgCyan: init(46, 49),
  bgWhite: init(47, 49)
};
function run(arr, str) {
  let i = 0, tmp, beg = "", end = "";
  for (;i < arr.length; i++) {
    tmp = arr[i];
    beg += tmp.open;
    end += tmp.close;
    if (!!~str.indexOf(tmp.close)) {
      str = str.replace(tmp.rgx, tmp.close + tmp.open);
    }
  }
  return beg + str + end;
}
function chain(has, keys) {
  let ctx = { has, keys };
  ctx.reset = $.reset.bind(ctx);
  ctx.bold = $.bold.bind(ctx);
  ctx.dim = $.dim.bind(ctx);
  ctx.italic = $.italic.bind(ctx);
  ctx.underline = $.underline.bind(ctx);
  ctx.inverse = $.inverse.bind(ctx);
  ctx.hidden = $.hidden.bind(ctx);
  ctx.strikethrough = $.strikethrough.bind(ctx);
  ctx.black = $.black.bind(ctx);
  ctx.red = $.red.bind(ctx);
  ctx.green = $.green.bind(ctx);
  ctx.yellow = $.yellow.bind(ctx);
  ctx.blue = $.blue.bind(ctx);
  ctx.magenta = $.magenta.bind(ctx);
  ctx.cyan = $.cyan.bind(ctx);
  ctx.white = $.white.bind(ctx);
  ctx.gray = $.gray.bind(ctx);
  ctx.grey = $.grey.bind(ctx);
  ctx.bgBlack = $.bgBlack.bind(ctx);
  ctx.bgRed = $.bgRed.bind(ctx);
  ctx.bgGreen = $.bgGreen.bind(ctx);
  ctx.bgYellow = $.bgYellow.bind(ctx);
  ctx.bgBlue = $.bgBlue.bind(ctx);
  ctx.bgMagenta = $.bgMagenta.bind(ctx);
  ctx.bgCyan = $.bgCyan.bind(ctx);
  ctx.bgWhite = $.bgWhite.bind(ctx);
  return ctx;
}
function init(open, close) {
  let blk = {
    open: `\x1B[${open}m`,
    close: `\x1B[${close}m`,
    rgx: new RegExp(`\\x1b\\[${close}m`, "g")
  };
  return function(txt) {
    if (this !== undefined && this.has !== undefined) {
      !!~this.has.indexOf(open) || (this.has.push(open), this.keys.push(blk));
      return txt === undefined ? this : $.enabled ? run(this.keys, txt + "") : txt + "";
    }
    return txt === undefined ? chain([open], [blk]) : $.enabled ? run([blk], txt + "") : txt + "";
  };
}
var kleur_default = $;

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/crypto.js
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
var UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
function deriveAes128CbcKeyFromPassword(password, options) {
  return pbkdf2Sync(password, "saltysalt", options.iterations, 16, "sha1");
}
function decryptChromiumAes128CbcCookieValue(encryptedValue, keyCandidates, options) {
  const buf = Buffer.from(encryptedValue);
  if (buf.length < 3)
    return null;
  const prefix = buf.subarray(0, 3).toString("utf8");
  const hasVersionPrefix = /^v\d\d$/.test(prefix);
  if (!hasVersionPrefix) {
    if (options.treatUnknownPrefixAsPlaintext === false)
      return null;
    return decodeCookieValueBytes(buf, false);
  }
  const ciphertext = buf.subarray(3);
  if (!ciphertext.length)
    return "";
  for (const key of keyCandidates) {
    const decrypted = tryDecryptAes128Cbc(ciphertext, key);
    if (!decrypted)
      continue;
    const decoded = decodeCookieValueBytes(decrypted, options.stripHashPrefix);
    if (decoded !== null)
      return decoded;
  }
  return null;
}
function decryptChromiumAes256GcmCookieValue(encryptedValue, key, options) {
  const buf = Buffer.from(encryptedValue);
  if (buf.length < 3)
    return null;
  const prefix = buf.subarray(0, 3).toString("utf8");
  if (!/^v\d\d$/.test(prefix))
    return null;
  const payload = buf.subarray(3);
  if (payload.length < 12 + 16)
    return null;
  const nonce = payload.subarray(0, 12);
  const authenticationTag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(12, payload.length - 16);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decodeCookieValueBytes(plaintext, options.stripHashPrefix);
  } catch {
    return null;
  }
}
function tryDecryptAes128Cbc(ciphertext, key) {
  try {
    const iv = Buffer.alloc(16, 32);
    const decipher = createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(false);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return removePkcs7Padding(plaintext);
  } catch {
    return null;
  }
}
function removePkcs7Padding(value) {
  if (!value.length)
    return value;
  const padding = value[value.length - 1];
  if (!padding || padding > 16)
    return value;
  return value.subarray(0, value.length - padding);
}
function decodeCookieValueBytes(value, stripHashPrefix) {
  const bytes = stripHashPrefix && value.length >= 32 ? value.subarray(32) : value;
  try {
    return stripLeadingControlChars(UTF8_DECODER.decode(bytes));
  } catch {
    return null;
  }
}
function stripLeadingControlChars(value) {
  let i = 0;
  while (i < value.length && value.charCodeAt(i) < 32)
    i += 1;
  return value.slice(i);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/exec.js
import { spawn } from "node:child_process";
async function execCapture(file, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1e4;
  const runOnce = (executable) => new Promise((resolve) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr2 = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr2 += chunk;
    });
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      resolve({ code: 124, stdout, stderr: `${stderr2}
Timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    timer.unref?.();
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        code: 127,
        stdout,
        stderr: `${stderr2}
${error instanceof Error ? error.message : String(error)}`
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr: stderr2 });
    });
  });
  const result = await runOnce(file);
  if (process.platform !== "win32")
    return result;
  const runOnceCmd = (cmd) => {
    const quoted = [cmd, ...args.map(cmdQuote)].join(" ");
    return new Promise((resolve) => {
      const child = spawn("cmd.exe", ["/d", "/s", "/c", quoted], {
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr2 = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr2 += chunk;
      });
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        resolve({ code: 124, stdout, stderr: `${stderr2}
Timed out after ${timeoutMs}ms` });
      }, timeoutMs);
      timer.unref?.();
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({
          code: 127,
          stdout,
          stderr: `${stderr2}
${error instanceof Error ? error.message : String(error)}`
        });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, stdout, stderr: stderr2 });
      });
    });
  };
  const stderr = result.stderr.toLowerCase();
  if (result.code === 127 && stderr.includes("enoent") && !file.toLowerCase().endsWith(".cmd")) {
    const cmdResult = await runOnceCmd(`${file}.cmd`);
    if (!(cmdResult.code === 127 && cmdResult.stderr.toLowerCase().includes("enoent")))
      return cmdResult;
  }
  if (result.code === 127 && stderr.includes("enoent") && !file.toLowerCase().endsWith(".bat")) {
    const batResult = await runOnceCmd(`${file}.bat`);
    if (!(batResult.code === 127 && batResult.stderr.toLowerCase().includes("enoent")))
      return batResult;
  }
  return result;
}
function cmdQuote(value) {
  if (!value)
    return '""';
  if (!/[\t\s"&|<>^]/.test(value))
    return value;
  return `"${value.replaceAll('"', '""')}"`;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/linuxKeyring.js
async function getLinuxChromiumSafeStoragePassword(options) {
  const warnings = [];
  const overrideKey = options.app === "edge" ? "SWEET_COOKIE_EDGE_SAFE_STORAGE_PASSWORD" : "SWEET_COOKIE_CHROME_SAFE_STORAGE_PASSWORD";
  const override = readEnv(overrideKey);
  if (override !== undefined)
    return { password: override, warnings };
  const backend = options.backend ?? parseLinuxKeyringBackend() ?? chooseLinuxKeyringBackend();
  if (backend === "basic")
    return { password: "", warnings };
  const service = options.app === "edge" ? "Microsoft Edge Safe Storage" : "Chrome Safe Storage";
  const account = options.app === "edge" ? "Microsoft Edge" : "Chrome";
  const folder = `${account} Keys`;
  if (backend === "gnome") {
    const res = await execCapture("secret-tool", ["lookup", "service", service, "account", account], { timeoutMs: 3000 });
    if (res.code === 0)
      return { password: res.stdout.trim(), warnings };
    warnings.push("Failed to read Linux keyring via secret-tool; v11 cookies may be unavailable.");
    return { password: "", warnings };
  }
  const kdeVersion = (readEnv("KDE_SESSION_VERSION") ?? "").trim();
  const serviceName = kdeVersion === "6" ? "org.kde.kwalletd6" : kdeVersion === "5" ? "org.kde.kwalletd5" : "org.kde.kwalletd";
  const walletPath = kdeVersion === "6" ? "/modules/kwalletd6" : kdeVersion === "5" ? "/modules/kwalletd5" : "/modules/kwalletd";
  const wallet = await getKWalletNetworkWallet(serviceName, walletPath);
  const passwordRes = await execCapture("kwallet-query", ["--read-password", service, "--folder", folder, wallet], { timeoutMs: 3000 });
  if (passwordRes.code !== 0) {
    warnings.push("Failed to read Linux keyring via kwallet-query; v11 cookies may be unavailable.");
    return { password: "", warnings };
  }
  if (passwordRes.stdout.toLowerCase().startsWith("failed to read"))
    return { password: "", warnings };
  return { password: passwordRes.stdout.trim(), warnings };
}
async function getLinuxChromeSafeStoragePassword(options = {}) {
  const args = { app: "chrome" };
  if (options.backend !== undefined)
    args.backend = options.backend;
  return await getLinuxChromiumSafeStoragePassword(args);
}
function parseLinuxKeyringBackend() {
  const raw = readEnv("SWEET_COOKIE_LINUX_KEYRING");
  if (!raw)
    return;
  const normalized = raw.toLowerCase();
  if (normalized === "gnome")
    return "gnome";
  if (normalized === "kwallet")
    return "kwallet";
  if (normalized === "basic")
    return "basic";
  return;
}
function chooseLinuxKeyringBackend() {
  const xdg = readEnv("XDG_CURRENT_DESKTOP") ?? "";
  const isKde = xdg.split(":").some((p) => p.trim().toLowerCase() === "kde") || !!readEnv("KDE_FULL_SESSION");
  return isKde ? "kwallet" : "gnome";
}
async function getKWalletNetworkWallet(serviceName, walletPath) {
  const res = await execCapture("dbus-send", [
    "--session",
    "--print-reply=literal",
    `--dest=${serviceName}`,
    walletPath,
    "org.kde.KWallet.networkWallet"
  ], { timeoutMs: 3000 });
  const fallback = "kdewallet";
  if (res.code !== 0)
    return fallback;
  const raw = res.stdout.trim();
  if (!raw)
    return fallback;
  return raw.replaceAll('"', "").trim() || fallback;
}
function readEnv(key) {
  const value = process.env[key];
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length ? trimmed : undefined;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/shared.js
import { copyFileSync, existsSync as existsSync2, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path4 from "node:path";

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/expire.js
function normalizeExpiration(expires) {
  if (expires === undefined || expires === null)
    return;
  if (typeof expires === "bigint") {
    if (expires <= 0n)
      return;
    if (expires > 10000000000000n) {
      return Number(expires / 1000000n - 11644473600n);
    }
    if (expires > 10000000000n) {
      return Number(expires / 1000n);
    }
    return Number(expires);
  }
  if (!expires || Number.isNaN(expires))
    return;
  const value = Number(expires);
  if (value <= 0)
    return;
  if (value > 10000000000000) {
    return Math.round(value / 1e6 - 11644473600);
  }
  if (value > 10000000000) {
    return Math.round(value / 1000);
  }
  return Math.round(value);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/hostMatch.js
function hostMatchesCookieDomain(host, cookieDomain) {
  const normalizedHost = host.toLowerCase();
  const normalizedDomain = cookieDomain.startsWith(".") ? cookieDomain.slice(1) : cookieDomain;
  const domainLower = normalizedDomain.toLowerCase();
  return normalizedHost === domainLower || normalizedHost.endsWith(`.${domainLower}`);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/nodeSqlite.js
var cached = null;
function supportsReadBigInts() {
  const [majorRaw, minorRaw] = process.versions.node.split(".");
  const major = Number.parseInt(majorRaw ?? "", 10);
  const minor = Number.parseInt(minorRaw ?? "", 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor))
    return false;
  if (major > 24)
    return true;
  if (major < 24)
    return false;
  return minor >= 4;
}
function shouldSuppressSqliteExperimentalWarning(warning, args) {
  const message = typeof warning === "string" ? warning : warning instanceof Error ? warning.message : typeof warning?.message === "string" ? warning.message : null;
  if (!message || !message.includes("SQLite is an experimental feature"))
    return false;
  const firstArg = args[0];
  if (firstArg === "ExperimentalWarning")
    return true;
  if (typeof firstArg === "object" && firstArg) {
    const type = firstArg.type;
    if (type === "ExperimentalWarning")
      return true;
  }
  if (warning instanceof Error && warning.name === "ExperimentalWarning")
    return true;
  return false;
}
async function importNodeSqlite() {
  if (cached)
    return cached;
  const originalEmitWarning = process.emitWarning.bind(process);
  process.emitWarning = (warning, ...args) => {
    if (shouldSuppressSqliteExperimentalWarning(warning, args))
      return;
    return originalEmitWarning(warning, ...args);
  };
  try {
    cached = await import("node:sqlite");
    return cached;
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/runtime.js
function isBunRuntime() {
  if (typeof process === "undefined")
    return false;
  const bunVersion = process.versions.bun;
  return Boolean(typeof process.versions === "object" && typeof bunVersion === "string");
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/shared.js
async function getCookiesFromChromeSqliteDb(options, origins, allowlistNames, decrypt) {
  const warnings = [];
  const tempDir = mkdtempSync(path4.join(tmpdir(), "sweet-cookie-chrome-"));
  const tempDbPath = path4.join(tempDir, "Cookies");
  try {
    copyFileSync(options.dbPath, tempDbPath);
    copySidecar(options.dbPath, `${tempDbPath}-wal`, "-wal");
    copySidecar(options.dbPath, `${tempDbPath}-shm`, "-shm");
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    warnings.push(`Failed to copy Chrome cookie DB: ${error instanceof Error ? error.message : String(error)}`);
    return { cookies: [], warnings };
  }
  try {
    const hosts = origins.map((o) => new URL(o).hostname);
    const where = buildHostWhereClause(hosts, "host_key");
    const metaVersion = await readChromiumMetaVersion(tempDbPath);
    const stripHashPrefix = metaVersion >= 24;
    const rowsResult = await readChromeRows(tempDbPath, where);
    if (!rowsResult.ok) {
      warnings.push(rowsResult.error);
      return { cookies: [], warnings };
    }
    const collectOptions = {};
    if (options.profile)
      collectOptions.profile = options.profile;
    if (options.includeExpired !== undefined)
      collectOptions.includeExpired = options.includeExpired;
    const cookies = collectChromeCookiesFromRows(rowsResult.rows, collectOptions, hosts, allowlistNames, (encryptedValue) => decrypt(encryptedValue, { stripHashPrefix }), warnings);
    return { cookies: dedupeCookies(cookies), warnings };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
function collectChromeCookiesFromRows(rows, options, hosts, allowlistNames, decrypt, warnings) {
  const cookies = [];
  const now = Math.floor(Date.now() / 1000);
  let warnedEncryptedType = false;
  for (const row of rows) {
    const name = typeof row.name === "string" ? row.name : null;
    if (!name)
      continue;
    if (allowlistNames && allowlistNames.size > 0 && !allowlistNames.has(name))
      continue;
    const hostKey = typeof row.host_key === "string" ? row.host_key : null;
    if (!hostKey)
      continue;
    if (!hostMatchesAny(hosts, hostKey))
      continue;
    const rowPath = typeof row.path === "string" ? row.path : "";
    const valueString = typeof row.value === "string" ? row.value : null;
    let value = valueString;
    if (value === null || value.length === 0) {
      const encryptedBytes = getEncryptedBytes(row);
      if (!encryptedBytes) {
        if (!warnedEncryptedType && row.encrypted_value !== undefined) {
          warnings.push("Chrome cookie encrypted_value is in an unsupported type.");
          warnedEncryptedType = true;
        }
        continue;
      }
      value = decrypt(encryptedBytes);
    }
    if (value === null)
      continue;
    const expiresRaw = typeof row.expires_utc === "number" || typeof row.expires_utc === "bigint" ? row.expires_utc : tryParseInt(row.expires_utc);
    const expires = normalizeExpiration(expiresRaw ?? undefined);
    if (!options.includeExpired) {
      if (expires && expires < now)
        continue;
    }
    const secure = row.is_secure === 1 || row.is_secure === 1n || row.is_secure === "1" || row.is_secure === true;
    const httpOnly = row.is_httponly === 1 || row.is_httponly === 1n || row.is_httponly === "1" || row.is_httponly === true;
    const sameSite = normalizeChromiumSameSite(row.samesite);
    const source = { browser: "chrome" };
    if (options.profile)
      source.profile = options.profile;
    const cookie = {
      name,
      value,
      domain: hostKey.startsWith(".") ? hostKey.slice(1) : hostKey,
      path: rowPath || "/",
      secure,
      httpOnly,
      source
    };
    if (expires !== undefined)
      cookie.expires = expires;
    if (sameSite !== undefined)
      cookie.sameSite = sameSite;
    cookies.push(cookie);
  }
  return cookies;
}
function tryParseInt(value) {
  if (typeof value === "bigint") {
    const parsed2 = Number(value);
    return Number.isFinite(parsed2) ? parsed2 : null;
  }
  if (typeof value !== "string")
    return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeChromiumSameSite(value) {
  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? normalizeChromiumSameSite(parsed) : undefined;
  }
  if (typeof value === "number") {
    if (value === 2)
      return "Strict";
    if (value === 1)
      return "Lax";
    if (value === 0)
      return "None";
    return;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed))
      return normalizeChromiumSameSite(parsed);
    const normalized = value.toLowerCase();
    if (normalized === "strict")
      return "Strict";
    if (normalized === "lax")
      return "Lax";
    if (normalized === "none" || normalized === "no_restriction")
      return "None";
  }
  return;
}
function getEncryptedBytes(row) {
  const raw = row.encrypted_value;
  if (raw instanceof Uint8Array)
    return raw;
  return null;
}
async function readChromiumMetaVersion(dbPath) {
  const sql = `SELECT value FROM meta WHERE key = 'version'`;
  const result = isBunRuntime() ? await queryNodeOrBun({ kind: "bun", dbPath, sql }) : await queryNodeOrBun({ kind: "node", dbPath, sql });
  if (!result.ok)
    return 0;
  const first = result.rows[0];
  const value = first?.value;
  if (typeof value === "number")
    return Math.floor(value);
  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
async function readChromeRows(dbPath, where) {
  const sqliteKind = isBunRuntime() ? "bun" : "node";
  const sqliteLabel = sqliteKind === "bun" ? "bun:sqlite" : "node:sqlite";
  const sql = `SELECT name, value, host_key, path, expires_utc, samesite, encrypted_value, ` + `is_secure AS is_secure, is_httponly AS is_httponly ` + `FROM cookies WHERE (${where}) ORDER BY expires_utc DESC;`;
  const result = await queryNodeOrBun({ kind: sqliteKind, dbPath, sql });
  if (result.ok)
    return { ok: true, rows: result.rows };
  return {
    ok: false,
    error: `${sqliteLabel} failed reading Chrome cookies (requires modern Chromium, e.g. Chrome >= 100): ${result.error}`
  };
}
async function queryNodeOrBun(options) {
  try {
    if (options.kind === "node") {
      const { DatabaseSync } = await importNodeSqlite();
      const dbOptions = { readOnly: true };
      if (supportsReadBigInts()) {
        dbOptions.readBigInts = true;
      }
      const db2 = new DatabaseSync(options.dbPath, dbOptions);
      try {
        const rows = db2.prepare(options.sql).all();
        return { ok: true, rows };
      } finally {
        db2.close();
      }
    }
    const { Database } = await import("bun:sqlite");
    const db = new Database(options.dbPath, { readonly: true });
    try {
      const rows = db.query(options.sql).all();
      return { ok: true, rows };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function copySidecar(sourceDbPath, target, suffix) {
  const sidecar = `${sourceDbPath}${suffix}`;
  if (!existsSync2(sidecar))
    return;
  try {
    copyFileSync(sidecar, target);
  } catch {}
}
function buildHostWhereClause(hosts, column) {
  const clauses = [];
  for (const host of hosts) {
    for (const candidate of expandHostCandidates(host)) {
      const escaped = sqlLiteral(candidate);
      const escapedDot = sqlLiteral(`.${candidate}`);
      const escapedLike = sqlLiteral(`%.${candidate}`);
      clauses.push(`${column} = ${escaped}`);
      clauses.push(`${column} = ${escapedDot}`);
      clauses.push(`${column} LIKE ${escapedLike}`);
    }
  }
  return clauses.length ? clauses.join(" OR ") : "1=0";
}
function sqlLiteral(value) {
  const escaped = value.replaceAll("'", "''");
  return `'${escaped}'`;
}
function expandHostCandidates(host) {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1)
    return [host];
  const candidates = new Set;
  candidates.add(host);
  for (let i = 1;i <= parts.length - 2; i += 1) {
    const candidate = parts.slice(i).join(".");
    if (candidate)
      candidates.add(candidate);
  }
  return Array.from(candidates);
}
function hostMatchesAny(hosts, cookieHost) {
  const cookieDomain = cookieHost.startsWith(".") ? cookieHost.slice(1) : cookieHost;
  return hosts.some((host) => hostMatchesCookieDomain(host, cookieDomain));
}
function dedupeCookies(cookies) {
  const merged = new Map;
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain ?? ""}|${cookie.path ?? ""}`;
    if (!merged.has(key))
      merged.set(key, cookie);
  }
  return Array.from(merged.values());
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/linuxPaths.js
import { existsSync as existsSync4 } from "node:fs";
import { homedir as homedir4 } from "node:os";
import path6 from "node:path";

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/paths.js
import { existsSync as existsSync3, statSync } from "node:fs";
import { homedir as homedir3 } from "node:os";
import path5 from "node:path";
function looksLikePath(value) {
  return value.includes("/") || value.includes("\\");
}
function expandPath(input) {
  if (input.startsWith("~/"))
    return path5.join(homedir3(), input.slice(2));
  return path5.isAbsolute(input) ? input : path5.resolve(process.cwd(), input);
}
function safeStat(candidate) {
  try {
    return statSync(candidate);
  } catch {
    return null;
  }
}
function resolveCookiesDbFromProfileOrRoots(options) {
  const candidates = [];
  if (options.profile && looksLikePath(options.profile)) {
    const expanded = expandPath(options.profile);
    const stat = safeStat(expanded);
    if (stat?.isFile())
      return expanded;
    candidates.push(path5.join(expanded, "Cookies"));
    candidates.push(path5.join(expanded, "Network", "Cookies"));
  } else {
    const profileDir = options.profile && options.profile.trim().length > 0 ? options.profile.trim() : "Default";
    for (const root of options.roots) {
      candidates.push(path5.join(root, profileDir, "Cookies"));
      candidates.push(path5.join(root, profileDir, "Network", "Cookies"));
    }
  }
  for (const candidate of candidates) {
    if (existsSync3(candidate))
      return candidate;
  }
  return null;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/linuxPaths.js
function resolveChromiumCookiesDbLinux(options) {
  const home = homedir4();
  const configHome = process.env["XDG_CONFIG_HOME"]?.trim() || path6.join(home, ".config");
  const root = path6.join(configHome, options.configDirName);
  if (options.profile && looksLikePath(options.profile)) {
    const candidate = expandPath(options.profile);
    if (candidate.endsWith("Cookies") && existsSync4(candidate))
      return candidate;
    const direct = path6.join(candidate, "Cookies");
    if (existsSync4(direct))
      return direct;
    const network = path6.join(candidate, "Network", "Cookies");
    if (existsSync4(network))
      return network;
    return null;
  }
  const profileDir = options.profile && options.profile.trim().length > 0 ? options.profile.trim() : "Default";
  const candidates = [
    path6.join(root, profileDir, "Cookies"),
    path6.join(root, profileDir, "Network", "Cookies")
  ];
  for (const candidate of candidates) {
    if (existsSync4(candidate))
      return candidate;
  }
  return null;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqliteLinux.js
async function getCookiesFromChromeSqliteLinux(options, origins, allowlistNames) {
  const args = {
    configDirName: "google-chrome"
  };
  if (options.profile !== undefined)
    args.profile = options.profile;
  const dbPath = resolveChromiumCookiesDbLinux(args);
  if (!dbPath) {
    return { cookies: [], warnings: ["Chrome cookies database not found."] };
  }
  const { password, warnings: keyringWarnings } = await getLinuxChromeSafeStoragePassword();
  const v10Key = deriveAes128CbcKeyFromPassword("peanuts", { iterations: 1 });
  const emptyKey = deriveAes128CbcKeyFromPassword("", { iterations: 1 });
  const v11Key = deriveAes128CbcKeyFromPassword(password, { iterations: 1 });
  const decrypt = (encryptedValue, opts) => {
    const prefix = Buffer.from(encryptedValue).subarray(0, 3).toString("utf8");
    if (prefix === "v10") {
      return decryptChromiumAes128CbcCookieValue(encryptedValue, [v10Key, emptyKey], {
        stripHashPrefix: opts.stripHashPrefix,
        treatUnknownPrefixAsPlaintext: false
      });
    }
    if (prefix === "v11") {
      return decryptChromiumAes128CbcCookieValue(encryptedValue, [v11Key, emptyKey], {
        stripHashPrefix: opts.stripHashPrefix,
        treatUnknownPrefixAsPlaintext: false
      });
    }
    return null;
  };
  const dbOptions = {
    dbPath
  };
  if (options.profile)
    dbOptions.profile = options.profile;
  if (options.includeExpired !== undefined)
    dbOptions.includeExpired = options.includeExpired;
  if (options.debug !== undefined)
    dbOptions.debug = options.debug;
  const result = await getCookiesFromChromeSqliteDb(dbOptions, origins, allowlistNames, decrypt);
  result.warnings.unshift(...keyringWarnings);
  return result;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqliteMac.js
import { homedir as homedir5 } from "node:os";
import path7 from "node:path";

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/macosKeychain.js
async function readKeychainGenericPassword(options) {
  const res = await execCapture("security", ["find-generic-password", "-w", "-a", options.account, "-s", options.service], { timeoutMs: options.timeoutMs });
  if (res.code === 0) {
    const password = res.stdout.trim();
    return { ok: true, password };
  }
  return {
    ok: false,
    error: `${res.stderr.trim() || `exit ${res.code}`}`
  };
}
async function readKeychainGenericPasswordFirst(options) {
  let lastError = null;
  for (const service of options.services) {
    const r = await readKeychainGenericPassword({
      account: options.account,
      service,
      timeoutMs: options.timeoutMs
    });
    if (r.ok)
      return r;
    lastError = r.error;
  }
  return {
    ok: false,
    error: `Failed to read macOS Keychain (${options.label}): ${lastError ?? "permission denied / keychain locked / entry missing."}`
  };
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqliteMac.js
async function getCookiesFromChromeSqliteMac(options, origins, allowlistNames) {
  const dbPath = resolveChromeCookiesDb(options.profile);
  if (!dbPath) {
    return { cookies: [], warnings: ["Chrome cookies database not found."] };
  }
  const warnings = [];
  const passwordResult = await readKeychainGenericPasswordFirst({
    account: "Chrome",
    services: ["Chrome Safe Storage"],
    timeoutMs: 3000,
    label: "Chrome Safe Storage"
  });
  if (!passwordResult.ok) {
    warnings.push(passwordResult.error);
    return { cookies: [], warnings };
  }
  const chromePassword = passwordResult.password.trim();
  if (!chromePassword) {
    warnings.push("macOS Keychain returned an empty Chrome Safe Storage password.");
    return { cookies: [], warnings };
  }
  const key = deriveAes128CbcKeyFromPassword(chromePassword, { iterations: 1003 });
  const decrypt = (encryptedValue, opts) => decryptChromiumAes128CbcCookieValue(encryptedValue, [key], {
    stripHashPrefix: opts.stripHashPrefix,
    treatUnknownPrefixAsPlaintext: true
  });
  const dbOptions = {
    dbPath
  };
  if (options.profile)
    dbOptions.profile = options.profile;
  if (options.includeExpired !== undefined)
    dbOptions.includeExpired = options.includeExpired;
  if (options.debug !== undefined)
    dbOptions.debug = options.debug;
  const result = await getCookiesFromChromeSqliteDb(dbOptions, origins, allowlistNames, decrypt);
  result.warnings.unshift(...warnings);
  return result;
}
function resolveChromeCookiesDb(profile) {
  const home = homedir5();
  const roots = process.platform === "darwin" ? [path7.join(home, "Library", "Application Support", "Google", "Chrome")] : [];
  const args = { roots };
  if (profile !== undefined)
    args.profile = profile;
  return resolveCookiesDbFromProfileOrRoots(args);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqliteWindows.js
import path10 from "node:path";

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/windowsMasterKey.js
import { existsSync as existsSync5, readFileSync as readFileSync2 } from "node:fs";
import path8 from "node:path";

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/windowsDpapi.js
async function dpapiUnprotect(data, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const inputB64 = data.toString("base64");
  const prelude = "try { Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction Stop } catch { try { Add-Type -AssemblyName System.Security -ErrorAction Stop } catch {} };";
  const script = prelude + `$in=[Convert]::FromBase64String('${inputB64}');` + `$out=[System.Security.Cryptography.ProtectedData]::Unprotect($in,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);` + `[Convert]::ToBase64String($out)`;
  const res = await execCapture("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeoutMs
  });
  if (res.code !== 0) {
    return { ok: false, error: res.stderr.trim() || `powershell exit ${res.code}` };
  }
  try {
    const out = Buffer.from(res.stdout.trim(), "base64");
    return { ok: true, value: out };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/windowsMasterKey.js
async function getWindowsChromiumMasterKey(userDataDir, label) {
  const localStatePath = path8.join(userDataDir, "Local State");
  if (!existsSync5(localStatePath)) {
    return { ok: false, error: `${label} Local State file not found.` };
  }
  let encryptedKeyB64 = null;
  try {
    const raw = readFileSync2(localStatePath, "utf8");
    const parsed = JSON.parse(raw);
    encryptedKeyB64 = typeof parsed.os_crypt?.encrypted_key === "string" ? parsed.os_crypt.encrypted_key : null;
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${label} Local State: ${error instanceof Error ? error.message : String(error)}`
    };
  }
  if (!encryptedKeyB64)
    return { ok: false, error: `${label} Local State missing os_crypt.encrypted_key.` };
  let encryptedKey;
  try {
    encryptedKey = Buffer.from(encryptedKeyB64, "base64");
  } catch {
    return { ok: false, error: `${label} Local State contains an invalid encrypted_key.` };
  }
  const prefix = Buffer.from("DPAPI", "utf8");
  if (!encryptedKey.subarray(0, prefix.length).equals(prefix)) {
    return { ok: false, error: `${label} encrypted_key does not start with DPAPI prefix.` };
  }
  const unprotected = await dpapiUnprotect(encryptedKey.subarray(prefix.length));
  if (!unprotected.ok) {
    return { ok: false, error: `DPAPI decrypt failed: ${unprotected.error}` };
  }
  return { ok: true, value: unprotected.value };
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromium/windowsPaths.js
import { existsSync as existsSync6 } from "node:fs";
import path9 from "node:path";
function resolveChromiumPathsWindows(options) {
  const localAppData = process.env["LOCALAPPDATA"];
  const root = localAppData ? path9.join(localAppData, options.localAppDataVendorPath) : null;
  if (options.profile && looksLikePath(options.profile)) {
    const expanded = expandPath(options.profile);
    const candidates2 = expanded.endsWith("Cookies") ? [expanded] : [
      path9.join(expanded, "Network", "Cookies"),
      path9.join(expanded, "Cookies"),
      path9.join(expanded, "Default", "Network", "Cookies")
    ];
    for (const candidate of candidates2) {
      if (!existsSync6(candidate))
        continue;
      const userDataDir = findUserDataDir(candidate);
      return { dbPath: candidate, userDataDir };
    }
    if (existsSync6(path9.join(expanded, "Local State"))) {
      return { dbPath: null, userDataDir: expanded };
    }
  }
  const profileDir = options.profile && options.profile.trim().length > 0 ? options.profile.trim() : "Default";
  if (!root)
    return { dbPath: null, userDataDir: null };
  const candidates = [
    path9.join(root, profileDir, "Network", "Cookies"),
    path9.join(root, profileDir, "Cookies")
  ];
  for (const candidate of candidates) {
    if (existsSync6(candidate))
      return { dbPath: candidate, userDataDir: root };
  }
  return { dbPath: null, userDataDir: root };
}
function findUserDataDir(cookiesDbPath) {
  let current = path9.dirname(cookiesDbPath);
  for (let i = 0;i < 6; i += 1) {
    const localState = path9.join(current, "Local State");
    if (existsSync6(localState))
      return current;
    const next = path9.dirname(current);
    if (next === current)
      break;
    current = next;
  }
  return null;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqliteWindows.js
async function getCookiesFromChromeSqliteWindows(options, origins, allowlistNames) {
  const resolveArgs = {
    localAppDataVendorPath: path10.join("Google", "Chrome", "User Data")
  };
  if (options.profile !== undefined)
    resolveArgs.profile = options.profile;
  const { dbPath, userDataDir } = resolveChromiumPathsWindows(resolveArgs);
  if (!dbPath || !userDataDir) {
    return { cookies: [], warnings: ["Chrome cookies database not found."] };
  }
  const masterKey = await getWindowsChromiumMasterKey(userDataDir, "Chrome");
  if (!masterKey.ok) {
    return { cookies: [], warnings: [masterKey.error] };
  }
  const decrypt = (encryptedValue, opts) => {
    return decryptChromiumAes256GcmCookieValue(encryptedValue, masterKey.value, {
      stripHashPrefix: opts.stripHashPrefix
    });
  };
  const dbOptions = {
    dbPath
  };
  if (options.profile)
    dbOptions.profile = options.profile;
  if (options.includeExpired !== undefined)
    dbOptions.includeExpired = options.includeExpired;
  if (options.debug !== undefined)
    dbOptions.debug = options.debug;
  return await getCookiesFromChromeSqliteDb(dbOptions, origins, allowlistNames, decrypt);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/chrome.js
async function getCookiesFromChrome(options, origins, allowlistNames) {
  const warnings = [];
  if (process.platform === "darwin") {
    const r = await getCookiesFromChromeSqliteMac(options, origins, allowlistNames);
    warnings.push(...r.warnings);
    const cookies = r.cookies;
    return { cookies, warnings };
  }
  if (process.platform === "linux") {
    const r = await getCookiesFromChromeSqliteLinux(options, origins, allowlistNames);
    warnings.push(...r.warnings);
    const cookies = r.cookies;
    return { cookies, warnings };
  }
  if (process.platform === "win32") {
    const r = await getCookiesFromChromeSqliteWindows(options, origins, allowlistNames);
    warnings.push(...r.warnings);
    const cookies = r.cookies;
    return { cookies, warnings };
  }
  return { cookies: [], warnings };
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/edgeSqliteLinux.js
async function getCookiesFromEdgeSqliteLinux(options, origins, allowlistNames) {
  const args = {
    configDirName: "microsoft-edge"
  };
  if (options.profile !== undefined)
    args.profile = options.profile;
  const dbPath = resolveChromiumCookiesDbLinux(args);
  if (!dbPath) {
    return { cookies: [], warnings: ["Edge cookies database not found."] };
  }
  const { password, warnings: keyringWarnings } = await getLinuxChromiumSafeStoragePassword({
    app: "edge"
  });
  const v10Key = deriveAes128CbcKeyFromPassword("peanuts", { iterations: 1 });
  const emptyKey = deriveAes128CbcKeyFromPassword("", { iterations: 1 });
  const v11Key = deriveAes128CbcKeyFromPassword(password, { iterations: 1 });
  const decrypt = (encryptedValue, opts) => {
    const prefix = Buffer.from(encryptedValue).subarray(0, 3).toString("utf8");
    if (prefix === "v10") {
      return decryptChromiumAes128CbcCookieValue(encryptedValue, [v10Key, emptyKey], {
        stripHashPrefix: opts.stripHashPrefix,
        treatUnknownPrefixAsPlaintext: false
      });
    }
    if (prefix === "v11") {
      return decryptChromiumAes128CbcCookieValue(encryptedValue, [v11Key, emptyKey], {
        stripHashPrefix: opts.stripHashPrefix,
        treatUnknownPrefixAsPlaintext: false
      });
    }
    return null;
  };
  const dbOptions = {
    dbPath
  };
  if (options.profile)
    dbOptions.profile = options.profile;
  if (options.includeExpired !== undefined)
    dbOptions.includeExpired = options.includeExpired;
  if (options.debug !== undefined)
    dbOptions.debug = options.debug;
  const result = await getCookiesFromChromeSqliteDb(dbOptions, origins, allowlistNames, decrypt);
  result.warnings.unshift(...keyringWarnings);
  return result;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/edgeSqliteMac.js
import { homedir as homedir6 } from "node:os";
import path11 from "node:path";
async function getCookiesFromEdgeSqliteMac(options, origins, allowlistNames) {
  const dbPath = resolveEdgeCookiesDb(options.profile);
  if (!dbPath) {
    return { cookies: [], warnings: ["Edge cookies database not found."] };
  }
  const warnings = [];
  const passwordResult = await readKeychainGenericPasswordFirst({
    account: "Microsoft Edge",
    services: ["Microsoft Edge Safe Storage", "Microsoft Edge"],
    timeoutMs: options.timeoutMs ?? 3000,
    label: "Microsoft Edge Safe Storage"
  });
  if (!passwordResult.ok) {
    warnings.push(passwordResult.error);
    return { cookies: [], warnings };
  }
  const edgePassword = passwordResult.password.trim();
  if (!edgePassword) {
    warnings.push("macOS Keychain returned an empty Microsoft Edge Safe Storage password.");
    return { cookies: [], warnings };
  }
  const key = deriveAes128CbcKeyFromPassword(edgePassword, { iterations: 1003 });
  const decrypt = (encryptedValue, opts) => decryptChromiumAes128CbcCookieValue(encryptedValue, [key], {
    stripHashPrefix: opts.stripHashPrefix,
    treatUnknownPrefixAsPlaintext: true
  });
  const dbOptions = {
    dbPath
  };
  if (options.profile)
    dbOptions.profile = options.profile;
  if (options.includeExpired !== undefined)
    dbOptions.includeExpired = options.includeExpired;
  if (options.debug !== undefined)
    dbOptions.debug = options.debug;
  const result = await getCookiesFromChromeSqliteDb(dbOptions, origins, allowlistNames, decrypt);
  result.warnings.unshift(...warnings);
  return result;
}
function resolveEdgeCookiesDb(profile) {
  const home = homedir6();
  const roots = process.platform === "darwin" ? [path11.join(home, "Library", "Application Support", "Microsoft Edge")] : [];
  const args = { roots };
  if (profile !== undefined)
    args.profile = profile;
  return resolveCookiesDbFromProfileOrRoots(args);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/edgeSqliteWindows.js
import path12 from "node:path";
async function getCookiesFromEdgeSqliteWindows(options, origins, allowlistNames) {
  const resolveArgs = {
    localAppDataVendorPath: path12.join("Microsoft", "Edge", "User Data")
  };
  if (options.profile !== undefined)
    resolveArgs.profile = options.profile;
  const { dbPath, userDataDir } = resolveChromiumPathsWindows(resolveArgs);
  if (!dbPath || !userDataDir) {
    return { cookies: [], warnings: ["Edge cookies database not found."] };
  }
  const masterKey = await getWindowsChromiumMasterKey(userDataDir, "Edge");
  if (!masterKey.ok) {
    return { cookies: [], warnings: [masterKey.error] };
  }
  const decrypt = (encryptedValue, opts) => {
    return decryptChromiumAes256GcmCookieValue(encryptedValue, masterKey.value, {
      stripHashPrefix: opts.stripHashPrefix
    });
  };
  const dbOptions = {
    dbPath
  };
  if (options.profile)
    dbOptions.profile = options.profile;
  if (options.includeExpired !== undefined)
    dbOptions.includeExpired = options.includeExpired;
  if (options.debug !== undefined)
    dbOptions.debug = options.debug;
  return await getCookiesFromChromeSqliteDb(dbOptions, origins, allowlistNames, decrypt);
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/edge.js
async function getCookiesFromEdge(options, origins, allowlistNames) {
  const warnings = [];
  if (process.platform === "darwin") {
    const r = await getCookiesFromEdgeSqliteMac(options, origins, allowlistNames);
    warnings.push(...r.warnings);
    const cookies = r.cookies;
    return { cookies, warnings };
  }
  if (process.platform === "linux") {
    const r = await getCookiesFromEdgeSqliteLinux(options, origins, allowlistNames);
    warnings.push(...r.warnings);
    const cookies = r.cookies;
    return { cookies, warnings };
  }
  if (process.platform === "win32") {
    const r = await getCookiesFromEdgeSqliteWindows(options, origins, allowlistNames);
    warnings.push(...r.warnings);
    const cookies = r.cookies;
    return { cookies, warnings };
  }
  return { cookies: [], warnings };
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/firefoxSqlite.js
import { copyFileSync as copyFileSync2, existsSync as existsSync7, mkdtempSync as mkdtempSync2, readdirSync, rmSync as rmSync2 } from "node:fs";
import { homedir as homedir7, tmpdir as tmpdir2 } from "node:os";
import path13 from "node:path";
async function getCookiesFromFirefox(options, origins, allowlistNames) {
  const warnings = [];
  const dbPath = resolveFirefoxCookiesDb(options.profile);
  if (!dbPath) {
    warnings.push("Firefox cookies database not found.");
    return { cookies: [], warnings };
  }
  const tempDir = mkdtempSync2(path13.join(tmpdir2(), "sweet-cookie-firefox-"));
  const tempDbPath = path13.join(tempDir, "cookies.sqlite");
  try {
    copyFileSync2(dbPath, tempDbPath);
    copySidecar2(dbPath, `${tempDbPath}-wal`, "-wal");
    copySidecar2(dbPath, `${tempDbPath}-shm`, "-shm");
  } catch (error) {
    rmSync2(tempDir, { recursive: true, force: true });
    warnings.push(`Failed to copy Firefox cookie DB: ${error instanceof Error ? error.message : String(error)}`);
    return { cookies: [], warnings };
  }
  const hosts = origins.map((o) => new URL(o).hostname);
  const now = Math.floor(Date.now() / 1000);
  const where = buildHostWhereClause2(hosts);
  const expiryClause = options.includeExpired ? "" : ` AND (expiry = 0 OR expiry > ${now})`;
  const sql = `SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite ` + `FROM moz_cookies WHERE (${where})${expiryClause} ORDER BY expiry DESC;`;
  try {
    if (isBunRuntime()) {
      const bunResult = await queryFirefoxCookiesWithBunSqlite(tempDbPath, sql);
      if (!bunResult.ok) {
        warnings.push(`bun:sqlite failed reading Firefox cookies: ${bunResult.error}`);
        return { cookies: [], warnings };
      }
      const cookies2 = collectFirefoxCookiesFromRows(bunResult.rows, options, hosts, allowlistNames);
      return { cookies: dedupeCookies2(cookies2), warnings };
    }
    const nodeResult = await queryFirefoxCookiesWithNodeSqlite(tempDbPath, sql);
    if (!nodeResult.ok) {
      warnings.push(`node:sqlite failed reading Firefox cookies: ${nodeResult.error}`);
      return { cookies: [], warnings };
    }
    const cookies = collectFirefoxCookiesFromRows(nodeResult.rows, options, hosts, allowlistNames);
    return { cookies: dedupeCookies2(cookies), warnings };
  } finally {
    rmSync2(tempDir, { recursive: true, force: true });
  }
}
async function queryFirefoxCookiesWithNodeSqlite(dbPath, sql) {
  try {
    const { DatabaseSync } = await importNodeSqlite();
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare(sql).all();
      return { ok: true, rows };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
async function queryFirefoxCookiesWithBunSqlite(dbPath, sql) {
  try {
    const { Database } = await import("bun:sqlite");
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db.query(sql).all();
      return { ok: true, rows };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function collectFirefoxCookiesFromRows(rows, options, hosts, allowlistNames) {
  const now = Math.floor(Date.now() / 1000);
  const cookies = [];
  for (const row of rows) {
    const name = typeof row.name === "string" ? row.name : null;
    const value = typeof row.value === "string" ? row.value : null;
    const host = typeof row.host === "string" ? row.host : null;
    const cookiePath = typeof row.path === "string" ? row.path : "";
    if (!name || value === null || !host)
      continue;
    if (allowlistNames && allowlistNames.size > 0 && !allowlistNames.has(name))
      continue;
    if (!hostMatchesAny2(hosts, host))
      continue;
    const expiryText = typeof row.expiry === "number" ? String(row.expiry) : typeof row.expiry === "string" ? row.expiry : undefined;
    const expires = normalizeFirefoxExpiry(expiryText);
    if (!options.includeExpired && expires && expires < now)
      continue;
    const isSecure = row.isSecure === 1 || row.isSecure === "1" || row.isSecure === true;
    const isHttpOnly = row.isHttpOnly === 1 || row.isHttpOnly === "1" || row.isHttpOnly === true;
    const cookie = {
      name,
      value,
      domain: host.startsWith(".") ? host.slice(1) : host,
      path: cookiePath || "/",
      secure: isSecure,
      httpOnly: isHttpOnly
    };
    if (expires !== undefined)
      cookie.expires = expires;
    const normalizedSameSite = normalizeFirefoxSameSite(typeof row.sameSite === "number" ? String(row.sameSite) : typeof row.sameSite === "string" ? row.sameSite : undefined);
    if (normalizedSameSite !== undefined)
      cookie.sameSite = normalizedSameSite;
    const source = { browser: "firefox" };
    if (options.profile)
      source.profile = options.profile;
    cookie.source = source;
    cookies.push(cookie);
  }
  return cookies;
}
function resolveFirefoxCookiesDb(profile) {
  const home = homedir7();
  const appData = process.env["APPDATA"];
  const roots = process.platform === "darwin" ? [path13.join(home, "Library", "Application Support", "Firefox", "Profiles")] : process.platform === "linux" ? [path13.join(home, ".mozilla", "firefox")] : process.platform === "win32" ? appData ? [path13.join(appData, "Mozilla", "Firefox", "Profiles")] : [] : [];
  if (profile && looksLikePath2(profile)) {
    const candidate = profile.endsWith("cookies.sqlite") ? profile : path13.join(profile, "cookies.sqlite");
    return existsSync7(candidate) ? candidate : null;
  }
  for (const root of roots) {
    if (!root || !existsSync7(root))
      continue;
    if (profile) {
      const candidate2 = path13.join(root, profile, "cookies.sqlite");
      if (existsSync7(candidate2))
        return candidate2;
      continue;
    }
    const entries = safeReaddir(root);
    const defaultRelease = entries.find((e) => e.includes("default-release"));
    const picked = defaultRelease ?? entries[0];
    if (!picked)
      continue;
    const candidate = path13.join(root, picked, "cookies.sqlite");
    if (existsSync7(candidate))
      return candidate;
  }
  return null;
}
function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
function looksLikePath2(value) {
  return value.includes("/") || value.includes("\\");
}
function copySidecar2(sourceDbPath, target, suffix) {
  const sidecar = `${sourceDbPath}${suffix}`;
  if (!existsSync7(sidecar))
    return;
  try {
    copyFileSync2(sidecar, target);
  } catch {}
}
function buildHostWhereClause2(hosts) {
  const clauses = [];
  for (const host of hosts) {
    const escaped = sqlLiteral2(host);
    const escapedDot = sqlLiteral2(`.${host}`);
    const escapedLike = sqlLiteral2(`%.${host}`);
    clauses.push(`host = ${escaped}`);
    clauses.push(`host = ${escapedDot}`);
    clauses.push(`host LIKE ${escapedLike}`);
  }
  return clauses.length ? clauses.join(" OR ") : "1=0";
}
function sqlLiteral2(value) {
  const escaped = value.replaceAll("'", "''");
  return `'${escaped}'`;
}
function normalizeFirefoxExpiry(expiry) {
  if (!expiry)
    return;
  const value = Number.parseInt(expiry, 10);
  if (!Number.isFinite(value) || value <= 0)
    return;
  return value;
}
function normalizeFirefoxSameSite(raw) {
  if (!raw)
    return;
  const value = Number.parseInt(raw, 10);
  if (Number.isFinite(value)) {
    if (value === 2)
      return "Strict";
    if (value === 1)
      return "Lax";
    if (value === 0)
      return "None";
  }
  const normalized = raw.toLowerCase();
  if (normalized === "strict")
    return "Strict";
  if (normalized === "lax")
    return "Lax";
  if (normalized === "none")
    return "None";
  return;
}
function hostMatchesAny2(hosts, cookieHost) {
  const cookieDomain = cookieHost.startsWith(".") ? cookieHost.slice(1) : cookieHost;
  return hosts.some((host) => hostMatchesCookieDomain(host, cookieDomain));
}
function dedupeCookies2(cookies) {
  const merged = new Map;
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain ?? ""}|${cookie.path ?? ""}`;
    if (!merged.has(key))
      merged.set(key, cookie);
  }
  return Array.from(merged.values());
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/base64.js
function tryDecodeBase64Json(input) {
  const trimmed = input.trim();
  if (!trimmed)
    return null;
  try {
    const encoding = /[-_]/.test(trimmed) ? "base64url" : "base64";
    const buf = Buffer.from(trimmed, encoding);
    const decoded = buf.toString("utf8").trim();
    if (!decoded)
      return null;
    JSON.parse(decoded);
    return decoded;
  } catch {
    return null;
  }
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/fs.js
import fs2 from "node:fs/promises";
async function readTextFileIfExists(filePath) {
  try {
    const stat = await fs2.stat(filePath);
    if (!stat.isFile())
      return null;
    return await fs2.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/inline.js
async function getCookiesFromInline(inline, origins, allowlistNames) {
  const warnings = [];
  const rawPayload = inline.source.endsWith("file") || inline.payload.endsWith(".json") || inline.payload.endsWith(".base64") ? await readTextFileIfExists(inline.payload) ?? inline.payload : inline.payload;
  const decoded = tryDecodeBase64Json(rawPayload) ?? rawPayload;
  const parsed = tryParseCookiePayload(decoded);
  if (!parsed) {
    return { cookies: [], warnings };
  }
  const hostAllow = new Set(origins.map((o) => new URL(o).hostname));
  const cookies = [];
  for (const cookie of parsed.cookies) {
    if (!cookie?.name)
      continue;
    if (allowlistNames && allowlistNames.size > 0 && !allowlistNames.has(cookie.name))
      continue;
    const domain = cookie.domain ?? (cookie.url ? safeHostnameFromUrl(cookie.url) : undefined);
    if (domain && hostAllow.size > 0 && !matchesAnyHost(hostAllow, domain))
      continue;
    cookies.push(cookie);
  }
  return { cookies, warnings };
}
function tryParseCookiePayload(input) {
  const trimmed = input.trim();
  if (!trimmed)
    return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { cookies: parsed };
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.cookies)) {
      return { cookies: parsed.cookies };
    }
    return null;
  } catch {
    return null;
  }
}
function matchesAnyHost(hosts, cookieDomain) {
  for (const host of hosts) {
    if (hostMatchesCookieDomain(host, cookieDomain))
      return true;
  }
  return false;
}
function safeHostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return;
  }
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/providers/safariBinaryCookies.js
import { existsSync as existsSync8, readFileSync as readFileSync3 } from "node:fs";
import { homedir as homedir8 } from "node:os";
import path14 from "node:path";
var MAC_EPOCH_DELTA_SECONDS = 978307200;
async function getCookiesFromSafari(options, origins, allowlistNames) {
  const warnings = [];
  if (process.platform !== "darwin") {
    return { cookies: [], warnings };
  }
  const cookieFile = options.file ?? resolveSafariBinaryCookiesPath();
  if (!cookieFile) {
    warnings.push("Safari Cookies.binarycookies not found.");
    return { cookies: [], warnings };
  }
  const hosts = origins.map((o) => new URL(o).hostname);
  const now = Math.floor(Date.now() / 1000);
  try {
    const data = readFileSync3(cookieFile);
    const parsed = decodeBinaryCookies(data);
    const cookies = [];
    for (const cookie of parsed) {
      if (!cookie.name)
        continue;
      if (allowlistNames && allowlistNames.size > 0 && !allowlistNames.has(cookie.name))
        continue;
      const domain = cookie.domain;
      if (!domain)
        continue;
      if (!hosts.some((h) => hostMatchesCookieDomain(h, domain)))
        continue;
      if (!options.includeExpired && cookie.expires && cookie.expires < now)
        continue;
      cookies.push(cookie);
    }
    return { cookies: dedupeCookies3(cookies), warnings };
  } catch (error) {
    warnings.push(`Failed to read Safari cookies: ${error instanceof Error ? error.message : String(error)}`);
    return { cookies: [], warnings };
  }
}
function resolveSafariBinaryCookiesPath() {
  const home = homedir8();
  const candidates = [
    path14.join(home, "Library", "Cookies", "Cookies.binarycookies"),
    path14.join(home, "Library", "Containers", "com.apple.Safari", "Data", "Library", "Cookies", "Cookies.binarycookies")
  ];
  for (const candidate of candidates) {
    if (existsSync8(candidate))
      return candidate;
  }
  return null;
}
function decodeBinaryCookies(buffer) {
  if (buffer.length < 8)
    return [];
  if (buffer.subarray(0, 4).toString("utf8") !== "cook")
    return [];
  const pageCount = buffer.readUInt32BE(4);
  let cursor = 8;
  const pageSizes = [];
  for (let i = 0;i < pageCount; i += 1) {
    pageSizes.push(buffer.readUInt32BE(cursor));
    cursor += 4;
  }
  const cookies = [];
  for (const pageSize of pageSizes) {
    const page = buffer.subarray(cursor, cursor + pageSize);
    cursor += pageSize;
    cookies.push(...decodePage(page));
  }
  return cookies;
}
function decodePage(page) {
  if (page.length < 16)
    return [];
  const header = page.readUInt32BE(0);
  if (header !== 256)
    return [];
  const cookieCount = page.readUInt32LE(4);
  const offsets = [];
  let cursor = 8;
  for (let i = 0;i < cookieCount; i += 1) {
    offsets.push(page.readUInt32LE(cursor));
    cursor += 4;
  }
  const cookies = [];
  for (const offset of offsets) {
    const cookie = decodeCookie(page.subarray(offset));
    if (cookie)
      cookies.push(cookie);
  }
  return cookies;
}
function decodeCookie(cookieBuffer) {
  if (cookieBuffer.length < 48)
    return null;
  const size = cookieBuffer.readUInt32LE(0);
  if (size < 48 || size > cookieBuffer.length)
    return null;
  const flagsValue = cookieBuffer.readUInt32LE(8);
  const isSecure = (flagsValue & 1) !== 0;
  const isHttpOnly = (flagsValue & 4) !== 0;
  const urlOffset = cookieBuffer.readUInt32LE(16);
  const nameOffset = cookieBuffer.readUInt32LE(20);
  const pathOffset = cookieBuffer.readUInt32LE(24);
  const valueOffset = cookieBuffer.readUInt32LE(28);
  const expiration = readDoubleLE(cookieBuffer, 40);
  const rawUrl = readCString(cookieBuffer, urlOffset, size);
  const name = readCString(cookieBuffer, nameOffset, size);
  const cookiePath = readCString(cookieBuffer, pathOffset, size) ?? "/";
  const value = readCString(cookieBuffer, valueOffset, size) ?? "";
  if (!name)
    return null;
  const domain = rawUrl ? safeHostnameFromUrl2(rawUrl) : undefined;
  const expires = expiration && expiration > 0 ? Math.round(expiration + MAC_EPOCH_DELTA_SECONDS) : undefined;
  const decoded = {
    name,
    value,
    path: cookiePath,
    secure: isSecure,
    httpOnly: isHttpOnly,
    source: { browser: "safari" }
  };
  if (domain)
    decoded.domain = domain;
  if (expires !== undefined)
    decoded.expires = expires;
  return decoded;
}
function readDoubleLE(buffer, offset) {
  if (offset + 8 > buffer.length)
    return 0;
  const slice = buffer.subarray(offset, offset + 8);
  return slice.readDoubleLE(0);
}
function readCString(buffer, offset, end) {
  if (offset <= 0 || offset >= end)
    return null;
  let cursor = offset;
  while (cursor < end && buffer[cursor] !== 0)
    cursor += 1;
  if (cursor >= end)
    return null;
  return buffer.toString("utf8", offset, cursor);
}
function safeHostnameFromUrl2(raw) {
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`;
    const parsed = new URL(url);
    return parsed.hostname.startsWith(".") ? parsed.hostname.slice(1) : parsed.hostname;
  } catch {
    const cleaned = raw.trim();
    if (!cleaned)
      return;
    return cleaned.startsWith(".") ? cleaned.slice(1) : cleaned;
  }
}
function dedupeCookies3(cookies) {
  const merged = new Map;
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain ?? ""}|${cookie.path ?? ""}`;
    if (!merged.has(key))
      merged.set(key, cookie);
  }
  return Array.from(merged.values());
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/util/origins.js
function normalizeOrigins(url, extraOrigins) {
  const origins = [];
  try {
    const parsed = new URL(url);
    origins.push(ensureTrailingSlash(parsed.origin));
  } catch {}
  for (const raw of extraOrigins ?? []) {
    const trimmed = raw.trim();
    if (!trimmed)
      continue;
    try {
      const parsed = new URL(trimmed);
      origins.push(ensureTrailingSlash(parsed.origin));
    } catch {}
  }
  return Array.from(new Set(origins));
}
function ensureTrailingSlash(origin) {
  return origin.endsWith("/") ? origin : `${origin}/`;
}

// ../../node_modules/.bun/@steipete+sweet-cookie@0.1.0/node_modules/@steipete/sweet-cookie/dist/public.js
var DEFAULT_BROWSERS = ["chrome", "safari", "firefox"];
async function getCookies(options) {
  const warnings = [];
  const url = options.url;
  const origins = normalizeOrigins(url, options.origins);
  const names = normalizeNames(options.names);
  let browsers;
  if (Array.isArray(options.browsers) && options.browsers.length > 0) {
    browsers = options.browsers;
  } else {
    browsers = parseBrowsersEnv() ?? DEFAULT_BROWSERS;
  }
  const mode = options.mode ?? parseModeEnv() ?? "merge";
  const inlineSources = await resolveInlineSources(options);
  for (const source of inlineSources) {
    const inlineResult = await getCookiesFromInline(source, origins, names);
    warnings.push(...inlineResult.warnings);
    if (inlineResult.cookies.length) {
      return { cookies: inlineResult.cookies, warnings };
    }
  }
  const merged = new Map;
  const tryAdd = (cookie) => {
    const domain = cookie.domain ?? "";
    const pathValue = cookie.path ?? "";
    const key = `${cookie.name}|${domain}|${pathValue}`;
    if (!merged.has(key)) {
      merged.set(key, cookie);
    }
  };
  for (const browser of browsers) {
    let result;
    if (browser === "chrome") {
      const chromeOptions = {};
      const chromeProfile = options.chromeProfile ?? options.profile ?? readEnv2("SWEET_COOKIE_CHROME_PROFILE");
      if (chromeProfile)
        chromeOptions.profile = chromeProfile;
      if (options.timeoutMs !== undefined)
        chromeOptions.timeoutMs = options.timeoutMs;
      if (options.includeExpired !== undefined)
        chromeOptions.includeExpired = options.includeExpired;
      if (options.debug !== undefined)
        chromeOptions.debug = options.debug;
      result = await getCookiesFromChrome(chromeOptions, origins, names);
    } else if (browser === "edge") {
      const edgeOptions = {};
      const edgeProfile = options.edgeProfile ?? options.profile ?? readEnv2("SWEET_COOKIE_EDGE_PROFILE") ?? readEnv2("SWEET_COOKIE_CHROME_PROFILE");
      if (edgeProfile)
        edgeOptions.profile = edgeProfile;
      if (options.timeoutMs !== undefined)
        edgeOptions.timeoutMs = options.timeoutMs;
      if (options.includeExpired !== undefined)
        edgeOptions.includeExpired = options.includeExpired;
      if (options.debug !== undefined)
        edgeOptions.debug = options.debug;
      result = await getCookiesFromEdge(edgeOptions, origins, names);
    } else if (browser === "firefox") {
      const firefoxOptions = {};
      const firefoxProfile = options.firefoxProfile ?? readEnv2("SWEET_COOKIE_FIREFOX_PROFILE");
      if (firefoxProfile)
        firefoxOptions.profile = firefoxProfile;
      if (options.includeExpired !== undefined)
        firefoxOptions.includeExpired = options.includeExpired;
      result = await getCookiesFromFirefox(firefoxOptions, origins, names);
    } else {
      const safariOptions = {};
      if (options.includeExpired !== undefined)
        safariOptions.includeExpired = options.includeExpired;
      if (options.safariCookiesFile)
        safariOptions.file = options.safariCookiesFile;
      result = await getCookiesFromSafari(safariOptions, origins, names);
    }
    warnings.push(...result.warnings);
    if (mode === "first" && result.cookies.length) {
      return { cookies: result.cookies, warnings };
    }
    for (const cookie of result.cookies) {
      tryAdd(cookie);
    }
  }
  return { cookies: Array.from(merged.values()), warnings };
}
function normalizeNames(names) {
  if (!names?.length)
    return null;
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (!cleaned.length)
    return null;
  return new Set(cleaned);
}
async function resolveInlineSources(options) {
  const sources = [];
  if (options.inlineCookiesJson) {
    sources.push({ source: "inline-json", payload: options.inlineCookiesJson });
  }
  if (options.inlineCookiesBase64) {
    sources.push({ source: "inline-base64", payload: options.inlineCookiesBase64 });
  }
  if (options.inlineCookiesFile) {
    sources.push({ source: "inline-file", payload: options.inlineCookiesFile });
  }
  return sources;
}
function parseBrowsersEnv() {
  const raw = readEnv2("SWEET_COOKIE_BROWSERS") ?? readEnv2("SWEET_COOKIE_SOURCES");
  if (!raw)
    return;
  const tokens = raw.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const out = [];
  for (const token of tokens) {
    if (token === "chrome" || token === "edge" || token === "firefox" || token === "safari") {
      if (!out.includes(token))
        out.push(token);
    }
  }
  return out.length ? out : undefined;
}
function parseModeEnv() {
  const raw = readEnv2("SWEET_COOKIE_MODE");
  if (!raw)
    return;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "merge" || normalized === "first")
    return normalized;
  return;
}
function readEnv2(key) {
  const value = process.env[key];
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length ? trimmed : undefined;
}
// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/cookies.js
var TWITTER_COOKIE_NAMES = ["auth_token", "ct0"];
var TWITTER_URL = "https://x.com/";
var TWITTER_ORIGINS = ["https://x.com/", "https://twitter.com/"];
var DEFAULT_COOKIE_TIMEOUT_MS = 30000;
function normalizeValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function cookieHeader(authToken, ct0) {
  return `auth_token=${authToken}; ct0=${ct0}`;
}
function buildEmpty() {
  return { authToken: null, ct0: null, cookieHeader: null, source: null };
}
function readEnvCookie(cookies, keys, field) {
  if (cookies[field]) {
    return;
  }
  for (const key of keys) {
    const value = normalizeValue(process.env[key]);
    if (!value) {
      continue;
    }
    cookies[field] = value;
    if (!cookies.source) {
      cookies.source = `env ${key}`;
    }
    break;
  }
}
function resolveSources(cookieSource) {
  if (Array.isArray(cookieSource)) {
    return cookieSource;
  }
  if (cookieSource) {
    return [cookieSource];
  }
  return ["safari", "chrome", "firefox"];
}
function labelForSource(source, profile) {
  if (source === "safari") {
    return "Safari";
  }
  if (source === "chrome") {
    return profile ? `Chrome profile "${profile}"` : "Chrome default profile";
  }
  return profile ? `Firefox profile "${profile}"` : "Firefox default profile";
}
function pickCookieValue(cookies, name) {
  const matches = cookies.filter((c) => c?.name === name && typeof c.value === "string");
  if (matches.length === 0) {
    return null;
  }
  const preferred = matches.find((c) => (c.domain ?? "").endsWith("x.com"));
  if (preferred?.value) {
    return preferred.value;
  }
  const twitter = matches.find((c) => (c.domain ?? "").endsWith("twitter.com"));
  if (twitter?.value) {
    return twitter.value;
  }
  return matches[0]?.value ?? null;
}
async function readTwitterCookiesFromBrowser(options) {
  const warnings = [];
  const out = buildEmpty();
  const { cookies, warnings: providerWarnings } = await getCookies({
    url: TWITTER_URL,
    origins: TWITTER_ORIGINS,
    names: [...TWITTER_COOKIE_NAMES],
    browsers: [options.source],
    mode: "merge",
    chromeProfile: options.chromeProfile,
    firefoxProfile: options.firefoxProfile,
    timeoutMs: options.cookieTimeoutMs
  });
  warnings.push(...providerWarnings);
  const authToken = pickCookieValue(cookies, "auth_token");
  const ct0 = pickCookieValue(cookies, "ct0");
  if (authToken) {
    out.authToken = authToken;
  }
  if (ct0) {
    out.ct0 = ct0;
  }
  if (out.authToken && out.ct0) {
    out.cookieHeader = cookieHeader(out.authToken, out.ct0);
    out.source = labelForSource(options.source, options.source === "chrome" ? options.chromeProfile : options.firefoxProfile);
    return { cookies: out, warnings };
  }
  if (options.source === "safari") {
    warnings.push("No Twitter cookies found in Safari. Make sure you are logged into x.com in Safari.");
  } else if (options.source === "chrome") {
    warnings.push("No Twitter cookies found in Chrome. Make sure you are logged into x.com in Chrome.");
  } else {
    warnings.push("No Twitter cookies found in Firefox. Make sure you are logged into x.com in Firefox and the profile exists.");
  }
  return { cookies: out, warnings };
}
async function resolveCredentials(options) {
  const warnings = [];
  const cookies = buildEmpty();
  const cookieTimeoutMs = typeof options.cookieTimeoutMs === "number" && Number.isFinite(options.cookieTimeoutMs) && options.cookieTimeoutMs > 0 ? options.cookieTimeoutMs : process.platform === "darwin" ? DEFAULT_COOKIE_TIMEOUT_MS : undefined;
  if (options.authToken) {
    cookies.authToken = options.authToken;
    cookies.source = "CLI argument";
  }
  if (options.ct0) {
    cookies.ct0 = options.ct0;
    if (!cookies.source) {
      cookies.source = "CLI argument";
    }
  }
  readEnvCookie(cookies, ["AUTH_TOKEN", "TWITTER_AUTH_TOKEN"], "authToken");
  readEnvCookie(cookies, ["CT0", "TWITTER_CT0"], "ct0");
  if (cookies.authToken && cookies.ct0) {
    cookies.cookieHeader = cookieHeader(cookies.authToken, cookies.ct0);
    return { cookies, warnings };
  }
  const sourcesToTry = resolveSources(options.cookieSource);
  for (const source of sourcesToTry) {
    const res = await readTwitterCookiesFromBrowser({
      source,
      chromeProfile: options.chromeProfile,
      firefoxProfile: options.firefoxProfile,
      cookieTimeoutMs
    });
    warnings.push(...res.warnings);
    if (res.cookies.authToken && res.cookies.ct0) {
      return { cookies: res.cookies, warnings };
    }
  }
  if (!cookies.authToken) {
    warnings.push("Missing auth_token - provide via --auth-token, AUTH_TOKEN env var, or login to x.com in Safari/Chrome/Firefox");
  }
  if (!cookies.ct0) {
    warnings.push("Missing ct0 - provide via --ct0, CT0 env var, or login to x.com in Safari/Chrome/Firefox");
  }
  if (cookies.authToken && cookies.ct0) {
    cookies.cookieHeader = cookieHeader(cookies.authToken, cookies.ct0);
  }
  return { cookies, warnings };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/extract-tweet-id.js
var TWEET_URL_REGEX = /(?:twitter\.com|x\.com)\/(?:\w+\/status|i\/web\/status)\/(\d+)/i;
function extractTweetId(input) {
  const urlMatch = TWEET_URL_REGEX.exec(input);
  if (urlMatch) {
    return urlMatch[1];
  }
  return input;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/cli/shared.js
var COOKIE_SOURCES = ["safari", "chrome", "firefox"];
function parseCookieSource(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "safari" || normalized === "chrome" || normalized === "firefox") {
    return normalized;
  }
  throw new Error(`Invalid --cookie-source "${value}". Allowed: safari, chrome, firefox.`);
}
var collectCookieSource = (value, previous = []) => {
  previous.push(parseCookieSource(value));
  return previous;
};
function resolveCookieSourceOrder(input) {
  if (typeof input === "string") {
    return [parseCookieSource(input)];
  }
  if (Array.isArray(input)) {
    const result = [];
    for (const entry of input) {
      if (typeof entry !== "string") {
        continue;
      }
      result.push(parseCookieSource(entry));
    }
    return result.length > 0 ? result : undefined;
  }
  return;
}
function resolveTimeoutMs(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return;
}
function resolveQuoteDepth(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return;
}
function detectMime(path15) {
  const ext = path15.toLowerCase();
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (ext.endsWith(".png")) {
    return "image/png";
  }
  if (ext.endsWith(".webp")) {
    return "image/webp";
  }
  if (ext.endsWith(".gif")) {
    return "image/gif";
  }
  if (ext.endsWith(".mp4") || ext.endsWith(".m4v")) {
    return "video/mp4";
  }
  if (ext.endsWith(".mov")) {
    return "video/quicktime";
  }
  return null;
}
function readConfigFile(path15, warn) {
  if (!existsSync9(path15)) {
    return {};
  }
  try {
    const raw = readFileSync4(path15, "utf8");
    const parsed = import_json5.default.parse(raw);
    return parsed ?? {};
  } catch (error) {
    warn(`Failed to parse config at ${path15}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}
function loadConfig(warn) {
  const globalPath = join(homedir9(), ".config", "bird", "config.json5");
  const localPath = join(process.cwd(), ".birdrc.json5");
  return {
    ...readConfigFile(globalPath, warn),
    ...readConfigFile(localPath, warn)
  };
}
function createCliContext(normalizedArgs, env = process.env) {
  const isTty = process.stdout.isTTY;
  let output = resolveOutputConfigFromArgv(normalizedArgs, env, isTty);
  kleur_default.enabled = output.color;
  const wrap = (styler) => (text) => isTty ? styler(text) : text;
  const colors = {
    banner: wrap((t) => kleur_default.bold().blue(t)),
    subtitle: wrap((t) => kleur_default.dim(t)),
    section: wrap((t) => kleur_default.bold().white(t)),
    bullet: wrap((t) => kleur_default.blue(t)),
    command: wrap((t) => kleur_default.bold().cyan(t)),
    option: wrap((t) => kleur_default.cyan(t)),
    argument: wrap((t) => kleur_default.magenta(t)),
    description: wrap((t) => kleur_default.white(t)),
    muted: wrap((t) => kleur_default.gray(t)),
    accent: wrap((t) => kleur_default.green(t))
  };
  const p = (kind) => {
    const prefix = statusPrefix(kind, output);
    if (output.plain || !output.color) {
      return prefix;
    }
    if (kind === "ok") {
      return kleur_default.green(prefix);
    }
    if (kind === "warn") {
      return kleur_default.yellow(prefix);
    }
    if (kind === "err") {
      return kleur_default.red(prefix);
    }
    if (kind === "info") {
      return kleur_default.cyan(prefix);
    }
    return kleur_default.gray(prefix);
  };
  const l = (kind) => {
    const prefix = labelPrefix(kind, output);
    if (output.plain || !output.color) {
      return prefix;
    }
    if (kind === "url") {
      return kleur_default.cyan(prefix);
    }
    if (kind === "date") {
      return kleur_default.magenta(prefix);
    }
    if (kind === "source") {
      return kleur_default.gray(prefix);
    }
    if (kind === "engine") {
      return kleur_default.blue(prefix);
    }
    if (kind === "credentials") {
      return kleur_default.yellow(prefix);
    }
    if (kind === "user") {
      return kleur_default.cyan(prefix);
    }
    if (kind === "userId") {
      return kleur_default.magenta(prefix);
    }
    if (kind === "email") {
      return kleur_default.green(prefix);
    }
    return kleur_default.gray(prefix);
  };
  const config = loadConfig((message) => {
    console.error(colors.muted(`${p("warn")}${message}`));
  });
  function applyOutputFromCommand(command) {
    const opts = command.optsWithGlobals();
    output = resolveOutputConfigFromCommander(opts, env, isTty);
    kleur_default.enabled = output.color;
  }
  function resolveTimeoutFromOptions(options) {
    return resolveTimeoutMs(options.timeout, config.timeoutMs, env.BIRD_TIMEOUT_MS);
  }
  function resolveCookieTimeoutFromOptions(options) {
    return resolveTimeoutMs(options.cookieTimeout, config.cookieTimeoutMs, env.BIRD_COOKIE_TIMEOUT_MS);
  }
  function resolveQuoteDepthFromOptions(options) {
    return resolveQuoteDepth(options.quoteDepth, config.quoteDepth, env.BIRD_QUOTE_DEPTH);
  }
  function resolveCredentialsFromOptions(opts) {
    const cookieSource = opts.cookieSource?.length ? opts.cookieSource : resolveCookieSourceOrder(config.cookieSource) ?? COOKIE_SOURCES;
    const chromeProfile = opts.chromeProfileDir || opts.chromeProfile || config.chromeProfileDir || config.chromeProfile;
    return resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      cookieSource,
      chromeProfile,
      firefoxProfile: opts.firefoxProfile || config.firefoxProfile,
      cookieTimeoutMs: resolveCookieTimeoutFromOptions(opts)
    });
  }
  function loadMedia(opts) {
    if (opts.media.length === 0) {
      return [];
    }
    const specs = [];
    for (const [index, path15] of opts.media.entries()) {
      const mime = detectMime(path15);
      if (!mime) {
        throw new Error(`Unsupported media type for ${path15}. Supported: jpg, jpeg, png, webp, gif, mp4, mov`);
      }
      const buffer = readFileSync4(path15);
      specs.push({ path: path15, mime, buffer, alt: opts.alts[index] });
    }
    const videoCount = specs.filter((m) => m.mime.startsWith("video/")).length;
    if (videoCount > 1) {
      throw new Error("Only one video can be attached");
    }
    if (videoCount === 1 && specs.length > 1) {
      throw new Error("Video cannot be combined with other media");
    }
    if (specs.length > 4) {
      throw new Error("Maximum 4 media attachments");
    }
    return specs;
  }
  function printTweets(tweets, opts = {}) {
    if (opts.json) {
      console.log(JSON.stringify(tweets, null, 2));
      return;
    }
    if (tweets.length === 0) {
      console.log(opts.emptyMessage ?? "No tweets found.");
      return;
    }
    const useEmoji = output.emoji && !output.plain;
    const articleLabel = useEmoji ? "\uD83D\uDCF0" : "Article:";
    const mediaLabel = (type) => {
      if (useEmoji) {
        return type === "video" ? "\uD83C\uDFAC" : type === "animated_gif" ? "\uD83D\uDD04" : "\uD83D\uDDBC️";
      }
      return type === "video" ? "VIDEO:" : type === "animated_gif" ? "GIF:" : "PHOTO:";
    };
    const quotePrefix = useEmoji ? { top: "┌─", mid: "│ ", bot: "└─" } : { top: "> ", mid: "> ", bot: "> " };
    for (const tweet of tweets) {
      console.log(`
@${tweet.author.username} (${tweet.author.name}):`);
      if (tweet.article) {
        const hasFullBody = tweet.text.startsWith(tweet.article.title);
        if (hasFullBody) {
          console.log(`${articleLabel} ${tweet.text}`);
        } else {
          console.log(`${articleLabel} ${tweet.article.title}`);
          if (tweet.article.previewText) {
            console.log(`   ${tweet.article.previewText}`);
          }
        }
      } else {
        console.log(tweet.text);
      }
      if (tweet.media && tweet.media.length > 0) {
        for (const m of tweet.media) {
          console.log(`${mediaLabel(m.type)} ${m.url}`);
        }
      }
      if (tweet.quotedTweet) {
        console.log(`${quotePrefix.top} QT @${tweet.quotedTweet.author.username}:`);
        const qtText = tweet.quotedTweet.article ? `${articleLabel} ${tweet.quotedTweet.article.title}` : tweet.quotedTweet.text;
        const maxLen = 280;
        const truncated = qtText.length > maxLen ? `${qtText.slice(0, maxLen)}...` : qtText;
        for (const line of truncated.split(`
`).slice(0, 4)) {
          console.log(`${quotePrefix.mid}${line}`);
        }
        if (tweet.quotedTweet.media && tweet.quotedTweet.media.length > 0) {
          for (const m of tweet.quotedTweet.media) {
            console.log(`${quotePrefix.mid}${mediaLabel(m.type)} ${m.url}`);
          }
        }
        console.log(`${quotePrefix.bot} https://x.com/${tweet.quotedTweet.author.username}/status/${tweet.quotedTweet.id}`);
      }
      if (tweet.createdAt) {
        console.log(`${l("date")}${tweet.createdAt}`);
      }
      const tweetUrl = `https://x.com/${tweet.author.username}/status/${tweet.id}`;
      console.log(`${l("url")}${hyperlink(tweetUrl, tweetUrl, output)}`);
      if (opts.showSeparator ?? true) {
        console.log("─".repeat(50));
      }
    }
  }
  function printTweetsResult(result, opts) {
    const tweets = result.tweets ?? [];
    if (opts.json && opts.usePagination) {
      console.log(JSON.stringify({ tweets, nextCursor: result.nextCursor ?? null }, null, 2));
      return;
    }
    printTweets(tweets, { json: opts.json, emptyMessage: opts.emptyMessage });
  }
  return {
    isTty,
    getOutput: () => output,
    colors,
    p,
    l,
    config,
    applyOutputFromCommand,
    resolveTimeoutFromOptions,
    resolveQuoteDepthFromOptions,
    resolveCredentialsFromOptions,
    loadMedia,
    printTweets,
    printTweetsResult,
    extractTweetId
  };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/cli/program.js
var KNOWN_COMMANDS = new Set([
  "tweet",
  "reply",
  "query-ids",
  "read",
  "replies",
  "thread",
  "search",
  "mentions",
  "bookmarks",
  "unbookmark",
  "follow",
  "unfollow",
  "following",
  "followers",
  "likes",
  "lists",
  "list-timeline",
  "home",
  "user-tweets",
  "news",
  "trending",
  "help",
  "whoami",
  "check"
]);
function createProgram(ctx) {
  const program2 = new Command;
  program2.configureHelp({
    showGlobalOptions: true,
    styleTitle: (t) => ctx.colors.section(t),
    styleUsage: (t) => ctx.colors.description(t),
    styleCommandText: (t) => ctx.colors.command(t),
    styleCommandDescription: (t) => ctx.colors.muted(t),
    styleOptionTerm: (t) => ctx.colors.option(t),
    styleOptionText: (t) => ctx.colors.option(t),
    styleOptionDescription: (t) => ctx.colors.muted(t),
    styleArgumentTerm: (t) => ctx.colors.argument(t),
    styleArgumentText: (t) => ctx.colors.argument(t),
    styleArgumentDescription: (t) => ctx.colors.muted(t),
    styleSubcommandTerm: (t) => ctx.colors.command(t),
    styleSubcommandText: (t) => ctx.colors.command(t),
    styleSubcommandDescription: (t) => ctx.colors.muted(t),
    styleDescriptionText: (t) => ctx.colors.muted(t)
  });
  const collect = (value, previous = []) => {
    previous.push(value);
    return previous;
  };
  program2.addHelpText("beforeAll", () => `${ctx.colors.banner("bird")} ${ctx.colors.muted(getCliVersion())} ${ctx.colors.subtitle("— fast X CLI for tweeting, replying, and reading")}`);
  program2.name("bird").description("Post tweets and replies via Twitter/X GraphQL API").version(getCliVersion());
  const formatExample = (command, description) => `${ctx.colors.command(`  ${command}`)}
${ctx.colors.muted(`    ${description}`)}`;
  program2.addHelpText("afterAll", () => `
${ctx.colors.section("Examples")}
${[
    formatExample("bird whoami", "Show the logged-in account via GraphQL cookies"),
    formatExample("bird --firefox-profile default-release whoami", "Use Firefox profile cookies"),
    formatExample('bird tweet "hello from bird"', "Send a tweet"),
    formatExample("bird 1234567890123456789 --json", "Read a tweet (ID or URL shorthand for `read`) and print JSON")
  ].join(`

`)}

${ctx.colors.section("Shortcuts")}
${[
    formatExample("bird <tweet-id-or-url> [--json]", "Shorthand for `bird read <tweet-id-or-url>`")
  ].join(`

`)}

${ctx.colors.section("JSON Output")}
${ctx.colors.muted(`  Add ${ctx.colors.option("--json")} to: read, replies, thread, search, mentions, bookmarks, likes, following, followers, about, lists, list-timeline, user-tweets, query-ids`)}
${ctx.colors.muted(`  Add ${ctx.colors.option("--json-full")} to include raw API response in ${ctx.colors.argument("_raw")} field (tweet commands only)`)}
${ctx.colors.muted(`  (Run ${ctx.colors.command("bird <command> --help")} to see per-command flags.)`)}`);
  program2.addHelpText("afterAll", () => `

${ctx.colors.section("Config")}
${ctx.colors.muted(`  Reads ${ctx.colors.argument("~/.config/bird/config.json5")} and ${ctx.colors.argument("./.birdrc.json5")} (JSON5)`)}
${ctx.colors.muted(`  Supports: chromeProfile, chromeProfileDir, firefoxProfile, cookieSource, cookieTimeoutMs, timeoutMs, quoteDepth`)}

${ctx.colors.section("Env")}
${ctx.colors.muted(`  ${ctx.colors.option("NO_COLOR")}, ${ctx.colors.option("BIRD_TIMEOUT_MS")}, ${ctx.colors.option("BIRD_COOKIE_TIMEOUT_MS")}, ${ctx.colors.option("BIRD_QUOTE_DEPTH")}`)}`);
  program2.option("--auth-token <token>", "Twitter auth_token cookie").option("--ct0 <token>", "Twitter ct0 cookie").option("--chrome-profile <name>", "Chrome profile name for cookie extraction", ctx.config.chromeProfile).option("--chrome-profile-dir <path>", "Chrome/Chromium profile directory or cookie DB path for cookie extraction", ctx.config.chromeProfileDir).option("--firefox-profile <name>", "Firefox profile name for cookie extraction", ctx.config.firefoxProfile).option("--cookie-timeout <ms>", "Cookie extraction timeout in milliseconds (keychain/OS helpers)").option("--cookie-source <source>", "Cookie source for browser cookie extraction (repeatable)", collectCookieSource).option("--media <path>", "Attach media file (repeatable, up to 4 images or 1 video)", collect).option("--alt <text>", "Alt text for the corresponding --media (repeatable)", collect).option("--timeout <ms>", "Request timeout in milliseconds").option("--quote-depth <depth>", "Max quoted tweet depth (default: 1; 0 disables)").option("--plain", "Plain output (stable, no emoji, no color)").option("--no-emoji", "Disable emoji output").option("--no-color", "Disable ANSI colors (or set NO_COLOR)");
  program2.hook("preAction", (_thisCommand, actionCommand) => {
    ctx.applyOutputFromCommand(actionCommand);
  });
  registerHelpCommand(program2, ctx);
  registerQueryIdsCommand(program2, ctx);
  registerPostCommands(program2, ctx);
  registerReadCommands(program2, ctx);
  registerSearchCommands(program2, ctx);
  registerBookmarksCommand(program2, ctx);
  registerUnbookmarkCommand(program2, ctx);
  registerFollowCommands(program2, ctx);
  registerListsCommand(program2, ctx);
  registerHomeCommand(program2, ctx);
  registerUserCommands(program2, ctx);
  registerUserTweetsCommand(program2, ctx);
  registerNewsCommand(program2, ctx);
  registerCheckCommand(program2, ctx);
  return program2;
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/lib/cli-args.js
var TWEET_URL_REGEX2 = /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/i;
var TWEET_ID_REGEX = /^\d{8,}$/;
function looksLikeTweetInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return TWEET_URL_REGEX2.test(trimmed) || TWEET_ID_REGEX.test(trimmed);
}
function resolveCliInvocation(rawArgs, knownCommands) {
  if (rawArgs.length === 0) {
    return { argv: null, showHelp: true };
  }
  const hasKnownCommand = rawArgs.some((arg) => knownCommands.has(arg));
  if (!hasKnownCommand) {
    const tweetArgIndex = rawArgs.findIndex(looksLikeTweetInput);
    if (tweetArgIndex >= 0) {
      const rewrittenArgs = [...rawArgs];
      rewrittenArgs.splice(tweetArgIndex, 0, "read");
      return { argv: ["node", "bird", ...rewrittenArgs], showHelp: false };
    }
  }
  return { argv: null, showHelp: false };
}

// ../../node_modules/.bun/@steipete+bird@0.8.0/node_modules/@steipete/bird/dist/cli.js
var rawArgs = process.argv.slice(2);
var normalizedArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
var ctx = createCliContext(normalizedArgs);
var program2 = createProgram(ctx);
var { argv, showHelp } = resolveCliInvocation(normalizedArgs, KNOWN_COMMANDS);
if (showHelp) {
  program2.outputHelp();
  process.exit(0);
}
if (argv) {
  program2.parse(argv);
} else {
  program2.parse(["node", "bird", ...normalizedArgs]);
}
