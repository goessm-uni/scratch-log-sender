const sinon = require('sinon')
const {assert} = require("@sinonjs/referee");
const {extractEventData, extractCodeState} = require('../src/logging-data-extractor')

const fakeBlocks = {
    getBlock: sinon.fake.returns({opcode: 'blockType'})
}

describe('.extractEventData()', () => {
    context('on Create event', () => {
        const testCreateEvent = {
            type: 'create',
            blockId: 1,
            ids: [1],
            recordUndo: true,
            xml: {outerHTML: '<block type=\"block\" id=\"1\" x=\"0\" y=\"0\"></block>'}
        }

        const testCreateEventWithChild = {
            type: 'create',
            blockId: 1,
            ids: [1, 2],
            recordUndo: true,
            xml: {outerHTML: '<block type=\"head\" id=\"1\" x=\"0\" y=\"0\"><next><block type=\"child\" id=\"2\"></block></next></block>'}
        }

        it('should extract relevant fields from Create event', () => {
            const testEvent = testCreateEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.ids, testEvent.ids)
            assert.equals(data.recordUndo, testEvent.recordUndo)
            assert.equals(data.outerHTML, testEvent.xml.outerHTML)
        });
        it('should get blockType from blocks using blockId', () => {
            const extractionResult = extractEventData(testCreateEvent, fakeBlocks)
            assert.equals(extractionResult.eventData.blockType, fakeBlocks.getBlock().opcode)
        });
        it('should set blockType to null if blockId is null', () => {
            const testCreateEventNoBlockId = {...testCreateEvent, blockId: null}
            const extractionResult = extractEventData(testCreateEventNoBlockId, fakeBlocks)
            assert.isNull(extractionResult.eventData.blockType)
        });
        it('should set blockType to null if block does not exist', () => {
            const fakeBlocksNotFound = {
                getBlock: sinon.fake.returns(null)
            }
            const extractionResult = extractEventData(testCreateEvent, fakeBlocksNotFound)
            assert.isNull(extractionResult.eventData.blockType)
        });
        it('should extract types of child blocks from XML', () => {
            const extractionResult = extractEventData(testCreateEventWithChild, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(data.children.length, 1)
            assert.equals(data.children[0].blockType, 'child')
        });
        it('should not throw an error if XML is empty', () => {
            let eventNoXml = {...testCreateEvent, xml: null} // Clone but change xml
            extractEventData(eventNoXml, fakeBlocks)
        })
        it('should continue without error if main xml object is not a block', () => {
            let eventWrongXml = {...testCreateEvent, xml: {outerHTML: '<unexpectedType />'}}
            const extractionResult = extractEventData(eventWrongXml, fakeBlocks)
        });
        it('should ignore XML elements that are not blocks', () => {
            let eventStrangeXml = {
                ...testCreateEvent, xml: {
                    outerHTML: '<block type=\"head\" id=\"1\" x=\"0\" y=\"0\"><next><bock type=\"child\" id=\"2\"></bock></next></block>'
                }
            }
            const result = extractEventData(eventStrangeXml, fakeBlocks)
            assert.equals(result.eventData.children.length, 0)
        });
        it('should ignore child elements not called next', function() {
            let eventXmlNoNext = {
                ...testCreateEvent, xml: {
                    outerHTML: '<block type=\"head\" id=\"1\" x=\"0\" y=\"0\"><notnext></notnext></block>'
                }
            }
            const result = extractEventData(eventXmlNoNext, fakeBlocks)
            assert.equals(result.eventData.children.length, 0)
        });
    });

    context('on Delete Event', () => {
        const testDeleteEvent = {
            type: 'delete',
            blockId: 1,
            ids: [1],
            recordUndo: true,
            oldXml: {outerHTML: '<block type=\"block\" id=\"1\" x=\"0\" y=\"0\"></block>'}
        }

        const testDeleteEventWithChild = {
            type: 'delete',
            blockId: 1,
            ids: [1, 2],
            recordUndo: true,
            oldXml: {outerHTML: '<block type=\"head\" id=\"1\" x=\"0\" y=\"0\"><next><block type=\"child\" id=\"2\"></block></next></block>'}
        }
        it('should extract relevant fields from Delete event', () => {
            const testEvent = testDeleteEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, 'block')
            assert.equals(data.ids, testEvent.ids)
            assert.equals(data.recordUndo, testEvent.recordUndo)
            assert.equals(data.outerHTML, testEvent.oldXml.outerHTML)
        });
        it('should extract types of child blocks from XML', () => {
            const extractionResult = extractEventData(testDeleteEventWithChild, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(data.children.length, 1)
            assert.equals(data.children[0].blockType, 'child')
        });
        it('should not throw an error if XML is empty', () => {
            let eventNoXml = {...testDeleteEvent, xml: null} // Clone but change xml
            eventNoXml.xml = null
            extractEventData(eventNoXml, fakeBlocks)
        })
    });

    context('on Change Event', () => {
        const testChangeEvent = {
            type: 'change',
            blockId: 1,
            element: 'element',
            name: 'name',
            newValue: 'newValue',
            oldValue: 'oldValue',
            recordUndo: true
        }
        it('should extract relevant fields from Change event', () => {
            const testEvent = testChangeEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, fakeBlocks.getBlock().opcode)
            assert.equals(data.element, testEvent.element)
            assert.equals(data.newValue, testEvent.newValue)
            assert.equals(data.oldValue, testEvent.oldValue)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
    });

    context('on Move Event', () => {
        const testMoveEvent = {
            type: 'move',
            blockId: 1,
            newCoordinate: {x: 1, y: 1},
            oldCoordinate: {x: 0, y: 0},
            newInputName: 'newInputName',
            oldInputName: 'oldInputName',
            newParentId: 'newParentId',
            oldParentId: 'oldParentId',
            recordUndo: true
        }
        it('should extract relevant fields from Move event', () => {
            const testEvent = testMoveEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, fakeBlocks.getBlock().opcode)
            assert.equals(data.newCoordinate, testEvent.newCoordinate)
            assert.equals(data.oldCoordinate, testEvent.oldCoordinate)
            assert.equals(data.newInputName, testEvent.newInputName)
            assert.equals(data.oldInputName, testEvent.oldInputName)
            assert.equals(data.newParentId, testEvent.newParentId)
            assert.equals(data.oldParentId, testEvent.oldParentId)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
    });

    context('on Ui Event', () => {
        const testUiEvent = {
            type: 'ui',
            blockId: 1,
            element: 'stackclick',
            newValue: 'newValue',
            oldValue: 'oldValue'
        }
        it('should extract relevant fields from Ui event', () => {
            const testEvent = testUiEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, fakeBlocks.getBlock().opcode)
            assert.equals(data.newValue, testEvent.newValue)
            assert.equals(data.oldValue, testEvent.oldValue)
        });
        it('should append the element type to the event type name', () => {
            const extractionResult = extractEventData(testUiEvent, fakeBlocks)
            // eventType == ui_stackclick
            assert.equals(extractionResult.eventType, 'ui_' + testUiEvent.element)
        });
        it('should leave the type as ui if no element is set', () => {
            let eventNoElement = {...testUiEvent, element: null} // Clone but change element
            const extractionResult = extractEventData(eventNoElement, fakeBlocks)
            assert.equals(extractionResult.eventType, eventNoElement.type)
        });
    });

    context('on Comment Event', () => {
        const testCommentEvent = {
            type: 'comment_create',
            blockId: 1,
            commentId: 'commentId',
            height: 1,
            minimized: false,
            text: 'text',
            width: 1,
            xml: {outerHTML: '<comment id=\"1\" x=\"0\" y=\"0\" h=\"1\" w=\"1\"></comment>'},
            xy: {x: 0, y: 0},
            recordUndo: true
        }

        const testCommentChangeEvent = {
            type: 'comment_change',
            blockId: 1,
            commentId: 'commentId',
            newContents_: {text: 'newText'},
            oldContents_: {text: 'oldText'},
            recordUndo: true
        }
        it('should extract relevant fields from Comment create or delete event', () => {
            const testEvent = testCommentEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, fakeBlocks.getBlock().opcode)
            assert.equals(data.commentId, testEvent.commentId)
            assert.equals(data.height, testEvent.height)
            assert.equals(data.minimized, testEvent.minimized)
            assert.equals(data.text, testEvent.text)
            assert.equals(data.width, testEvent.width)
            assert.equals(data.outerHTML, testEvent.xml.outerHTML)
            assert.equals(data.xy, testEvent.xy)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
        it('should extract relevant fields from Comment change event', () => {
            const testEvent = testCommentChangeEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, fakeBlocks.getBlock().opcode)
            assert.equals(data.commentId, testEvent.commentId)
            assert.equals(data.newContents_, testEvent.newContents_)
            assert.equals(data.oldContents_, testEvent.oldContents_)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
        it('should not throw error if xml is null', () => {
            const eventNoXml = {...testCommentEvent, xml: null}
            const extractionResult = extractEventData(eventNoXml, fakeBlocks)
        });
    });

    context('on Var Event', () => {
        const testVarEvent = {
            type: 'var_create',
            isCloud: false,
            isLocal: true,
            varId: 'varId',
            varName: 'varName',
            varType: 'carType',
            recordUndo: true
        }

        const testVarRenameEvent = {
            type: 'var_rename',
            newName: 'newName',
            oldName: 'oldName',
            varId: 'varId',
            recordUndo: true
        }

        it('should extract relevant fields from Var create or delete event', () => {
            const testEvent = testVarEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.isCloud, testEvent.isCloud)
            assert.equals(data.isLocal, testEvent.isLocal)
            assert.equals(data.varId, testEvent.varId)
            assert.equals(data.varName, testEvent.varName)
            assert.equals(data.varType, testEvent.varType)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
        it('should extract relevant fields from Var rename event', () => {
            const testEvent = testVarRenameEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.newName, testEvent.newName)
            assert.equals(data.oldName, testEvent.oldName)
            assert.equals(data.varId, testEvent.varId)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
        it('should get isLocal on rename by checking editingTarget', () => {
            const fakeBlocksWithEditingTarget = {
                runtime: {
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
            }
            const extractionResult = extractEventData(testVarRenameEvent, fakeBlocksWithEditingTarget)
            assert.equals(extractionResult.eventData.isLocal, true)
        });
    });

    context('on Drag Event', () => {
        const testDragEvent = {
            type: 'endDrag',
            blockId: 'blockId',
            isOutside: false,
            recordUndo: true
        }
        it('should extract relevant fields from Drag event', () => {
            const testEvent = testDragEvent
            const extractionResult = extractEventData(testEvent, fakeBlocks)
            const data = extractionResult.eventData
            assert.equals(extractionResult.eventType, testEvent.type)
            assert.equals(data.blockId, testEvent.blockId)
            assert.equals(data.blockType, fakeBlocks.getBlock().opcode)
            assert.equals(data.isOutside, testEvent.isOutside)
            assert.equals(data.recordUndo, testEvent.recordUndo)
        });
    });
});

describe('.extractCodeState()', () => {
    it('should extract all targets that are sprites from runtime', () => {
        const fakeRuntime = {
            targets: [
                {
                    id: 'targetId',
                    sprite: {
                        name: 'spriteName',
                        blocks: {_blocks: {}}
                    }
                },
                {id: 'nonSpriteTarget'}
            ]
        };
        const result = extractCodeState(fakeRuntime)
        assert.equals(result.length, 1)
        assert.equals(result[0].name, fakeRuntime.targets[0].sprite.name)
    });
    it('should not throw error if runtime is null', () => {
        const result = extractCodeState(null)
    });
});
