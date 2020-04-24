pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";


contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    struct Airline {
        bool isRegistered;
        uint funding;
    }
    struct Insurance {
        address account;
        uint amount;
    }
    mapping(address => bool) private authorizedCallers;
    address[] private airlineAddresses;
    mapping(address => Airline) private registeredAirlines;
    mapping(bytes32 => Insurance) passengers;
    mapping(bytes32 => address[]) insureesByFlight;
    mapping(address => uint) payoutsOwed;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address firstAirline) public {
        contractOwner = msg.sender;
        registeredAirlines[firstAirline] = Airline({
            isRegistered: true,
            funding: 0
        });
        airlineAddresses.push(firstAirline);
    }

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
        require(operational, "Contract is currently not operational");
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
     * @dev Modifier that checks if caller is authorized
     */
    modifier isAuthorizedCaller() {
        require(authorizedCallers[msg.sender], "Caller is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */

    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */

    function setOperatingStatus(bool mode) external
    requireContractOwner() {
        operational = mode;
    }

    /**
     * @dev Authorizes callers for this contract
     *
     */

    function authorizeCaller(address id) public
    requireContractOwner() {
        authorizedCallers[id] = true;
    }

    /**
     * @dev Check if address is authorized caller
     *
     */

    function isCaller(address id) public view returns (bool) {
        return authorizedCallers[id];
    }

    /**
     * @dev Get airline addresses
     *
     * @return An array of addresses representing all registered airlines
     */

    function getAirlineAddresses() external view returns (address[] memory) {
        return airlineAddresses;
    }

    /**
     * @dev Get insurance of a passenger
     *
     * @return The insuree's address and amount
     */

    function getInsurance(address airline, string flight, uint256 timestamp, address passenger) external view returns (address, uint) {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        bytes32 passengerKey = getPassengerKey(passenger, flightKey);
        return (passengers[passengerKey].account, passengers[passengerKey].amount);
    }

    /**
     * @dev Get payout owed
     *
     * @return The payout owed to a particular passenger
     */

     function getPayoutOwed(address passenger) external view returns (uint) {
         return payoutsOwed[passenger];
     }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */

    function registerAirline(address newAirline) external
    requireIsOperational()
    isAuthorizedCaller() {
        registeredAirlines[newAirline] = Airline({
            isRegistered: true,
            funding: 0
        });
        airlineAddresses.push(newAirline);
    }

    /**
     * @dev Buy insurance for a flight
     *
     */

    function buy(address passenger, bytes32 flightKey, uint limit) external payable
    requireIsOperational()
    isAuthorizedCaller() {
        bytes32 passengerKey = getPassengerKey(passenger, flightKey);
        uint totalInsured = passengers[passengerKey].amount.add(msg.value);
        require(totalInsured <= limit, "Total insured cannot exceed insurance limit");
        passengers[passengerKey].account = passenger;
        passengers[passengerKey].amount = totalInsured;
        insureesByFlight[flightKey].push(passenger);
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(bytes32 flightKey, uint multiplierTimesTen) external
    requireIsOperational()
    isAuthorizedCaller() {
        address[] storage accountsForFlight = insureesByFlight[flightKey];
        for (uint i = 0; i < accountsForFlight.length; i++) {
            address passenger = accountsForFlight[i];
            bytes32 passengerKey = getPassengerKey(passenger, flightKey);
            payoutsOwed[passenger] = payoutsOwed[passenger].add(passengers[passengerKey].amount.mul(multiplierTimesTen).div(10));
            passengers[passengerKey].amount = 0;
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address account) external
    requireIsOperational()
    isAuthorizedCaller() {
        uint payout = payoutsOwed[account];
        require(payout > 0, "Address has zero balance");
        payoutsOwed[account] = 0;
        account.transfer(payout);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */

    function fund(address airline) public payable
    requireIsOperational()
    isAuthorizedCaller() {
        registeredAirlines[airline].funding = registeredAirlines[airline].funding.add(msg.value);
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function getPassengerKey(address passenger, bytes32 flightKey) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(passenger, flightKey));
    }

    /**
     * @dev Check if airline is registered
     *
     */

    function isAirline(address id) external view returns (bool) {
        return registeredAirlines[id].isRegistered;
    }

    /**
     * @dev Get the funding for an airline
     *
     */

    function getFunding(address id) public view returns (uint) {
        return registeredAirlines[id].funding;
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        fund(msg.sender);
    }

}
