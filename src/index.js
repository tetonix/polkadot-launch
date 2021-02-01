#!/usr/bin/env node

import {
	startNode, startCollator, killAll, generateChainSpec, generateChainSpecRaw, exportGenesisWasm,
	exportGenesisState, startSimpleCollator,startTests
} from './spawn';
import { connect, registerParachain, setBalance } from './rpc';
import { checkConfig } from './check';
import { clearAuthorities, addAuthority } from './spec';
import { parachainAccount } from './parachain';

const { resolve, dirname } = require('path');
const fs = require('fs');

// Special care is needed to handle paths to various files (binaries, spec, config, etc...)
// The user passes the path to `config.json`, and we use that as the starting point for any other
// relative path. So the `config.json` file is what we will be our starting point.
const { argv } = require('yargs')

const config_file = argv._[0] ? argv._[0] : null;
if (!config_file) {
	console.error("Missing config file argument...");
	process.exit();
}
let config_path = resolve(process.cwd(), config_file);
let config_dir = dirname(config_path);
if (!fs.existsSync(config_path)) {
	console.error("Config file does not exist: ", config_path);
	process.exit();
}
let config = require(config_path);

function sleep(ms) {
	return new Promise((res) => {
		setTimeout(res, ms);
	});
}

export async function start() {
	// keep track of registered parachains
	let registeredParachains = {}

	// Verify that the `config.json` has all the expected properties.
	if (!checkConfig(config)) {
		return;
	}

	const relay_chain_bin = resolve(config_dir, config.relaychain.bin);
	if (!fs.existsSync(relay_chain_bin)) {
		console.error("Relay chain binary does not exist: ", relay_chain_bin);
		process.exit();
	}
	const chain = config.relaychain.chain;
	await generateChainSpec(relay_chain_bin, chain);
	clearAuthorities(`${chain}.json`);
	for (const node of config.relaychain.nodes) {
		await addAuthority(`${chain}.json`, node.name);
	}
	await generateChainSpecRaw(relay_chain_bin, chain);
	const spec = resolve(`${chain}-raw.json`);

	// First we launch each of the validators for the relay chain.
	for (const node of config.relaychain.nodes) {
		const { name, wsPort, port, flags } = node;
		console.log(`Starting ${name}...`);
		// We spawn a `child_process` starting a node, and then wait until we
		// able to connect to it using PolkadotJS in order to know its running.
		startNode(relay_chain_bin, name, wsPort, port, spec, flags);
	}
	
	// Connect to the first relay chain node to submit the extrinsic.
	let relayChainApi = await connect(config.relaychain.nodes[0].wsPort, config.types);

	// Then launch each parachain
	await new Promise(async(resolvePromise,reject)=>{

		let readyIndex=0
		function checkFinality(){
			readyIndex+=1
			if (readyIndex===config.parachains.length){
				resolvePromise()
			}
		}
		for (const parachain of config.parachains) {
			const { id, wsPort, balance, port, flags, chain } = parachain;
			const bin = resolve(config_dir, parachain.bin);
			if (!fs.existsSync(bin)) {
				console.error("Parachain binary does not exist: ", bin);
				process.exit();
			}
			let account = parachainAccount(id);
			console.log(`Starting a Collator for parachain ${id}: ${account}, Collator port : ${port} wsPort : ${wsPort}`);
			await startCollator(bin, id, wsPort, port, chain, spec, flags)

			// If it isn't registered yet, register the parachain on the relaychain
			if (!registeredParachains[id]) {
				console.log(`Registering Parachain ${id}`);

				// Get the information required to register the parachain on the relay chain.
				let genesisState
				let genesisWasm
				try {
					genesisState = await exportGenesisState(bin, id, chain)
					genesisWasm = await exportGenesisWasm(bin, chain)
				} catch (err) {
					console.error(err)
					process.exit(1)
				}
				try{
					await registerParachain(relayChainApi, id, genesisWasm, genesisState);
					//checkFinality('isRegistered')
				} catch(e){
					console.log('error during register',e)
				}

				registeredParachains[id] = true

				// Allow time for the TX to complete, avoiding nonce issues.
				// TODO: Handle nonce directly instead of this.
				if (balance) {
					await setBalance(relayChainApi, account, balance)
					//checkFinality('isBalanceSet')
				}
			}
			checkFinality()
		}
	})
	console.log('ALL PARACHAINS REGISTERED')
}

// log unhandledRejection
process.on('unhandledRejection', error => {
	if (error.message){
		console.trace(error);
	}else {
		console.log('unhandledRejection: error thrown without a message')
	}
});

// Kill all processes when exiting.
process.on('exit', function () {
	console.log('exit index spawn')
	killAll();
});

// Handle ctrl+c to trigger `exit`.
process.on('SIGINT', function () {
	console.log('SIGINT spawn')
	process.exit(2);
});

start();
