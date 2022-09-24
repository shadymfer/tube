// Next, React
import { FC, useEffect, useState } from "react";

// Wallet
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

// Store
import { RefreshIcon, ClockIcon, BeakerIcon, CheckCircleIcon } from "@heroicons/react/outline";
import useTransmuterStore from "../../stores/useTransmuterStore";

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useRouter } from "next/router";
import { TransmuterWrapper, MutationWrapper, MutationData } from "@gemworks/transmuter-ts";
import { parseWhitelistType } from "../../utils/helpers";
import { findWhitelistProofPDA } from "@gemworks/gem-farm-ts";

import { ToastContainer, toast } from "react-toastify";
import { parseSecondsToDate } from "../../utils/helpers";

import { SelectedTokens } from "../../interfaces/index";
import { Vaults } from "../../components/Vaults";
import useGembankClient from "../../hooks/useGemBankClient";
import { programs } from "@metaplex/js";
import { AppBar } from "components/AppBar";
const {
	metadata: { Metadata },
} = programs;

export const MutationView: FC = ({ }) => {
	const wallet = useWallet();
	const { connection } = useConnection();
	const [transmuterWrapper, setTransmuterWrapper] = useState<TransmuterWrapper>(null);
	const [mutationWrapper, setMutationWrapper] = useState<MutationWrapper>(null);
	const [mutationData, setMutationData] = useState<any>(null);
	const { initTransmuterClient } = useTransmuterStore();
	const router = useRouter();
	const transmuterClient = useTransmuterStore((s) => s.transmuterClient);
	const { mutationPublicKey } = router.query;
	const gemBankClient = useGembankClient()
	const [takerBankWhitelist, setTakerBankWhitelist] = useState(null);
	const [selectedTokens, setSelectedTokens] = useState<SelectedTokens>({});
	const [mutationOwner, setMutationOwner] = useState<PublicKey>(null);
	const [mutationReceipt, setMutationReceipt] = useState(null);
	const [timeLeft, setTimeLeft] = useState<{ raw: number; formatted: string }>({ raw: -99, formatted: "" });
	useEffect(() => {
		if (wallet.publicKey && connection) {
			initTransmuterClient(wallet, connection);
		}
	}, [wallet.publicKey, connection]);

	useEffect(() => {
		if (transmuterClient && wallet.publicKey && gemBankClient && mutationPublicKey) {
			getMutation();
		}

		if (!wallet.publicKey) {
			setTimeLeft({ raw: -99, formatted: "" });
			setMutationReceipt(null);
		}
	}, [mutationPublicKey, transmuterClient, wallet.publicKey, gemBankClient]);

	async function getMutation() {
		const mutationPk = new PublicKey(mutationPublicKey);
		const mutationData = await transmuterClient.programs.Transmuter.account.mutation.fetch(mutationPk);
		setMutationData(mutationData);

		const mutationWrapper_ = new MutationWrapper(transmuterClient, mutationPk, mutationData.transmuter, mutationData);
		setMutationWrapper(mutationWrapper_);

		const transmuterData = await transmuterClient.programs.Transmuter.account.transmuter.fetch(mutationData.transmuter);
		const { bankA, bankB, bankC, owner } = transmuterData;
		setMutationOwner(owner);

		//WRAPPER
		const transmuterWrapper_ = new TransmuterWrapper(transmuterClient, mutationData.transmuter, bankA, bankB, bankC, transmuterData);

		//RECEIPT
		setTimeLeft({ raw: -99, formatted: "" });
		const receipts = await transmuterClient.findAllReceipts(undefined, mutationPk);
		const takerReceipt = receipts.filter((receipt) => receipt.account.taker.toBase58() === wallet.publicKey.toBase58());
		if (takerReceipt.length > 0) {
			const timeUntilFinished = takerReceipt[0].account.mutationCompleteTs.toNumber() - Math.floor(Date.now() / 1000);

			const formattedTime = parseSecondsToDate(timeUntilFinished);
			if (timeUntilFinished > 0) {
				setTimeLeft({ raw: timeUntilFinished, formatted: formattedTime });
				//@ts-ignore
			} else if (takerReceipt[0].account.state?.notStarted) {
				setTimeLeft({ raw: -99, formatted: "" });
			} else {
				setTimeLeft({ raw: 0, formatted: formattedTime });
			}

			setMutationReceipt(takerReceipt[0].account);
		}

		const bankAWhitelist = await getAllWhitelistedPDAs(bankA);
		const bankBWhitelist = await getAllWhitelistedPDAs(bankB);
		const bankCWhitelist = await getAllWhitelistedPDAs(bankC);

		setTakerBankWhitelist({
			[bankA.toBase58()]: bankAWhitelist,
			[bankB.toBase58()]: bankBWhitelist,
			[bankC.toBase58()]: bankCWhitelist,
		});

		setTransmuterWrapper(transmuterWrapper_);
	}

	useEffect(() => {
		// exit early when we reach 0
		if (!timeLeft.raw || timeLeft.raw === -99) return;

		// save intervalId to clear the interval when the
		// component re-renders
		const intervalId = setInterval(() => {
			const formattedTime = parseSecondsToDate(timeLeft.raw - 1);

			setTimeLeft({ raw: timeLeft.raw - 1, formatted: formattedTime });
		}, 1000);

		// clear interval on re-render to avoid memory leaks
		return () => clearInterval(intervalId);
		// add timeLeft as a dependency to re-rerun the effect
		// when we update it
	}, [timeLeft]);

	async function executeMutation() {
		//claim tokens
		if (mutationReceipt?.state?.pending && timeLeft.raw === 0) {
			//execute mutation
			const { tx } = await mutationWrapper.execute(wallet.publicKey, undefined, mutationOwner);
			const { signature } = await tx.confirm();

			if (signature) {
				await getMutation();
			}
			return;
		}

		// reverse mutation
		if (mutationReceipt?.state?.complete && mutationData?.config.reversible) {
			const { tx } = await mutationWrapper.reverse(wallet.publicKey, mutationOwner);
			const { signature } = await tx.confirm();

			if (signature) {
				await getMutation();
			}
			return;
		}

		//check if tokens were selected by user
		Object.keys(mutationData?.config).forEach((key) => {
			if (key.includes("takerToken") && mutationData?.config[key].requiredAmount.toNumber() > 0) {
				if (selectedTokens[mutationData?.config[key]?.gemBank.toBase58()] === undefined) {
					throw new Error("missing required tokens. please select tokens for each required vault.");
				}
			}
		});

		//check if same tokens were selected by user
		Object.keys(mutationData?.config).forEach((key) => {
			if (key.includes("takerToken") && mutationData?.config[key].requiredAmount.toNumber() > 0) {
				if (selectedTokens[mutationData?.config.takerTokenA?.gemBank.toBase58()]?.mint === selectedTokens[mutationData?.config.takerTokenB?.gemBank.toBase58()]?.mint) {
					throw new Error("Same tokens selected, select diff tokens.");
				}
			}
		});

		//check if same tokens were selected by user
		Object.keys(mutationData?.config).forEach((key) => {
			if (key.includes("takerToken") && mutationData?.config[key].requiredAmount.toNumber() > 0) {
				if (selectedTokens[mutationData?.config.takerTokenB?.gemBank.toBase58()]?.mint === selectedTokens[mutationData?.config.takerTokenC?.gemBank.toBase58()]?.mint) {
					throw new Error("Same tokens selected, select diff tokens.");
				}
			}
		});

		//check if same tokens were selected by user
		Object.keys(mutationData?.config).forEach((key) => {
			if (key.includes("takerToken") && mutationData?.config[key].requiredAmount.toNumber() > 0) {
				if (selectedTokens[mutationData?.config.takerTokenA?.gemBank.toBase58()]?.mint === selectedTokens[mutationData?.config.takerTokenC?.gemBank.toBase58()]?.mint) {
					throw new Error("Same tokens selected, select diff tokens.");
				}
			}
		});

		if (mutationWrapper && transmuterWrapper) {
			//@TODO
			//if taker vaults already initiated, fetch PDAs of existing vaults
			const vaultA = await mutationWrapper.initTakerVault(transmuterWrapper.bankA, wallet.publicKey);
			const vaultB = await mutationWrapper.initTakerVault(transmuterWrapper.bankB, wallet.publicKey);
			const vaultC = await mutationWrapper.initTakerVault(transmuterWrapper.bankC, wallet.publicKey);

			// //init all three taker vaults in one trx
			const largeTx = vaultA.tx.combine(vaultB.tx).combine(vaultC.tx);
			await largeTx.confirm();

			const { isFromWhiteList, mint, creatorPk } = selectedTokens[mutationData?.config.takerTokenA?.gemBank.toBase58()];

			const [mintProof, bump] = await findWhitelistProofPDA(transmuterWrapper.bankA, new PublicKey(mint));
			let creatorProof_;
			if (creatorPk !== undefined && creatorPk !== "") {
				const [creatorProof, bump2] = await findWhitelistProofPDA(transmuterWrapper.bankA, new PublicKey(creatorPk));
				creatorProof_ = creatorProof;
			}
			const ataTokenA = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
				mint: new PublicKey(mint),
			});

			const metadataPDA = await Metadata.getPDA(new PublicKey(mint));
			await gemBankClient.depositGem(
				transmuterWrapper.bankA,
				vaultA.vault,
				wallet.publicKey,
				mutationData.config.takerTokenA.requiredAmount,
				new PublicKey(mint),
				ataTokenA.value[0].pubkey,
				isFromWhiteList && mintProof,
				// @TODO add metadata support
				metadataPDA,
				isFromWhiteList && creatorProof_ && creatorProof_
			);

			if (selectedTokens[mutationData?.config.takerTokenB?.gemBank.toBase58()]?.mint !== undefined) {
				const { isFromWhiteList, mint, creatorPk } = selectedTokens[mutationData?.config.takerTokenB?.gemBank.toBase58()];
				const [mintProof, bump] = await findWhitelistProofPDA(transmuterWrapper.bankB, new PublicKey(mint));
				let creatorProof_;
				if (creatorPk !== undefined && creatorPk !== "") {
					const [creatorProof, bump2] = await findWhitelistProofPDA(transmuterWrapper.bankB, new PublicKey(creatorPk));
					creatorProof_ = creatorProof;
				}
				const ataTokenB = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
					mint: new PublicKey(mint),
				});
				const metadataPDA = await Metadata.getPDA(new PublicKey(mint));
				await gemBankClient.depositGem(
					transmuterWrapper.bankB,
					vaultB.vault,
					wallet.publicKey,
					mutationData.config.takerTokenB.requiredAmount,
					new PublicKey(mint),
					ataTokenB.value[0].pubkey,
					isFromWhiteList && mintProof,

					// @TODO add metadata support
					metadataPDA,
					isFromWhiteList && creatorProof_ && creatorProof_
				);
			}

			if (selectedTokens[mutationData?.config.takerTokenC?.gemBank.toBase58()]?.mint !== undefined) {
				const { isFromWhiteList, mint, creatorPk } = selectedTokens[mutationData?.config.takerTokenC?.gemBank.toBase58()];
				const [mintProof, bump] = await findWhitelistProofPDA(transmuterWrapper.bankC, new PublicKey(mint));
				let creatorProof_;
				if (creatorPk !== undefined && creatorPk !== "") {
					const [creatorProof, bump2] = await findWhitelistProofPDA(transmuterWrapper.bankC, new PublicKey(creatorPk));
					creatorProof_ = creatorProof;
				}
				const metadataPDA = await Metadata.getPDA(new PublicKey(mint));
				const ataTokenC = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
					mint: new PublicKey(mint),
				});
				await gemBankClient.depositGem(
					transmuterWrapper.bankC,
					vaultC.vault,
					wallet.publicKey,
					mutationData.config.takerTokenC.requiredAmount,
					new PublicKey(mint),
					ataTokenC.value[0].pubkey,
					isFromWhiteList && mintProof,

					// @TODO add metadata support
					metadataPDA,
					isFromWhiteList && creatorProof_ && creatorProof_
				);
			}

			//execute mutation
			const { tx } = await mutationWrapper.execute(wallet.publicKey, undefined, mutationOwner);
			const { signature } = await tx.confirm();

			if (signature) {
				await getMutation();
			}
		}
	}

	async function getAllWhitelistedPDAs(bank: PublicKey) {
		const whitelistPdas = await gemBankClient?.fetchAllWhitelistProofPDAs(bank);
		const whitelistPdas_ = whitelistPdas?.map((item) => {
			return {
				whiteListType: parseWhitelistType(item.account.whitelistType),
				publicKey: item.account.whitelistedAddress.toBase58(),
			};
		});

		return whitelistPdas_;
	}

	return (
		<div className=" bg-cover min-h-screen bg-[url('/images/lab.jpg')]">
			<ToastContainer theme="colored" />
			<header>
				<div className=" text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
					<div className="pt-8 pb-4 flex flex-col items-center align-center justify-center">
						<img src="/images/vessel.gif" className="rounded-xl justify-center w-2/6 h-2/6" alt="vessel" />
						<img src="/images/txt.png" className="mt-4 rounded-xl justify-center w-1/6 h-1/6" alt="vessel" />
					</div>


					<h1 className="text-3xl font-bold leading-tight text-white uppercase">🧪 SHADIES TEST TUBE #1{/* {new TextDecoder().decode(new Uint8Array(mutationData?.name))}*/}</h1>

					<div className="flex flex-col sm:flex-row items-center text-sm flex-wrap justify-center sm:space-x-4">
						<div className="flex items-center ">
							{/* <BeakerIcon className="h-5 w-5 text-gray-400" aria-hidden="true" /> */}
							<span className="text-gray-50 font-medium pl-1.5">
								{mutationData?.totalUses.toNumber() - mutationData?.remainingUses.toNumber()}/{mutationData?.totalUses.toNumber()}
							</span>
							<span className="text-gray-50 font-bold pl-1">⚡ Charges remaining </span>
						</div>

						<div className="flex items-center">
							{/* <ClockIcon className="h-5 w-5 text-gray-400" aria-hidden="true" /> */}
							<span className="text-gray-50 font-medium pl-1.5">{mutationData?.config?.mutationDurationSec.toNumber()}s</span>
							<span className="text-gray-50 font-bold pl-1">⏳ to evolve</span>
						</div>
						{/* <div className="flex items-center">
							<RefreshIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
							<span className="text-gray-800 font-medium pl-1.5">{mutationData?.config?.reversible ? "reversable" : "irreversible"}</span>
						</div> */}
						<div className="flex items-center">
							<img src="/images/solana.png" className="w-4 h-4" alt="solana_logo" />
							<span className="text-gray-50 font-medium pl-1.5">{mutationData?.config?.price?.priceLamports.toNumber() / LAMPORTS_PER_SOL} SOL </span>
							<span className="text-gray-50 font-bold pl-1">needed</span>
						</div>
						{mutationData?.config.reversible && (
							<div className="flex items-center">
								<img src="/images/solana.png" className="w-4 h-4" alt="solana_logo" />
								<span className="text-gray-800 font-medium pl-1.5">{mutationData?.config?.price?.reversalPriceLamports.toNumber() / LAMPORTS_PER_SOL} SOL </span>
								<span className="text-gray-50 font-bold pl-1">to reverse</span>
							</div>
						)}
					</div>


					{(mutationReceipt?.state?.complete || mutationReceipt?.state?.pending) && (
						<div className="mt-8 text-center flex items-center text-xl text-gray-50 font-medium sm:mr-6 sm:mt-2 justify-center">
							{mutationReceipt?.state?.pending && timeLeft.raw > 0 && (
								<>
									{" "}
									{/* <ClockIcon className="text-center flex-shrink-0 mr-1.5 h-5 w-5 text-yellow-400" aria-hidden="true" /> */}
									⏲️ {timeLeft.formatted} <span className="text-gray-50 pl-1.5">til vesseL is released.</span>
								</>
							)}
							{mutationReceipt?.state?.pending && timeLeft.raw === 0 && (
								<>
									{" "}
									{/* <ClockIcon className="text-center flex-shrink-0 mr-1.5 h-5 w-5 text-yellow-400" aria-hidden="true" /> */}
									📦 Tube shake done, time to collect!!
								</>
							)}

							{mutationReceipt?.state?.complete && (
								<>
									{" "}
									{/* <CheckCircleIcon className="text-center flex-shrink-0 mr-1.5 h-5 w-5 text-green-400" aria-hidden="true" /> */}
									✅ TUBE USED - GET ANOTHER ONE!
								</>
							)}
						</div>
					)}
				</div>
			</header>
			<main>
				<div className="text-center max-w-7xl mx-auto sm:px-6 lg:px-8">
					{/* Replace with your content */}
					<div className="px-4 py-4 sm:px-0 ">
						{/* MAKER VAULTS */}

						{mutationData !== null && takerBankWhitelist !== null && (
							<Vaults
								selectedTokens={selectedTokens}
								wallet={wallet}
								mutationData={mutationData}
								takerBankWhitelist={takerBankWhitelist}
								connection={connection}
								setSelectedTokens={setSelectedTokens}
							/>
						)}
					</div>
					<button
						onClick={() => {
							toast.promise(
								executeMutation,
								{
									pending: "Shaking..",
									success: "Shaking Done! LFG!",
									error: {
										render({ data }) {
											//@ts-expect-error
											return data.message;
										},
									},
								},
								{
									position: "bottom-center",
								}
							);
						}}
						disabled={!wallet.publicKey || (mutationReceipt?.state?.pending && timeLeft.raw > 0) || (mutationReceipt?.state?.complete && !mutationData?.config.reversible)}
						type="button"
						className="disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-base font-medium text-white bg-amber-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 duration-150 transition-all ease-in rounded-lg"
					>
						{/* <BeakerIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" /> */}
						{mutationReceipt?.state?.pending && timeLeft.raw > 0 && `🧬 Tube Shaking`}
						{mutationReceipt?.state?.pending && timeLeft.raw === 0 && `⚡ Claim from Tube`}
						{mutationReceipt?.state?.complete && mutationData?.config.reversible && `Reverse mutation`}
						{mutationReceipt?.state?.complete && !mutationData?.config.reversible && `👨🏾‍🔬 Shake the Tube!`}
						{timeLeft.raw === -99 && (!mutationReceipt || mutationReceipt?.state?.notStarted) && "👨🏾‍🔬 Shake the Tube!"}
					</button>
				</div>
			</main>
			{/* <div className='mt-40 flex flex-col items-center align-center justify-center text-center w-full text-white rounded-lg'>
				<h2 className='text-sm text-center'>No "vesseL" yet? 🧬</h2>
				<a href="/">
					<h2 className='text-md font-bold'> MINT YOUR VESSEL HERE!</h2>
				</a>
			</div> */}
			<div className='items-center justify-center text-center lg:w-6/6 text-white font-bold mt-20 pb-10'>
				<h2 className='text-xs'>Coded in the Shadows | 👻 TSC Buidl</h2>
				<a href="/">
					<h2 className='text-xs font-bold mt-2'> CLICK HERE TO JOIN OUR ⌛ DISCORD</h2>
				</a>
			</div>
		</div>

	);
};
