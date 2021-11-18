const logger = require('./src/logger');
const loggingWs = require('./src/logging-websocket')
const vmListener = require('./src/virtual-machine-listener')

module.exports = {
    logger: logger,
    wsOpen: loggingWs.isOpen,
    wsSaveError: loggingWs.hasSaveError,
    listenToVM: vmListener.listenToVM
};
