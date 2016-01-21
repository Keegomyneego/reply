var reply = require('./../');

function proceed() {
    reply.confirm('Would you like to continue?', function(err, yes){
        if (!err && yes) {
            doubleCheck(proceed, proceed);
        } else {
            doubleCheck(leave, proceed);
        }
    });
}

function doubleCheck(doit, bail) {
    reply.confirm('Are you sure?', function(err, yes){
        if (!err && yes) {
            doit();
        } else {
            bail();
        }
    });
}

function leave() {
    console.log("Okay bye!");
}

proceed();
