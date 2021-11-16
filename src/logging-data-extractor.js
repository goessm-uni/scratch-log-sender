const htmlparser2 = require('htmlparser2');

/**
 * The data object to add extracted data to.
 * @typedef {Object} EventData
 */

/**
 * A Blockly event, emitted from scratch-blocks.
 * @typedef {Object} BlockEvent
 */

/**
 * The Blocks object, from scratch-vm.
 * @typedef {Object} Blocks
 */

/**
 * The Runtime object, from scratch-vm.
 * @typedef {Object} Runtime
 */

/**
 * Extract data from a Create event.
 * @param {EventData} data This object will be altered to add data!
 * @param {BlockEvent} event Will only act on Create events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractCreate = function (data, event, blocks) {
    if (event.type !== 'create') return
    // For create events, we cannot get the block from blocks.getBlock, as it hasn't been created yet.
    // We can get it from event.xml instead.
    const html = event.xml?.outerHTML
    if (!html) return
    const html_doc = htmlparser2.parseDocument(html, {decodeEntities: true})
    const blockData = html_doc.children[0]?.attribs
    if (!blockData) return
    data.blockType = blockData.type
    data.blockId = blockData.id
}

/**
 * Extract data from a UI event.
 * @param {EventData} data This object will be altered to add data!
 * @param {BlockEvent} event Will only act on UI events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractUi = function (data, event, blocks) {
    if (event.type != 'ui') return
    data.element = event.element
    switch (event.element) {
        case 'selected':
            // TODO match data definition
            data.newValue = event.newValue
            data.oldValue = event.oldValue
            data.recordUndo = event.recordUndo
            data.workspaceId = event.workspaceId
    }
}

/**
 * Extract data from a comment event.
 * @param {EventData} data This object will be altered to add data!
 * @param {BlockEvent} event Will only act on Comment events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractComment = function (data, event, blocks) {
    if (!event.type.startsWith('comment')) return
    data.commentId = event.commentId

    if (event.type === 'comment_change') {
        data.newContents_ = event.newContents_
        data.oldContents_ = event.oldContents_
    }

    if (event.type === 'comment_delete')  {
        data.text = event.text
    }
}

/**
 * Extract data from a Var event.
 * @param {EventData} data This object will be altered to add data!
 * @param {BlockEvent} event Will only act on Var events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractVar = function (data, event, blocks) {
    if (!event.type.startsWith('var')) return
    data.varId = event.varId

    if (event.type === 'var_create' || event.type === 'var_delete') {
        data.isCloud = event.isCloud
        data.isLocal = event.isLocal
        data.varName = event.varName
        data.vartype = event.vartype
    }

    if (event.type === 'var_rename') {
        data.newName = event.newName
        data.oldName = event.oldName
    }
}

const eventExtractors = [
    extractCreate,
    extractUi,
    extractComment,
    extractVar,
]

/**
 * Extracts the desired data from the current state of the Scratch runtime.
 *
 * @param {Runtime} runtime The Scratch VM runtime.
 * @returns {[]} Array of Sprite objects containing the _blocks block state.
 */
const extractCodeState = function (runtime) {
    if (!runtime) return [];
    const sprites = [];
    for (const target of runtime.targets) {
        if (!target?.sprite) continue;
        const sprite = {};
        sprite.name = target.sprite.name;
        sprite.id = target.id;
        sprite._blocks = target.sprite.blocks._blocks;
        sprites.push(sprite);
    }
    return sprites;
};

/**
 * Extracts desired data from Block event
 * @param {BlockEvent} event A Block event
 * @param {Blocks} blocks Blocks object where the event occurred
 * @returns {{}} Event data
 */
const extractEventData = function (event, blocks) {
    // console.log(event.type)
    // console.log(event)
    // console.log(blocks)
    const data = {};
    const block = blocks.getBlock?.(event.blockId);
    if (block) {
        data.blockType = block.opcode;
        data.blockId = event.blockId;
    }

    // Call all extract methods, they will add type specific data to the data object based on event.type.
    for (let eventExtractor of eventExtractors) {
        eventExtractor(data, event, blocks)
    }

    return data;
};

module.exports = {
    extractEventData: extractEventData,
    extractCodeState: extractCodeState
};
