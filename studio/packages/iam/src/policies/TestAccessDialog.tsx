/**
 * *Test access* — would this be allowed, and which layer decides. Who (a
 * person, an agent or a token) · started by · does (an action) · to (a
 * resource, with an optional ` · field`) · in which world. The engine runs the
 * same check dispatch runs, without running anything, and answers with every
 * layer's verdict — policies it holds · started by · world · boundary · token —
 * and the first that refuses. It writes nothing, so every member may use it.
 *
 * A link may carry the check (`?who=agent:<id>&by=<user id>&does=…&to=…&world=…`):
 * the form opens filled, and runs once when who, does and to are all given.
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
import { Check, ScrollText, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIamOpen } from "../open";
import {
	useIamAgentsQuery,
	useIamTokensQuery,
	usePeopleQuery,
	useTestAccessMutation,
} from "../queries";
import type { AccessCheckRequest, PrincipalRef } from "../types";
import { SaysBadge } from "./policyParts";

const EVERY = { limit: 200 };

/** A layer's *By*: a policy opens its page; a person or a world is named. */
function ByLine({
	by,
	onOpen,
}: {
	by: PrincipalRef[];
	/** Called before a policy opens, so the dialog does not stay over it. */
	onOpen: () => void;
}) {
	const open = useIamOpen();
	if (by.length === 0) return <span className="text-muted-foreground">—</span>;
	return (
		<span className="flex flex-wrap items-center gap-1">
			{by.map((b) =>
				b.kind === "policy" ? (
					<Button
						key={`${b.kind}:${b.id ?? b.name}`}
						size="xs"
						variant="ghost"
						onClick={() => {
							onOpen();
							open.policy(b.name);
						}}
					>
						<ScrollText className="size-3.5" />
						{b.name}
					</Button>
				) : (
					<span
						key={`${b.kind}:${b.id ?? b.name}`}
						className="text-muted-foreground"
					>
						{b.name}
					</span>
				),
			)}
		</span>
	);
}
const NOBODY = "none";

type PrincipalKind = AccessCheckRequest["principal_kind"];

/** A check a link carries; every field optional. */
export type TestAccessPrefill = {
	/** `agent:<id>` · `person:<id>` · `token:<id>`. */
	who?: string;
	/** The starter's user id. */
	startedBy?: string;
	action?: string;
	resource?: string;
	world?: string;
};

/** Mounted only while it is open. */
export function TestAccessDialog({
	username,
	graphSlug,
	prefill = {},
	onClose,
}: {
	username: string;
	graphSlug: string;
	prefill?: TestAccessPrefill;
	onClose: () => void;
}) {
	const test = useTestAccessMutation({ username, graphSlug });
	const people = usePeopleQuery(username, graphSlug, EVERY);
	const agents = useIamAgentsQuery(username, graphSlug, EVERY);
	const tokens = useIamTokensQuery(username, graphSlug, EVERY);
	const [who, setWho] = useState(prefill.who ?? "");
	const [startedBy, setStartedBy] = useState(prefill.startedBy ?? NOBODY);
	const [action, setAction] = useState(prefill.action ?? "");
	const [resource, setResource] = useState(prefill.resource ?? "");
	const [world, setWorld] = useState(prefill.world ?? "");
	const read = test.data;

	const ready = !!who && !!action.trim() && !!resource.trim();
	const ranPrefill = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a carried check runs once, on open
	useEffect(() => {
		if (ranPrefill.current || !ready) return;
		// Run after a StrictMode remount settles: a mutation started before it
		// loses its observer and reads as pending for good.
		const timer = setTimeout(() => {
			ranPrefill.current = true;
			run();
		});
		return () => clearTimeout(timer);
	}, []);
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
								placeholder="no world"
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
											<TableCell className="whitespace-nowrap font-medium">
												{layer.label}
											</TableCell>
											<TableCell>
												<span className="flex flex-col items-start">
													<ByLine by={layer.by} onOpen={onClose} />
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
