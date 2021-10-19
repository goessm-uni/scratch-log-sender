/**
 * Log user events
 * Author: goessm
 */
const ws = require('./logging-websocket');
const extractor = require('./logging-data-extractor');

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
    // console.log(`logging user action: ${eventType}`);
    const time = new Date().getTime();
    const actionLog = {
        timestamp: time,
        type: eventType,
        data: eventData,
        codeState: extractor.extractCodeState(runtime)
    };
    eventLog.push(actionLog);
};

/**
 * Call when a user key / mouse event occurs to add it to log.
 * @param {string} eventType String description of event type
 * @param {object} eventData Additional event data
 * @param {object} codeState The _blocks object representing the current code state
 */
// eslint-disable-next-line no-unused-vars
const logUserKeyEvent = function (_eventType, _eventData) {
    // Ignore key events for now
    return;
};

/**
 * Call with a blockly listen event. Extracts relevant information then logs a user event.
 * Tries to filter noise / non-user events.
 * @param {Blockly.Event} event A Blockly listen event
 * @param {Blocks} blocks Blocks object
 */
const logListenEvent = function (event, blocks) {
    const eventData = extractor.extractEventData(event, blocks);
    logUserEvent(event.type, eventData, blocks.runtime);
};

/**
 * Send current log buffer over websocket connection
 */
const sendLog = function () {
    if (eventLog.length === 0 && sendBuffer.length === 0) return;
    if (!ws.isOpen()) {
        console.log('tried to send log, but ws connection not ready.');
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
    logUserKeyEvent: logUserKeyEvent,
    getEventLog: getEventLog
};
