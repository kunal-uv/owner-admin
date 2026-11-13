import { Suspense } from "react";
import { Plans } from "@/modules/plans/Plans";

export const metadata = { title: "Plans" };

export default function Page() {
	return (
		<Suspense>
			<Plans />
		</Suspense>
	);
}
