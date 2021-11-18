/**
 * Log user events
 * Author: goessm
 */
const ws = require('./logging-websocket');
const extractor = require('./logging-data-extractor');
const denoiser = require('./denoiser');

const eventLog = [];
const sendInterval = 10000;

let sendBuffer = [];

/**
 * Call when a user event occurs to add it to log.
 * @param {string} eventType String description of event type
 * @param {object} eventData Additional event data
 * @param {Runtime} runtime The Scratch VM runtime for code state extraction
 */
const logUserEvent = function (eventType, eventData, runtime) {
    const time = new Date().getTime();
    const actionLog = {
        timestamp: time,
        type: eventType,
        data: eventData,
        codeState: runtime ? extractor.extractCodeState(runtime) : null
    };
    // console.log(`logging user action: ${eventType}`);
    // console.log(eventData)
    eventLog.push(actionLog);
};

/**
 * Call with a blockly listen event. Extracts relevant information then logs a user event.
 * Tries to filter noise / non-user events.
 * @param {Blockly.Event} event A Blockly listen event
 * @param {Blocks} blocks Blocks object
 */
const logListenEvent = function (event, blocks) {
    if (denoiser.eventIsNoise(event, blocks)) {
        // Event is considered noise, ignore
        return;
    }
    const extractorResult = extractor.extractEventData(event, blocks);

    // console.log(event)
    logUserEvent(extractorResult.eventType, extractorResult.eventData, blocks.runtime);
};

/**
 * Log control events like greenFlag and stopAll
 * @param {string} type Event type
 * @param {Runtime} runtime The scratch VM runtime
 */
const logControlEvent = function (type, runtime) {
    // console.log(type)
    logUserEvent(type, null, runtime);
}

/**
 * Send current log buffer over websocket connection
 */
const sendLog = function () {
    if (eventLog.length === 0 && sendBuffer.length === 0) return;
    if (!ws.isOpen()) {
        // console.log('tried to send log, but ws connection not ready.');
        return;
    }
    // Move actions from log to buffer
    sendBuffer.push(...eventLog);
    eventLog.length = 0;

    const messageSent = ws.sendActions(sendBuffer); // Send actions
    if (messageSent) sendBuffer = []; // Clear buffer
};

const getEventLog = function () {
    return eventLog;
};

/* Send log every interval */
const _intervalID = setInterval(sendLog, sendInterval);

module.exports = {
    logListenEvent: logListenEvent,
    logUserEvent: logUserEvent,
    logControlEvent: logControlEvent,
    getEventLog: getEventLog
};
