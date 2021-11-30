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
    console.log(`logging user action: ${eventType}`);
    console.log(eventData)
    eventLog.push(actionLog);
};

// List of block event types that are ignored by the logger.
const ignoredBlockEventTypes = [
    'ui_click'
]

/**
 * Call with a blockly listen event. Extracts relevant information then logs a user event.
 * Tries to filter noise / non-user events.
 * @param {BlockEvent} event A scratch-blocks Blockly event
 * @param {Blocks} blocks Blocks object
 */
const logListenEvent = function (event, blocks) {
    if (denoiser.eventIsNoise(event, blocks)) {
        // Event is considered noise, ignore
        return;
    }
    const extractionResult = extractor.extractEventData(event, blocks);

    if (ignoredBlockEventTypes.includes(extractionResult.eventType)) {
        // Ignored event type
        return;
    }
    // console.log(event.type)
    // console.log(event)
    logUserEvent(extractionResult.eventType, extractionResult.eventData, blocks.runtime);
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

const logGuiEvent = function (type, data, runtime) {
    logUserEvent(type, data, runtime)
}

/**
 * Log a GUI event that involves changes to costume or backdrop.
 * @param {String} type
 * @param {Object} data
 * @param {Runtime} runtime
 */
const logCostumeEvent = function (type, data, runtime) {
    // Sprite and Stage are both Targets.
    // Stage backdrop changes are handled the same as costume changes.
    // We check if sprite is stage to record backdrop events.
    if (data.target && runtime && (runtime.getTargetForStage().id === data.target)) {
        // backdrop event
        type = type.replace('costume_', 'backdrop_')
    }

    // For change events prevent double log (enter-blur bug), or excessive changes by batching.
    if (type.includes('change')) {
        const funcIdentifier = JSON.stringify({func: logGuiEvent.name, target: data.target, prop: data.property})
        denoiser.callBatched(funcIdentifier, 500, () => {
            logGuiEvent(type, data, runtime)
        })
    } else {
        logGuiEvent(type, data, runtime)
    }
}

const logSpriteChange = function (spriteId, property, newValue, runtime) {
    // Noise Warn: When you hit enter to confirm a text edit change, the change handler is called twice!
    // This is probably because both the 'enter' key event and onBlur happen and call the handler.
    // This can be considered a bug in scratch-gui (it also calls the vm functions twice, e.g. renameSprite).
    //
    // You could handle it by storing the last props, and if they haven't changed discard the event.
    // Here this get handled by batching anyway, so we don't have to worry about it.

    const type = 'sprite_change'
    // Rapid GUI change events of same type get batched into one, because some selectors fire a lot of events.
    const funcIdentifier = JSON.stringify({func: logGuiEvent.name, type: type, property: property})
    denoiser.callBatched(funcIdentifier, 250, () => {
        logGuiEvent(type, { spriteId: spriteId, property: property, newValue: newValue }, runtime)
    })
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
    logGuiEvent: logGuiEvent,
    logCostumeEvent, logCostumeEvent,
    logSpriteChange: logSpriteChange,
    getEventLog: getEventLog
};
