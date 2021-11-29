/**
 * Tells us whether a block event is an automated action.
 * Automated action means that the user didn't directly cause the event.
 * Automated actions are internal workings of the VM.
 *
 * @param {BlockEvent} event A block event.
 * @param {Blocks} blocks The Blocks object handling the event.
 * @returns {boolean} True if event is considered an automated, non-user action.
 */
const isAutomatedAction = function (event, blocks) {
    const userActionsThatRecordUndo = [
        'var_create',
        'create',
        'move',
        'delete'
    ]
    if (userActionsThatRecordUndo.includes(event.type) && !event.recordUndo) {
        // No undo recorded on an event that usually records undo.
        // This is a sign that the event was called internally and not directly caused by the user.
        return true;
    }
    return false;

}

/**
 * This function tries to detect when a Blockly event is noise.
 * Events should be considered noise if they are not caused by a user action,
 * represent internal workings or are invalid / malformed.
 *
 * @param {BlockEvent} event Blockly event
 * @param {Blocks} blocks The Blocks object that will receive the event
 * @returns {boolean} True if event is considered noise, false if it isn't
 */
const eventIsNoise = function (event, blocks) {
    if (isAutomatedAction(event, blocks)) return true;
    return false;
};

/**
 * Calls the given function, after a timeout.
 * If this gets called multiple times with the same identifier within the timeout,
 * only the last call will be forwarded.
 * This can be useful when events are called many times in a row,
 * e.g. by gui selectors, where only the final value is relevant for the log.
 * @param {string} identifier A String that is the same for all calls that should be
 *     batched. You could use JSON.stringify({func: function.name, constantParam: constantParam}.
 * @param {number} batchWindow Time in milliseconds to wait before sending batch
 * @param {function} func The function to call, no params, use arrow function for complex calls.
 */
const activeTimeouts = {}
const callBatched = function (identifier, batchWindow, func) {
    // If same function was called recently, cancel that call.
    if (activeTimeouts[identifier]) {
        clearTimeout(activeTimeouts[identifier])
    }
    // Call the func after timeout, add it to activeTimeouts while it's waiting.
    const timeout = setTimeout(() => {
        delete activeTimeouts[identifier]
        func()
    }, batchWindow)
    activeTimeouts[identifier] = timeout
}
module.exports = {
    eventIsNoise: eventIsNoise,
    callBatched: callBatched
};
