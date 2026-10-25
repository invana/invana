/**
 * *Test access* — would this be allowed, and which layer decides. Who (a
 * person, an agent or a token) · started by · does (an action) · to (a
 * resource, with an optional ` · field`) · in which world. The engine runs the
 * same check dispatch runs, without running anything, and answers with every
 * layer's verdict — policies it holds · started by · world · boundary · token —
 * and the first that refuses. It writes nothing, so every member may use it.
 */

import {
	Field,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Check, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import {
	useIamAgentsQuery,
	useIamTokensQuery,
	usePeopleQuery,
	useTestAccessMutation,
} from "../queries";
import type { AccessCheckRequest } from "../types";
import { SaysBadge } from "./policyParts";

const EVERY = { limit: 200 };
const NOBODY = "none";

type PrincipalKind = AccessCheckRequest["principal_kind"];

/** Mounted only while it is open. */
export function TestAccessDialog({
	username,
	graphSlug,
	onClose,
}: {
	username: string;
	graphSlug: string;
	onClose: () => void;
}) {
	const test = useTestAccessMutation({ username, graphSlug });
	const people = usePeopleQuery(username, graphSlug, EVERY);
	const agents = useIamAgentsQuery(username, graphSlug, EVERY);
	const tokens = useIamTokensQuery(username, graphSlug, EVERY);
	const [who, setWho] = useState("");
	const [startedBy, setStartedBy] = useState(NOBODY);
	const [action, setAction] = useState("");
	const [resource, setResource] = useState("");
	const [world, setWorld] = useState("");
	const read = test.data;

	const ready = !!who && !!action.trim() && !!resource.trim();
	const run = () => {
		const [kind, ...rest] = who.split(":");
		test.mutate({
			principal_kind: kind as PrincipalKind,
			principal_id: rest.join(":"),
			action: action.trim(),
			resource: resource.trim(),
			started_by: startedBy === NOBODY ? null : startedBy,
			world_id: world.trim() || null,
		});
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Test access</DialogTitle>
					<DialogDescription>
						would this be allowed, and which layer decides
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Field>
							<FieldLabel>Who</FieldLabel>
							<Select value={who} onValueChange={setWho}>
								<SelectTrigger aria-label="Who">
									<SelectValue placeholder="A person, an agent or a token" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>Agents</SelectLabel>
										{(agents.data?.items ?? []).map((a) => (
											<SelectItem
												key={a.agent_id}
												value={`agent:${a.agent_id}`}
											>
												{a.name}
											</SelectItem>
										))}
									</SelectGroup>
									<SelectGroup>
										<SelectLabel>People</SelectLabel>
										{(people.data?.items ?? []).map((p) => (
											<SelectItem key={p.user_id} value={`person:${p.user_id}`}>
												{p.username}
											</SelectItem>
										))}
									</SelectGroup>
									{tokens.data?.items.length ? (
										<SelectGroup>
											<SelectLabel>Tokens</SelectLabel>
											{tokens.data.items.map((t) => (
												<SelectItem key={t.id} value={`token:${t.id}`}>
													{t.name} · {t.holder.username}
												</SelectItem>
											))}
										</SelectGroup>
									) : null}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Started by</FieldLabel>
							<Select value={startedBy} onValueChange={setStartedBy}>
								<SelectTrigger aria-label="Started by">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NOBODY}>nobody — not a run</SelectItem>
									{(people.data?.items ?? []).map((p) => (
										<SelectItem key={p.user_id} value={p.user_id}>
											{p.username}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="test-action">Does</FieldLabel>
							<Input
								id="test-action"
								className="font-mono"
								value={action}
								onChange={(e) => setAction(e.target.value)}
								placeholder="graph.write.records"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="test-resource">To</FieldLabel>
							<Input
								id="test-resource"
								className="font-mono"
								value={resource}
								onChange={(e) => setResource(e.target.value)}
								placeholder="graph/Fare/LHR-JFK · price"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="test-world">World</FieldLabel>
							<Input
								id="test-world"
								className="font-mono"
								value={world}
								onChange={(e) => setWorld(e.target.value)}
								placeholder="the world's id — none for the whole Graph"
							/>
						</Field>
					</div>
					<FormError error={test.error} />
					{read ? (
						<>
							<Alert tone={read.allowed ? "success" : "destructive"}>
								{read.allowed ? (
									<Check className="size-4" />
								) : (
									<X className="size-4" />
								)}
								<AlertDescription>{read.message}</AlertDescription>
							</Alert>
							<Table aria-label="Layers checked">
								<TableHeader>
									<TableRow>
										<TableHead>Checked</TableHead>
										<TableHead>By</TableHead>
										<TableHead className="w-24">Says</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{read.layers.map((layer) => (
										<TableRow key={layer.layer}>
											<TableCell className="font-medium">
												{layer.label}
											</TableCell>
											<TableCell>
												<span className="flex flex-col">
													<span>
														{layer.by.map((b) => b.name).join(" · ") || "—"}
													</span>
													{layer.reason ? (
														<span className="text-muted-foreground">
															{layer.reason}
														</span>
													) : null}
												</span>
											</TableCell>
											<TableCell>
												<SaysBadge says={layer.says} />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</>
					) : null}
					<p className="text-muted-foreground">
						The same check the engine makes before every call — run here without
						running anything.
					</p>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Close
					</Button>
					<Button disabled={!ready || test.isPending} onClick={run}>
						<ShieldCheck />
						{test.isPending ? "Testing…" : "Test"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
