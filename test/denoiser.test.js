const sinon = require('sinon')
const {assert} = require("@sinonjs/referee");
const denoiser = require('../src/denoiser')
const scratchFixtures = require('./fixtures/scratch-fixtures')

describe('.eventIsNoise', () => {
    context('event is automated action', () => {
        context('action type records undo but recordUndo is false', () => {
            const testEvent = {...scratchFixtures.validCreateEvent, recordUndo: false}
            it('should return true', () => {
                const isNoise = denoiser.eventIsNoise(testEvent, scratchFixtures.fakeBlocks)
                assert.isTrue(isNoise)
            });
        });
    });
    context('event is not noise', () => {
        context('action type records undo and recordUndo is true', () => {
            it('should return false', () => {
                const isNoise = denoiser.eventIsNoise(scratchFixtures.validCreateEvent, scratchFixtures.fakeBlocks)
                assert.isFalse(isNoise)
            });
        });
    });
});
