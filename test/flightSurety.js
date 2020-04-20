
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

//   it(`(multiparty) has correct initial isOperational() value`, async function () {

//     // Get operating status
//     let status = await config.flightSuretyData.isOperational.call();
//     assert.equal(status, true, "Incorrect initial operating status value");

//   });

//   it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

//       // Ensure that access is denied for non-Contract Owner account
//       let accessDenied = false;
//       try 
//       {
//           await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
//       }
//       catch(e) {
//           accessDenied = true;
//       }
//       assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
//   });

//   it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

//       // Ensure that access is allowed for Contract Owner account
//       let accessDenied = false;
//       try 
//       {
//           await config.flightSuretyData.setOperatingStatus(false);
//       }
//       catch(e) {
//           accessDenied = true;
//       }
//       assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
//   });

//   it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

//       await config.flightSuretyData.setOperatingStatus(false);

//       let reverted = false;
//       try 
//       {
//           await config.flightSurety.setTestingMode(true);
//       }
//       catch(e) {
//           reverted = true;
//       }
//       assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

//       // Set it back for other tests to work
//       await config.flightSuretyData.setOperatingStatus(true);

//   });

  it('(airline) first airline registered properly', async () => {
      let result = await config.flightSuretyData.isAirline.call(config.firstAirline);
      assert.equal(result, true, "First airline not initialized properly");
  })

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let firstAirline = config.firstAirline;
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: firstAirline});
    }
    catch(e) {
        //console.log(e);
    }
    let result = await config.flightSuretyData.isAirline.call(newAirline); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('(airline) can register an Airline using registerAirline() if it is funded', async () => {
    
    // ARRANGE
    let firstAirline = config.firstAirline;
    let newAirline = accounts[2];
    let fundingAmount = web3.utils.toWei("10", "ether");

    // ACT
    // try {
    //     // await config.flightSuretyApp.fund({from: config.firstAirline, value: fundingAmount});
    //     await config.flightSuretyData.fund(firstAirline);
    //     await config.flightSuretyApp.registerAirline(newAirline, {from: firstAirline});
    // }
    // catch(e) {
    //     console.log(e);
    // }

    await config.flightSuretyData.fund(firstAirline);
    await config.flightSuretyApp.registerAirline(newAirline, {from: firstAirline});

    let result1 = await config.flightSuretyData.getFunding.call(config.firstAirline);
    console.log("RESULT 1: " + result1);
    let result2 = await config.flightSuretyData.isAirline.call(newAirline);
    console.log("IS NEW REGISTERED: " + result2);
    let result3 = await config.flightSuretyData.isAirline.call(firstAirline);
    console.log("IS OLD REGISTERED: " + result3);

    // ASSERT
    assert.equal(result1, fundingAmount, "Airline does not have the expected funding");
    assert.equal(result2, true, "Airline should be able to register another airline if it has provided funding");

  });
 

});
