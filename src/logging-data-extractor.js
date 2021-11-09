const htmlparser2 = require('htmlparser2');

/**
 * Extract data from a Create event
 * @param {Object} data The data object to add extracted data to.
 * @param {Object} event The Blockly.Event. Can be called with any event, will only act on Create events.
 * @param {Object} blocks The Blocks object where the event occurred.
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

const eventExtractors = [
    extractCreate
]

/**
 * Extracts the desired data from the current state of the Scratch runtime.
 *
 * @param {Runtime} runtime The Scratch VM runtime.
 * @returns {[]} Array of Sprite objects containing the _blocks block state.
 */
const extractCodeState = function (runtime) {
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
 * Extracts desired data from Blockly listen event
 * @param {Blockly.Event} event A Blockly event
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
