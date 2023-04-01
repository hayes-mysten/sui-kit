/**
 * @file sui-kit.ts
 * @description This file is used to aggregate the tools that used to interact with SUI network.
 * @author IceFox
 * @version 0.1.0
 */
import 'colorts/lib/string'
import { RawSigner, TransactionBlock } from '@mysten/sui.js'
import { composeTransferSuiTxn } from './transfer-sui';
import { SuiAccountManager, DerivePathParams } from "./sui-account-manager";
import { SuiRpcProvider, NetworkType } from './sui-rpc-provider';
import { SuiPackagePublisher, PublishOptions } from "./sui-package-publisher";

type ToolKitParams = {
	mnemonics?: string;
	secretKey?: string;
	fullnodeUrl?: string;
	faucetUrl?: string;
	networkType?: NetworkType;
	suiBin?: string;
}
/**
 * @class SuiKit
 * @description This class is used to aggregate the tools that used to interact with SUI network.
 */
export class SuiKit {

	public accountManager: SuiAccountManager;
	public rpcProvider: SuiRpcProvider;
	public packagePublisher: SuiPackagePublisher;

	/**
	 * Support the following ways to init the SuiToolkit:
	 * 1. mnemonics
	 * 2. secretKey (base64 or hex)
	 * If none of them is provided, will generate a random mnemonics with 24 words.
	 *
	 * @param mnemonics, 12 or 24 mnemonics words, separated by space
	 * @param secretKey, base64 or hex string, when mnemonics is provided, secretKey will be ignored
	 * @param networkType, 'testnet' | 'mainnet' | 'devnet', default is 'devnet'
	 * @param fullnodeUrl, the fullnode url, default is the preconfig fullnode url for the given network type
	 * @param faucetUrl, the faucet url, default is the preconfig faucet url for the given network type
	 * @param suiBin, the path to sui cli binary, default to 'cargo run --bin sui'
	 */
	constructor({ mnemonics, secretKey, networkType, fullnodeUrl, faucetUrl, suiBin }: ToolKitParams = {}) {
		// Init the account manager
		this.accountManager = new SuiAccountManager({ mnemonics, secretKey });
		// Init the rpc provider
		this.rpcProvider = new SuiRpcProvider({ fullnodeUrl, faucetUrl, networkType });
		// Init the package publisher
		this.packagePublisher = new SuiPackagePublisher(suiBin);
	}

	/**
	 * if derivePathParams is not provided or mnemonics is empty, it will return the currentSigner.
	 * else:
	 * it will generate signer from the mnemonic with the given derivePathParams.
	 */
	getSigner(derivePathParams?: DerivePathParams) {
		const keyPair = this.accountManager.getKeyPair(derivePathParams);
		return new RawSigner(keyPair, this.rpcProvider.provider);
	}

	/**
	 * @description Switch the current account with the given derivePathParams
	 * @param derivePathParams, such as { accountIndex: 2, isExternal: false, addressIndex: 10 }, comply with the BIP44 standard
	 */
	switchAccount(derivePathParams: DerivePathParams) {
		this.accountManager.switchAccount(derivePathParams);
	}

	/**
	 * @description Get the address of the account for the given derivePathParams
	 * @param derivePathParams, such as { accountIndex: 2, isExternal: false, addressIndex: 10 }, comply with the BIP44 standard
	 */
	getAddress(derivePathParams?: DerivePathParams) {
		return this.accountManager.getAddress(derivePathParams);
	}
	currentAddress() { return this.accountManager.currentAddress }

	/**
	 * Request some SUI from faucet
	 * @Returns {Promise<boolean>}, true if the request is successful, false otherwise.
	 */
	async requestFaucet(derivePathParams?: DerivePathParams) {
		const addr = this.accountManager.getAddress(derivePathParams);
		return this.rpcProvider.requestFaucet(addr);
	}

	async getBalance(coinType?: string, derivePathParams?: DerivePathParams) {
		const owner = this.accountManager.getAddress(derivePathParams);
		return this.rpcProvider.getBalance(owner, coinType);
	}

	async signTxn(tx: Uint8Array | TransactionBlock, derivePathParams?: DerivePathParams) {
		const signer = this.getSigner(derivePathParams);
		return signer.signTransactionBlock({ transactionBlock: tx });
	}

	async signAndSendTxn(tx: Uint8Array | TransactionBlock, derivePathParams?: DerivePathParams) {
		const signer = this.getSigner(derivePathParams);
		return signer.signAndExecuteTransactionBlock({ transactionBlock: tx  })
	}

	/**
	 * publish the move package at the given path
	 * It starts a child process to call the "sui binary" to build the move package
	 * The building process takes place in a tmp directory, which would be cleaned later
	 * @param packagePath
	 */
	async publishPackage(packagePath: string, options?: PublishOptions, derivePathParams?: DerivePathParams) {
		const signer = this.getSigner(derivePathParams);
		return this.packagePublisher.publishPackage(packagePath, signer)
	}

	async transferSui(to: string, amount: number, derivePathParams?: DerivePathParams) {
		const tx = composeTransferSuiTxn(to, amount);
		return this.signAndSendTxn(tx, derivePathParams);
	}
}