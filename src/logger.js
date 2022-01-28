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
 * @param {Runtime} runtime The Scratch VM runtime for code state extraction
 */
const logUserEvent = function (eventType, eventData, runtime) {
    const time = new Date().getTime();
    const logItem = {
        timestamp: time,
        userId: ws.getUserId(),
        taskId: ws.getTaskId(),
        type: eventType,
        data: eventData,
        codeState: runtime ? extractor.extractCodeState(runtime) : null
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
    console.log(event)

    // Use this to call the exported property instead of function directly, allows stubbing in tests
    this.logUserEvent(extractionResult.eventType, extractionResult.eventData, blocks.runtime);
};

/**
 * Log control events like greenFlag and stopAll
 * @param {string} type Event type
 * @param {Runtime} runtime The scratch VM runtime
 * @param {String | null} projectJSON Optional current project.json string, specify to save json state.
 */
const logControlEvent = function (type, runtime, projectJSON = null) {
    if (projectJSON) {
        this.logUserEvent(type, {json: projectJSON}, runtime);
    } else {
        this.logUserEvent(type, null, runtime);
    }
}

/**
 * Log a Gui event.
 * Event types containing 'change' will be batched based on the data.target and data.property fields.
 * @param {String} type
 * @param {object} data
 * @param {Runtime} runtime
 */
const logGuiEvent = function (type, data, runtime) {
    // Noise / Bug Info: When you hit enter to confirm a text edit change, the change handler is called twice!
    // This is probably because both the 'enter' key event and onBlur happen and call the handler.
    // This is a bug in scratch-gui (it also calls the vm functions twice, e.g. renameSprite).
    //
    // Here this get handled by batching, so we don't have to worry about it.

    // Batch change events together to prevent event spam by selectors, and the blur-bug.
    const batchWindow = 400;
    if (type.includes('change')) {
        const funcIdentifier = JSON.stringify({func: logUserEvent.name, target: data.target, prop: data.property})
        denoiser.callBatched(funcIdentifier, batchWindow, () => {
            this.logUserEvent(type, data, runtime)
        });
    } else {
        // No batching, just call logUserEvent.
        this.logUserEvent(type, data, runtime);
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

    this.logGuiEvent(type, data, runtime);
}

/**
 * Convenience function to call logGuiEvent for a sprite_change event
 * @param {String} spriteId
 * @param {String} property
 * @param {any} newValue
 * @param {Runtime} runtime
 */
const logSpriteChange = function (spriteId, property, newValue, runtime) {
    this.logGuiEvent('sprite_change', { spriteId: spriteId, property: property, newValue: newValue }, runtime);
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
