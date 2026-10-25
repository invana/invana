/**
 * IAM › **People** (board `iam.people`) — the Graph's members and its service
 * accounts, each with the groups, policies and tokens it holds.
 *
 * *As an owner, I want people, service accounts and groups, and the policies
 * each holds, so that a team is granted once.*
 *
 * The list is on the list contract: the kind tabs `All · People · Service
 * accounts` write `?f.kind=`, the search writes `?q=`, and the engine filters
 * and counts — the tabs' counts are its `kinds`, the tokens column its count
 * of live tokens that reach this Graph. The kind is the tabs', not a column:
 * a row is its name, email, groups, policies, tokens and sign-in.
 *
 * *Add person* is the membership act (the Graph's `…/members`); *New service
 * account* makes a person with no sign-in that owns tokens. Both are the `iam`
 * area's: without iam-admin they show disabled, naming who holds it.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { EmptyState, SearchInput } from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { SectionBody } from "@invana-studio/ui";
import { Bot, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePeopleQuery, useServiceAccountMutation } from "../queries";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import type { PersonRow } from "../types";
import { AddPersonDialog } from "./AddPersonDialog";
import {
	CountChip,
	joined,
	KindTabs,
	ListStrip,
	NameDialog,
	PAGE,
	ReadState,
} from "./listParts";

const KIND_TABS = [
	{ value: "person", label: "People" },
	{ value: "service", label: "Service accounts" },
];

export function PeoplePage({ username, graphSlug }: SectionPageProps) {
	const list = useListParams();
	const [search] = useSearchParams();
	const query = usePeopleQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const serviceAccount = useServiceAccountMutation({ username, graphSlug });
	const [adding, setAdding] = useState(false);
	const [making, setMaking] = useState(false);
	const columns = useMemo(personColumns, []);
	const page = query.data;
	const filtered = (page?.applied ?? list.pending).length > 0;

	return (
		<SectionPage
			section="people"
			graph={graphSlug}
			chips={<CountChip page={page} noun="people" />}
			actions={
				<>
					<ActButton
						area="iam"
						size="sm"
						variant="outline"
						onClick={() => {
							serviceAccount.reset();
							setMaking(true);
						}}
					>
						<Bot className="size-3.5" />
						New service account
					</ActButton>
					<ActButton area="iam" size="sm" onClick={() => setAdding(true)}>
						<UserPlus className="size-3.5" />
						Add person
					</ActButton>
				</>
			}
		>
			<SectionBody>
				<div className="flex flex-wrap items-center gap-2">
					<KindTabs
						list={list}
						kinds={page?.kinds}
						tabs={KIND_TABS}
						label="Kind"
					/>
					<SearchInput
						inputSize="sm"
						className="w-64"
						placeholder="Find a person"
						value={search.get("q") ?? ""}
						onChange={list.setQ}
					/>
				</div>
				<ListStrip page={page} list={list} />
				{!page ? (
					<ReadState
						loading={query.isLoading}
						error={query.error}
						what="the people of this Graph"
						onRetry={() => void query.refetch()}
					/>
				) : (
					<DataTable
						columns={columns}
						data={page.items}
						loading={query.isFetching}
						enableSorting={false}
						getRowId={(row) => row.user_id}
						emptyState={
							<EmptyState
								title={filtered ? "No one matches" : "No people yet"}
								description={
									filtered
										? "Remove a filter above, or clear them all."
										: "Add a person who has an Invana account, or make a service account for a script."
								}
							/>
						}
					/>
				)}
			</SectionBody>
			<AddPersonDialog
				username={username}
				graphSlug={graphSlug}
				open={adding}
				onOpenChange={setAdding}
			/>
			<NameDialog
				open={making}
				title="New service account"
				description="A person with no sign-in that owns tokens for scripts. It joins this Graph holding viewer; mint its token in Tokens."
				nameLabel="Username"
				submitLabel="Create service account"
				pending={serviceAccount.isPending}
				error={serviceAccount.error}
				onOpenChange={setMaking}
				onSubmit={(name, description) =>
					serviceAccount.mutate(
						{ username: name, description: description || undefined },
						{ onSuccess: () => setMaking(false) },
					)
				}
			/>
		</SectionPage>
	);
}

function personColumns(): ColumnDef<PersonRow>[] {
	return [
		{
			id: "name",
			header: "Name",
			size: 140,
			cell: ({ row }) => (
				<span className="font-semibold">{row.original.username}</span>
			),
		},
		{
			id: "email",
			header: "Email",
			size: 240,
			cell: ({ row }) => row.original.email ?? "—",
		},
		{
			id: "groups",
			header: "Groups",
			size: 150,
			cell: ({ row }) => joined(row.original.groups),
		},
		{
			id: "policies",
			header: "Policies",
			size: 640,
			cell: ({ row }) => joined(row.original.policies),
		},
		{
			id: "tokens",
			header: "Tokens",
			size: 90,
			cell: ({ row }) => row.original.tokens.toLocaleString(),
		},
		{
			id: "signs_in_with",
			header: "Signs in with",
			size: 180,
			cell: ({ row }) => row.original.signs_in_with,
		},
	];
}
