const htmlparser2 = require('htmlparser2');

/**
 * The result of the event data extraction.
 * @typedef {Object} ExtractionResult
 * @property {String} eventType - The type of user event, inferred from the event.
 * @property {Object} eventData - The data object containing info about the event.
 */

/**
 * The data object to add extracted data to.
 * @typedef {Object} EventData
 */

/**
 * A Blockly event, emitted from scratch-blocks.
 * @typedef {Object} BlockEvent
 * @property {String} type
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
 * @param {BlockEvent} event Will only act on Create events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 * @returns {?ExtractionResult} The result of extraction, or null if event was of wrong type.
 */
const extractCreate = function (event, blocks) {
    if (event.type !== 'create') return null

    const data = _getBlockDataFromEvent(event, blocks) // Sets data.blockId and data.blockType

    // For create events, we cannot get the block from blocks.getBlock, as it hasn't been created yet.
    // We can get it from event.xml instead.
    const html = event.xml?.outerHTML
    if (!html) return null
    const html_doc = htmlparser2.parseDocument(html, {decodeEntities: false})
    console.log(html_doc)

    // Get data of head block.
    const mainBlock = html_doc.children[0]
    if (mainBlock.name !== 'block') return null
    data.blockType = mainBlock.attribs?.type
    data.blockId = mainBlock.attribs?.id

    // Create events may include multiple blocks created at the same time.
    // We check for child blocks and save them in data.children
    let hasNext = true
    let current_block_doc = mainBlock
    let children = []
    while (hasNext) {
        // Handle multiple blocks created.
        hasNext = false // Terminate loop unless block found.
        for (const child of current_block_doc.children) {
            // If a child with name "next" exists, then there is a child block.
            if (child.name === 'next') {
                // Get child block (which is grandchild of last block, structure: block -> next -> block...).
                // There should always be just one child here, but we loop for safety.
                for (const grandchild of child.children) {
                    if (grandchild.name === 'block') {
                        // This is the doc for the next block. Save it then restart the loop from here.
                        const child_block = grandchild
                        children.push({
                            blockId: child_block.attribs?.id,
                            blockType: child_block.attribs?.type
                        })
                        current_block_doc = child_block
                        hasNext = true
                    }
                }
            }
        }
    }

    // Children: Array of child blocks if multiple blocks were created.
    // Array order corresponds to position in single-line block hierarchy.
    // Empty if a single block was created.
    data.children = children

    return {
        eventType: event.type,
        eventData: data
    }
}

/**
 * Extract data from a UI event.
 * @param {BlockEvent} event Will only act on UI events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractUi = function (event, blocks) {
    if (event.type !== 'ui') return null

    const data = _getBlockDataFromEvent(event, blocks) // Sets data.blockId and data.blockType
    let eventType = event.type

    data.element = event.element
    // Update event type based on element
    if (data.element) { eventType = event.type + "_" + event.element }

    // Update event data based on element
    switch (data.element) {
        case 'selected':
            data.newValue = event.newValue
            data.oldValue = event.oldValue

            const oldBlock = blocks.getBlock?.(event.oldValue);
            data.oldBlockType = (oldBlock) ? oldBlock.opcode : null
            const newBlock = blocks.getBlock?.(event.newValue);
            data.newBlockType = (newBlock) ? newBlock.opcode : null
            break;
    }

    return {
        eventType: eventType,
        eventData: data
    }
}

/**
 * Extract data from a comment event.
 * @param {BlockEvent} event Will only act on Comment events.
 * @param {Blocks} _blocks The Blocks object where the event occurred.
 */
const extractComment = function (event, _blocks) {
    if (!event.type.startsWith('comment')) return null

    const data = _getBlockDataFromEvent(event, blocks) // Sets data.blockId and data.blockType

    data.commentId = event.commentId

    if (event.type === 'comment_change') {
        data.newContents_ = event.newContents_
        data.oldContents_ = event.oldContents_
    }

    if (event.type === 'comment_delete')  {
        data.text = event.text
    }

    return {
        eventType: event.type,
        eventData: data
    }
}

/**
 * Extract data from a Var event.
 * @param {BlockEvent} event Will only act on Var events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractVar = function (event, blocks) {
    if (!event.type.startsWith('var')) return null

    const data = _getBlockDataFromEvent(event, blocks) // Sets data.blockId and data.blockType
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
        // Rename event doesn't include isLocal, so we infer it like scratch-vm does.
        if (blocks.runtime?.getEditingTarget().variables.hasOwnProperty(event.varId)) {
            data.isLocal = true
        } else {
            data.isLocal = false
        }
    }

    return {
        eventType: event.type,
        eventData: data
    }
}

/**
 * Extract data from a Drag event.
 * @param {BlockEvent} event Will only act on endDrag and dragOutside events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractDrag = function (event, blocks) {
    if (event.type !== 'endDrag' && event.type !== 'dragOutside') return null

    const data = _getBlockDataFromEvent(event, blocks) // Sets data.blockId and data.blockType
    data.isOutside = event.isOutside

    return {
        eventType: event.type,
        eventData: data
    }
}

/**
 * Extract data from a Change event.
 * @param {BlockEvent} event Will only act on change events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractChange = function (event, blocks) {
    if (event.type !== 'change') return null

    const data = _getBlockDataFromEvent(event, blocks) // Sets data.blockId and data.blockType
    if (event.element === 'field') {
        data.field = event.name
        data.oldValue = event.oldValue
        data.newValue = event.newValue
    }

    return {
        eventType: event.type,
        eventData: data
    }
}

const eventExtractors = [
    extractCreate,
    extractUi,
    extractComment,
    extractVar,
    extractDrag,
    extractChange,

]

/**
 * Helper function for extractors. Gets blockId and blockType from event if possible.
 * @param event
 * @param blocks
 * @returns {{}} data object containing blockId and blockType if they exist.
 */
const _getBlockDataFromEvent = function (event, blocks) {
    const data = {}
    if (event.blockId) {
        data.blockId = event.blockId
        const block = blocks.getBlock?.(event.blockId)
        if (block) { data.blockType = block.opcode }
    }
    return data
}


/**
 * Extracts the desired data from the current state of the Scratch runtime.
 *
 * @param {Runtime} runtime The Scratch VM runtime.
 * @returns {[]} Array of Sprite objects containing the _blocks block state.
 */
const extractCodeState = function (runtime) {
    if (!runtime) return null;
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
 * @returns {ExtractorResult} The extraction results.
 */
const extractEventData = function (event, blocks) {
    // console.log(event.type)
    // console.log(event)
    // console.log(blocks)

    let result = {
        eventType: event.type,
        eventData: {}
    }
    // Call all extract methods. Every possible event.type should only be handled by only one extractor.
    for (let eventExtractor of eventExtractors) {
        const extractorResult = eventExtractor(event, blocks)
        // Only update result if extractor returns non-null value
        result = extractorResult ? extractorResult : result
    }

    return result;
};

module.exports = {
    extractEventData: extractEventData,
    extractCodeState: extractCodeState
};
