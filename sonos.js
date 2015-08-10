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
            id: "currentState",
            label: "Current State",
            type: {
                id: "integer"
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
            id: "stop",
            label: "Stop"
        }, {
            id: "mute",
            label: "Mute"
        }, {
            id: "next",
            label: "Next"
        }, {
            id: "previous",
            label: "Previous"
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

        this.logInfo("Sonos state: " + JSON.stringify(this.state));//@TODO remove

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

                deferred.resolve();
            }
        }

        return deferred.promise;
    };

    /**
     *
     */
    Sonos.prototype.scan = function () {
        this.logInfo("\tScanning for Sonos Host " + this.configuration.host + " started.");

        var sonosSearch = SonosLibrary.search();
        this.logInfo("Passed library search.")

        sonosSearch.on('DeviceAvailable', function (sonos) {
            var deferred = q.defer();
            this.logInfo("Found Sonos " + sonos.host);

            this.sonos = sonos;

            this.sonos.deviceDescription(function (err, output) {

                if (err != null) {
                    this.logInfo("ERROR - " + JSON.stringify(err));

                    if (sonos.host === this.configuration.host) {
                        this.logInfo("Matching Sonos Host found: " + sonos.host);

                        this.sonos = sonos;
                        this.connect();
                    }
                    else {
                        this.logInfo("Ignoring host " + this.sonos.host);
                        this.sonos = null;
                    }
                }
                else {
                    if (output.roomName === this.configuration.name) {
                        this.logInfo("Found matching host with name " + output.roomName + " at IP " + sonos.host);
                        this.description = output;
                        this.connect();

                    }
                    else {
                        this.logDebug("Ignoring host " + sonos.host + " with room name " + output.roomName);
                        this.sonos=null;
                    }


                }

            }.bind(this));

            deferred.resolve();
            return deferred.promise;
        }.bind(this));
    };

    /**
     *
     */
    Sonos.prototype.connect = function () {
        this.logInfo("Connecting Sonos Device ", this.description.friendlyName);

        this.sonos.getCurrentState(function (err, track) {
            this.state.currentState = track;
            this.logInfo("Current State: " + this.state.currentState);
        }.bind(this));

        this.sonos.getMuted(function (err, muted) {
            this.state.muted = muted;
            this.logInfo("Muted: " + this.state.muted);
        }.bind(this))

        this.sonos.currentTrack(function (err, track) {
            this.state.currentTrack = track.title;
            this.logInfo("Current Track: " + this.state.currentTrack);
        }.bind(this));

        this.sonos.getVolume(function (err, volume) {
            this.state.volume = volume;
            this.logInfo("Current Volume: " + this.state.volume);
        }.bind(this));

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
            this.sonos.play(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
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
            this.sonos.pause(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.stop = function () {
        this.logInfo("Sonos stop called");//@TODO remove

        if (!this.isSimulated()) {
            this.sonos.stop(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.next = function () {
        this.logInfo("Sonos next called");//@TODO remove

        if (!this.isSimulated()) {
            this.sonos.next(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.previous = function () {
        this.logInfo("Sonos previous called");//@TODO remove

        if (!this.isSimulated()) {
            this.sonos.previous(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
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
            this.sonos.getMuted(function (err, muted) {
                var muteOpposite = !muted;
                this.logInfo("Setting mute to " + muteOpposite);
                this.sonos.setMuted(muteOpposite, function (err, data) {
                });
            }.bind(this))
        }

        this.publishStateChange();
    };

}
