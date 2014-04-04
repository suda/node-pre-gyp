
/**
 * Module exports.
 */

module.exports = exports;

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , nopt = require('nopt')
  , log = require('npmlog')
  , child_process = require('child_process')
  , EE = require('events').EventEmitter
  , inherits = require('util').inherits
  , commands = [
      'clean',
      'install',
      'reinstall',
      'build',
      'rebuild',
      'package',
      'testpackage',
      'publish',
      'unpublish',
      'info',
      'testbinary'
    ]
  , aliases = {
    }

// differentiate node-pre-gyp's logs from npm's
log.heading = 'node-pre-gyp'

exports.find = require('./pre-binding').find;

exports.errorMessage = errorMessage;

function errorMessage(prog) {
  var os = require('os')
  log.error('System', os.type() + ' ' + os.release())
  log.error('command', process.argv
            .map(JSON.stringify).join(' '))
  log.error('cwd', process.cwd())
  log.error('node -v', process.version)
  log.error(process.title+' -v', 'v' + prog.package.version)
}

exports.install = function(opts) {
    var completed2 = false;
    function run2() {
      var command = prog.todo.shift()
      if (!command) {
        // done!
        completed = true
        log.info('ok')
        return
      }
      prog.commands[command.name](command.args, function (err) {
        if (err) {
          log.error(command.name + ' error')
          log.error('stack', err.stack)
          errorMessage(prog)
          log.error('not ok')
          return process.exit(1)
        }
        var args_array = [].slice.call(arguments, 1)
        if (args_array.length) {
          console.log.apply(console, args_array)
        }
        process.nextTick(run2)
      })
    }
    var prog = new Run()
    var args = ['node','node-pre-gyp','install'];
    prog.parseArgv(args);
    // turn ops into parseable command line-like arguments
    Object.keys(opts).forEach(function(o) {
        prog.opts[o] = opts[o];
        //args.push('--' + o + '=' + val);
    });
    run2();
}

function Run() {
  var self = this

  this.commands = {}

  commands.forEach(function (command) {
    self.commands[command] = function (argv, callback) {
      log.verbose('command', command, argv)
      return require('./' + command)(self, argv, callback)
    }
  })
}
inherits(Run, EE)
exports.Run = Run
var proto = Run.prototype

/**
 * Export the contents of the package.json.
 */

proto.package = require('../package')

/**
 * nopt configuration definitions
 */

proto.configDefs = {
    help: Boolean     // everywhere
  , arch: String      // 'configure'
  , debug: Boolean    // 'build'
  , directory: String // bin
  , proxy: String     // 'install'
  , loglevel: String  // everywhere
}

/**
 * nopt shorthands
 */

proto.shorthands = {
    release: '--no-debug'
  , C: '--directory'
  , debug: '--debug'
  , j: '--jobs'
  , silly: '--loglevel=silly'
  , verbose: '--loglevel=verbose'
}

/**
 * expose the command aliases for the bin file to use.
 */

proto.aliases = aliases

/**
 * Parses the given argv array and sets the 'opts',
 * 'argv' and 'command' properties.
 */

proto.parseArgv = function parseOpts (argv) {
  this.opts = nopt(this.configDefs, this.shorthands, argv)
  this.argv = this.opts.argv.remain.slice()

  var commands = this.todo = []

  // create a copy of the argv array with aliases mapped
  argv = this.argv.map(function (arg) {
    // is this an alias?
    if (arg in this.aliases) {
      arg = this.aliases[arg]
    }
    return arg
  }, this)

  // process the mapped args into "command" objects ("name" and "args" props)
  argv.slice().forEach(function (arg) {
    if (arg in this.commands) {
      var args = argv.splice(0, argv.indexOf(arg))
      argv.shift()
      if (commands.length > 0) {
        commands[commands.length - 1].args = args
      }
      commands.push({ name: arg, args: [] })
    }
  }, this)
  if (commands.length > 0) {
    commands[commands.length - 1].args = argv.splice(0)
  }

  // support for inheriting config env variables from npm
  var npm_config_prefix = 'npm_config_'
  Object.keys(process.env).forEach(function (name) {
    if (name.indexOf(npm_config_prefix) !== 0) return
    var val = process.env[name]
    if (name === npm_config_prefix + 'loglevel') {
      log.level = val
    } else {
      // add the user-defined options to the config
      name = name.substring(npm_config_prefix.length)
      // avoid npm argv clobber already present args
      // which avoids problem of 'npm test' calling
      // script that runs unique npm install commands
      if (name === 'argv') {
         if (this.opts.argv &&
             this.opts.argv.remain &&
             this.opts.argv.remain.length) {
            // do nothing
         } else {
            this.opts[name] = val
         }
      } else {
        this.opts[name] = val
      }
    }
  }, this)

  if (this.opts.loglevel) {
    log.level = this.opts.loglevel
  }
  log.resume()
}

/**
 * Returns the usage instructions for node-pre-gyp.
 */

proto.usage = function usage () {
  var str = [
      ''
    , '  Usage: node-pre-gyp <command> [options]'
    , ''
    , '  where <command> is one of:'
    , commands.map(function (c) {
        return '    - ' + c + ' - ' + require('./' + c).usage
      }).join('\n')
    , ''
    , 'node-pre-gyp@' + this.version + '  ' + path.resolve(__dirname, '..')
    , 'node@' + process.versions.node
  ].join('\n')
  return str
}

/**
 * Version number getter.
 */

Object.defineProperty(proto, 'version', {
    get: function () {
      return this.package.version
    }
  , enumerable: true
})

