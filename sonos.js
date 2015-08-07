module.exports = {
    metadata: {
        family: "sonos",
        plugin: "sonos",
        label: "Sonos",
        tangible: true,
        discoverable: true,
        state: [{
            id: "currentTrack",
            label: "Current Track",
            type: {
                id: "string"
            }
        }, {
            id: "volume",
            label: "Volume",
            type: {
                id: "integer"
            }
        }, {
            id: "muted",
            label: "Muted",
            type: {
                id: "boolean"
            }
        }],
        actorTypes: [],
        sensorTypes: [],
        services: [{
            id: "play",
            label: "Play"
        }, {
            id: "pause",
            label: "Pause"
        }, {
            id: "mute",
            label: "Mute"
        }],
        configuration: [{
            id: "simulated",
            label: "Simulated",
            type: {
                id: "boolean"
            }
        }, {
            id: "host",
            label: "Host",
            type: {
                id: "string"
            }
        }, {
            id: "name",
            label: "Name",
            type: {
                id: "string"
            }
        }]
    },

    create: function (device) {
        return new Sonos();
    },
    discovery: function (options) {
        var discovery = new SonosDiscovery();

        discovery.options = options;

        return discovery;
    }
};

var q = require('q');
var Sonos;
//var noble = require('noble');

function SonosDiscovery() {
    /**
     *
     * @param options
     */
    SonosDiscovery.prototype.start = function () {
        if (this.node.isSimulated()) {
        } else {
            if (!Sonos) {
                Sonos = require("sonos");
            }

            console.log("Prototype start called. Doing nothing.");//@TODO remove
        }
    };

    /**
     *
     * @param options
     */
    SonosDiscovery.prototype.stop = function () {
        console.log("Prototype stop called. Doing nothing.");//@TODO remove
    };
}

/**
 *
 */
function SonosDevice() {
    /**
     *
     */
    Sonos.prototype.start = function () {
        var deferred = q.defer();

        this.state = {
            currentTrack: null,
            volume: 0,
            muted: false
        };

        console.log("Sonos state: %s.", this.state);//@TODO remove

        if (this.sonos) {
            console.log("Sonos already exists in prototype start - really unexpected!");//@TODO remove
            this.connect();

            deferred.resolve();
        }
        else {
            if (!this.isSimulated()) {
                console.log("Sonos start called for reals...");//@TODO remove
                this.started = true;

                if (!Sonos) {
                    Sonos = require("sonos");

                    this.scan();
                }

                deferred.resolve();
            } else {
                console.log("Sonos simulation mode not implemented.")
            }
        }

                return deferred.promise;
    };

    /**
     *
     */
    SonosDevice.prototype.scan = function(){
        console.log("\tScanning for Sonos Host " + this.configuration.host + " started.");

        Sonos.search.(function(sonos) {
            console.log('Found Sonos \'%s\'', sonos.host);

            if (sonos.host === this.configuration.host) {
                console.log("\nMatching Sonos Host found.");

                this.sonos = sonos;
                this.connect();
            }

        }.bind(this));
    };

    /**
     *
     */
    SonosDevice.prototype.connect = function(){
        console.log("Sonos conneccccccccttttiiiinnnng!!!!");//@TODO remove
    }

    /**
     *
     */
    SonosDevice.prototype.setState = function (state) {
        this.state = state;

        this.publishStateChange();
    };

    /**
     *
     */
    SonosDevice.prototype.getState = function () {
        return this.state;
    };

    /**
     *
     *
     */
    SonosDevice.prototype.play = function () {
        console.log("Sonos play called");//@TODO remove

        if (!this.isSimulated()) {
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    SonosDevice.prototype.pause = function () {
        console.log("Sonos pause called");//@TODO remove

        if (!this.isSimulated()) {
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    SonosDevice.prototype.mute = function () {
        console.log("Sonos mute called");//@TODO remove

        if (!this.isSimulated()) {
        }

        this.publishStateChange();
    };

}
