/* global process */

/**
 * A parsed response from user input.
 * 
 * @typedef {(string|number|boolean|undefined)} Answer
 */

/**
 * A condition required for an option to be prompted to the user
 * 
 * @typedef {{ not: Answer }|{ in: Answer[] }|Answer} Condition
 */

/**
 * A function called after requesting confirmation from the user.
 * 
 * @callback confirmCallback
 * @param {Error} [err] - An error describing what went wrong.
 * @param {boolean} [answer] - Whether or not the user confirmed.
 */

/**
 * A function called after all prompts have been made to the user.
 * 
 * @callback donePromptingCallback
 * @param {Error} [err] - An error describing what went wrong.
 * @param {Object.<string, Answer>} [answer] - A collection of responses from the user.
 */

/**
 * A function called to produce a default value for an option.
 * 
 * @callback generateDefault
 * @param {Object.<string, Answer>} partial_answers - The collection of answers that have been accumulated so far
 * @returns {*}
 */

/**
 * A function called to handle user input.
 * 
 * @callback replyCallback
 * @param {string} reply - The raw reply retrieved from the user
 */

/**
 * A collection of configurations and restrictions to be placed on a request for user input.
 * 
 * @typedef {Object} Option
 * @property {String} [message] - A message to display before requesting user input.
 * @property {*|generateDefault} [default] - A value to default to if none is supplied by the user.
 * @property {Object} [depends_on] - Previous answer(s) required to prevent skipping this option.
 * @property {string} [type] - The type of value to validate the response against.
 * @property {Array} [options] - An array of elements containing the only possible valid responses.
 * @property {RegExp} [regex] - A regular expression to validate the response against.
 * @property {boolean} [allow_empty=false] - Whether or not to allow empty responses.
 */

// import readline to simplify i/o interactions with the user
var rl, readline = require('readline');

/**
 * Generates an interface for interacting with the user.
 * 
 * @private
 * @function
 * @name get_interface
 * @param {process.stdin} stdin - A readable stream to listen to
 * @param {process.stdout} [stdout] - writable stream to write data to
 * @returns {readline.Interface}
 */
var get_interface = function(stdin, stdout) {
  // create the interface if it doesn't exist, otherwise resume it
  if (!rl) {
      rl = readline.createInterface(stdin, stdout);
  } else {
      stdin.resume(); // interface exists
  }
  
  return rl;
}

/**
 * Shows the user the given message and prompts them to confirm whether or
 * not its true.
 * 
 * @function
 * @name confirm
 * @param {string} message - A message to display before requesting user input.
 * @param {confirmCallback} callback - The callback to be called after requesting confirmation.
 */
var confirm = exports.confirm = function(message, callback) {

  var question = {
    'reply': {
      type: 'confirm',
      message: message,
      default: 'yes'
    }
  }

  get(question, function(err, answer) {
    if (err) {
        return callback(err);
    }
    
    callback(null, answer.reply === true || answer.reply == 'yes');
  });

};

/**
 * Prompts the user to supply information for each option given. The answers to all the
 * options are then passed to the given callback function.
 * 
 * @function
 * @name get
 * @param {Object.<string, Option>} options - An ordered grouping of options to prompt the user with.
 * @param {donePromptingCallback} callback - The callback called with answers to the given prompts after all prompting has finished.
 */
var get = exports.get = function(options, callback) {

  // no point in continuing
  if (!callback) {
      return;
  }

  if (typeof options != 'object') {
    return callback(new Error("Please pass a valid options object."));
  }

  // collection of answers to build up
  var answers = {};
  
  // list of keys to be present in the answers object
  var fields = Object.keys(options);
  
  var stdin = process.stdin;
  var stdout = process.stdout;

  /**
   * Closes up user i/o and calls the donePromptingCallback with the
   * current collection of answers.
   * 
   * @private
   * @function
   * @name done
   */
  var done = function() {
    close_prompt();
    callback(null, answers);
  }

  /**
   * Pauses input and closes the readline interface
   * 
   * @private
   * @function
   * @name close_prompt
   */
  var close_prompt = function() {
    stdin.pause();
    
    if (!rl) {
        return;
    }
    
    rl.close();
    rl = null;
  }
  
  /**
   * Retrieves the default value for the option with the given key. This is the first of
   * either a function to be called with the given partial answers, the value of the
   * 'default' property of the option, or the option itself.
   * 
   * @private
   * @function
   * @name get_default
   * @param {string} key - The name of the option to retrieve the default value of
   * @param {Object.<string, Answer>} [partial_answers] - The collection of answers that have been accumulated so far
   * @returns {*}
   */
  var get_default = function(key, partial_answers) {
    if (typeof options[key] == 'object')
      return typeof options[key].default == 'function' ? options[key].default(partial_answers) : options[key].default;
    else
      return options[key];
  }
  
  /**
   * Parses the given reply to determine its type, and returns the value of
   * the reply casted to that type.
   * 
   * @private
   * @function
   * @name guess_type
   * @param {string} reply - The raw reply retrieved from the user
   * @returns {Answer}
   */
  var guess_type = function(reply) {

    // check the reply's value and cast it to the according type
    if (reply.trim() == '')
      return;
    else if (reply.match(/^(true|y(es)?)$/))
      return true;
    else if (reply.match(/^(false|n(o)?)$/))
      return false;
    else if ((reply*1).toString() === reply)
      return reply*1;

    return reply;
  }
  
  /**
   * Returns whether or not the given answer is valid for the option
   * with the given key based on the properties of that option.
   * 
   * @private
   * @function
   * @name validate
   * @param {string} key - The name of the option to validate against
   * @param {Answer} answer - The current answer to validate
   * @returns {boolean}
   */
  var validate = function(key, answer) {

    if (typeof answer == 'undefined')
      return options[key].allow_empty || typeof get_default(key) != 'undefined';
    else if(regex = options[key].regex)
      return regex.test(answer);
    else if(options[key].options)
      return options[key].options.indexOf(answer) != -1;
    else if(options[key].type == 'confirm')
      return typeof(answer) == 'boolean'; // answer was given so it should be
    else if(options[key].type && options[key].type != 'password')
      return typeof(answer) == options[key].type;

    return true;

  }

  /**
   * Outputs an error to the user for the option with the given name.
   * 
   * @private
   * @function
   * @name show_error
   * @param {string} key - The name of the option where the error occurred
   */
  var show_error = function(key) {
    var str = options[key].error ? options[key].error : 'Invalid value.';

    if (options[key].options)
        str += ' (options are ' + options[key].options.join(', ') + ')';

    stdout.write("\u001b[31m" + str + "\u001b[0m" + "\n");
  }

  /**
   * Outputs a message to the user for the option with the given name.
   * 
   * @private
   * @function
   * @name show_message
   * @param {string} key - The name of the option to show the message for
   */
  var show_message = function(key) {
    var msg = '';

    if (text = options[key].message)
      msg += text.trim() + ' ';

    if (options[key].options)
      msg += '(options are ' + options[key].options.join(', ') + ')';

    if (msg != '') stdout.write("\u001b[1m" + msg + "\u001b[0m\n");
  }

  /**
   * Waits for the user to enter a password, masking input while they type.
   * Taken from commander lib.
   * 
   * @private
   * @function
   * @name wait_for_password
   * @param {string} prompt - The prompt text describing what the user is to enter.
   * @param {replyCallback} callback - A function to pass the user's response to.
   */
  var wait_for_password = function(prompt, callback) {

    var buf = '',
        mask = '*';

    var keypress_callback = function(c, key) {

      if (key && (key.name == 'enter' || key.name == 'return')) {
        stdout.write("\n");
        stdin.removeAllListeners('keypress');
        // stdin.setRawMode(false);
        return callback(buf);
      }

      if (key && key.ctrl && key.name == 'c')
        close_prompt();

      if (key && key.name == 'backspace') {
        buf = buf.substr(0, buf.length-1);
        var masked = '';
        
        // make the mask size the same as the current number of characters entered
        for (i = 0; i < buf.length; i++) { masked += mask; }
        
        // overwrite with new prompt and mask
        stdout.write('\r\u001b[2K' + prompt + masked);
      } else {
        stdout.write(mask);
        buf += c;
      }

    };

    stdin.on('keypress', keypress_callback);
  }

  /**
   * Checks if the given user response is valid.
   * If so, ask the user the next question.
   * If not, show the error to the user and ask the current question again.
   * 
   * @private
   * @function
   * @name check_reply
   * @param {number} index - The index of the current option
   * @param {string} curr_key - The name of the current option
   * @param {*} fallback - The default value to fall back on when an empty reply is supplied
   * @param {string} reply - The raw reply retrieved from the user
   */
  var check_reply = function(index, curr_key, fallback, reply) {
    // get the answer casted to its type
    var answer = guess_type(reply);
    
    // default to fallback if answer is empty
    var return_answer = (typeof answer != 'undefined') ? answer : fallback;

    if (validate(curr_key, answer))
      next_question(++index, curr_key, return_answer);
    else
      show_error(curr_key) || next_question(index); // repeats current
  }

  /**
   * Determines whether or not the given conditions have been met
   * 
   * @private
   * @function
   * @name dependencies_met
   * @param {Object.<*, Condition>} conds - The collection of conditions that must be met
   * @returns {boolean}
   */
  var dependencies_met = function(conds) {
    // check each condition, returning false if any of them fail
    for (var key in conds) {
      var cond = conds[key];
      if (cond.not) { // object, inverse
        if (answers[key] === cond.not)
          return false;
      } else if (cond.in) { // array 
        if (cond.in.indexOf(answers[key]) == -1) 
          return false;
      } else {
        if (answers[key] !== cond)
          return false; 
      }
    }

    return true;
  }

  /**
   * Prompts the user to answer the next question.
   * 
   * @private
   * @function
   * @name next_question
   * @param {number} index - The index of the option to prompt the user with
   * @param {string} [prev_key] - The name of the previous option
   * @param {*} [answer] - The answer to the previous option
   */
  var next_question = function(index, prev_key, answer) {
    if (prev_key) answers[prev_key] = answer;

    var curr_key = fields[index];
    
    // no more questions, we're done
    if (!curr_key) return done();

    // skip this question if its dependencies haven't been met
    if (options[curr_key].depends_on) {
      if (!dependencies_met(options[curr_key].depends_on))
        return next_question(++index, curr_key, undefined);
    }

    // build the prompt to precede user input
    var prompt = (options[curr_key].type == 'confirm') ?
      ' - yes/no: ' : " - " + curr_key + ": ";

    // get the fallback and add it to the prompt
    var fallback = get_default(curr_key, answers);
    if (typeof(fallback) != 'undefined' && fallback !== '')
      prompt += "[" + fallback + "] ";

    show_message(curr_key);

    // ask the next question (slightly different flow for passwords)
    if (options[curr_key].type == 'password') {

      var listener = stdin._events.keypress; // to reassign down later
      stdin.removeAllListeners('keypress');

      // stdin.setRawMode(true);
      stdout.write(prompt);

      wait_for_password(prompt, function(reply) {
        stdin._events.keypress = listener; // reassign
        check_reply(index, curr_key, fallback, reply)
      });

    } else {

      rl.question(prompt, function(reply) {
        check_reply(index, curr_key, fallback, reply);
      });

    }

  }

  // make an interface to talk to the user with and ask the first question
  rl = get_interface(stdin, stdout);
  next_question(0);

  // handle close requests gracefully
  rl.on('close', function() {
    close_prompt(); // just in case

    var given_answers = Object.keys(answers).length;
    
    // got all the answers, exit silently
    if (fields.length == given_answers) return;

    // didn't make it all the way through, pass info to callback before exitting
    var err = new Error("Cancelled after giving " + given_answers + " answers.");
    callback(err, answers);
  });

}
