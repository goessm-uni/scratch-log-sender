const sinon = require('sinon')
const {assert} = require("@sinonjs/referee");
const {listenToVM} = require('../src/virtual-machine-listener')
const logger = require('../src/logger')

describe('.listenToVM', () => {
    it('should log a control event for events emitted by the vm', () => {
        // Replace logger.logControlEvent with fake
        const fake = sinon.fake();
        sinon.replace(logger, 'logControlEvent', fake)

        // Call listenToVM with fake VM object
        const EventEmitter = require('events')
        class FakeVM extends EventEmitter {}
        const fakeVM = new FakeVM()
        fakeVM.constructor = {name: 'VirtualMachine'}
        listenToVM(fakeVM)

        // Emit fake VM events
        fakeVM.emit('TURBO_MODE_ON')
        fakeVM.emit('TURBO_MODE_OFF')
        fakeVM.emit('RUNTIME_STARTED')

        assert.equals(fake.callCount, 3)
    });
    it('should not listen if the objects constructor name is not VirtualMachine', () => {
        // Replace logger.logControlEvent with fake
        const fake = sinon.fake();
        sinon.replace(logger, 'logControlEvent', fake)

        // Call listenToVM with fake VM object
        const EventEmitter = require('events')
        class FakeVM extends EventEmitter {}
        const fakeVM = new FakeVM()
        fakeVM.constructor = {name: 'NotVirtualMachine'}
        // Should do nothing
        listenToVM(fakeVM)

        fakeVM.emit('TURBO_MODE_ON')

        assert.equals(fake.callCount, 0)
    });
    it('should not fail if called twice on same object', () => {
        // Replace logger.logControlEvent with fake
        const fake = sinon.fake();
        sinon.replace(logger, 'logControlEvent', fake)

        // Call listenToVM with fake VM object
        const EventEmitter = require('events')
        class FakeVM extends EventEmitter {}
        const fakeVM = new FakeVM()
        fakeVM.constructor = {name: 'VirtualMachine'}
        // Should not throw anything
        listenToVM(fakeVM)
        listenToVM(fakeVM)
    });
});
