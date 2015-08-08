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
var SonosLibrary;
//var noble = require('noble');

function SonosDiscovery() {
    /**
     *
     * @param options
     */
    SonosDiscovery.prototype.start = function () {
        if (this.node.isSimulated()) {
        } else {
            if (!SonosLibrary) {
                SonosLibrary = require("sonos");
            }

            this.logInfo("Sonos discovery prototype start called. Doing nothing.");//@TODO remove
        }
    };

    /**
     *
     * @param options
     */
    SonosDiscovery.prototype.stop = function () {
        this.logInfo("Sonos discovery prototype stop called. Doing nothing.");//@TODO remove
    };
}

/**
 *
 */
function Sonos() {
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

        this.logInfo("Sonos state: %s.", this.state);//@TODO remove

        if (this.sonos) {
            this.logInfo("Sonos already exists in prototype start - really unexpected!");//@TODO remove
            this.connect();

            deferred.resolve();
        }
        else {
            if (!this.isSimulated()) {
                this.logInfo("Sonos start called for reals...");//@TODO remove
                this.started = true;

                if (!SonosLibrary) {
                    SonosLibrary = require("sonos");

                    this.scan();
                }

                deferred.resolve();
            } else {
                this.logInfo("Sonos simulation mode not implemented.")
            }
        }

                return deferred.promise;
    };

    /**
     *
     */
    Sonos.prototype.scan = function(){
        this.logInfo("\tScanning for Sonos Host " + this.configuration.host + " started.");

        SonosLibrary.search(function(sonos) {
            this.logInfo('Found Sonos \'%s\'', sonos.host);

            if (sonos.host === this.configuration.host) {
                this.logInfo("\nMatching Sonos Host found.");

                this.sonos = sonos;
                this.connect();
            }

        }.bind(this));
    };

    /**
     *
     */
    Sonos.prototype.connect = function(){
        this.logInfo("Sonos conneccccccccttttiiiinnnng!!!!");//@TODO remove
    }

    /**
     *
     */
    Sonos.prototype.setState = function (state) {
        this.state = state;

        this.publishStateChange();
    };

    /**
     *
     */
    Sonos.prototype.getState = function () {
        return this.state;
    };

    /**
     *
     *
     */
    Sonos.prototype.play = function () {
        this.logInfo("Sonos play called");//@TODO remove

        if (!this.isSimulated()) {
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.pause = function () {
        this.logInfo("Sonos pause called");//@TODO remove

        if (!this.isSimulated()) {
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.mute = function () {
        this.logInfo("Sonos mute called");//@TODO remove

        if (!this.isSimulated()) {
        }

        this.publishStateChange();
    };

}
