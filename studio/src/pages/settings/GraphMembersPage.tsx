import {
	Badge,
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api/client";
import { graphMembershipApi } from "../../services/api/graph-membership";
import type { GraphRole } from "../../types/auth";

export function GraphMembersPage() {
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const { user, membershipForGraph, rolesForGraph } = useAuth();
	const qc = useQueryClient();

	const membership = membershipForGraph(username, slug);
	const { isAdmin: isAdminHere } = rolesForGraph(username, slug);

	const { data: members, isLoading } = useQuery({
		queryKey: ["graph", username, slug, "members"],
		queryFn: () =>
			graphMembershipApi.listMembers(username as string, slug as string),
		enabled: !!username && !!slug && !!membership,
	});

	if (!username || !slug) return <Navigate to="/" replace />;
	if (!membership) {
		return (
			<div className="p-8 text-muted-foreground">
				You aren&apos;t a member of this Graph.
			</div>
		);
	}

	async function onRoleChange(userId: string, role: GraphRole) {
		try {
			await graphMembershipApi.updateMemberRole(
				username as string,
				slug as string,
				userId,
				role,
			);
			qc.invalidateQueries({ queryKey: ["graph", username, slug, "members"] });
			toast.success("Role updated.");
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Update failed.");
		}
	}

	async function onRemove(userId: string) {
		try {
			await graphMembershipApi.removeMember(
				username as string,
				slug as string,
				userId,
			);
			qc.invalidateQueries({ queryKey: ["graph", username, slug, "members"] });
			toast.success("Member removed.");
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Removal failed.");
		}
	}

	return (
		<div className="max-w-3xl mx-auto px-6 py-10">
			<header className="mb-6">
				<h1 className="text-2xl font-semibold">
					Members &mdash;{" "}
					<span className="text-muted-foreground font-normal">
						{membership.graph_name}
					</span>
				</h1>
				<p className="text-muted-foreground text-base">
					{isAdminHere
						? "Manage roles and remove members from this Graph."
						: "All members in this Graph."}
				</p>
			</header>

			{isLoading ? (
				<div className="text-muted-foreground">Loading…</div>
			) : !members || members.length === 0 ? (
				<div className="text-muted-foreground italic">No members.</div>
			) : (
				<table className="w-full text-base">
					<thead className="text-left text-muted-foreground border-b">
						<tr>
							<th className="py-2">Name</th>
							<th className="py-2">@username</th>
							<th className="py-2">Email</th>
							<th className="py-2">Role</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{members.map((m) => {
							const isSelf = m.user_id === user?.id;
							const display = m.last_name
								? `${m.first_name} ${m.last_name}`
								: m.first_name;
							return (
								<tr key={m.user_id} className="border-b">
									<td className="py-2">
										{display}
										{isSelf && (
											<span className="text-muted-foreground ml-2 text-base">
												(you)
											</span>
										)}
									</td>
									<td className="py-2 text-muted-foreground">@{m.username}</td>
									<td className="py-2 text-muted-foreground">{m.email}</td>
									<td className="py-2">
										{isAdminHere && !isSelf ? (
											<Select
												value={m.role}
												onValueChange={(v) =>
													onRoleChange(m.user_id, v as GraphRole)
												}
											>
												<SelectTrigger className="w-32 h-8">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="developer">developer</SelectItem>
													<SelectItem value="analyst">analyst</SelectItem>
													<SelectItem value="admin">admin</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<Badge variant="secondary">{m.role}</Badge>
										)}
									</td>
									<td className="py-2 text-right">
										{isAdminHere && !isSelf && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => onRemove(m.user_id)}
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}
