---
eip: 7390
title: Vanilla Options for ERC-20 Tokens
description: An interface for creating, managing, and executing simple time-limited call/put (vanilla) options.
author: Ewan Humbert (@Xeway) <xeway@protonmail.com>, Lassi Maksimainen (@mlalma) <lassi.maksimainen@gmail.com>
discussions-to: https://ethereum-magicians.org/t/erc-7390-vanilla-option-standard/15206
status: Draft
type: Standards Track
category: ERC
created: 2022-09-02
requires: 20, 1155
---

## Abstract

This standard defines a comprehensive set of functions and events facilitating seamless interactions (creation, management, exercising, etc.) for vanilla options.

Vanilla options grant the right, without obligation, to buy or sell an asset at a set price within a specified timeframe.

This standard doesn't represent a simple option that would be useless after the expiration date. Instead, it can store as many issuance as needed. Each issuance is identified by an id, and can be bought, exercised, cancelled, etc., independently of the other issuances.\
Every issuance is collateralized, meaning that the writer has to provide the collateral to the contract before the buyer can buy the option. The writer can retrieve the collateral if the buyer hasn't exercised in the exercise window.\
A buyer can decide to buy only a fraction of the issuance (meaning multiple buyers is possible), and will receive accordingly tokens (ERC-1155) that represent the fraction of the issuance. From now, we will call these tokens *redeem tokens*. These tokens can be exchanged between users, and are used for exercising the option. With this mechanism, a buyer can decide to exercise only a fraction of what he bought.\
Also, the writer can decide to cancel the issuance if no option has been bought yet. He also has the right to update the premium price at any time. This doesn't affect the already bought options.\
The underlying token, strike token and premium token are ERC-20 tokens.

In the following, the plural term option**s** will sometimes be used. This can refer to the amount of redeem tokens a buyer purchased and can exercise.

## Motivation

Options are widely used financial instruments, and have a true usefulness for investors and traders. It offers versatile risk management tools and speculative opportunities.\
In the decentralized finance, many options-selling platform emerged, but each of these protocols implements their own definition of an option. This leads to incapabilities, which is a pity because options should be interoperable like fungible/non-fungible tokens are.\
By introducing a standard interface for vanilla options contracts, we aim to foster a more inclusive and interoperable derivatives ecosystem. This standard will enhance the user experience and facilitate the development of decentralized options platforms, enabling users to seamlessly trade options across different applications. Moreover, this standard is designed to represent vanilla options, which are the most common type of options. This standard can be used as a base for more complex options, such as exotic options.

## Specification

All EIP-7390 MUST implement EIP-1155 to give the possibility to buy only a fraction of the issuance.

### Interface

```solidity
interface IERC7390 {
    enum Side {
        Call,
        Put
    }

    struct VanillaOptionData {
        Side side;
        address underlyingToken;
        uint256 amount;
        address strikeToken;
        uint256 strike;
        address premiumToken;
        uint256 premium;
        uint256 exerciseWindowStart;
        uint256 exerciseWindowEnd;
        address[] allowed;
    }

    struct OptionIssuance {
        VanillaOptionData data;
        address writer;
        uint256 exercisedAmount;
        uint256 soldAmount;
    }

    error Forbidden();
    error TransferFailed();
    error TimeForbidden();
    error AmountForbidden();
    error InsufficientBalance();

    event Created(uint256 indexed id);
    event Bought(uint256 indexed id, uint256 amount, address indexed buyer);
    event Exercised(uint256 indexed id, uint256 amount);
    event Expired(uint256 indexed id);
    event Canceled(uint256 indexed id);
    event PremiumUpdated(uint256 indexed id, uint256 amount);
    event AllowedUpdated(uint256 indexed id, address[] allowed);

    function create(VanillaOptionData calldata optionData) external returns (uint256);

    function buy(uint256 id, uint256 amount) external;

    function exercise(uint256 id, uint256 amount) external;

    function retrieveExpiredTokens(uint256 id, address receiver) external;

    function cancel(uint256 id, address receiver) external;

    function updatePremium(uint256 id, uint256 amount) external;

    function updateAllowed(uint256 id, address[] memory allowed) external;

    function issuance(uint256 id) external view returns (OptionIssuance memory);
}
```

### State Variable Descriptions

At creation time, user must provide filled instance of `VanillaOptionData` structure that contains all the key information for initializing the option issuance.

#### `side`

**Type: `enum`**

Side of the option. Can take the value `Call` or `Put`. `Call` option gives the option buyer right to exercise any acquired option tokens to buy the `underlying` token at given `strike` price using `strikeToken` from option writer. Similarly, `Put` option gives the option buyer right to sell the `underlying` token to the option writer at `strike` price.

#### `underlyingToken`

**Type: `address` (ERC-20 contract)**

Underlying token.

#### `amount`

**Type: `uint256`**

Maximum amount of the underlying tokens that can be exercised.

> Be aware of token decimals!

#### `strikeToken`

**Type: `address` (ERC-20 contract)**

Token used as a reference to determine the strike price.

#### `strike`

**Type: `uint256`**

Strike price. The option buyer MAY be able to exercise only fraction of the issuance and the paid strike price must be adjusted by the contract to reflect it.

Note that `strike` is set for exercising the total `amount` of the issuance.

> Be aware of token decimals!

#### `premiumToken`

**Type: `address` (ERC-20 contract)**

Premium token.

#### `premium`

**Type: `uint256`**

Premium price is the price that option buyer has to pay to option writer to compensate for the risk that the writer takes for issuing the option. Option premium changes depending on various factors, most important ones being the volatility of the underlying token, strike price and the time left for exercising the option.

**Note that the premium price is set for exercising the total `amount` of the issuance. The buyer MAY be able to buy only fraction of the option tokens and the paid premium price must be adjusted by the contract to reflect it.**

> Be aware of token decimals!

#### `exerciseWindowStart`

**Type: `uint256`**\
**Format: *timestamp as seconds since unix epoch***

Option exercising window start time. When current time is greater or equal to `exerciseWindowStart` and below or equal to `exerciseWindowEnd`, owner of option(s) can exercise them.

#### `exerciseWindowEnd`

**Type: `uint256`**\
**Format: *timestamp as seconds since unix epoch***

Option exercising window end time. When current time is greater or equal to `exerciseWindowStart` and below or equal to `exerciseWindowEnd`, owner of option(s) can exercise them. When current time is greater than `exerciseWindowEnd`, buyers can't exercise and writer can retrieve remaining underlying (call) or strike (put) tokens.

#### `allowed`

**Type: `address[]`**

Addresses that are allowed to buy the issuance. If the array is empty, all addresses are allowed to buy the issuance.

`VanillaOptionData` is stored in the `OptionIssuance` struct, which is used to store the option issuance data. It contains other information.

#### `writer`

**Type: `address`**

Address of the writer meaning the address that created the option.

#### `exercisedAmount`

**Type: `uint256`**

Amount of underlying tokens that have been exercised.

#### `soldAmount`

**Type: `uint256`**

Amount of underlying tokens that have been bought for this issuance.

#### `transferredExerciseCost`

**Type: `uint256`**

Amount of `strikeToken` tokens that have been transferred to the writer (call) or buyers (put) of the option issuance.\
This is an utility variable used to not always have to calculate the total exercise cost transferred. It's updated at the same time `exercisedAmount` is updated. The calculation is `(exercisedAmount * selectedIssuance.data.strike) / selectedIssuance.data.amount`.

#### `exerciseCost`

**Type: `uint256`**

Exercise cost. It represents the collateral the writer has to deposit to the contract (put), or the amount of `strikeToken` tokens a writer can receive if all buyers decide to exercise (call).\
This is an utility variable used to not always have to calculate the exercise cost. We compute it at the creation of the option. The calculation is `(strike * amount) / (10 ** underlyingToken.decimals())`.

### Function Descriptions

#### `constructor`

No constructor is needed for this standard, but the contract MUST implement the ERC-1155 interface. So, the contract MUST call the ERC-1155 constructor.

#### `create`

```solidity
function create(VanillaOptionData calldata optionData) external returns (uint256);
```

Option writer creates new option tokens and defines the option parameters using `create()`. As an argument, option writer needs to fill `VanillaOptionData` data structure instance and pass it to the method. As a part of creating the option tokens, the function transfers the collateral from option writer to the contract.

It is highly preferred that as a part of calling `create()` the option issuance becomes fully collateralized to prevent increased counterparty risk. For creating a call (put) option issuance, writer needs to allow the amount of `amount` (`strike`) tokens of `underlyingToken` (`strikeToken`) to be transferred to the option contract before calling `create()`.

Note that this standard does not define functionality for option writer to "re-up" the collateral in case the option contract allows under-collateralization. The contract needs to then adjust its API and implementation accordingly.

MUST revert if `underlyingToken` or `strikeToken` is the zero address.\
MUST revert if `premium` is not 0 and `premiumToken` is the zero address.\
MUST revert if `amount` or `strike` is 0.\
MUST revert if `exerciseWindowStart` is less than the current time or if `exerciseWindowEnd` is less than `exerciseWindowStart`.

*Returns an id value that refers to the created option issuance in option contract if option issuance was successful.*
*Emits `Created` event if option issuance was successful.*

#### `buy`

```solidity
function buy(uint256 id, uint256 amount) external;
```

Allows the buyer to buy `amount` of option tokens from option issuance with the defined `id`.

The buyer has to allow the token contract to transfer the (fraction of total) `premium` in the specified `premiumToken` to option writer. During the call of the function, the premium is be directly transferred to the writer.

If `allowed` array is not empty, the buyer's address MUST be included in this list.\
MUST revert if `amount` is 0 or greater than the remaining options available for purchase.\
MUST revert if the current time is greater than `exerciseWindowEnd`.

*Mints `amount` redeem tokens to the buyer's address if buying was successful.*
*Emits `Bought` event if buying was successful.*

#### `exercise`

```solidity
function exercise(uint256 id, uint256 amount) external;
```

Allows the buyer to exercise `amount` of option tokens from option issuance with the defined `id`.

- If the option is a call, buyer pays writer at the specified strike price and gets the specified underlying tokens.
- If the option is a put, buyer transfers to writer the underlying tokens and gets paid at the specified strike price.

The buyer has to allow the spend of either `strikeToken` or `underlyingToken` before calling `exercise()`.

Exercise MUST only take place when `exerciseWindowStart` <= current time <= `exerciseWindowEnd`.\
MUST revert if `amount` is 0 or buyer hasn't the necessary redeem tokens to exercise the option.

*Burns `amount` redeem tokens from the buyer's address if the exercising was successful.*
*Emits `Exercised` event if the option exercising was successful.*

#### `retrieveExpiredTokens`

```solidity
function retrieveExpiredTokens(uint256 id, address receiver) external;
```

Allows writer to retrieve the collateral tokens that were not exercised. These tokens are transferred to `receiver`.\
If the option is a call, `receiver` retrieves the underlying tokens. If the option is a put, `receiver` retrieves the strike tokens.

MUST revert if the address calling the function is not the writer of the option issuance.\
MUST revert if `exerciseWindowEnd` is greater or equals than the current time.\
If equals to the zero address, MUST set `receiver` to caller's address.

*Transfers the un-exercised collateral to the writer's address.*
*Deletes the option issuance from the contract if the retrieval was successful.*
*Emits `Expired` event if the retrieval was successful.*

#### `cancel`

```solidity
function cancel(uint256 id, address receiver) external;
```

Allows writer to cancel the option and retrieve tokens used as collateral. These tokens are transferred to `receiver`.\
If the option is a call, `receiver` retrieves the underlying tokens. If the option is a put, `receiver` retrieves the strike tokens.

MUST revert if the address calling the function is not the writer of the option issuance.\
MUST revert if at least one option's fraction has been bought.\
If equals to the zero address, MUST set `receiver` to caller's address.

*Transfers the un-exercised collateral to the writer's address.*
*Deletes the option issuance from the contract if the cancelation was successful.*
*Emits `Canceled` event if the cancelation was successful.*

#### `updatePremium`

```solidity
function updatePremium(uint256 id, uint256 amount) external;
```

Allows the writer to update the premium that buyers will need to provide for buying the options.

**Note that the `amount` will be for the whole underlying amount, not only for the options that might still be available for purchase.**

MUST revert if the address calling the function is not the writer of the option issuance.\
MUST revert if the current time is greater than `exerciseWindowEnd`.

*Emits `PremiumUpdated` event when the function call was handled successfully.*

#### `updateAllowed`

```solidity
function updateAllowed(uint256 id, address[] memory allowed) external;
```

Allows the writer to update the list of allowed addresses that can buy the option issuance.\
If a buyer already bought an option and his address is not in the new list, he will still be able to exercise his purchased options.

MUST revert if the address calling the function is not the writer of the option issuance.\
MUST revert if the current time is greater than `exerciseWindowEnd`.

*Emits `AllowedUpdated` event when the function call was handled successfully.*

#### `issuance`

```solidity
function issuance(uint256 id) external view returns (OptionIssuance memory);
```

Returns all the key information for the option issuance with the given `id`.

### Events

#### `Created`

```solidity
event Created(uint256 id);
```

Emitted when the writer has provided option issuance data successfully (and locked down the collateral to the contract). The given `id` identifies the particular option issuance.

#### `Bought`

```solidity
event Bought(uint256 indexed id, uint256 amount, address indexed buyer);
```

Emitted when options have been bought. Provides information about the option issuance `id`, the address of `buyer` and the `amount` of options bought.

#### `Exercised`

```solidity
event Exercised(uint256 indexed id, uint256 amount);
```

Emitted when the option has been exercised from the option issuance with given `id` and the given `amount`.

#### `Expired`

```solidity
event Expired(uint256 indexed id);
```

Emitted when the writer of the option issuance with `id` has retrieved the un-exercised collateral.

#### `Canceled`

```solidity
event Canceled(uint256 indexed id);
```

Emitted when the option issuance with given `id` has been cancelled by the writer.

#### `PremiumUpdated`

```solidity
event PremiumUpdated(uint256 indexed id, uint256 amount);
```

Emitted when writer updates the premium to `amount` for option issuance with given `id`. Note that the updated premium is for the total issuance.

#### `AllowedUpdated`

```solidity
event AllowedUpdated(uint256 indexed id, address[] allowed);
```

Emitted when writer updates the list of allowed addresses for option issuance with given `id`.

### Errors

#### `Forbidden`

Reverts when the caller is not allowed to perform some actions (general purpose).

#### `TransferFailed`

Reverts when the transfer of tokens failed.

#### `TimeForbidden`

Reverts when the current time of the execution is invalid.

#### `AmountForbidden`

Reverts when the amount is invalid.

#### `InsufficientBalance`

Reverts when the caller has insufficient balance to perform the action.

### Concrete Examples

#### Call Option

Let's say Bob sells a **call** option.\
He gives the right to anyone to buy **8 TokenA** at **25 TokenB** each between **14th of July 2023** and **16th of July 2023 (at midnight)**.\
For such a contract, he wants to receive a premium of **10 TokenC**.

Before creating the option, Bob has to transfer the collateral to the contract. This collateral corresponds to the tokens he will have to give if the option if fully exercised (`amount`). For this option, he has to give as collateral 8 TokenA. He does that by calling the function `approve(address spender, uint256 amount)` on the TokenA's contract and as parameters the contract's address (`spender`) and for `amount`: **8 \* 10^(TokenA's decimals)**. Then Bob can execute `create()` on the contract for issuing the option, giving the following parameters:

- `side`: **Call**
- `underlyingToken`: **TokenA's address**
- `amount`: **8 \* 10^(TokenA's decimals)**
- `strikeToken`: **TokenB's address**
- `strike`: **25 \* 10^(TokenB's decimals)**
- `premiumToken`: **TokenC's address**
- `premium`: **10 \* 10^(TokenC's decimals)**
- `exerciseWindowStart`: **1689292800** *(2023-07-14 timestamp)*
- `exerciseWindowEnd`: **1689465600** *(2023-07-16 timestamp)*
- `allowed`: `[]` (open to anyone)

The issuance has ID 88.

Alice wants to be able to buy only **4** TokenA. She will first have to pay the premium (that is proportional to its share) by allowing the spending of his 10 TokenC by calling `approve(address spender, uint256 amount)` on the TokenC's contract and give as parameters the contract's address (`spender`) and for `amount`: **4\*10^(TokenA's decimals) \* 10\*10^(TokenC's decimals) / 8\*10^(TokenA's decimals)** (amountToBuy \* `premium` / `amount`). She can then execute `buy(88, 4 \* 10^(TokenA's decimals))` on the contract, and will receive 4\*10^(TokenA's decimals) redeem tokens.

John, for his part, wants to buy **2** TokenA. He does the same thing and receives **2\*10^(TokensA's decimals)** redeem tokens.

We're on the 15th of July and Alice wants to exercise his option because 1 TokenA is traded at 50 TokenB! She needs to allow the contract to transfer **4\*10^(TokenA's decimals) \* 25\*10^(TokenB's decimals) / 8\*10^(TokenA's decimals)** (amountToExercise \* `strike` / `amount`) TokenBs from her account to be able to exercise. When she calls `exercise(88, 4\*10^(TokenA's decimals))` on the contract, it will transfer 4 TokenA to Alice, and 4\*25 TokenB to Bob.

John decided to give his right to exercise to his friend Jimmy. He did that simply by transferring his **2\*10^(TokensA's decimals)** redeem tokens to Jimmy's address.\
Jimmy decides to only buy **1** TokenA with the option. So he will give to Bob (through the contract) **1\*10^(TokenA's decimals) \* 25\*10^(TokenB's decimals) / 8\*10^(TokenA's decimals)**.

#### Put Option

Let's say Bob sells a **put** option.\
He gives the right to anyone to sell to him **8 TokenA** at **25 TokenB** each between **14th of July 2023** and **16th of July 2023 (at midnight)**.\
For such a contract, he wants to receive a premium of **10 TokenC**.

Before creating the option, Bob has to transfer the collateral to the contract. This collateral corresponds to the tokens he will have to give if the option if fully exercised (`exerciseCost`). For this option, he has to give as collateral 200 TokenB (8 \* 25). He does that by calling the function `approve(address spender, uint256 amount)` on the TokenB's contract and as parameters the contract's address (`spender`) and for `amount`: **25\*10^(Token B's decimals) \* 8\*10^(TokenB's decimals) / 10^(TokenA's decimals)** (`strike` \* `amount` / 10^(`underlyingToken`'s decimals)). Then Bob can execute `create()` on the contract for issuing the option, giving the following parameters:

- `side`: **Put**
- `underlyingToken`: **TokenA's address**
- `amount`: **8 \* 10^(TokenA's decimals)**
- `strikeToken`: **TokenB's address**
- `strike`: **25 \* 10^(TokenB's decimals)**
- `premiumToken`: **TokenC's address**
- `premium`: **10 \* 10^(TokenC's decimals)**
- `exerciseWindowStart`: **1689292800** *(2023-07-14 timestamp)*
- `exerciseWindowEnd`: **1689465600** *(2023-07-16 timestamp)*
- `allowed`: `[]` (open to anyone)

The issuance has ID 88.

Alice wants to be able to sell only **4** TokenA. She will first have to pay the premium (that is proportional to its share) by allowing the spending of his 10 TokenC by calling `approve(address spender, uint256 amount)` on the TokenC's contract and give as parameters the contract's address (`spender`) and for `amount`: **4\*10^(TokenA's decimals) \* 10\*10^(TokenC's decimals) / 8\*10^(TokenA's decimals)** (amountToSell \* `premium` / `amount`). She can then execute `buy(88, 4 \* 10^(TokenA's decimals))` on the contract, and will receive 4\*10^(TokenA's decimals) redeem tokens.

John, for his part, wants to sell **2** TokenA. He does the same thing and receives **2\*10^(TokensA's decimals)** redeem tokens.

We're on the 15th of July and Alice wants to exercise his option because 1 TokenA is traded at only 10 TokenB! She needs to allow the contract to transfer **4 \* 10^(TokenA's decimals)** TokenAs from her account to be able to exercise. When she calls `exercise(88, 4 \* 10^(TokenA's decimals))` on the contract, it will transfer 4\*25 TokenB to Alice and 4 TokenA to Bob.

John decided to give his right to exercise to his friend Jimmy. He did that simply by transferring his **2\*10^(TokensA's decimals)** redeem tokens to Jimmy's address.\
Jimmy decides to only sell **1** TokenA with the option. So he will give to Bob (through the contract) **1\*10^(TokenA's decimals)**.

#### Retrieve collateral

Let's say Alice never exercised his option because it wasn't profitable enough for her. To retrieve his collateral, Bob would have to wait for the current time to be greater than `exerciseWindowEnd`. In the examples, this characteristic is set to 2 days, so he would be able to get back his collateral from the 16th of July by simply calling `retrieveExpiredTokens()`.

## Rationale

This contract's concept is oracle-free, because we assume that a rational buyer will exercise his option only if it's profitable for him.

The premium is to be determined by the option writer. writer is free to choose how to calculate the premium, e.g. by using *Black-Scholes model* or something else. writer can update the premium price at will in order to adjust it according to changes on the underlying's price, volatility, time to option expiry and other such factors. Computing the premium off-chain is better for gas costs purposes.

This ERC is intended to represent vanilla options. However, exotic options can be built on top of this ERC.\
Instead of representing a single option that would be useless after the expiration date, this contract can store as many issuances as needed. Each issuance is identified by an id, and can be bought, exercised, cancelled, etc., independently of the other issuances. This is a better approach for gas costs purposes.

It's designed so that the option can be either European or American, by introduction of the `exerciseWindowStart` and `exerciseWindowEnd` data points. A buyer can only exercise between `exerciseWindowStart` and `exerciseWindowEnd`.

- If the option writer considers the option to be European, he can set the `exerciseWindowStart` in line with the expiration date, and `exerciseWindowEnd` to the expiration date + a determined time range so that buyers have a period of time to exercise.
- If the option writer considers the option to be American, he can set the `exerciseWindowStart` to the current time, and the buyer will be able to exercise the option immediately.

The contract inherently supports multiple buyers for a single option issuance. This is achieved by using ERC-1155 tokens for representing the options. When a buyer buys a fraction of the option issuance, he receives ERC-1155 tokens that represent the fraction of the option issuance. These tokens can be exchanged between users, and are used for exercising the option. With this mechanism, a buyer can decide to exercise only a fraction of what he bought.

The contract implements `allowed` array, which can be used to restrict the addresses that can buy the option issuance. This can be useful if two users agreed for an option off-chain and they want to create it on-chain. This prevents the risk that between the creation of the contract and the purchase by the second user, an on-chain user has already bought the contract.

This ERC is designed to handle ERC-20 tokens. However, this standard can be used as a good base for handling other types of tokens, such as ERC-721 tokens. Some attributes and functions signatures (to provide an id instead of an amount for instance) would have to be changed, but the general idea would remain the same.

## Security Considerations

Contract contains `exerciseWindowStart` and `exerciseWindowEnd` data points. These define the determined time range for the buyer to exercise options. When the current time is greater than `exerciseWindowEnd`, the buyer won't be able to exercise and the writer will be able to retrieve any remaining collateral.

For preventing clear arbitrage cases when option writer considers the issuance to be of European options, we would strongly advice the option writer to call `updatePremium` to considerably increase the premium price when exercise window opens. This will make sure that the bots won't be able to buy any remaining options and immediately exercise them for quick profit. Of course, this standard can be customized and maybe users will find more convenient to update the premium automatically using available tools, instead of doing it manually (especially if the premium is based on specific dynamic metrics like the *Black-Scholes model*). If the option issuance is considered to be American, such adjustment is of course not needed.

This standard implements the `updatePremium` function, which allows the writer to update the premium price at any time. This function can lead to security issues for the buyer: a buyer could buy an option, and the writer could front-run buyer's transaction by updating the premium price to a very high value. To prevent this, we advise the buyer to only allow for the agreed amount of premium to be spent by the contract, not more.

The contract supports multiple buyers for a single option issuance, meaning fractions of the option issuance can be bought. The ecosystem doesn't really support non-integers, so fractions can sometimes lead to rounding errors. This can lead to unexpected results, especially in the `exercise` and `buy` functions.

- In the `buy` function, if the premium is set, the buyer has to pay for only a fraction proportional to the amount of options he wants to buy. If that fraction is not an integer, this will truncate and therefore round to floor. This means that that writer will receive less than the expected premium. We consider this risk pretty negligible given that most tokens have a high number of decimals, but it's important to be aware of it. Some buyer could exploit this by buying repeatedly small fraction, and therefore paying less than the expected premium. However, this probably wouldn't be profitable given the gas costs.
- In the `exercise` function, the exercise cost (`(amountToExercise * selectedIssuance.data.strike) / selectedIssuance.data.amount`) is proportional to the amount of options the buyer wants to exercise. So according to the same logic, the writer will receive less than expected in case of a call option, and the buyer will receive less than expected in case of a put option. Again, this risk could be exploited, but it's probably not profitable given the gas costs. At the end of the option's life, due to this rounding, some tokens could remain in the contract. The writer can retrieve them using the `retrieveExpiredTokens()` function.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).
