var reply = require('./..');

var options = {
	input: {
        message: "Say something!"
    }
}

function requestInput() {
    reply.get(options, function(err, answers){
        console.log("\nYour response was parsed as '" + answers.input + "' which is of type '" + typeof answers.input + "'");
    });
}

requestInput();
