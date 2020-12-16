import Web3 from "web3";
import {Subscription} from 'web3-core-subscriptions';
import {BlockHeader} from 'web3-eth'

// function subscribe(web3:Web3,eventName:string):Subscription<string> {
//   //return new Promise<Subscription>((resolve, reject) => {
//     return web3.eth
//     .subscribe(eventName)
//     .on("data", function (transaction) {
//       console.log(eventName, transaction);
//     })
//     .on("error", function (error) {
//       console.log("sub error", error);
//     });
//   //});
// }

export async function listenForBlocks(web3: Web3) {
  // setup listeners for web3_1
  const subscription1:Subscription<string> = web3.eth
    .subscribe("pendingTransactions")
    .on("data", function (transaction) {
      console.log("pending transaction", transaction);
    });
  const subscription2:Subscription<BlockHeader> = web3.eth
    .subscribe("newBlockHeaders")
    .on("data", function (blockHeader) {
      console.log("++ New Block", blockHeader.number);
    });

  // Kill all processes when exiting.
  process.on("exit", function () {
    console.log("exit");
  });

  // Handle ctrl+c to trigger `exit`.
  process.on("SIGINT", async function () {
    console.log("SIGINT");
    await new Promise<boolean>((resolve, reject) => {
      subscription1.unsubscribe((e, res) => {
        if (e) {
          console.log("error whiile clearing subscriptions", e);
          reject(e);
        } else {
          console.log("subscription1 cleared");
          resolve(res);
        }
      });
    });
    await new Promise<boolean>((resolve, reject) => {
      subscription2.unsubscribe((e, res) => {
        if (e) {
          console.log("error whiile clearing subscriptions", e);
          reject(e);
        } else {
          console.log("subscription2 cleared");
          resolve(res);
        }
      });
    });
    process.exit(2);
  });
}
