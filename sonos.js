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
                        sonosSpeaker.id = output.roomName.replace(/\W/g, '');
                        sonosSpeaker.label = output.roomName;
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
        //@TODO unregister services
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

    Sonos.prototype.stop = function (){
        this.started = false;
        this.logInfo("Stopping Sonos Device " + this.configuration.name + ".");

        for (var interval in this.intervals){
            clearInterval(interval);
        }

        for (var interval in this.simulationIntervals){
            clearInterval(interval);
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
                        this.connect();
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
            if (track) {
                this.state.currentTrack = track.title,
                    this.state.artist = track.artist,
                    this.state.album = track.album,
                    this.state.albumArtURI = track.albumArtURI
                this.logDebug("Current State: ", this.state);
            }
        }.bind(this));

        this.sonos.getVolume(function (err, volume) {
            this.state.volume = volume;
            this.logDebug("Current Volume: " + this.state.volume);
        }.bind(this));

        this.logDebug("Current Track: ", this.state.currentTrack, " Volume: ", this.state.volume, " State: ", this.state.currentState);
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
                    this.logError("Error subscribing to event: " + JSON.stringify(error));
                }
                else {
                    this.logDebug('Successfully subscribed, with subscription id', sid);
                }
            }.bind(this));

            // register for playback rendering, eg bass, treble, volume and EQ.
            listener.addService('/MediaRenderer/RenderingControl/Event', function (error, sid) {
                if (error) {
                    this.logError("Error: " + JSON.stringify(error));
                    throw error;
                }
                this.logDebug('Successfully subscribed, with subscription id', sid);
            }.bind(this));

            listener.on('serviceEvent', function (endpoint, sid, data) {
                this.logDebug('Received event from', endpoint, '(' + sid + ').');

                this.readStatus();
                /* The following code only works for AVTransport events
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
        }.bind(this));

        this.logDebug("Done registering events.");
        this.intervals.push(setInterval(Sonos.prototype.readStatus.bind(this), 1000));
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
        this.logDebug("Sonos play called");

        if (!this.isSimulated()) {
            this.sonos.play(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }
        else {
            this.state.currentState = "playing";
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.pause = function () {
        this.logDebug("Sonos pause called");//@TODO remove

        if (!this.isSimulated()) {
            this.sonos.pause(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }
        else {
            this.state.currentState = "paused";
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.stop = function () {
        this.logDebug("Sonos stop called");

        if (!this.isSimulated()) {
            this.sonos.stop(function (err, data) {
                // no need to do anything, really.
            }.bind(this));
        }
        else {
            this.state.currentState = "stopped";
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.next = function () {
        this.logDebug("Sonos next called");//@TODO remove

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
        this.logDebug("Sonos previous called");//@TODO remove

        if (!this.isSimulated()) {
            this.sonos.previous(function (err, data) {
                // no need to do anything
            }.bind(this));

            this.publishStateChange();
        }
        else{
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
        else{
            this.state.muted = !this.state.muted;
        }

        this.publishStateChange();
    };

    /**
     *
     *
     */
    Sonos.prototype.isPlaying = function(){
        return ((this.state.currentState == "playing") || (this.state.currentState == "transitioning"));
    }

    /**
     *
     *
     */
    Sonos.prototype.isPaused = function(){
        return (this.state.currentState == "paused");
    }

    /**
     *
     *
     */
    Sonos.prototype.isStopped = function(){
        return (this.state.currentState == "stopped");
    }

    /**
     *
     *
     */
    Sonos.prototype.isMuted = function(){
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

    Sonos.prototype.setVolume = function(volume){
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
    Sonos.prototype.initiateSimulation = function(){
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
            if (this.isPlaying()){
                this.simulateNextSong();
            }
        }.bind(this), 15000));
    }

    /**
     *
     *
     */
    Sonos.prototype.simulatePreviousSong = function() {
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
    Sonos.prototype.simulateNextSong = function() {
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
    Sonos.prototype.simulateSong = function(index){
        this.logDebug("Simulating song change to ", this.simulationData.songs[index]);
        this.state.currentTrack = this.simulationData.songs[index].currentTrack;
        this.state.artist = this.simulationData.songs[index].artist;
        this.state.album = this.simulationData.songs[index].album;
        this.state.albumArtURI = this.simulationData.songs[index].albumArtURI;
        this.publishStateChange();
    }

}
