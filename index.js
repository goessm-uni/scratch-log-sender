const userEventLog = require('./src/user-event-log');
const loggingWs = require('./src/logging-websocket')

module.exports = {
    userEventLog: userEventLog,
    wsOpen: loggingWs.isOpen(),
    wsSaveError: loggingWs.hasSaveError()
};
