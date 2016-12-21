import * as Alexa from "alexa-sdk";
import * as requester from "request";

const APP_ID: string = "";
const DYNAMO_TABLE: string = "NearbyAircraftUsers";
const USER_AGENT: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36";

interface Location {
    "lat": number;
    "long": number;
}
const states = {
    SETLOCATION: "_SETLOCATION"
};

const defaultSessionHanders = {
    "LaunchRequest": function () {
        this.handler.state = "";
        
        if (!this.attributes.location) {
            // User hasn't set a location yet
            this.handler.state = states.SETLOCATION;
            this.emit(":ask", "What zip code or U.S. city would you like to set as your location? I'll save this so you won't have to tell me again.", "Please say a zip code or U.S. city.");
        }
        else {
            let location: Location = this.attributes.location;
            this.emit(":ask", "Which Georgia Tech bus route would you like the ETA for?", "Which bus route?");
        }
    },
        /*
        var slots = this.event.request.intent.slots;
        var emit = this.emit;
        if (slots.Bus.value && getBusRoute(slots.Bus.value) === null) {
            // Invalid bus route
            this.emit(":ask", "That's not a valid bus route. Please try again.", "Please try again.");
            return;
        }
        var filter = !!slots.Bus.value ? getBusRoute(slots.Bus.value) : null;
        getAlerts(filter, function (err, messageTexts) {
            if (err) {
                emit(":tell", err);
                console.warn(err);
                return;
            }
            if (messageTexts.length > 0) {
                messageTexts.unshift("Here are the current service alerts for " + (!!filter ? "the " + getSpokenBusName(filter) : "all routes") + ":");
            }
            else {
                messageTexts.push("There are no current service alerts" + (!!filter ? " for the " + getSpokenBusName(filter) : ""));
            }
            emit(":tell", messageTexts.join(" ").replace(/&/g, " and "));
        });
    },*/
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "You can ask for nearby flights or aircraft. You can also set your location for quicker responses.", "Try asking for nearby flights.");
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

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.dynamoDBTableName = 
    alexa.registerHandlers(defaultSessionHanders);
    alexa.execute();
};