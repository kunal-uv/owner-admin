"use client";

import React from "react";
import { Center, Paper, Stack, Text, Title } from "@mantine/core";
import { Layers } from "lucide-react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
	return (
		<Center mih="100vh" bg="#f7f8fa" p="md">
			<Paper w="100%" maw={400} p="xl" radius="lg" shadow="xs">
				<Stack gap="md">
					<Center w={40} h={40} bg="brand.6" c="white" style={{ borderRadius: "50%" }}>
						<Layers size={20} />
					</Center>
					<div>
						<Title order={3} fz={20}>
							{title}
						</Title>
						{subtitle && (
							<Text size="sm" c="dimmed">
								{subtitle}
							</Text>
						)}
					</div>
					{children}
				</Stack>
			</Paper>
		</Center>
	);
}
