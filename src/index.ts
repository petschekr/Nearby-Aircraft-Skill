import * as Alexa from "alexa-sdk";
import * as requester from "request";
const geolib: any = require("geolib");
// For more precise locations
const usZips: any = require("us-zips");
// For more zip code information
const zipcodes: any = require("zipcodes");

const APP_ID: string = "amzn1.ask.skill.d6f99fe1-708e-46a1-b88d-c965145e5d76";
const DYNAMO_TABLE: string = "NearbyAircraftUsers";
const USER_AGENT: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36";
const API_OPTIONS = {
    "url": "https://opensky-network.org/api/states/all",
    "headers": {
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache"
    }
};

interface Location {
    "latitude": number;
    "longitude": number;
    "city": string;
    "state": string;
}
const states = {
    GETLOCATION: "_GETLOCATION"
};

function mainAircraftHandler (zipCode: string | null, cityName: string | null, stateName: string | null, shouldFollowUp: boolean = false) {
    if (zipCode) {
        let foundCoords = usZips[zipCode];
        let zipCodeDetails = zipcodes.lookup(zipCode);
        if (foundCoords === undefined) {
            this.emit(":ask", "Invalid zip code. Please try again.", "Please try again");
        }
        else {
            let location: Location = {
                latitude: foundCoords.lat,
                longitude: foundCoords.lng,
                city: zipCodeDetails.city,
                state: zipCodeDetails.state
            };
            getNearestAircraft(this.emit, location);
            this.handler.state = "";
        }
    }
    else if (cityName && stateName) {
        if (cityName.toLowerCase() === "new york city")
            cityName = "new york";
        let cityDetails = zipcodes.lookupByName(cityName, stateName)[0];
        if (cityDetails === undefined) {
            this.emit(":ask", "Invalid city and state. Please try again.", "Please try again");
        }
        else {
            let location: Location = {
                latitude: cityDetails.latitude,
                longitude: cityDetails.longitude,
                city: cityDetails.city,
                state: cityDetails.state
            };
            getNearestAircraft(this.emit, location);
            this.handler.state = "";
        }
    }
    else {
        if (shouldFollowUp) {
            // Follow up with a request for a location
            this.handler.state = states.GETLOCATION;
            this.emit(":ask", "OK, what zip code or U.S. city and state would you like nearby aircraft for?", "For what zip code or U.S. city and state?");
        }
        else {
            this.emit("Unhandled");
        }
    }
}

const defaultSessionHanders = {
    "LaunchRequest": function () {
        this.handler.state = states.GETLOCATION;
        this.emit(":ask", "What zip code or U.S. city and state would you like nearby aircraft for?", "For what zip code or U.S. city and state?");
    },
    "NearbyAircraft": function () {
        const slots = this.event.request.intent.slots;
        let zipCode: string = slots.ZipCode.value;
        let cityName: string = slots.City.value;
        let stateName: string = slots.State.value;
        mainAircraftHandler.call(this, zipCode, cityName, stateName, true);
    },
    "Location": function () {
        const slots = this.event.request.intent.slots;
        let zipCode: string = slots.ZipCode.value;
        let cityName: string = slots.City.value;
        let stateName: string = slots.State.value;
        mainAircraftHandler.call(this, zipCode, cityName, stateName);
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "Try asking for nearby flights or aircraft. You can also specify a zip code or U.S. city and state in the same request.", "Try asking for nearby flights.");
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", "OK");
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", "OK");
    },
    "Unhandled": function () {
        this.emit(":ask", "Sorry, I didn't get that. Try asking for nearby flights.", "Try asking for nearby flights.");
    }
};
const getLocationHandlers = Alexa.CreateStateHandler(states.GETLOCATION, {
    "NearbyAircraft": function () {
        this.emit("Location");
    },
    "Location": function () {
        const slots = this.event.request.intent.slots;
        let zipCode: string = slots.ZipCode.value;
        let cityName: string = slots.City.value;
        let stateName: string = slots.State.value;
        mainAircraftHandler.call(this, zipCode, cityName, stateName);
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "Say a zip code or U.S. city and state.", "Say a zip code or U.S. city and state.");
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", "OK");
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", "OK");
    },
    "Unhandled": function () {
        this.emit(":ask", "Sorry, I didn't get that. Please say a zip code or U.S. city and state.", "Please say a zip code or U.S. city and state.");
    }
});

function getNearestAircraft (emit: (...params: string[]) => void, location: Location): void {
    requester(API_OPTIONS, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            try {
                let allAircraft: any[] = JSON.parse(body).states;
                // Find the three nearest aircraft with callsigns in a roughly 80km radius
                let sentences: string[] = allAircraft.filter(function (aircraft) {
                    if (!aircraft[6] || !aircraft[5] || aircraft[8] === true)
                        return false;
                    return geolib.getDistanceSimple(
                        { latitude: aircraft[6], longitude: aircraft[5] },
                        { latitude: location.latitude, longitude: location.longitude }
                    ) < 80000;
                }).sort(function (a, b) {
                    let distanceA = geolib.getDistanceSimple(
                        { latitude: a[6], longitude: a[5] },
                        { latitude: location.latitude, longitude: location.longitude }
                    );
                    let distanceB = geolib.getDistanceSimple(
                        { latitude: b[6], longitude: b[5] },
                        { latitude: location.latitude, longitude: location.longitude }
                    );
                    return distanceA - distanceB;
                }).slice(0, 3).map(function (aircraft) {
                    // Turn into sentence
                    let distance: number = geolib.getDistance(
                        { latitude: aircraft[6], longitude: aircraft[5] },
                        { latitude: location.latitude, longitude: location.longitude }
                    );
                    distance /= 1000;
                    distance *= 0.62137119;
                    let bearing: number = geolib.getRhumbLineBearing(
                        { latitude: location.latitude, longitude: location.longitude },
                        { latitude: aircraft[6], longitude: aircraft[5] }
                    );
                    let direction: string = getBearingDirection(bearing);
                    let callsign: string = "Aircraft with no callsign";
                    if (aircraft[1]) {
                        callsign = `<say-as interpret-as="spell-out">${aircraft[1].trim()}</say-as>`;
                    }
                    return `${callsign}, hailing from ${articlizeCountry(aircraft[2])}, is ${distance.toFixed(1)} miles away to the ${direction}, traveling ${!aircraft[10] ? "in an unknown direction" : getBearingDirection(aircraft[10])} at ${aircraft[7] === null ? "unknown altitude" : (Math.floor(Math.round(aircraft[7] * 3.2808399 / 100) * 100).toString() + " feet")}, at ${aircraft[9] === null ? "unknown speed" : (Math.round(aircraft[9] * 2.23693629) + " miles per hour")}`;
                });
                // Alexa doesn't know to pronounce this as a state
                if (location.state === "OK")
                    location.state = "Oklahoma";
                if (sentences.length > 0) {
                    emit(":tell", `For ${location.city}, ${location.state}: ${sentences.join(". ")}`);
                }
                else {
                    emit(":tell", `There are currently no aircraft within 50 miles of ${location.city}, ${location.state}.`);
                }
            }
            catch (e) {
                console.error("Invalid JSON", {
                    error: error,
                    response: response,
                    body: body
                });
                emit(":tell", "Received invalid JSON");
            }
        }
        else {
            console.error({
                error: error,
                response: response,
                body: body
            });
            emit(":tell", "An error occurred");
        }
    });
    function articlizeCountry (country: string): string {
        if (country === "United States" || country === "United Kingdom" || country === "Philippines" || country === "Netherlands" || country === "Czech Republic")
            return "the " + country;
        else
            return country;
    }
    function getBearingDirection (bearing: number): string {
        switch(Math.round(bearing / 22.5)) {
            case 1:
                return "North North East";
            case 2:
                return "North East";
            case 3:
                return "East North East"
            case 4:
                return "East";
            case 5:
                return "East South East";
            case 6:
                return "South East";
            case 7:
                return "South South East";
            case 8:
                return "South";
            case 9:
                return "South South West";
            case 10:
                return "South West";
            case 11:
                return "West South West";
            case 12:
                return "West";
            case 13:
                return "West North West";
            case 14:
                return "North West";
            case 15:
                return "North North West";
            default:
                return "North";
        }
    }
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    //alexa.dynamoDBTableName = DYNAMO_TABLE;
    alexa.registerHandlers(defaultSessionHanders, getLocationHandlers);
    alexa.execute();
};