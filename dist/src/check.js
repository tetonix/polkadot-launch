"use strict";
// This function checks that the `config.json` file has all the expected properties.
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkConfig = void 0;
// It displays a unique error message and returns `false` for any detected issues.
function checkConfig(config) {
    if (!config) {
        return false;
    }
    if (!config.relaychain) {
        console.error("Missing `relaychain` object");
        return false;
    }
    if (!config.relaychain.bin) {
        console.error("Missing `relaychain.bin`");
        return false;
    }
    if (!config.relaychain.chain) {
        console.error("Missing `relaychain.chain`");
        return false;
    }
    if (config.relaychain.nodes.length == 0) {
        console.error("No relaychain nodes defined");
        return false;
    }
    for (const node of config.relaychain.nodes) {
        if (node.flags && node.flags.constructor !== Array) {
            console.error("Parachain flags should be an array.");
            return false;
        }
    }
    if (!config.parachains) {
        console.error("Missing `parachains` object");
        return false;
    }
    if (config.parachains.length >= config.relaychain.nodes.length) {
        console.error("Must have the same or greater number of relaychain nodes than parachains.");
        return false;
    }
    for (let parachain of config.parachains) {
        if (parachain.flags && parachain.flags.constructor !== Array) {
            console.error("Parachain flags should be an array.");
            return false;
        }
    }
    return true;
}
exports.checkConfig = checkConfig;
