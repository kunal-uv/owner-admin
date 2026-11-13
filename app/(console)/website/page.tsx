import { Suspense } from "react";
import { ClientWebsites } from "@/modules/website/ClientWebsites";

export const metadata = { title: "Websites" };

export default function Page() {
	return (
		<Suspense>
			<ClientWebsites />
		</Suspense>
	);
}
