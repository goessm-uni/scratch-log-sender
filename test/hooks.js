const sinon = require("sinon");

// Sinon.js Boilerplate
exports.mochaHooks = {
    afterEach() {
        sinon.restore();
    },
};
