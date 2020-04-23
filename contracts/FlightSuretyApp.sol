pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";


/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    uint private constant MINIMUM_FUNDING_THRESHOLD = 10 ether;
    uint private constant MAXIMUM_INSURANCE_AMOUNT = 1 ether;
    uint private constant PAYOUT_MULTIPLIER_TIMES_TEN = 15;

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner; // Account used to deploy contract
    FlightSuretyData flightSuretyData;

    struct Poll {
        bool isActive;
        address target;
        uint requiredVotes;
        uint yesVotes;
        uint noVotes;
    }
    Poll private airlineRegisterPoll;
    mapping(address => bool) private hasVoted;
    address[] private voterList;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    // uint private tempIndex;

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        // Modify to call data contract's status
        require(true, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifier that requires the caller to be an an existing airline
     */

    modifier isAirline() {
        require(flightSuretyData.isAirline(msg.sender), "Caller is not a registered airline");
        _;
    }

    /**
     * @dev Modifier that requires the caller to be a funded airline
     */

    modifier isFunded() {
        require(flightSuretyData.getFunding(msg.sender) >= MINIMUM_FUNDING_THRESHOLD, "Caller does not have required funding");
        _;
    }

    modifier isNotDuplicated(address newAirline) {
        require(!flightSuretyData.isAirline(newAirline), "Airline is already registered");
        _;
    }

    /**
     * @dev Determines if the target address is being voted on
     */

    modifier isActiveVote(address newAirline) {
        require(newAirline == airlineRegisterPoll.target, "This address is not open for voting");
        require(airlineRegisterPoll.isActive, "This vote has already concluded");
        _;
    }

    /**
     * @dev Determines if the sender has already voted
     */

    modifier isNotDuplicateVoter() {
        require(!hasVoted[msg.sender], "Caller has already voted");
        _;
    }

    modifier inTheFuture(uint timestamp) {
        require(timestamp > now, "Provided timestamp is in the past");
        _;
    }

    modifier flightIsRegistered(address airline, string flight, uint timestamp) {
        require(flights[getFlightKey(airline, flight, timestamp)].isRegistered, "Flight has not yet been registered");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor
     *
     */
    constructor(address dataContract) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public pure returns (bool) {
        return true; // Modify to call data contract's status
    }

    function getPollStatus() public view returns (bool, address, uint, uint, uint) {
        return (airlineRegisterPoll.isActive, airlineRegisterPoll.target, airlineRegisterPoll.requiredVotes,
        airlineRegisterPoll.yesVotes, airlineRegisterPoll.noVotes);
    }

    function getVoterList() public view returns (address[] memory) {
        return voterList;
    }

    function getHasVoted(address voter) public view returns (bool) {
        return hasVoted[voter];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */

    function registerAirline(address newAirline) external
    isAirline()
    isFunded()
    isNotDuplicated(newAirline) {
        uint numAirlines = flightSuretyData.getAirlineAddresses().length;
        if (numAirlines < 4) {
            flightSuretyData.registerAirline(newAirline);
        } else {
            openPoll(newAirline);
        }
    }

    /**
     * @dev Existing airlines can vote for a new airline to be registered
     *
     */

    function voteAirline(address newAirline, bool approve) external
    isAirline()
    isFunded()
    isActiveVote(newAirline)
    isNotDuplicateVoter() {
        if (approve) {
            airlineRegisterPoll.yesVotes = airlineRegisterPoll.yesVotes.add(1);
        } else {
            airlineRegisterPoll.noVotes = airlineRegisterPoll.noVotes.add(1);
        }
        hasVoted[msg.sender] = true;
        voterList.push(msg.sender);

        if(airlineRegisterPoll.yesVotes >= airlineRegisterPoll.requiredVotes) {
            closePollSuccess(newAirline);
        } else if(airlineRegisterPoll.yesVotes.add(airlineRegisterPoll.noVotes) >= getNumberOfFundedAirlines()) {
            closePollFail();
        }
    }

    /**
     * @dev Adds funding to the airline
     *
     */

    function fund() external payable
    isAirline() {
        flightSuretyData.fund.value(msg.value)(msg.sender);
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */

    function registerFlight(string flight, uint timestamp) external
    isAirline()
    isFunded()
    inTheFuture(timestamp) {
        bytes32 flightKey = getFlightKey(msg.sender, flight, timestamp);
        flights[flightKey].isRegistered = true;
        flights[flightKey].statusCode = STATUS_CODE_ON_TIME;
        flights[flightKey].updatedTimestamp = timestamp;
        flights[flightKey].airline = msg.sender;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */

    function buyFlightInsurance(address airline, string flight, uint timestamp) external payable
    flightIsRegistered(airline, flight, timestamp) {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flightSuretyData.buy.value(msg.value)(msg.sender, flightKey, MAXIMUM_INSURANCE_AMOUNT);
    }

    function withdraw() external {
        flightSuretyData.pay(msg.sender);
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */

    function processFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 statusCode) internal {
        if(statusCode == STATUS_CODE_LATE_AIRLINE) {
            bytes32 flightKey = getFlightKey(airline, flight, timestamp);
            flightSuretyData.creditInsurees(flightKey, PAYOUT_MULTIPLIER_TIMES_TEN);
        }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        // tempIndex = index;
        emit OracleRequest(index, airline, flight, timestamp);
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3] memory) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            //Prevent processFlightStatus from being called more than once
            oracleResponses[key].isOpen = false;
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function getPassengerKey(address passenger, bytes32 flightKey) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(passenger, flightKey));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3] memory) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    // endregion

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function getFlight(address airline, string flight, uint256 timestamp) external view returns (bool, uint8, uint256, address) {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        return (flights[flightKey].isRegistered, flights[flightKey].statusCode, flights[flightKey].updatedTimestamp, flights[flightKey].airline);
    }

    // function getTempIndex() external view returns (uint) {
    //     return tempIndex;
    // }

    /********************************************************************************************/
    /*                                       HELPER FUNCTIONS                                   */
    /********************************************************************************************/

    function getNumberOfFundedAirlines() private returns (uint) {
        address[] memory allAirlines = flightSuretyData.getAirlineAddresses();
        uint numFundedAirlines = 0;
        for (uint i = 0; i < allAirlines.length; i++) {
            address currentAirline = allAirlines[i];
            if (flightSuretyData.getFunding(currentAirline) >= MINIMUM_FUNDING_THRESHOLD) {
                numFundedAirlines = numFundedAirlines.add(1);
            }
        }
        return numFundedAirlines;
    }

    function openPoll(address newAirline) private {
        airlineRegisterPoll = Poll({
            isActive: true,
            target: newAirline,
            requiredVotes: getRequiredVotes(),
            yesVotes: 1,
            noVotes: 0
        });
        hasVoted[msg.sender] = true;
        voterList.push(msg.sender);
        if (airlineRegisterPoll.yesVotes >= airlineRegisterPoll.requiredVotes) {
            closePollSuccess(newAirline);
        }
    }

    function closePollFail() private {
        uint numVoters = voterList.length;

        for (uint i = 0; i < numVoters; i++) {
            hasVoted[voterList[i]] = false;
        }
        delete voterList;
        airlineRegisterPoll.isActive = false;
    }

    function closePollSuccess(address newAirline) private {
        closePollFail();
        flightSuretyData.registerAirline(newAirline);
    }

    function getRequiredVotes() private returns (uint) {
        uint requiredVotes = 0;
        uint numFundedAirlines = getNumberOfFundedAirlines();

        // If even number of airlines, required votes = number of airlines / 2.
        // If odd number of airlines, required votes = number of airlines / 2 + 1.
        if (numFundedAirlines.div(2).mul(2) == numFundedAirlines) {
            requiredVotes = numFundedAirlines.div(2);
        } else {
            requiredVotes = numFundedAirlines.div(2).add(1);
        }

        return requiredVotes;
    }

}

// Define interface to interact with the data contract
contract FlightSuretyData {
    function registerAirline(address newAirline) external;
    function isAirline(address id) external returns (bool);
    function fund(address airline) public payable;
    function getFunding(address id) external returns (uint);
    function getAirlineAddresses() external returns (address[] memory);
    function buy(address passenger, bytes32 flightKey, uint limit) external payable;
    function creditInsurees(bytes32 flightKey, uint multiplierTimesTen) external;
    function pay(address account) external;
}
