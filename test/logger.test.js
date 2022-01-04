const sinon = require('sinon')
const {assert} = require("@sinonjs/referee");
const logger = require('../src/logger')
const ws = require('../src/logging-websocket')
const denoiser = require('../src/denoiser')
const extractor = require('../src/logging-data-extractor')
const {fakeBlocks} = require('./fixtures/scratch-fixtures')

describe('.sendLog', () => {
    const testAction = {
        timestamp: 0,
        type: 'test',
        data: null,
        codeState: null
    }
    beforeEach(() => {
        // Empty eventLog
        const eventLog = logger.getEventLog()
        eventLog.length = 0
    });
    it('should call sendActions with the current action log', () => {
        const sendActionsFake = sinon.fake.returns(true)
        sinon.replace(ws, 'sendActions', sendActionsFake)
        sinon.replace(ws, 'isOpen', sinon.fake.returns(true))
        const eventLog = logger.getEventLog()
        eventLog.push(testAction)
        logger.sendLog()
        assert.equals(sendActionsFake.callCount, 1)
        sinon.assert.calledWith(sendActionsFake, sinon.match.array.contains([testAction]))
    });
    it('should do nothing if eventLog is empty', () => {
        const sendActionsFake = sinon.fake.returns(true)
        sinon.replace(ws, 'sendActions', sendActionsFake)
        sinon.replace(ws, 'isOpen', sinon.fake.returns(true))
        // Call sendLog with empty eventLog
        logger.sendLog()
        sinon.assert.notCalled(sendActionsFake)
    });
    it('should do nothing if websocket is not open', () => {
        const sendActionsFake = sinon.fake.returns(true)
        sinon.replace(ws, 'sendActions', sendActionsFake)
        sinon.replace(ws, 'isOpen', sinon.fake.returns(false)) // Websocket closed
        const eventLog = logger.getEventLog()
        eventLog.push(testAction)
        logger.sendLog()
        sinon.assert.notCalled(sendActionsFake)
    });
    it('should keep logs in buffer and resend if send fails', () => {
        const sendActionsFake = sinon.stub().returns(true)
        sendActionsFake.onCall(0).returns(false) // First call will return false
        sinon.replace(ws, 'sendActions', sendActionsFake)
        sinon.replace(ws, 'isOpen', sinon.fake.returns(true))
        const eventLog = logger.getEventLog()
        eventLog.push(testAction)
        logger.sendLog() // Send returns false, keep logs
        logger.sendLog() // Send returns true
        assert.equals(sendActionsFake.callCount, 2)
        sinon.assert.alwaysCalledWith(sendActionsFake, sinon.match.array.contains([testAction]))
    });
});

describe('.loglistenEvent', () => {
    const validEvent = {
        type: 'endDrag',
        workspaceId: 'workspaceId',
        group: 'group',
        blockId: 'blockId',
        isOutside: false,
        recordUndo: false
    }
    it('should call logUserEvent when called with valid event', () => {
        sinon.replace(denoiser, 'eventIsNoise', sinon.fake.returns(false))
        sinon.replace(extractor, 'extractEventData', sinon.fake.returns(
            {
                eventType: 'testEvent',
                eventData: {}
            }
        ))
        const logUserEventFake = sinon.fake()
        sinon.replace(logger, 'logUserEvent', logUserEventFake)

        logger.logListenEvent(validEvent, fakeBlocks)
        sinon.assert.calledWith(logUserEventFake, 'testEvent', {}, {})
    });
    it('should not call logUserEvent if event is seen as noise', () => {
        const denoiser = require('../src/denoiser')
        sinon.replace(denoiser, 'eventIsNoise', sinon.fake.returns(true))
        const extractor = require('../src/logging-data-extractor')
        sinon.replace(extractor, 'extractEventData', sinon.fake.returns(
            {
                eventType: 'testEvent',
                eventData: {}
            }
        ))
        const logUserEventFake = sinon.fake()
        sinon.replace(logger, 'logUserEvent', logUserEventFake)

        logger.logListenEvent(validEvent, fakeBlocks)
        sinon.assert.notCalled(logUserEventFake)
    });
    it('should not call logUserEvent if event has ignored type', () => {
        const denoiser = require('../src/denoiser')
        sinon.replace(denoiser, 'eventIsNoise', sinon.fake.returns(false))
        const extractor = require('../src/logging-data-extractor')
        sinon.replace(extractor, 'extractEventData', sinon.fake.returns(
            {
                eventType: 'ui_click', // ignored type
                eventData: {}
            }
        ))
        const logUserEventFake = sinon.fake()
        sinon.replace(logger, 'logUserEvent', logUserEventFake)

        logger.logListenEvent(validEvent, fakeBlocks)
        sinon.assert.notCalled(logUserEventFake)
    });
});

describe('.logUserEvent', () => {
    beforeEach(() => {
        // Empty eventLog
        const eventLog = logger.getEventLog()
        eventLog.length = 0
    });
    it('should add given event to eventLog', () => {
        logger.logUserEvent('testType', {}, {})
        const eventLog = logger.getEventLog()
        assert.equals(eventLog.length, 1)
        sinon.assert.match(eventLog[0], {type: 'testType', data: {}})
    });
    it('should set codeState to null if runtime is null', () => {
        logger.logUserEvent('testType', {}, null)
        const eventLog = logger.getEventLog()
        sinon.assert.match(eventLog[0], {type: 'testType', data: {}, codeState: null})
    });
});

describe('.logControlEvent', () => {
    it('should call logUserEvent with params and null data', () => {
        const logUserEventFake = sinon.fake()
        sinon.replace(logger, 'logUserEvent', logUserEventFake)

        logger.logControlEvent('testType', {})
        sinon.assert.calledWith(logUserEventFake, 'testType', null, {})
    });
});

describe('.logGuiEvent', () => {
    it('should call logUserEvent', () => {
        const logUserEventFake = sinon.fake()
        sinon.replace(logger, 'logUserEvent', logUserEventFake)

        logger.logGuiEvent('testType', {}, {})
        sinon.assert.calledWith(logUserEventFake, 'testType', {}, {})
    });
});

describe('.logCostumeEvent', () => {
    context('type is not change', () => {
        it('should call logGuiEvent', () => {
            const logGuiEventFake = sinon.fake()
            sinon.replace(logger, 'logGuiEvent', logGuiEventFake)

            logger.logCostumeEvent('testType', {}, {})
            sinon.assert.calledWith(logGuiEventFake, 'testType', {}, {})
        });
    });
    context('type includes change', () => {
        it('should call logGuiEvent only once for rapid changes', () => {
            const FakeTimers = require("@sinonjs/fake-timers");
            const clock = FakeTimers.install()
            const logGuiEventFake = sinon.fake()
            sinon.replace(logger, 'logGuiEvent', logGuiEventFake)

            logger.logCostumeEvent('testType_change', {}, {})
            logger.logCostumeEvent('testType_change', {}, {})
            logger.logCostumeEvent('testType_change', {}, {})
            clock.tick(1000)
            sinon.assert.calledOnce(logGuiEventFake)
        });
        it('should call denoiser.callBatched with logGuiEvent to batch calls', () => {
            const callBatchedFake = sinon.fake()
            sinon.replace(denoiser, 'callBatched', callBatchedFake)

            logger.logCostumeEvent('testType_change', {}, {})
            sinon.assert.called(callBatchedFake)
        });
    });
    it('should replace costume with backdrop in type name if target is stage', () => {
        const logGuiEventFake = sinon.fake()
        sinon.replace(logger, 'logGuiEvent', logGuiEventFake)
        const fakeRuntime = {
            getTargetForStage: sinon.fake.returns({id: 'stageId'})
        }

        logger.logCostumeEvent('costume_test', {target: 'stageId'}, fakeRuntime)
        sinon.assert.calledWith(logGuiEventFake, 'backdrop_test')
    });
});
describe('.logSpriteChange', () => {
    it('should call logGuiEvent with sprite_change', () => {
        const FakeTimers = require("@sinonjs/fake-timers");
        const clock = FakeTimers.install()
        const logGuiEventFake = sinon.fake()
        sinon.replace(logger, 'logGuiEvent', logGuiEventFake)

        logger.logSpriteChange('spriteId', 'property', 'newValue', {})
        clock.tick(1000)
        sinon.assert.calledWith(logGuiEventFake, sinon.match('sprite_change'))
    });
    it('should call logGuiEvent only once for rapid changes', () => {
        const FakeTimers = require("@sinonjs/fake-timers");
        const clock = FakeTimers.install()
        const logGuiEventFake = sinon.fake()
        sinon.replace(logger, 'logGuiEvent', logGuiEventFake)

        logger.logSpriteChange('spriteId', 'property', 'newValue', {})
        logger.logSpriteChange('spriteId', 'property', 'newValue', {})
        logger.logSpriteChange('spriteId', 'property', 'newValue', {})
        clock.tick(1000)
        sinon.assert.calledOnce(logGuiEventFake)
    });
});
