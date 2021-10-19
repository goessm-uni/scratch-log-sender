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
    const data = {};
    const block = blocks._blocks[event.blockId];
    if (block) {
        data.blockType = block.opcode;
        data.eventBlock = block;
    }

    switch (event.type) {
        case 'create': {
            break;
        }
        case 'change':
            break;
    }
    return data;
};

module.exports = {
    extractEventData: extractEventData,
    extractCodeState: extractCodeState
};
