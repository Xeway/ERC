EIP: <to be assigned>
Title: ERC-Options: A Standard Interface for Options on the Ethereum Blockchain

Author: Ewan Humbert (@Xeway)
Discussions-To: [Ethereum Magicians](https://ethereum-magicians.org/)
Status: Draft
Type: Standards Track
Category: ERC
Created: 2022-09-02

## Simple Summary
This proposal introduces ERC-Options, a standard interface for creating and interacting with options contracts on the Ethereum blockchain. The ERC-Options standard provides a consistent way to represent and trade options, enabling interoperability between different decentralized applications (dApps) and platforms.

## Abstract
ERC-Options defines a set of functions and events that allow for the creation, management, and exercising of options contracts on the Ethereum blockchain. This standard ensures that options contracts conform to a common interface, facilitating the development of robust options trading platforms and enabling interoperability between dApps and protocols.

## Motivation
Options are widely used financial instruments that provide users with the right, but not the obligation, to buy or sell an underlying asset at a predetermined price within a specified timeframe. By introducing a standard interface for options contracts, we aim to foster a more inclusive and interoperable options ecosystem on Ethereum. This standard will enhance the user experience and facilitate the development of decentralized options platforms, enabling users to seamlessly trade options across different applications.

## Specification
### Interface
```solidity
interface IOption {
    event Bought(address indexed buyer, uint256 timestamp);
    event Exercised(uint256 timestamp);
    event Expired(uint256 timestamp);
    event Canceled(uint256 timestamp);

    function buy() external returns (bool);
    function exercise() external returns (bool);
    function retrieveExpiredTokens() external returns (bool);
    function cancel() external returns (bool);

    function side() external view returns (Side);
    function underlyingToken() external view returns (address);
    function amount() external view returns (uint256);
    function strikeToken() external view returns (address);
    function strike() external view returns (uint256);
    function expiration() external view returns (uint256);
    function durationExerciseAfterExpiration() external view returns (uint256);
    function premiumToken() external view returns (address);
    function premium() external view returns (uint256);
    function getType() external view returns (Type);
    function writer() external view returns (address);
    function buyer() external view returns (address);
    function state() external view returns (State);
}
```

### State Variable Descriptions
#### `side`
**Type: `enum`**

Side of the option. Can take the value `Call` or `Put`.

#### `underlyingToken`
**Type: `address` (`IERC20`)**

Underlying token.

#### `amount`
**Type: `uint256`**

Amount of the underlying token.

> Be aware of token decimals!

#### `strikeToken`
**Type: `address` (`IERC20`)**

Token used as a reference to determine the strike price.

#### `strike`
**Type: `uint256`**

Strike price.

> Be aware of token decimals!

#### `expiration`
**Type: `uint256`**\
**Format: _timestamp as seconds since unix epoch_**

Date of the expiration.

#### `durationExerciseAfterExpiration`
**Type: `uint256`**\
**Format: _seconds_**

Duration during which the buyer may exercise the option. This period start at the `expiration`'s date.

#### `premiumToken`
**Type: `address` (`IERC20`)**

Premium token.

#### `premium`
**Type: `uint256`**

Premium price.

> Be aware of token decimals!

#### `type`
**Type: `enum`**

Type of the option. Can take the value `European` or `American`.

#### `writer`
**Type: `address`**

Writer's address. Since the contract inherit from `Ownable`, `writer` is `owner`.

#### `buyer`
**Type: `address`**

Buyer's address.

#### `state`
**Type: `enum`**

State of the option. Can take the value `Created`, `Bought`, `Exercised`, `Expired` or `Canceled`.

### Function Descriptions
#### `buy`
```solidity
function buy() external returns (bool);
```
Allows the user to buy the option. The buyer has to previously allow the spend to pay for the premium in the specified token. During the call of the function, the premium is be directly send to the writer.

*Returns a boolean depending on whether or not the function was successfully executed.*

#### `exercise`
```solidity
function exercise() external returns (bool);
```
Allows the buyer to exercise his option.

- If the option is a call, buyer pays writer at the specified strike price and gets the specified underlying token(s).
- If the option is a put, buyer transfers to writer the underlying token(s) and gets paid at the specified strike price.

In all case, the buyer has to previously allow the spend of either `strikeToken` or `underlyingToken`.

*Returns a boolean depending on whether or not the function was successfully executed.*

#### `retrieveExpiredTokens`
```solidity
function retrieveExpiredTokens() external returns (bool);
```
Allows the writer to retrieve the token(s) he locked (used as collateral). Writer can only execute this function after the period `durationExerciseAfterExpiration` happening after `expiration`.

*Returns a boolean depending on whether or not the function was successfully executed.*

#### `call`
```solidity
function cancel() external returns (bool);
```
Allows the writer to cancel the option and retrieve his/its locked token(s) (used as collateral). Writer can only execute this function if the option hasn't been bought or exercised.

*Returns a boolean depending on whether or not the function was successfully executed.*

### Events
#### `Bought`
```solidity
event Bought(address indexed buyer, uint256 timestamp);
```
Emitted when the option has been bought. Provides information about the `buyer` and the transaction's `timestamp`.

#### `Exercised`
```solidity
event Exercised(uint256 timestamp);
```
Emitted when the option has been exercised. Provides information about the transaction's `timestamp`.

#### `Expired`
```solidity
event Expired(uint256 timestamp);
```
Emitted when the option has been expired. Provides information about the transaction's `timestamp`.

#### `Canceled`
```solidity
event Canceled(uint256 timestamp);
```
Emitted when the option has been canceled. Provides information about the transaction's `timestamp`.

## Rationale
The proposed ERC-Options standard provides a simple yet powerful interface for options contracts on Ethereum. By standardizing the interface, it becomes easier for developers to build applications and platforms that support options trading, and users can seamlessly interact with different options contracts across multiple dApps.

## Implementation
This standard can be implemented in Solidity and integrated into smart contracts managing options contracts. Developers can deploy their own options contracts that conform to this standard or build applications on top of existing options platforms that implement ERC-Options.

## References
- Related EIPs and standards: ERC-20, ERC-721

## Conclusion
The ERC-Options standard proposes a common interface for options contracts on Ethereum, promoting interoperability and facilitating the development of decentralized options platforms. By adopting this standard, developers can build applications that seamlessly interact with options contracts, enhancing the user experience and expanding the options trading ecosystem on Ethereum. Community feedback and further discussion are encouraged to refine and improve this proposal.
