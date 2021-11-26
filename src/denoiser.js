/**
 * Tells us whether the VM filters the event.
 * This function mirrors the structure of Blocks.blocklyListen in the VM.
 * This filters rare edge case events that are considered invalid or irrelevant.
 *
 * @param {BlockEvent} e A block event.
 * @param {Blocks} blocks The blocks object that will receive this event.
 * @returns {boolean} True if the event gets ignores by the blocks object. False if it gets used.
 */
const vmIgnoresEvent = function (e, blocks) {
    if (typeof e !== 'object') return true;

    switch (e.type) {
        case 'delete':
            // Delete event for missing block or shadow block
            if (!blocks._blocks.hasOwnProperty(e.blockId) ||
                blocks._blocks[e.blockId].shadow) {
                return true;
            }
            break;
        case 'var_create':
            if (!(e.isLocal && blocks.editingTarget && !blocks.editingTarget.isStage && !e.isCloud)) {
                if (blocks.runtime.getTargetForStage().lookupVariableById(e.varId)) {
                    //variable already exists
                    return true;
                }
                const allTargets = blocks.runtime.targets.filter(t => t.isOriginal);
                for (const target of allTargets) {
                    if (target.lookupVariableByNameAndType(e.varName, e.varType, true)) {
                        // variable name conflict
                        return true;
                    }
                }
            }
            break;
        case 'comment_change':
        case 'comment_move':
        case 'comment_delete':
            const target = blocks.runtime.getEditingTarget();
            if (target && !target.comments.hasOwnProperty(e.commentId)) {
                // comment doesn't exist
                return true;
            }
            if (e.type == 'comment_delete' && e.blockId && !target.blocks.getBlock(e.blockId)) {
                // referenced block doesn't exist
                return true;
            }
    }
    // VM doesn't filter event
    return false;
}

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
    if (vmIgnoresEvent(event, blocks)) return true;
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
