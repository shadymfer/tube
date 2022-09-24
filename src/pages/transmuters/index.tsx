import type { NextPage } from "next";
import Head from "next/head";
import { TransmutersView } from "../../views";

const Transmuters: NextPage = (props) => {
	return (
		<div>
			<Head>
				<title>The Tubes - Shadies</title>
				<meta name="og:title" content={`Shadies - Tubes`} key="ogtitle" />
				<meta name="description" content="Shadies - Tubes" />
				<meta property="og:type" content="website" />
				<meta property="og:url" content="/" />
				<meta property="og:title" content={`Shadies - Tubes`} />
				<meta property="og:description" content="Shadies - Tubes" />
				{/* <meta property="og:image" content="/images/_.png" data-rh="true" /> */}

				<meta property="twitter:card" content="summary_large_image" />
				<meta property="twitter:url" content="/" />
				<meta property="twitter:title" content={`Shadies - Tubes`} />
				<meta property="twitter:description" content="Shadies - Tubes" />
				{/* <meta property="twitter:image" content="/images/_.png" /> */}

			</Head>
			<TransmutersView />
		</div>
	);
};

export default Transmuters;
