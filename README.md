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
interface IERCOptions {
    function createOption(
        address underlyingAsset,
        uint256 strikePrice,
        uint256 expirationTime,
        uint256 amount
    ) external returns (uint256 optionId);

    function getOptionDetails(uint256 optionId)
        external
        view
        returns (
            address underlyingAsset,
            uint256 strikePrice,
            uint256 expirationTime,
            uint256 amount,
            uint256 totalSupply
        );

    function exerciseOption(uint256 optionId) external;

    function transferOption(
        uint256 optionId,
        address recipient,
        uint256 amount
    ) external;

    event OptionCreated(
        uint256 indexed optionId,
        address indexed creator,
        address indexed underlyingAsset,
        uint256 strikePrice,
        uint256 expirationTime,
        uint256 amount
    );

    event OptionExercised(
        uint256 indexed optionId,
        address indexed exerciser,
        uint256 amount
    );

    event OptionTransferred(
        uint256 indexed optionId,
        address indexed from,
        address indexed to,
        uint256 amount
    );
}
```

### Function Descriptions
#### `createOption`
```solidity
function createOption(
    address underlyingAsset,
    uint256 strikePrice,
    uint256 expirationTime,
    uint256 amount
) external returns (uint256 optionId);
```
Creates a new options contract with the specified parameters. The `underlyingAsset` represents the ERC20 token used as the underlying asset. The `strikePrice` is the agreed-upon price at which the asset can be bought or sold. `expirationTime` defines the timestamp after which the option expires. The `amount` specifies the number of options to be created. Returns the `optionId` that uniquely identifies the created options contract.

#### `getOptionDetails`
```solidity
function getOptionDetails(uint256 optionId)
    external
    view
    returns (
        address underlyingAsset,
        uint256 strikePrice,
        uint256 expirationTime,
        uint256 amount,
        uint256 totalSupply
    );
```
Returns the details of the options contract identified by `optionId`, including the `underlyingAsset`, `strikePrice`, `expirationTime`, `amount` of options created, and the `totalSupply` of options currently in circulation.

#### `exerciseOption`
```solidity
function exerciseOption(uint256 optionId) external;
```
Allows the caller to exercise the options contract identified by `optionId`. This function can only be called before the `expirationTime` of the options contract. The function should transfer the underlying assets based on the terms of the option and emit an `OptionExercised` event.

#### `transferOption`
```solidity
function transferOption(
    uint256 optionId,
    address recipient,
    uint256 amount
) external;
```
Transfers `amount` options from the caller's balance to the specified `recipient`. This function emits an `OptionTransferred` event.

### Events
#### `OptionCreated`
```solidity
event OptionCreated(
    uint256 indexed optionId,
    address indexed creator,
    address indexed underlyingAsset,
    uint256 strikePrice,
    uint256 expirationTime,
    uint256 amount
);
```
Emitted when a new options contract is created. Provides information about the `optionId`, `creator`, `underlyingAsset`, `strikePrice`, `expirationTime`, and `amount` of options created.

#### `OptionExercised`
```solidity
event OptionExercised(
    uint256 indexed optionId,
    address indexed exerciser,
    uint256 amount
);
```
Emitted when an options contract is exercised. Provides information about the `optionId`, `exerciser`, and the `amount` of options exercised.

#### `OptionTransferred`
```solidity
event OptionTransferred(
    uint256 indexed optionId,
    address indexed from,
    address indexed to,
    uint256 amount
);
```
Emitted when options are transferred between addresses. Provides information about the `optionId`, `from` address, `to` address, and the `amount` of options transferred.

## Rationale
The proposed ERC-Options standard provides a simple yet powerful interface for options contracts on Ethereum. By standardizing the interface, it becomes easier for developers to build applications and platforms that support options trading, and users can seamlessly interact with different options contracts across multiple dApps.

## Implementation
This standard can be implemented in Solidity and integrated into smart contracts managing options contracts. Developers can deploy their own options contracts that conform to this standard or build applications on top of existing options platforms that implement ERC-Options.

## References
- Related EIPs and standards: ERC-20, ERC-721

## Conclusion
The ERC-Options standard proposes a common interface for options contracts on Ethereum, promoting interoperability and facilitating the development of decentralized options platforms. By adopting this standard, developers can build applications that seamlessly interact with options contracts, enhancing the user experience and expanding the options trading ecosystem on Ethereum. Community feedback and further discussion are encouraged to refine and improve this proposal.
