const EventEmitter = require('events');
const logger = require('./logger')

/**
 * Capture additional events from the VM.
 * The VirtualMachine class exported by scratch-vm is an EventEmitter.
 * Where possible we listen to the events emitted by the VirtualMachine to extract user actions.
 * These events are more high-level than the low-level block events captured from scratch-blocks.
 */
let currentVM;

const listenToVM = function (vm) {
    if (vm?.constructor?.name !== 'VirtualMachine') return
    if (vm === currentVM) return

    currentVM = vm
    // Monkey-patch the vm emit method to allow listening for any (*) event.
    // This is easier than listening to every single event type.
    vm.emit = CustomEmitter.prototype.emit

    vm.on('*', (type, ...args) => {
        // console.log(`VM event: ${type}`)
        // console.log(args)
    })

    vm.on('TURBO_MODE_ON', () => {
        logger.logControlEvent('turbo_mode_on', null, null)
    })
    vm.on('TURBO_MODE_OFF', () => {
        logger.logControlEvent('turbo_mode_off', null, null)
    })
    vm.on('RUNTIME_STARTED', () => {
        logger.logControlEvent('runtime_started',null, null)
    })
};

module.exports = {
    listenToVM: listenToVM
}

/**
 * Custom EventEmitter that allows listening to any event using "*".
 * When listening to "*", the first arg will always be the event type.
 */
class CustomEmitter extends EventEmitter {
    emit(type, ...args) {
        super.emit('*', type, ...args);
        return super.emit(type, ...args);
    }
}
