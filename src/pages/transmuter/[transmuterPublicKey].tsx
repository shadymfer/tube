import type { NextPage } from "next";
import Head from "next/head";
import { TransmuterView } from "../../views";
import { useRouter } from "next/router";
import { formatPublickey } from "../../utils/helpers";
const Transmuter: NextPage = (props) => {
	const router = useRouter();

	let { transmuterPublicKey } = router.query;
	transmuterPublicKey = transmuterPublicKey as string;
	return (
		<div>
			<Head>
				<title>The Tubes - Shadies {transmuterPublicKey}</title>
				<meta name="og:title" content={`Shadies - Tube ${formatPublickey(transmuterPublicKey)}`} key="ogtitle" />
				<meta name="description" content="Shadies - Tube   ${formatPublickey(transmuterPublicKey)}" />
				<meta property="og:type" content="website" />
				<meta property="og:url" content="/" />
				<meta property="og:title" content={`Shadies - Tube ${formatPublickey(transmuterPublicKey)}`} />
				<meta property="og:description" content={`Shadies - Tube ${formatPublickey(transmuterPublicKey)}`} />
				{/* <meta property="og:image" content="/images/_.png" data-rh="true" /> */}

				<meta property="twitter:card" content="summary_large_image" />
				<meta property="twitter:url" content="/" />
				<meta property="twitter:title" content={`Shadies - Tube ${formatPublickey(transmuterPublicKey)}`} />
				<meta property="twitter:description" content={`Shadies - Tube ${formatPublickey(transmuterPublicKey)}`} />
				{/* <meta property="twitter:image" content="/images/_.png" /> */}
			</Head>
			<TransmuterView />
		</div>
	);
};

export default Transmuter;
