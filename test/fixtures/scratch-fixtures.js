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
module.exports = {
    fakeBlocks: fakeBlocks,
    fakeRuntimeEditingTarget: fakeRuntimeEditingTarget
}
