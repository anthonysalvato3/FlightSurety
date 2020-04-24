
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  // Flight status codes
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;

  const TEST_ORACLES_COUNT = 20;

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

      // Get operating status
      let status = await config.flightSuretyData.isOperational.call();
      assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try 
        {
            await config.flightSurety.setTestingMode(true);
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

  it('(airline) first airline registered properly', async () => {
    let firstAirline = config.firstAirline;

    let result1 = await config.flightSuretyData.isAirline.call(firstAirline);
    let result2 = await config.flightSuretyData.getAirlineAddresses.call();
    assert.equal(result1, true, "First airline not initialized properly");
    assert.equal(result2[0], firstAirline, "First airline not included in airline list");
    assert.equal(result2.length, 1, "Number of airlines should be 1");
  })

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

    // ARRANGE
    let firstAirline = config.firstAirline;
    let newAirline = accounts[2];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, { from: firstAirline });
    }
    catch (e) {
      //console.log(e);
    }
    let result = await config.flightSuretyData.isAirline.call(newAirline);
    let airlines = await config.flightSuretyData.getAirlineAddresses.call();

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
    assert.equal(airlines.length, 1, "Number of airlines should be 1");

  });

  it('(airline) gets properly funded', async () => {

    // ARRANGE
    let firstAirline = config.firstAirline;
    let fundingAmount = web3.utils.toWei("10", "ether");

    // ACT
    try {
      await config.flightSuretyApp.fund({ from: firstAirline, value: fundingAmount, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let result = await config.flightSuretyData.getFunding.call(firstAirline);
    let airlines = await config.flightSuretyData.getAirlineAddresses.call();

    // ASSERT
    assert.equal(result, fundingAmount, "Airline does not have the expected funding");
    assert.equal(airlines.length, 1, "Number of airlines should be 1");

  });

  it('(airline) can register an Airline using registerAirline() if it is funded', async () => {

    // ARRANGE
    let firstAirline = config.firstAirline;
    let newAirline = accounts[2];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, { from: firstAirline });
    }
    catch (e) {
      console.log(e);
    }

    let result1 = await config.flightSuretyData.isAirline.call(newAirline);
    let result2 = await config.flightSuretyData.getAirlineAddresses.call();

    // ASSERT
    assert.equal(result1, true, "Airline should be able to register another airline if it has provided funding");
    assert.equal(result2[1], newAirline, "Airline not included in airline list");
    assert.equal(result2.length, 2, "Number of airlines should be 2");

  });

  it('(airline) cannot be registered more than once', async () => {

    // ARRANGE
    let firstAirline = config.firstAirline;
    let newAirline = accounts[2];

    // ASSERT
    await truffleAssert.reverts(config.flightSuretyApp.registerAirline(newAirline, { from: firstAirline }), "Airline is already registered");

    let airlines = await config.flightSuretyData.getAirlineAddresses.call();
    assert.equal(airlines.length, 2, "Number of airlines should be 2");

  });

  it('(airline) poll will open on the 5th airline registration. Poll should close immediately because only 1 airline has voting rights', async () => {

    let firstAirline = config.firstAirline;
    let thirdAirline = accounts[3];
    let fourthAirline = accounts[4];
    let fifthAirline = accounts[5];
    let emptyAddress = "0x0000000000000000000000000000000000000000";

    let allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    assert.equal(allAirlines.length, 2, "Expected only 2 airlines");

    try {
      await config.flightSuretyApp.registerAirline(thirdAirline, { from: firstAirline, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    assert.equal(allAirlines.length, 3, "Expected only 3 airlines");

    try {
      await config.flightSuretyApp.registerAirline(fourthAirline, { from: firstAirline, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    //Expect no poll to have opened
    let preStatus = await config.flightSuretyApp.getPollStatus.call();
    allAirlines = await config.flightSuretyData.getAirlineAddresses.call();

    assert.equal(allAirlines.length, 4, "Expected only 4 airlines");
    assert.equal(preStatus[0], false, "Poll should not have opened");
    assert.equal(preStatus[1], emptyAddress, "Poll target should be empty address on empty poll");
    assert.equal(preStatus[2], 0, "Required approvals should be 0 on empty poll");
    assert.equal(preStatus[3], 0, "Yes votes should be 0 on empty poll");
    assert.equal(preStatus[4], 0, "No votes should be 0 on empty poll");

    try {
      await config.flightSuretyApp.registerAirline(fifthAirline, { from: firstAirline, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    //Expect poll to have opened and concluded with firstAirline being the only voter
    allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    let postStatus = await config.flightSuretyApp.getPollStatus.call();
    assert.equal(allAirlines.length, 5, "Expected 5 airlines");
    assert.equal(postStatus[0], false, "Poll should have concluded immediately");
    assert.equal(postStatus[1], fifthAirline, "Poll target should be the new airline");
    assert.equal(postStatus[2], 1, "Required approvals should be 1");
    assert.equal(postStatus[3], 1, "Yes votes should be 1");
    assert.equal(postStatus[4], 0, "No votes should be 0");

  });

  it('(airline) after 3 airlines are funded, adding another airline should require 2 approvals', async () => {

    let firstAirline = config.firstAirline;
    let secondAirline = accounts[2];
    let thirdAirline = accounts[3];
    let sixthAirline = accounts[6];
    let fundingAmount = web3.utils.toWei("10", "ether");

    try {
      await config.flightSuretyApp.fund({ from: secondAirline, value: fundingAmount, nonce: await web3.eth.getTransactionCount(secondAirline) });
      await config.flightSuretyApp.fund({ from: thirdAirline, value: fundingAmount, nonce: await web3.eth.getTransactionCount(thirdAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let fund1 = await config.flightSuretyData.getFunding.call(secondAirline);
    let fund2 = await config.flightSuretyData.getFunding.call(thirdAirline);

    assert.equal(fund1, fundingAmount, "Airline 2 does not have the expected funding");
    assert.equal(fund2, fundingAmount, "Airline 3 does not have the expected funding");

    try {
      await config.flightSuretyApp.registerAirline(sixthAirline, { from: firstAirline, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    let pollStatus = await config.flightSuretyApp.getPollStatus.call();

    assert.equal(allAirlines.length, 5, "New airline should not be added before poll concludes");
    assert.equal(pollStatus[0], true, "Poll should have started");
    assert.equal(pollStatus[1], sixthAirline, "Poll target should be the new airline");
    assert.equal(pollStatus[2], 2, "Required approvals should be 2");
    assert.equal(pollStatus[3], 1, "Yes votes should be 1");
    assert.equal(pollStatus[4], 0, "No votes should be 0");

  });

  it('(airline) a random address should not be able to vote', async () => {

    let randomAddress = accounts[7];
    let sixthAirline = accounts[6];

    await truffleAssert.reverts(config.flightSuretyApp.voteAirline(sixthAirline, true, { from: randomAddress }), "Caller is not a registered airline");

  });

  it('(airline) if an airline is unfunded, it should not be able to vote', async () => {

    let fourthAirline = accounts[4];
    let sixthAirline = accounts[6];

    await truffleAssert.reverts(config.flightSuretyApp.voteAirline(sixthAirline, true, { from: fourthAirline }), "Caller does not have required funding");

  });

  it('(airline) voting on an incorrect airline should fail', async () => {

    let secondAirline = accounts[2];
    let fourthAirline = accounts[4];

    await truffleAssert.reverts(config.flightSuretyApp.voteAirline(fourthAirline, true, { from: secondAirline }), "This address is not open for voting");

  });

  it('(airline) voting no should increase the no vote amount', async () => {

    let secondAirline = accounts[2];
    let sixthAirline = accounts[6];

    try {
      await config.flightSuretyApp.voteAirline(sixthAirline, false, { from: secondAirline, nonce: await web3.eth.getTransactionCount(secondAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    let pollStatus = await config.flightSuretyApp.getPollStatus.call();

    assert.equal(allAirlines.length, 5, "New airline should not be added before poll concludes");
    assert.equal(pollStatus[0], true, "Poll should still be open");
    assert.equal(pollStatus[1], sixthAirline, "Poll target should be the new airline");
    assert.equal(pollStatus[2], 2, "Required approvals should be 2");
    assert.equal(pollStatus[3], 1, "Yes votes should be 1");
    assert.equal(pollStatus[4], 1, "No votes should be 1");

  });

  it('(airline) a voter should only be able to vote once', async () => {

    let secondAirline = accounts[2];
    let sixthAirline = accounts[6];

    await truffleAssert.reverts(config.flightSuretyApp.voteAirline(sixthAirline, false, { from: secondAirline }), "Caller has already voted");

  });

  it('(airline) an additional no vote should close the poll and reject the new airline', async () => {

    let thirdAirline = accounts[3];
    let sixthAirline = accounts[6];

    try {
      await config.flightSuretyApp.voteAirline(sixthAirline, false, { from: thirdAirline, nonce: await web3.eth.getTransactionCount(thirdAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    let isRegistered = await config.flightSuretyData.isAirline.call(sixthAirline);
    let pollStatus = await config.flightSuretyApp.getPollStatus.call();
    let voterList = await config.flightSuretyApp.getVoterList.call();
    let hasVoted1 = await config.flightSuretyApp.getHasVoted.call(accounts[1]);
    let hasVoted2 = await config.flightSuretyApp.getHasVoted.call(accounts[2]);
    let hasVoted3 = await config.flightSuretyApp.getHasVoted.call(accounts[3]);

    assert.equal(allAirlines.length, 5, "New airline should not have been added");
    assert.equal(isRegistered, false, "New airline should not have been registered");
    assert.equal(pollStatus[0], false, "Poll should have closed");
    assert.equal(pollStatus[1], sixthAirline, "Poll target should be the new airline");
    assert.equal(pollStatus[2], 2, "Required approvals should be 2");
    assert.equal(pollStatus[3], 1, "Yes votes should be 1");
    assert.equal(pollStatus[4], 2, "No votes should be 2");
    assert.equal(voterList.length, 0, "Voter list should have been cleared");
    assert.equal(hasVoted1, false, "First airline vote should be cleared");
    assert.equal(hasVoted2, false, "Second airline vote should be cleared");
    assert.equal(hasVoted3, false, "Third airline vote should be cleared");

  });

  it('(airline) another poll should be able to open on the same airline', async () => {

    let firstAirline = config.firstAirline;
    let sixthAirline = accounts[6];

    try {
      await config.flightSuretyApp.registerAirline(sixthAirline, { from: firstAirline, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    let pollStatus = await config.flightSuretyApp.getPollStatus.call();

    assert.equal(allAirlines.length, 5, "New airline should not be added before poll concludes");
    assert.equal(pollStatus[0], true, "Poll should have started");
    assert.equal(pollStatus[1], sixthAirline, "Poll target should be the new airline");
    assert.equal(pollStatus[2], 2, "Required approvals should be 2");
    assert.equal(pollStatus[3], 1, "Yes votes should be 1");
    assert.equal(pollStatus[4], 0, "No votes should be 0");

  });

  it('(airline) another yes vote should increase the yes vote amount, close the poll, and approve the new airline', async () => {

    let secondAirline = accounts[2];
    let sixthAirline = accounts[6];

    try {
      await config.flightSuretyApp.voteAirline(sixthAirline, true, { from: secondAirline, nonce: await web3.eth.getTransactionCount(secondAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let allAirlines = await config.flightSuretyData.getAirlineAddresses.call();
    let isRegistered = await config.flightSuretyData.isAirline.call(sixthAirline);
    let pollStatus = await config.flightSuretyApp.getPollStatus.call();
    let voterList = await config.flightSuretyApp.getVoterList.call();
    let hasVoted1 = await config.flightSuretyApp.getHasVoted.call(accounts[1]);
    let hasVoted2 = await config.flightSuretyApp.getHasVoted.call(accounts[2]);
    let hasVoted3 = await config.flightSuretyApp.getHasVoted.call(accounts[3]);

    assert.equal(allAirlines.length, 6, "New airline should have been added");
    assert.equal(isRegistered, true, "New airline should have been registered");
    assert.equal(pollStatus[0], false, "Poll should close");
    assert.equal(pollStatus[1], sixthAirline, "Poll target should be the new airline");
    assert.equal(pollStatus[2], 2, "Required approvals should be 2");
    assert.equal(pollStatus[3], 2, "Yes votes should be 2");
    assert.equal(pollStatus[4], 0, "No votes should be 0");
    assert.equal(voterList.length, 0, "Voter list should have been cleared");
    assert.equal(hasVoted1, false, "First airline vote should be cleared");
    assert.equal(hasVoted2, false, "Second airline vote should be cleared");
    assert.equal(hasVoted3, false, "Third airline vote should be cleared");

  });

  it('(flight) random address should not be able to register flight', async () => {

    let randomAddress = accounts[7];
    let flight = "flight1";
    let timestamp = Math.floor(Date.now() / 1000) + 10000;

    await truffleAssert.reverts(config.flightSuretyApp.registerFlight(flight, timestamp, { from: randomAddress, nonce: await web3.eth.getTransactionCount(randomAddress) }), "Caller is not a registered airline");

  });

  it('(flight) unfunded airline should not be able to register flight', async () => {

    let unfundedAirline = accounts[6];
    let flight = "flight1";
    let timestamp = Math.floor(Date.now() / 1000) + 10000;

    await truffleAssert.reverts(config.flightSuretyApp.registerFlight(flight, timestamp, { from: unfundedAirline }), "Caller does not have required funding");

  });

  it('(flight) registered flights should always be in the future', async () => {

    let firstAirline = config.firstAirline;
    let flight = "flight1";
    let timestamp = Math.floor(Date.now() / 1000) - 1;

    await truffleAssert.reverts(config.flightSuretyApp.registerFlight(flight, timestamp, { from: firstAirline }), "Provided timestamp is in the past");

  });

  it('(flight) successfully register a flight', async () => {

    let firstAirline = config.firstAirline;
    let flight = "flight1";
    let timestamp = config.timestamp;

    try {
      await config.flightSuretyApp.registerFlight(flight, timestamp, { from: firstAirline, nonce: await web3.eth.getTransactionCount(firstAirline) });
    }
    catch (e) {
      console.log(e);
    }

    let flightData = await config.flightSuretyApp.getFlight.call(firstAirline, flight, timestamp);
    assert.equal(flightData[0], true, "isRegistered should be true");
    assert.equal(flightData[1], STATUS_CODE_ON_TIME, "Status should be on time");
    assert.equal(flightData[2], timestamp, "Timestamp should be saved");
    assert.equal(flightData[3], firstAirline, "Airline should be the caller");

  });

  it('(flight) passenger cannot buy insurance for unregistered flight', async () => {

    let firstAirline = config.firstAirline;
    let flight = "flight1";
    let timestamp = config.timestamp;
    let passenger = accounts[7];

    let wrongAirline = accounts[2];
    let wrongFlight = "wrong flight";
    let wrongTimestamp = timestamp - 1;

    await truffleAssert.reverts(config.flightSuretyApp.buyFlightInsurance(wrongAirline, flight, timestamp, { from: passenger, nonce: await web3.eth.getTransactionCount(passenger) }), "Flight has not yet been registered");
    await truffleAssert.reverts(config.flightSuretyApp.buyFlightInsurance(firstAirline, wrongFlight, timestamp, { from: passenger, nonce: await web3.eth.getTransactionCount(passenger) }), "Flight has not yet been registered");
    await truffleAssert.reverts(config.flightSuretyApp.buyFlightInsurance(firstAirline, flight, wrongTimestamp, { from: passenger, nonce: await web3.eth.getTransactionCount(passenger) }), "Flight has not yet been registered");

  });

  it('(flight) passenger can buy insurance for registered flight', async () => {

    let firstAirline = config.firstAirline;
    let flight = "flight1";
    let timestamp = config.timestamp;
    let passenger = accounts[7];
    let amount = web3.utils.toWei("0.5", "ether");

    try {
      await config.flightSuretyApp.buyFlightInsurance(firstAirline, flight, timestamp, { from: passenger, value: amount, nonce: await web3.eth.getTransactionCount(passenger) });
    }
    catch (e) {
      console.log(e);
    }

    let result = await config.flightSuretyData.getInsurance.call(firstAirline, flight, timestamp, passenger);

    assert.equal(result[0], passenger, "Passenger address was not saved properly");
    assert.equal(result[1], amount, "Insurance payment was not saved properly");

  });

  it('(flight) passenger insurance purchases are cumulative for the same flight', async () => {

    let firstAirline = config.firstAirline;
    let flight = "flight1";
    let timestamp = config.timestamp;
    let passenger = accounts[7];
    let amount = web3.utils.toWei("0.25", "ether");
    let totalInsurance = web3.utils.toWei("0.75", "ether");

    try {
      await config.flightSuretyApp.buyFlightInsurance(firstAirline, flight, timestamp, { from: passenger, value: amount, nonce: await web3.eth.getTransactionCount(passenger) });
    }
    catch (e) {
      console.log(e);
    }

    let result = await config.flightSuretyData.getInsurance.call(firstAirline, flight, timestamp, passenger);

    assert.equal(result[0], passenger, "Passenger address was not saved properly");
    assert.equal(result[1], totalInsurance, "Insurance payment did not accumulate");

  });

  it('(flight) passenger cannot purchase above the insurance limit', async () => {

    let firstAirline = config.firstAirline;
    let flight = "flight1";
    let timestamp = config.timestamp;
    let passenger = accounts[7];
    let amount = web3.utils.toWei("0.26", "ether");

    await truffleAssert.reverts(config.flightSuretyApp.buyFlightInsurance(firstAirline, flight, timestamp, { from: passenger, value: amount, nonce: await web3.eth.getTransactionCount(passenger) }), "Total insured cannot exceed insurance limit");

  });

  it('(oracles) can register oracles', async () => {

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 11; a < TEST_ORACLES_COUNT + 10; a++) {
      await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee, nonce: await web3.eth.getTransactionCount(accounts[a]) });
      let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('(oracles) can pay insurees on late airline status', async () => {

    // ARRANGE
    let flight = 'flight1';
    let timestamp = config.timestamp;
    let passenger = accounts[7];
    let expectedPayout = web3.utils.toWei("0.75", "ether") * 1.5;
    let minResponses = 3;

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    // let tempIndex = await config.flightSuretyApp.getTempIndex.call();
    let successCount = 0;
    // console.log("FLIGHT INDEX: " + tempIndex);
    for (let a = 11; a < TEST_ORACLES_COUNT + 10; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      for (let idx = 0; idx < 3; idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, { from: accounts[a], nonce: await web3.eth.getTransactionCount(accounts[a]) });
          successCount++;
        }
        catch (e) {
          // Enable this when debugging
          // console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
        if (successCount >= minResponses) {
          await truffleAssert.reverts(config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, { from: accounts[a], nonce: await web3.eth.getTransactionCount(accounts[a]) }), "Flight or timestamp do not match oracle request");
        }

      }
    }

    if (successCount >= minResponses) {
      let actualPayout = await config.flightSuretyData.getPayoutOwed.call(passenger);
      console.log("INSUREE PAYOUT ACTIVATED");
      console.log("EXPECTED PAYOUT: " + expectedPayout);
      console.log("ACTUAL PAYOUT: " + actualPayout);
      assert.equal(actualPayout, expectedPayout, "Passenger not properly paid out");
    }

  });

  it('(passenger) withdraw fails if passenger is not owed anything', async () => {
    let passenger = accounts[8];

    await truffleAssert.reverts(config.flightSuretyApp.withdraw({from: passenger, nonce: await web3.eth.getTransactionCount(passenger)}), "Address has zero balance");

  });

  it('(passenger) can withdraw payout owed', async () => {

    // ARRANGE
    let passenger = accounts[7];
    let payout = BigNumber(await config.flightSuretyData.getPayoutOwed.call(passenger));
    let initialBalance = BigNumber(await web3.eth.getBalance(passenger));
    let expectedFinalBalance = initialBalance.plus(payout);
    let precision = 1000000000000000;

    // ACT
    if (payout == 0) {
      await truffleAssert.reverts(config.flightSuretyApp.withdraw({from: passenger, nonce: await web3.eth.getTransactionCount(passenger)}), "Address has zero balance");
    } else {
      await config.flightSuretyApp.withdraw({from: passenger, nonce: await web3.eth.getTransactionCount(passenger)});

      let finalBalance = BigNumber(await web3.eth.getBalance(passenger));
      console.log("INITIAL BALANCE: " + initialBalance);
      console.log("EXPECTED FINAL BALANCE: " + expectedFinalBalance);
      console.log("FINAL BALANCE: " + finalBalance);
      let newPayout = await config.flightSuretyData.getPayoutOwed.call(passenger);
      assert.equal(newPayout, 0, "Payout was not reset to 0");
      assert.equal(Math.round(finalBalance.minus(expectedFinalBalance).dividedBy(precision)), 0, "Final balance does not match expected");
    }
  });

});