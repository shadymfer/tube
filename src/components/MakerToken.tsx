import { useEffect, useState } from "react"
import { TrendingUpIcon } from "@heroicons/react/outline";
import GradientAvatar from "components/GradientAvatar";
import { useConnection } from "@solana/wallet-adapter-react";

import { formatPublickey } from "../utils/helpers";

export function MakerToken({ token, mutationData, vaultId }) {
	const { connection } = useConnection()
	const { mint, amountPerUse } = token
	const [decimals, setDecimals] = useState(null)

	useEffect(() => {
		const fetchDecimals = async () => {
			const { value } = await connection.getParsedAccountInfo(mint)
			setDecimals(value?.data?.["parsed"].info?.decimals)
		}
		fetchDecimals()
	}, [])




	return (
		<div>
			<div className="py-5 border-gray-200 text-gray-200">
				{/* <h3 className="text-xl leading-6 font-medium text-gray-200">
					<span className="text-bold">🧬 This Tube will evolve your "vesseL" into a "seaLed vesseL" 🧬</span>
				</h3> */}
				<div className="items-center font-bold text-lg mt-2">

					<span className="text-gray-200 pl-1 text-center">Evolution to </span>
					<span className="bg-purple-900 text-center text-amber-300 font-large pl-1.5 pr-1.5 rounded-full">{amountPerUse / Math.pow(10, decimals)}</span>
					<span className="text-gray-200 pl-1 ">"seaLed vesseL"{amountPerUse.toNumber() > 1 && "."}</span>
				</div>
			</div>

			{/* <div className="space-x-2 pt-5 flex items-center">
				<GradientAvatar width={7} height={7} hash={mint.toBase58()} />

				<span className="pl-2">{formatPublickey(mint.toBase58())}</span>
			</div> */}
		</div>
	)
}