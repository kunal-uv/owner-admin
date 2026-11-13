import { Suspense } from "react";
import { NewClient } from "@/modules/clients/NewClient";

export const metadata = { title: "New client" };

export default function Page() {
	return (
		<Suspense>
			<NewClient />
		</Suspense>
	);
}
