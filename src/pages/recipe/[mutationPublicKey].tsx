import type { NextPage } from "next";
import Head from "next/head";
import { MutationView } from "../../views";
import { useRouter } from "next/router";
import { formatPublickey } from "../../utils/helpers";
const Mutation: NextPage = (props) => {
	const router = useRouter();

	let { mutationPublicKey } = router.query;
	mutationPublicKey = mutationPublicKey as string;
	return (
		<div>
			<Head>
				<title>Shadies Tube Recipe {/* {mutationPublicKey} */}</title>
				<meta name="og:title" content={`Shadies - Tube ${formatPublickey(mutationPublicKey)}`} key="ogtitle" />
				<meta name="description" content={`Shadies - Tube ${formatPublickey(mutationPublicKey)}`} />
				<meta property="og:type" content="website" />
				<meta property="og:url" content={`/${mutationPublicKey}`} />
				<meta property="og:title" content={`Shadies - Tube ${formatPublickey(mutationPublicKey)}`} />
				<meta property="og:description" content={`Shadies - Tube ${formatPublickey(mutationPublicKey)}`} />
				{/* <meta property="og:image" content="/images/_.png" data-rh="true" /> */}

				<meta property="twitter:card" content="summary_large_image" />
				<meta property="twitter:url" content={`/${mutationPublicKey}`} />
				<meta property="twitter:title" content={`Shadies - Tube ${formatPublickey(mutationPublicKey)}`} />
				<meta property="twitter:description" content={`Shadies - Tube ${formatPublickey(mutationPublicKey)}`} />
				{/* <meta property="twitter:image" content="/images/_.png" /> */}
			</Head>
			<MutationView />
		</div>
	);
};

export default Mutation;
