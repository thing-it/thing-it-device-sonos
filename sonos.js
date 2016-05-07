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
            id: "stopPlayback",
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
            label: "Change Volume"
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
        }, {
            id: "updateInterval",
            label: "Update Interval",
            type: {
                id: "integer"
            },
            defaultValue: 5000
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
var xml2js = require('sonos/node_modules/xml2js');
var SonosLibrary;
var transportModes = {
    stopped: "STOPPED",
    playing: "PLAYING",
    paused: "PAUSED_PLAYBACK",
    transitioning: "TRANSITIONING",
    noMediaPresent: "NO_MEDIA_PRESENT"
};

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

            this.logInfo("Scanning for Sonos hosts started.");
            var sonosSearch = SonosLibrary.search();

            sonosSearch.on('DeviceAvailable', function (sonos) {
                sonos.deviceDescription(function (err, output) {
                    var deferred = q.defer();
                    if (err != null) {
                        this.logInfo("ERROR - " + JSON.stringify(err));
                    }
                    else {
                        this.logInfo("Auto discovered Sonos host " + sonos.host + " with name " + output.roomName
                            + " and friendly name " + output.friendlyName + ".");
                        var sonosSpeaker = new Sonos();
                        sonosSpeaker.id = "sonos" + output.roomName.replace(/\W/g, '');
                        sonosSpeaker.label = "Sonos " + output.roomName;
                        sonosSpeaker.uuid = output.friendlyName;

                        sonosSpeaker.configuration = {
                            host: sonos.host,
                            name: output.roomName,
                        };

                        this.advertiseDevice(sonosSpeaker);
                    }
                    deferred.resolve();
                    return deferred.promise;
                }.bind(this));
            }.bind(this));
        }
    };

    /**
     *
     * @param options
     */
    SonosDiscovery.prototype.stop = function () {
        this.logDebug("Sonos discovery prototype stop called. Doing nothing.");
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
            muted: false,
            artist: null,
            album: null,
            albumArtURI: null
        };

        this.simulationIntervals = [];
        this.intervals = [];

        this.logDebug("Sonos state: " + JSON.stringify(this.state));

        if (this.sonos) {
            this.logInfo("Unexpected Condition: Sonos already exists in prototype start.");//@TODO remove
            this.connect();
            deferred.resolve();
        }
        else {
            if (!this.isSimulated()) {
                this.logInfo("Starting up Sonos.");
                this.started = true;

                if (!SonosLibrary) {
                    SonosLibrary = require("sonos");
                }

                this.configuration.updateInterval =
                    ((this.configuration.updateInterval === undefined || 1000 > this.configuration.updateInterval)
                        ? 1000
                        : this.configuration.updateInterval);

                this.scan();
                deferred.resolve();
            } else {
                this.logInfo("Starting up simulated Sonos.");
                deferred.resolve();
                this.initiateSimulation();
            }
        }

        return deferred.promise;
    };

    Sonos.prototype.stop = function () {
        this.started = false;
        this.logInfo("Stopping Sonos Device " + this.configuration.name + ".");

        for (var interval in this.intervals) {
            clearInterval(interval);
        }

        for (var interval in this.simulationIntervals) {
            clearInterval(interval);
        }

        this.logDebug("Un-registering for zone events.");

        if (this.listener && this.sids && this.sids.length > 0) {
            var sid;
            for (var i in this.sids) {
                sid = this.sids[i];
                this.logDebug("Un-registering sid.", sid);

                try {
                    this.listener.removeService(sid, function (error, data) {
                        if (error){
                            this.logError("Error unregistering event.", error);
                        } else {
                            this.logDebug("Successfully unregistered.");
                        }

                    }.bind(this));
                } catch (e) {
                    this.logError("Error unregistering event.", e);
                }
            }
        }
    }

    /**
     *
     */
    Sonos.prototype.scan = function () {
        this.logInfo("Scanning for Sonos Host " + this.configuration.name + " started.");
        var sonosSearch = SonosLibrary.search();

        sonosSearch.on('DeviceAvailable', function (sonos) {
            var deferred = q.defer();
            this.logDebug("Found Sonos " + sonos.host);

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
                        this.registerEvents();
                    }
                    else {
                        this.logDebug("Ignoring host " + sonos.host + " with room name " + output.roomName
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
    Sonos.prototype.registerEvents = function () {
        this.logDebug("Registering for zone events.");
        var Listener = require('sonos/lib/events/listener');
        this.listener = new Listener(this.sonos);
        this.sids = [];
        this.logDebug("Initiated the listener.");

        this.listener.listen(function (err) {
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
            this.listener.addService('/MediaRenderer/AVTransport/Event', function (error, sid) {
                if (error) {
                    this.logError("Error subscribing to event: " + JSON.stringify(error));
                }
                else {
                    this.logDebug('Successfully subscribed, with subscription id', sid);
                    this.sids.push(sid);
                }
            }.bind(this));


            // register for playback rendering, eg bass, treble, volume and EQ.
            this.listener.addService('/MediaRenderer/RenderingControl/Event', function (error, sid) {
                if (error) {
                    this.logError("Error: " + JSON.stringify(error));
                } else {
                    this.logDebug('Successfully subscribed, with subscription id', sid);
                    this.sids.push(sid);
                }
            }.bind(this));

            this.listener.on('serviceEvent', function (endpoint, sid, data) {
                this.logDebug('Received event from', endpoint, '(' + sid + ').');

                xml2js.parseString(data.LastChange, function (err, event) {
                    try {
                        if ("/MediaRenderer/AVTransport/Event" == endpoint) {
                            try {
                                this.state.currentState = event.Event.InstanceID[0].TransportState[0].$.val;
                                this.logInfo("Notified about current play mode.", this.state.currentState);
                                this.publishStateChange();
                            } catch (e) {
                                this.logDebug("No transport state.", endpoint);
                            }

                            var currentTrackMetaDataXML;
                            try {
                                currentTrackMetaDataXML = event.Event.InstanceID[0].CurrentTrackMetaData[0].$.val;
                            } catch (e) {
                                this.logDebug("No track meta data.", endpoint);
                            }

                            if (currentTrackMetaDataXML) {
                                xml2js.parseString(currentTrackMetaDataXML, function (err, trackMetaData) {
                                    if (!err) {
                                        try {
                                            this.state.currentTrack = trackMetaData["DIDL-Lite"].item[0]["dc:title"][0];
                                            this.state.artist = trackMetaData["DIDL-Lite"].item[0]["dc:creator"][0];
                                            this.state.album = trackMetaData["DIDL-Lite"].item[0]["upnp:album"][0];
                                            this.state.albumArtURI = trackMetaData["DIDL-Lite"].item[0]["upnp:albumArtURI"][0];
                                        } catch (e) {
                                            this.logError("Error reading track meta data.", e);
                                        }

                                        this.logInfo("Notified about current track.", this.state.currentTrack,
                                            this.state.artist, this.state.album);
                                        this.logDebug("Album Art URI", this.state.albumArtURI);
                                        this.publishStateChange();
                                    }
                                    else {
                                        this.logError("Error parsing event from", endpoint, '(' + sid + ').', e);
                                    }
                                }.bind(this));
                            }
                        } else if ("/MediaRenderer/RenderingControl/Event" == endpoint) {
                            try {
                                this.state.muted = (event.Event.InstanceID[0].Mute[0].$.val == 1) ? true : false;
                                this.logInfo("Muted", this.state.muted);
                            } catch (e) {
                                this.logDebug("No mute state.", endpoint);
                            }

                            try {
                                this.state.volume = parseInt(event.Event.InstanceID[0].Volume[0].$.val);
                                this.logInfo("Volume", this.state.volume);
                            } catch (e) {
                                this.logDebug("No volume state.", endpoint);
                            }

                            this.publishStateChange();
                        }
                    } catch (e) {
                        this.logError("Could not handle event from", endpoint, '(' + sid + ').');
                        this.logError(e);
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));

        this.logDebug("Done registering events.");
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
        this.logDebug("Sonos play called");

        if (!this.isSimulated()) {
            this.sonos.play(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }
        else {
            this.state.currentState = transportModes.playing;
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.pause = function () {
        if (!this.isSimulated()) {
            this.sonos.pause(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }
        else {
            this.state.currentState = transportModes.paused;
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.stopPlayback = function () {
        if (!this.isSimulated()) {
            this.sonos.stop(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }
        else {
            this.state.currentState = transportModes.stopped;
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.next = function () {
        if (!this.isSimulated()) {
            this.sonos.next(function (err, data) {
                // no need to do anything, really.
            }.bind(this));

            this.publishStateChange();
        }
        else {
            this.simulateNextSong();
        }


    };

    /**
     *
     *
     */
    Sonos.prototype.previous = function () {
        if (!this.isSimulated()) {
            this.sonos.previous(function (err, data) {
                // no need to do anything
            }.bind(this));

            this.publishStateChange();
        }
        else {
            this.simulatePreviousSong()
        }

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
                this.logDebug("Setting mute to " + muteOpposite);
                this.sonos.setMuted(muteOpposite, function (err, data) {
                });
            }.bind(this))
        }
        else {
            this.state.muted = !this.state.muted;
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.isPlaying = function () {
        return ((this.state.currentState == "playing") || (this.state.currentState == "transitioning"));
    }

    /**
     *
     *
     */
    Sonos.prototype.isPaused = function () {
        return (this.state.currentState == transportModes.paused);
    }

    /**
     *
     *
     */
    Sonos.prototype.isStopped = function () {
        return (this.state.currentState == transportModes.stopped);
    }

    /**
     *
     *
     */
    Sonos.prototype.isMuted = function () {
        return this.state.muted;
    }

    /**
     *
     *
     */
    Sonos.prototype.changeVolume = function (parameters) {
        this.logDebug("Sonos changeVolume called");
        this.setVolume(parameters.level);
    };

    Sonos.prototype.setVolume = function (volume) {
        this.logDebug("Sonos setVolume called");
        this.state.volume = volume;

        if (!this.isSimulated()) {
            this.sonos.setVolume(this.state.volume, function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }

        this.publishStateChange();
    }

    /**
     *
     *
     */
    Sonos.prototype.initiateSimulation = function () {
        this.state = {
            currentTrack: null,
            currentState: "playing",
            volume: 23,
            muted: false,
            artist: null,
            album: null,
            albumArtURI: null
        };

        this.simulationData = {
            songNr: 0,
            songs: [{
                currentTrack: "My Other Love",
                artist: "Pretty Lights",
                album: "Filling Up The City Skies",
                albumArtURI: "http://cont-sv5-1.pandora.com/images/public/amz/8/0/1/6/900006108_500W_500H.jpg"
            }, {
                currentTrack: "Rainy Streets",
                artist: "Blue In Green",
                album: "The Break Of Dawn",
                albumArtURI: "http://cont-sjl-1.pandora.com/images/public/amz/8/0/1/0/885007210108_500W_500H.jpg"
            }, {
                currentTrack: "Ike's Mood I",
                artist: "Visioneers",
                album: "Dirty Old Hip-Hop",
                albumArtURI: "http://cont-2.p-cdn.com/images/public/amz/2/2/1/7/730003107122_500W_500H.jpg"
            }]
        };

        this.simulateSong(0);

        // Simulating song changes every 15 seconds, but only if playing
        this.simulationIntervals.push(setInterval(function () {
            if (this.isPlaying()) {
                this.simulateNextSong();
            }
        }.bind(this), 15000));
    }

    /**
     *
     *
     */
    Sonos.prototype.simulatePreviousSong = function () {
        this.logDebug("Simulating previous song.");

        if (this.simulationData.songNr == 0) {
            this.simulationData.songNr = (this.simulationData.songs.length - 1);
        }
        else {
            this.simulationData.songNr--;
        }

        this.simulateSong(this.simulationData.songNr);
    }

    /**
     *
     *
     */
    Sonos.prototype.simulateNextSong = function () {
        this.logDebug("Simulating next song.");

        if (this.simulationData.songNr < (this.simulationData.songs.length - 1)) {
            this.simulationData.songNr++;
        }
        else {
            this.simulationData.songNr = 0;
        }

        this.simulateSong(this.simulationData.songNr);
    }

    /**
     *
     *
     */
    Sonos.prototype.simulateSong = function (index) {
        this.logDebug("Simulating song change to ", this.simulationData.songs[index]);
        this.state.currentTrack = this.simulationData.songs[index].currentTrack;
        this.state.artist = this.simulationData.songs[index].artist;
        this.state.album = this.simulationData.songs[index].album;
        this.state.albumArtURI = this.simulationData.songs[index].albumArtURI;
        this.publishStateChange();
    }

}
