exports.CleanUp = function CleanUp(callback) {
    // catch ctrl+c event and exit normally if the returned
    //value was true, otherwise we will keep it running
    //so something can keep going until finished.
    process.on('SIGINT', function() {
        if(callback())
            process.exit(2);
        else
            console.log('Stopping stopped.'.red);
    });

    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function(e) {
        console.log('Uncaught Exception...');
        console.log(e.stack);
        process.exit(99);
        callback();
    });
};
