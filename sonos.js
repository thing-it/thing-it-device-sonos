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
                id: "string"
            }
        }, {
            id: "artist",
            label: "Artist",
            type: {
                id: "string"
            }
        }, {
            id: "album",
            label: "Album",
            type: {
                id: "string"
            }
        }, {
            id: "albumArtURI",
            label: "Album Art URI",
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
        }, {
            id: "changeVolume",
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
            currentState: null,
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
        this.logInfo("Scanning for Sonos Host " + this.configuration.name + " started.");
        var sonosSearch = SonosLibrary.search();

        sonosSearch.on('DeviceAvailable', function (sonos) {
            var deferred = q.defer();
            this.logInfo("Found Sonos " + sonos.host);

            sonos.deviceDescription(function (err, output) {
                var deferred = q.defer();
                if (err != null) {
                    this.logInfo("ERROR - " + JSON.stringify(err));
                }
                else {
                    if (output.roomName === this.configuration.name) {
                        this.logInfo("Found matching host with name " + output.roomName + " and friendly name "
                            + output.friendlyName);
                        this.sonos = sonos;
                        this.description = output;
                        this.connect();
                    }
                    else {
                        this.logInfo("Ignoring host " + sonos.host + " with room name " + output.roomName
                            + " and friendly name " + output.friendlyName);
                    }
                }
                deferred.resolve();
                return deferred.promise;
            }.bind(this));

            deferred.resolve();
            return deferred.promise;
        }.bind(this));
    };

    /**
     *
     */
    Sonos.prototype.readStatus = function () {
        var deferred = q.defer();
        this.sonos.getCurrentState(function (err, state) {
            this.state.currentState = state;
            this.logDebug("Current State: " + this.state.currentState);
        }.bind(this));

        this.sonos.getMuted(function (err, muted) {
            this.state.muted = muted;
            this.logDebug("Muted: " + this.state.muted);
        }.bind(this))

        this.sonos.currentTrack(function (err, track) {
            this.state.currentTrack = track.title,
            this.state.artist = track.artist,
            this.state.album = track.album,
            this.state.albumArtURI = track.albumArtURI
            this.logDebug("Current State: ", this.state);
        }.bind(this));

        this.sonos.getVolume(function (err, volume) {
            this.state.volume = volume;
            this.logDebug("Current Volume: " + this.state.volume);
        }.bind(this));

        this.logInfo("Current Track: ", this.state.currentTrack, " Volume: ", this.state.volume, " State: ", this.state.currentState);
        this.publishStateChange();
        deferred.resolve();
        return deferred.promise;
    }

    /**
     *
     */
    Sonos.prototype.registerEvents = function () {
        this.logDebug("Registering for zone events.");
        var Listener = require('sonos/lib/events/listener');
        var listener = new Listener(this.sonos);
        this.logDebug("Initiated the listener.");

        listener.listen(function (err) {
            if (err) throw err;

            /**
             * TODO: Add services for:
             * - /MediaServer/ConnectionManager/Event
             *      UPnP standard connection manager service for the media server.
             * - /MediaRenderer/ConnectionManager/Event
             *      UPnP standard connection manager service for the media renderer.
             * - /MediaRenderer/Queue/Event
             *      Sonos queue service, for functions relating to queue management, saving
             *      queues etc.
             * - /MediaRenderer/GroupRenderingControl/Control
             *      Sonos group rendering control service, for functions relating to
             *      group volume etc.
             * - /ZoneGroupTopology/Event
             *      Notification about zone changes
             */

                // Register for play, pause, etc.
            listener.addService('/MediaRenderer/AVTransport/Event', function (error, sid) {
                if (error) {
                    this.logInfo("Error: " + JSON.stringify(error));
                    throw error;
                }
                this.logInfo('Successfully subscribed, with subscription id', sid);
            }.bind(this));

            listener.on('serviceEvent', function (endpoint, sid, data) {
                this.logDebug('Received transport event from', endpoint, '(' + sid + ').');

                this.readStatus();
                /*
                 xml2js = require('sonos/node_modules/xml2js');

                 xml2js.parseString(data.LastChange, function (err, avTransportEvent) {

                 try {
                 var currentTrackMetaDataXML = avTransportEvent.Event.InstanceID[0].CurrentTrackMetaData[0].$.val;
                 } catch (e) {
                 this.logError("Could not handle event from", endpoint, '(' + sid + ').');
                 }

                 xml2js.parseString(currentTrackMetaDataXML, function (err, trackMetaData) {
                 if(!err){
                 this.logInfo("Notified about current track: " + trackMetaData["DIDL-Lite"].item[0]["dc:title"][0]);
                 this.state.currentTrack = trackMetaData["DIDL-Lite"].item[0]["dc:title"][0];
                 this.publishStateChange();
                 }
                 else {
                 this.logError("Error parsing event from", endpoint, '(' + sid + ').');
                 }
                 }.bind(this));
                 }.bind(this));
                 */
            }.bind(this));

            // register for playback rendering, eg bass, treble, volume and EQ.
            listener.addService('/MediaRenderer/RenderingControl/Event', function (error, sid) {
                if (error) {
                    this.logError("Error: " + JSON.stringify(error));
                    throw error;
                }
                this.logInfo('Successfully subscribed, with subscription id', sid);
            }.bind(this));

            listener.on('serviceEvent', function (endpoint, sid, data) {
                this.logDebug('Received playback rendering event from', endpoint, '(' + sid + ').');
                this.readStatus();
            }.bind(this));

        }.bind(this));

        this.logInfo("Done registering events.");
    }

    /**
     *
     */
    Sonos.prototype.connect = function () {
        this.readStatus();
        this.registerEvents();
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
        this.logDebug("Sonos mute called");

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

    /**
     *
     *
     */
    Sonos.prototype.changeVolume = function (volume) {
        this.logDebug("Sonos changeVolume called");

        this.state.volume = volume;

        if (!this.isSimulated()) {
            this.sonos.setVolume(this.state.volume, function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }

        this.publishStateChange();
    };

}
