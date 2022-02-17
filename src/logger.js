/**
 * Log user events
 * Author: goessm
 */
const ws = require('./logging-websocket');
const extractor = require('./logging-data-extractor');
const denoiser = require('./denoiser');

const eventLog = [];

let sendBuffer = [];

/**
 * Call when a user event occurs to add it to log.
 * @param {string} eventType String description of event type
 * @param {object} eventData Additional event data
 * @param {string | null} jsonString Optional string representation of the scratch runtime (code state)
 */
const logUserEvent = function (eventType, eventData, jsonString) {
    const time = new Date().getTime();
    const logItem = {
        timestamp: time,
        userId: ws.getUserId(),
        taskId: ws.getTaskId(),
        type: eventType,
        data: eventData,
        codeState: jsonString ? {json: jsonString} : null
    };
    console.log(`logging user action: ${logItem.type}`);
    console.log(logItem);
    eventLog.push(logItem);

    if (logItem.type === 'greenFlag') {
        this.sendLog();
    }
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
 * @param {string} jsonString String representation of the serialized scratch runtime
 */
const logListenEvent = function (event, blocks, jsonString) {
    if (denoiser.eventIsNoise(event, blocks)) {
        return; // Event is considered noise, ignore
    }
    // Get event type and relevant data using extractor
    const extractionResult = extractor.extractEventData(event, blocks);

    if (ignoredBlockEventTypes.includes(extractionResult.eventType)) {
        return; // Ignored event type
    }

    if (extractionResult.eventType === 'change') {
        // Batch rapid change events together
        const batchId = {type: extractionResult.eventType, blockId: extractionResult.eventData.blockId}
        _logUserEventBatched(extractionResult.eventType, extractionResult.eventData, jsonString, batchId, 800);
    } else {
        this.logUserEvent(extractionResult.eventType, extractionResult.eventData, jsonString);
    }
};

/**
 * Log control events like greenFlag and stopAll.
 * Currently acts same as logUserEvent, just here to make it easier to change control event behaviour.
 * @param {string} type Event type
 * @param {Object} data Additional event data
 * @param {string | null} jsonString Optional string representation of the scratch runtime (code state)
 */
const logControlEvent = function (type, data, jsonString) {
    this.logUserEvent(type, data, jsonString);
}

/**
 * Log a Gui event.
 * Event types containing 'change' will be batched based on the data.target and data.property fields.
 * @param {String} type
 * @param {object} data
 */
const logGuiEvent = function (type, data) {
    // Noise / Bug Info: When you hit enter to confirm a text edit change, the change handler is called twice!
    // This is probably because both the 'enter' key event and onBlur happen and call the handler.
    // This is a bug in scratch-gui (it also calls the vm functions twice, e.g. renameSprite).
    //
    // Here this get handled by batching, so we don't have to worry about it.

    // Batch change events together to prevent event spam by selectors, and the blur-bug.
    if (type.includes('change')) {
        const batchId = {type: type, target: data.target, prop: data.property}
        _logUserEventBatched(type, data, null, batchId, 400);
    } else {
        // No batching, just call logUserEvent.
        this.logUserEvent(type, data, null);
    }
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

    this.logGuiEvent(type, data, null);
}

/**
 * Convenience function to call logGuiEvent for a sprite_change event
 * @param {String} spriteId
 * @param {String} property
 * @param {any} newValue
 * @param {Runtime} runtime
 * @param {string} jsonString String representation of the serialized scratch runtime
 */
const logSpriteChange = function (spriteId, property, newValue) {
    this.logGuiEvent('sprite_change', { spriteId: spriteId, property: property, newValue: newValue });
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

/**
 * Calls logUserEvent using denoiser.callBatched to batch together rapid calls.
 * @param {string} eventType String description of event type
 * @param {object} eventData Additional event data
 * @param {string | null} jsonString Optional string representation of the scratch runtime (code state)
 * @param {object} batchId Calls with same batchId object get batched together. Gets JSON.stringify()-ed.
 * @param batchWindow Time in ms for batch window
 * @private
 */
const _logUserEventBatched = function (eventType, eventData, jsonString, batchId, batchWindow) {
    batchId.function = 'logUserEvent'
    batchId = JSON.stringify(batchId)
    denoiser.callBatched(batchId, batchWindow, () => {
        module.exports.logUserEvent(eventType, eventData, jsonString);
    });
};

module.exports = {
    sendLog: sendLog,
    logListenEvent: logListenEvent,
    logUserEvent: logUserEvent,
    logControlEvent: logControlEvent,
    logGuiEvent: logGuiEvent,
    logCostumeEvent: logCostumeEvent,
    logSpriteChange: logSpriteChange,
    getEventLog: getEventLog
};
