import axios, { AxiosInstance, AxiosPromise, AxiosResponse } from "axios";
import actionToHttpRequest, {
  FieldValueResolverFn
} from "./action_to_http_request";
import { problemResponseInterceptor } from "./axios_rfc7807_middleware";
import { Action, EmbeddedRepresentationSubEntity, Entity } from "./siren";

interface GetInfo {
  id: string;
  listen_addresses: string[]; // multiaddresses
}

export interface Ledger {
  name: string;
  chain_id?: number;
  network?: string;
}

export interface Asset {
  name: string;
  quantity: string;
  token_contract?: string;
}

export interface Peer {
  peer_id: string;
  address_hint: string;
}

/**
 * The parameters that the two parties have agreed on for swap execution.
 *
 * The swap request is sent by the party in the role of Alice to initiate a swap with Bob.
 */
export interface SwapRequest {
  alpha_ledger: Ledger;
  alpha_asset: Asset;
  beta_ledger: Ledger;
  beta_asset: Asset;
  alpha_expiry?: number;
  beta_expiry?: number;
  alpha_ledger_refund_identity?: string;
  beta_ledger_redeem_identity?: string;
  peer: Peer;
}

export interface BitcoinSendAmountToAddressPayload {
  to: string;
  amount: string;
  network: string;
}

export interface BitcoinBroadcastSignedTransactionPayload {
  hex: string;
  network: string;
}

export interface EthereumDeployContractPayload {
  data: string;
  amount: string;
  gas_limit: string;
  network: string;
}

export interface EthereumCallContractPayload {
  contract_address: string;
  data: string;
  gas_limit: string;
  network: string;
}

export interface LndSendPaymentPayload {
  self_public_key: string;
  to_public_key: string;
  amount: string;
  secret_hash: string;
  final_cltv_delta: number;
  chain: string;
  network: string;
}

export interface LndAddHoldInvoicePayload {
  self_public_key: string;
  amount: string;
  secret_hash: string;
  expiry: number;
  cltv_expiry: number;
  chain: string;
  network: string;
}

export interface LndSettleInvoicePayload {
  self_public_key: string;
  secret: string;
  chain: string;
  network: string;
}

export type LedgerAction =
  | {
      type: "bitcoin-send-amount-to-address";
      payload: BitcoinSendAmountToAddressPayload;
    }
  | {
      type: "bitcoin-broadcast-signed-transaction";
      payload: BitcoinBroadcastSignedTransactionPayload;
    }
  | {
      type: "ethereum-deploy-contract";
      payload: EthereumDeployContractPayload;
    }
  | {
      type: "ethereum-call-contract";
      payload: EthereumCallContractPayload;
    }
  | {
      type: "lnd-send-payment";
      payload: LndSendPaymentPayload;
    }
  | {
      type: "lnd-add-hold-invoice";
      payload: LndAddHoldInvoicePayload;
    }
  | {
      type: "lnd-settle-invoice";
      payload: LndSettleInvoicePayload;
    }
  | {
      type: string;
      payload: any;
    };

export interface SwapDetails extends Entity {
  properties?: SwapProperties;
}

export interface SwapSubEntity extends EmbeddedRepresentationSubEntity {
  properties?: SwapProperties;
}

export interface SwapProperties {
  /**
   * The id of the swap.
   */
  id: string;
  /**
   * The peer-id of the counterparty of this swap.
   */
  counterparty: string;
  /**
   * The role in which you are participating in this swap.
   */
  role: "Alice" | "Bob";
  /**
   * The cryptographic protocol that is employed in this swap.
   */
  protocol: string;
  /**
   * The status this swap is currently in.
   */
  status: "IN_PROGRESS" | "SWAPPED" | "NOT_SWAPPED" | "INTERNAL_FAILURE";
  /**
   * The parameters of this swap.
   */
  parameters: {
    alpha_asset: Asset;
    alpha_ledger: Ledger;
    beta_asset: Asset;
    beta_ledger: Ledger;
    [k: string]: any;
  };
  /**
   * The detailed state of the swap.
   */
  state?: {
    /**
     * The state of the alpha ledgers regarding the swap.
     */
    alpha_ledger: {
      /**
       * The transaction ID of the deployment transaction on the alpha ledgers.
       */
      deploy_tx: string | null;
      fund_tx: string | null;
      htlc_location: any;
      redeem_tx: string | null;
      refund_tx: string | null;
      /**
       * The status of the HTLC on the alpha ledgers.
       */
      status:
        | "NOT_DEPLOYED"
        | "DEPLOYED"
        | "FUNDED"
        | "REDEEMED"
        | "REFUNDED"
        | "INCORRECTLY_FUNDED";
      [k: string]: any;
    };
    /**
     * The state of the beta ledgers regarding the swap.
     */
    beta_ledger: {
      /**
       * The transaction ID of the deployment transaction on the beta ledgers.
       */
      deploy_tx: string | null;
      fund_tx: string | null;
      htlc_location: any;
      redeem_tx: string | null;
      refund_tx: string | null;
      /**
       * The status of the HTLC on the beta ledgers.
       */
      status:
        | "NOT_DEPLOYED"
        | "DEPLOYED"
        | "FUNDED"
        | "REDEEMED"
        | "REFUNDED"
        | "INCORRECTLY_FUNDED";
      [k: string]: any;
    };
    /**
     * The state created during the communication of the two parties regarding the swap.
     */
    communication: {
      /**
       * The expiry value of the HTLC on the alpha ledgers. The semantic value depends on the ledgers.
       */
      alpha_expiry: number;
      alpha_redeem_identity: string | null;
      alpha_refund_identity: string | null;
      beta_expiry: number;
      beta_redeem_identity: string | null;
      beta_refund_identity: string | null;
      secret_hash: string;
      status: "SENT" | "ACCEPTED" | "REJECTED";
      [k: string]: any;
    };
    [k: string]: any;
  };
  [k: string]: any;
}

/**
 * Facilitates access to the [COMIT network daemon (cnd)](@link https://github.com/comit-network/comit-rs) REST API.
 */
export class Cnd {
  private readonly client: AxiosInstance;

  public constructor(cndUrl: string) {
    this.client = axios.create({
      baseURL: cndUrl
    });
    this.client.interceptors.response.use(
      response => response,
      problemResponseInterceptor
    );
  }

  public async getPeerId(): Promise<string> {
    const info = await this.getInfo();
    if (!info.id) {
      throw new Error("id field not present");
    }

    return info.id;
  }

  public async getPeerListenAddresses(): Promise<string[]> {
    const info = await this.getInfo();
    if (!info.listen_addresses) {
      throw new Error("listen addresses field not present");
    }

    return info.listen_addresses;
  }

  public async postSwap(swap: SwapRequest): Promise<string> {
    const response = await this.client.post("swaps/rfc003", swap);

    return response.headers.location;
  }

  public async getSwaps(): Promise<SwapSubEntity[]> {
    const response = await this.fetch("swaps");
    const entity = response.data as Entity;

    return entity.entities as SwapSubEntity[];
  }

  public fetch<T>(path: string): AxiosPromise<T> {
    return this.client.get(path);
  }

  public async executeSirenAction(
    action: Action,
    resolver?: FieldValueResolverFn
  ): Promise<AxiosResponse> {
    const request = await actionToHttpRequest(action, resolver);

    return this.client.request(request);
  }

  /**
   * Post a swap request on the lightning REST API route of cnd `/swaps/han/ethereum/ether/halight/lightning/bitcoin`
   * @param body The body to set in the request. The design being not yet finalised it is optional and of type `any`
   * @return The location of the swap (href) as returned by the REST API in the location header.
   */
  public async createHanEthereumEtherHalightLightningBitcoin(
    body?: any
  ): Promise<string> {
    const response = await this.client.post(
      "swaps/han/ethereum/ether/halight/lightning/bitcoin",
      body
    );

    return response.headers.location;
  }

  /**
   * Post a swap request on the lightning REST API route of cnd `/swaps/herc20/ethereum/erc20/halight/lightning/bitcoin`
   * @param body The body to set in the request. The design being not yet finalised it is optional and of type `any`
   * @return The location of the swap (href) as returned by the REST API in the location header.
   */
  public async createHerc20EthereumErc20HalightLightningBitcoin(
    body?: any
  ): Promise<string> {
    const response = await this.client.post(
      "swaps/herc20/ethereum/erc20/halight/lightning/bitcoin",
      body
    );

    return response.headers.location;
  }

  /**
   * Post a swap request on the lightning REST API route of cnd `/swaps/halight/lightning/bitcoin/han/ethereum/ether`
   * @param body The body to set in the request. The design being not yet finalised it is optional and of type `any`
   * @return The location of the swap (href) as returned by the REST API in the location header.
   */
  public async createHalightLightningBitcoinHanEthereumEther(
    body?: any
  ): Promise<string> {
    const response = await this.client.post(
      "swaps/halight/lightning/bitcoin/han/ethereum/ether",
      body
    );

    return response.headers.location;
  }

  /**
   * Post a swap request on the lightning REST API route of cnd `/swaps/halight/lightning/bitcoin/herc20/ethereum/erc20`
   * @param body The body to set in the request. The design being not yet finalised it is optional and of type `any`
   * @return The location of the swap (href) as returned by the REST API in the location header.
   */
  public async createHalightLightningBitcoinHerc20EthereumErc20(
    body?: any
  ): Promise<string> {
    const response = await this.client.post(
      "swaps/halight/lightning/bitcoin/herc20/ethereum/erc20",
      body
    );

    return response.headers.location;
  }

  private async getInfo(): Promise<GetInfo> {
    const response = await this.client.get("/");

    return response.data;
  }
}
