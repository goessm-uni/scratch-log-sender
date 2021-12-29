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
 * @property {Boolean} [recordUndo]
 * @property {String} [blockId]
 * @property {Object} [xml]
 * @property {Object} [oldXml]
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
 * Stores the last known state of the blocks on current target.
 * This is useful to get block data for actions that alter the state such as delete,
 * because the log function is called after the VM updates.
 */
let lastKnownBlocksState

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
    data.outerHTML = xml?.outerHTML
    // Children: Array of child blocks if multiple blocks were created.
    // Array order corresponds to position in single-line block hierarchy (child, grandchild, ...).
    // Empty if a single block was created.
    data.children = _getBlocksFromXML(event.xml)?.children

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
    data.outerHTML = oldXml?.outerHTML
    // Since log is called after block is already deleted, we must get block and children data from XML.
    const blockData = _getBlocksFromXML(event.oldXml)
    data.blockType = blockData?.blockType
    data.children = blockData?.children

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
    let {type, group, workspaceId, element, ...data} = event
    data.blockType = _getBlockTypeFromId(data.blockId, blocks)
    // Update event type based on element
    if (element) { type = type + "_" + element }

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

    // Extract outerHTML from xml for comment_create and comment_delete
    data.outerHTML = xml?.outerHTML

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
        // See scratch-vm/src/engine/blocks.blocklyListen for example.
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
 * Helper function for Create or Delete extraction.
 * Events may include multiple blocks created / deleted at the same time.
 * This function returns blockId and blockType for main Block and all children,
 * extracted from xml.outerHTML.
 * @param {Object} xml
 * @returns {null|Object} Object containing blockID, blockType and children, or null on error
 * @private
 */
const _getBlocksFromXML = function (xml) {
    const html = xml?.outerHTML
    if (!html) return null
    const html_doc = htmlparser2.parseDocument(html, {decodeEntities: false})

    // Get data of head block.
    const mainBlock = html_doc.children[0]
    if (mainBlock.name !== 'block') return null
    const result = {
        blockId: mainBlock.attribs?.id,
        blockType: mainBlock.attribs?.type,
        children: []
    }
    // Loop while child block exists
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
                        result.children.push({
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
    return result
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
    // Call all extract methods. Every possible event.type should be handled by only one extractor.
    for (let eventExtractor of eventExtractors) {
        const extractionResult = eventExtractor(event, blocks)
        // If extractor returns non-null value, update result
        if (extractionResult) {
            result = extractionResult
        }
    }
    // Set last known blocks state to clone of blocks._blocks
    lastKnownBlocksState = {...blocks._blocks}
    return result;
};

module.exports = {
    extractEventData: extractEventData,
    extractCodeState: extractCodeState
};
