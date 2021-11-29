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
 * @property {String} [blockId]
 * @property {Object} [xml]
 * @property {[String]} [ids]
 * @property {String} [element]
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
 * Stores the last known state of the runtime, which contains the code state.
 * This is useful to get data for actions that alter the state such as delete,
 * especially when the log function is called after the VM updates.
 */
let lastKnownRuntimeState

/**
 * Extract data from a Create event.
 * @param {BlockEvent} event Will only act on Create events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 * @returns {?ExtractionResult} The result of extraction, or null if event was of wrong type.
 */
const extractCreate = function (event, blocks) {
    if (event.type !== 'create') return null

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, xml, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)
    // Children: Array of child blocks if multiple blocks were created.
    // Array order corresponds to position in single-line block hierarchy (child, grandchild, ...).
    // Empty if a single block was created.
    data.children = _getChildBlocksFromXML(event.xml)

    return {
        eventType: type,
        eventData: data
    }
}

/**
 * Extract data from a Delete event.
 * @param {BlockEvent} event Will only act on change events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractDelete = function (event, blocks) {
    if (event.type !== 'delete') return null

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, oldXml, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)

    return {
        eventType: type,
        eventData: data
    }
}

/**
 * Extract data from a Change or Move event.
 * @param {BlockEvent} event Will only act on change or move events.
 * @param {Blocks} blocks The Blocks object where the event occurred.
 */
const extractChangeMove = function (event, blocks) {
    if (event.type !== 'change' && event.type !== 'move') return null

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)

    return {
        eventType: type,
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

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)
    // Update event type based on element
    if (data.element) { type = type + "_" + event.element }

    return {
        eventType: type,
        eventData: data
    }
}

/**
 * Extract data from a comment event.
 * @param {BlockEvent} event Will only act on Comment events.
 * @param {Blocks} _blocks The Blocks object where the event occurred.
 */
const extractComment = function (event, blocks) {
    if (!event.type.startsWith('comment')) return null

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, xml, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)

    return {
        eventType: type,
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

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, ...data} = event

    if (type === 'var_rename') {
        // Rename event doesn't include isLocal, so we infer it like scratch-vm does.
        if (blocks.runtime?.getEditingTarget().variables.hasOwnProperty(event.varId)) {
            data.isLocal = true
        } else {
            data.isLocal = false
        }
    }

    return {
        eventType: type,
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

    // Clone event to data, removing undesired fields using destructuring
    let {type, group, workspaceId, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)

    return {
        eventType: type,
        eventData: data
    }
}

const eventExtractors = [
    extractCreate,
    extractDelete,
    extractChangeMove,
    extractUi,
    extractComment,
    extractVar,
    extractDrag,
]

/**
 * Helper function for extractors. Gets blockType from blockId if possible.
 * @param {String} blockId
 * @param {Blocks} blocks
 * @returns {?String} BlockType for blockId in given blocks, or null if block not found.
 * @private
 */
const _getBlockTypeFromId = function (blockId, blocks) {
    if (!blockId || !blocks) return null
    const block = blocks.getBlock?.(blockId)
    if (block) return block.opcode
    return null
}

/**
 * Helper function for extractCreate, returns data about block children from xml object.
 * @param {Object} xml
 * @returns {null|[{}]} Array of objects containing blockID and type of children, or null on error
 * @private
 */
const _getChildBlocksFromXML = function (xml) {
    const html = xml?.outerHTML
    if (!html) return null
    const html_doc = htmlparser2.parseDocument(html, {decodeEntities: false})

    // Get data of head block.
    const mainBlock = html_doc.children[0]
    if (mainBlock.name !== 'block') return null

    // Create events may include multiple blocks created at the same time.
    // We check for child blocks and save them in children
    let hasNext = true
    let current_block_doc = mainBlock
    let children = []
    while (hasNext) {
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
    return children
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
    // Set last know runtime state
    lastKnownRuntimeState = runtime;
    return sprites;
};

/**
 * Extracts desired data from Block event
 * @param {BlockEvent} event A Block event
 * @param {Blocks} blocks Blocks object where the event occurred
 * @returns {ExtractionResult} The extraction results.
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
        const extractionResult = eventExtractor(event, blocks)
        // If extractor returns non-null value, update result
        if (extractionResult) {
            result = extractionResult
        }
    }
    return result;
};

const getLastKnownRuntimeState = function () {
    return lastKnownRuntimeState;
}

module.exports = {
    extractEventData: extractEventData,
    extractCodeState: extractCodeState,
    getLastKnownRuntimeState: getLastKnownRuntimeState
};
