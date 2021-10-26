/**
 * This function mirrors the structure of Blocks.blocklyListen in the VM.
 * It tells us whether the VM filters the event as invalid or irrelevant.
 * This filters very rare edge case events.
 *
 * @param {Blockly.Event} e Blockly listen event
 * @param {Blocks} blocks The blocks object that will receive this event
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

const isAutomatedAction = function (event, blocks) {
    const userActionsThatRecordUndo = [
        'create',
        'move',
        'delete'
    ]
    if (userActionsThatRecordUndo.includes(event.type) && !event.recordUndo) {
        // No undo recorded on an action that usually records undo
        // This is a sign that the action was called internally and not caused by the user
        return true;
    }
    return false;

}

/**
 * This function tries to detect when a Blockly event is noise.
 * Events should be considered noise if they are not caused by a user action,
 * represent internal events or are invalid / malformed.
 * @param {Blockly.Event} event Blockly event
 * @param {Blocks} blocks The Blocks object that will receive the event
 * @returns {boolean} True if event is considered noise, false if it isn't
 */
const eventIsNoise = function (event, blocks) {
    if (vmIgnoresEvent(event, blocks)) return true;
    if (isAutomatedAction(event, blocks)) return true;
    return false;
};

module.exports = {
    eventIsNoise: eventIsNoise
};
