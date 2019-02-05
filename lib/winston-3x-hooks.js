const cycle = require('cycle');

//
// ### function clone (obj)
// #### @obj {Object} Object to clone.
// Helper method for deep cloning pure JSON objects
// i.e. JSON objects that are either literals or objects (no Arrays, etc)
//
module.exports.clone = function (obj) {
  if (obj instanceof Error) {
    // With potential custom Error objects, this might not be exactly correct,
    // but probably close-enough for purposes of this lib.
    var copy = { message: obj.message };
    Object.getOwnPropertyNames(obj).forEach(function (key) {
      copy[key] = obj[key];
    });

    return cycle.decycle(copy);
  }
  else if (!(obj instanceof Object)) {
    return obj;
  }
  else if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  return clone(cycle.decycle(obj));
};

//
// ### function log (options)
// #### @options {Object} All information about the log serialization.
// Generic logging function for returning timestamped strings
// with the following options:
//
//    {
//      level:     'level to add to serialized message',
//      message:   'message to serialize',
//      meta:      'additional logging metadata to serialize',
//      colorize:  false, // Colorizes output (only if `.json` is false)
//      align:     false  // Align message level.
//      timestamp: true   // Adds a timestamp to the serialized message
//      label:     'label to prepend the message'
//    }
//
module.exports.log = function (options) {
  var timestampFn = typeof options.timestamp === 'function'
    ? options.timestamp
    : exports.timestamp,
    timestamp   = options.timestamp ? timestampFn() : null,
    showLevel   = options.showLevel === undefined ? true : options.showLevel,
    meta        = options.meta !== null && options.meta !== undefined
      ? exports.clone(options.meta)
      : options.meta || null,
    output;

  //
  // raw mode is intended for outputing winston as streaming JSON to STDOUT
  //
  if (options.raw) {
    if (typeof meta !== 'object' && meta != null) {
      meta = { meta: meta };
    }
    output         = exports.clone(meta) || {};
    output.level   = options.level;
    //
    // Remark (jcrugzz): This used to be output.message = options.message.stripColors.
    // I do not know why this is, it does not make sense but im handling that
    // case here as well as handling the case that does make sense which is to
    // make the `output.message = options.message`
    //
    output.message = options.message.stripColors
      ? options.message.stripColors
      : options.message;

    return JSON.stringify(output);
  }

  //
  // json mode is intended for pretty printing multi-line json to the terminal
  //
  if (options.json || true === options.logstash) {
    if (typeof meta !== 'object' && meta != null) {
      meta = { meta: meta };
    }

    output         = exports.clone(meta) || {};
    output.level   = options.level;
    output.message = output.message || '';

    if (options.label) { output.label = options.label; }
    if (options.message) { output.message = options.message; }
    if (timestamp) { output.timestamp = timestamp; }

    if (options.logstash === true) {
      // use logstash format
      var logstashOutput = {};
      if (output.message !== undefined) {
        logstashOutput['@message'] = output.message;
        delete output.message;
      }

      if (output.timestamp !== undefined) {
        logstashOutput['@timestamp'] = output.timestamp;
        delete output.timestamp;
      }

      logstashOutput['@fields'] = exports.clone(output);
      output = logstashOutput;
    }

    if (typeof options.stringify === 'function') {
      return options.stringify(output);
    }

    return JSON.stringify(output, function (key, value) {
      return value instanceof Buffer
        ? value.toString('base64')
        : value;
    });
  }

  //
  // Remark: this should really be a call to `util.format`.
  //
  if (typeof options.formatter == 'function') {
    options.meta = meta || options.meta;
    if (options.meta instanceof Error) {
      // Force converting the Error to an plain object now so it
      // will not be messed up by decycle() when cloning options
      options.meta = exports.clone(options.meta);
    }
    return String(options.formatter(exports.clone(options)));
  }

  output = timestamp ? timestamp + ' - ' : '';
  if (showLevel) {
    output += options.colorize === 'all' || options.colorize === 'level' || options.colorize === true
      ? config.colorize(options.level)
      : options.level;
  }

  output += (options.align) ? '\t' : '';
  output += (timestamp || showLevel) ? ': ' : '';
  output += options.label ? ('[' + options.label + '] ') : '';
  output += options.colorize === 'all' || options.colorize === 'message'
    ? config.colorize(options.level, options.message)
    : options.message;

  if (meta !== null && meta !== undefined) {
    if (typeof meta !== 'object') {
      output += ' ' + meta;
    }
    else if (Object.keys(meta).length > 0) {
      if (typeof options.prettyPrint === 'function') {
        output += ' ' + options.prettyPrint(meta);
      } else if (options.prettyPrint) {
        output += ' ' + '\n' + util.inspect(meta, false, options.depth || null, options.colorize);
      } else if (
        options.humanReadableUnhandledException
        && Object.keys(meta).length >= 5
        && meta.hasOwnProperty('date')
        && meta.hasOwnProperty('process')
        && meta.hasOwnProperty('os')
        && meta.hasOwnProperty('trace')
        && meta.hasOwnProperty('stack')) {

        //
        // If meta carries unhandled exception data serialize the stack nicely
        //
        var stack = meta.stack;
        delete meta.stack;
        delete meta.trace;
        output += ' ' + exports.serialize(meta);

        if (stack) {
          output += '\n' + stack.join('\n');
        }
      } else {
        output += ' ' + exports.serialize(meta);
      }
    }
  }

  return output;
};

function clone(obj) {
  //
  // We only need to clone reference types (Object)
  //
  var copy = Array.isArray(obj) ? [] : {};

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (Array.isArray(obj[i])) {
        copy[i] = obj[i].slice(0);
      }
      else if (obj[i] instanceof Buffer) {
        copy[i] = obj[i].slice(0);
      }
      else if (typeof obj[i] != 'function') {
        copy[i] = obj[i] instanceof Object ? exports.clone(obj[i]) : obj[i];
      }
      else if (typeof obj[i] === 'function') {
        copy[i] = obj[i];
      }
    }
  }

  return copy;
}