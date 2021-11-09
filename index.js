const userEventLog = require('./src/user-event-log');
const loggingWs = require('./src/logging-websocket')
const vmListener = require('./src/virtual-machine-listener')

module.exports = {
    userEventLog: userEventLog,
    wsOpen: loggingWs.isOpen,
    wsSaveError: loggingWs.hasSaveError,
    listenToVM: vmListener.listenToVM
};
