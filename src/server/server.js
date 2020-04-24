import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
var flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

web3.eth.getAccounts().then(accounts => {
  var ORACLE_START = 11;
  var ORACLE_END = 31;

  //Register oracles
  // for (var i = ORACLE_START; i < ORACLE_END; i++) {
  //   flightSuretyApp.methods.registerOracle()
  //   .send({from: accounts[i], value: web3.utils.toWei("1", "ether"), gas: 9999999}, (error, result) => {
  //     if(error) console.log(error);
  //     if(result) console.log(result);
  //   });
  // }

    flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    if (error) console.log(error)
    console.log(event)
    var correctIndex = event.index;
    var oracleIndexes = [];
    var flightStatusArray = [0, 10, 20, 30, 40, 50];
    var flightStatus = 0;
    var randomIndex = 0;
    for (var i = ORACLE_START; i < ORACLE_END; i++) {
        // flightSuretyApp.methods.getMyIndexes().call({from: accounts[i]}).then(indexes => {
        //   console.log(indexes);
        // });
        flightSuretyApp.methods.getMyIndexes().call({from: accounts[i]}, (error, result) => {
          console.log(i);
          console.log(result);
        });
    }

    // oracleIndexes = flightSuretyApp.methods.getMyIndexes().call({from: accounts[i]}, (error, result) => {
      //   if (error) console.log(error);
      //   if (result) console.log(result);
      //   for (var j = 0; j < 3; j++) {
      //     if (oracleIndexes[j] == correctIndex) {
      //       randomIndex = Math.floor(Math.random() * 6);
      //       flightStatus = flightStatusArray[randomIndex];
      //       flightSuretyApp.methods.submitOracleResponse(oracleIndexes[j], event.airline, event.flight, event.timestamp, flightStatus).send({from: accounts[i]}, (error, result) => {
      //         if (error) console.log(error);
      //         if (result) console.log(result);
      //       });
      //     }
      //   }
      // });
  });
});

// web3.eth.getAccounts((error, accts) => {
//   web3.eth.defaultAccount = accts[0];
//   let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
//   let accounts = accts;
//   const ORACLE_START = 11;
//   const ORACLE_END = 31;

  //Register oracles
  // for (var i = ORACLE_START; i < ORACLE_END; i++) {
  //   flightSuretyApp.methods.registerOracle()
  //   .send({from: accounts[i], value: web3.utils.toWei("1", "ether"), gas: 9999999}, (error, result) => {
  //     if(error) console.log(error);
  //     if(result) console.log(result);
  //   });
  // }

//   flightSuretyApp.events.OracleRequest({
//     fromBlock: 0
//   }, function (error, event) {
//     if (error) console.log(error)
//     console.log(event)
//     var correctIndex = event.index;
//     var oracleIndexes = [];
//     var flightStatusArray = [0, 10, 20, 30, 40, 50];
//     var flightStatus = 0;
//     var randomIndex = 0;
//     for (var i = ORACLE_START; i < ORACLE_END; i++) {
//       oracleIndexes = flightSuretyApp.methods.getMyIndexes().call({from: accounts[i]}, (error, result) => {
//         if (error) console.log(error);
//         if (result) console.log(result);
//         for (var j = 0; j < 3; j++) {
//           if (oracleIndexes[j] == correctIndex) {
//             randomIndex = Math.floor(Math.random() * 6);
//             flightStatus = flightStatusArray[randomIndex];
//             flightSuretyApp.methods.submitOracleResponse(oracleIndexes[j], event.airline, event.flight, event.timestamp, flightStatus).send({from: accounts[i]}, (error, result) => {
//               if (error) console.log(error);
//               if (result) console.log(result);
//             });
//           }
//         }
//       });
//     }
//   });

// })

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;


