const sinon = require('sinon')

const fakeBlocks = {
    getBlock: sinon.fake.returns({opcode: 'blockType'}),
    runtime: {}
}

const fakeRuntimeEditingTarget = {
    getEditingTarget: sinon.fake.returns({
        variables: {
            varId: {
                id: 'varId',
                isCloud: false,
                name: 'varName',
                type: '',
                value: 0
            }
        }
    })
}

const validCreateEvent = {
    type: 'create',
    blockId: 1,
    ids: [1],
    recordUndo: true,
    xml: {outerHTML: '<block type=\"block\" id=\"1\" x=\"0\" y=\"0\"></block>'}
}
module.exports = {
    fakeBlocks: fakeBlocks,
    fakeRuntimeEditingTarget: fakeRuntimeEditingTarget,
    validCreateEvent: validCreateEvent
}
