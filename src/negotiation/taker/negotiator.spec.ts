import { MockBitcoinWallet } from "../../__mocks__/bitcoin_wallet";
import { Cnd } from "../../cnd";
import { ComitClient } from "../../comit_client";
import { EthereumWallet } from "../../ethereum_wallet";
import {
  // @ts-ignore: tslint does not know that this is actually ./__mocks__/maker_client
  mockGetExecutionParams,
  // @ts-ignore: tslint does not know that this is actually ./__mocks__/maker_client
  mockGetOrderByTradingPair
} from "./maker_client";
import { Negotiator } from "./negotiator";
import { TakerCriteria } from "./order";

jest.mock("./maker_client");
jest.mock("../../ethereum_wallet");
jest.mock("../../cnd");

const defaultCnd = new Cnd("");
const defaultComitClient = new ComitClient(defaultCnd);
defaultComitClient.bitcoinWallet = new MockBitcoinWallet();
defaultComitClient.ethereumWallet = new EthereumWallet("");

describe("Taker Negotiator", () => {
  beforeEach(() => {
    mockGetOrderByTradingPair.mockClear();
    mockGetExecutionParams.mockClear();
  });

  it("Search an order and takes it", async () => {
    const takerNegotiator = new Negotiator(defaultComitClient, "");

    // Define criteria for the order such as the assets and ledgers
    // But also min/max amounts we are looking to trade
    const takerCriteria: TakerCriteria = {
      buy: {
        ledger: "bitcoin",
        asset: "bitcoin",
        minNominalAmount: "2"
      },
      sell: {
        ledger: "ethereum",
        asset: "ether"
      }
    };

    // Ask the maker if there are any orders that matches the criteria
    const order = await takerNegotiator.getOrder(takerCriteria);

    // We expect the returned order to be valid, if not
    // this maker may be broken or malicious
    expect(order.isValid()).toBeTruthy();

    // The returned order may or may not match the criteria,
    // while it is expected that the maker returns correct
    // assets/Ledgers, it may not be the case. Or the proposed
    // order may not have amounts matching the criteria
    expect(order.matches()).toBeTruthy();

    // Takes the order by starting the swap execution and
    // announcing to the maker that we have done so.
    await order.take();
  });

  it("Returns an order with the correct trading pair, given buy/sell input", async () => {
    const takerNegotiator = new Negotiator(defaultComitClient, "");

    const takerCriteria: TakerCriteria = {
      buy: {
        ledger: "bitcoin",
        asset: "bitcoin",
        minNominalAmount: "2"
      },
      sell: {
        ledger: "ethereum",
        asset: "ether"
      }
    };

    const order = await takerNegotiator.getOrder(takerCriteria);

    expect(order.rawOrder).toHaveProperty("bid.ledger", "bitcoin");
    expect(order.rawOrder).toHaveProperty("bid.asset", "bitcoin");
    expect(order.rawOrder).toHaveProperty("ask.ledger", "ethereum");
    expect(order.rawOrder).toHaveProperty("ask.asset", "ether");

    expect(mockGetOrderByTradingPair).toHaveBeenCalledTimes(1);
    expect(mockGetExecutionParams).toHaveBeenCalledTimes(0);
  });
});
