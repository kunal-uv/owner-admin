import { ClientDetail } from "@/modules/clients/ClientDetail";

export const metadata = { title: "Client" };

export default function Page({ params }: { params: { id: string } }) {
	return <ClientDetail id={params.id} />;
}
