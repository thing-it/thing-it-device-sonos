var assert = require("assert");

describe('[thing-it] Sonos Plugin', function () {
    var testDriver;

    before(function () {
        testDriver = require("thing-it-test").createTestDriver({logLevel: "error"});

        testDriver.registerDevicePlugin(__dirname + "/../sonos");
    });
    describe('Start Configuration', function () {
        this.timeout(5000);

        it('should complete without error', function () {
            return testDriver.start({
                configuration: require("../examples/configuration.js"),
                heartbeat: 10
            });
        });
    });
});





