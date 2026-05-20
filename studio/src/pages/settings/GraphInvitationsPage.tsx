import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api/client";
import { graphMembershipApi } from "../../services/api/graph-membership";
import type { GraphRole } from "../../types/auth";

export function GraphInvitationsPage() {
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const { membershipForGraph, rolesForGraph } = useAuth();
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);
	const [redeemUrl, setRedeemUrl] = useState<string | null>(null);

	const membership = membershipForGraph(username, slug);
	const { isAdmin: isAdminHere } = rolesForGraph(username, slug);

	const { data: invitations, isLoading } = useQuery({
		queryKey: ["graph", username, slug, "invitations"],
		queryFn: () =>
			graphMembershipApi.listInvitations(username as string, slug as string),
		enabled: !!username && !!slug && !!isAdminHere,
	});

	if (!username || !slug) return <Navigate to="/" replace />;
	if (!membership) {
		return (
			<div className="p-8 text-muted-foreground">
				You aren&apos;t a member of this Graph.
			</div>
		);
	}
	if (!isAdminHere) {
		return (
			<div className="p-8 text-muted-foreground">
				Only Graph admins can manage invitations.
			</div>
		);
	}

	async function onDelete(id: string) {
		try {
			await graphMembershipApi.deleteInvitation(
				username as string,
				slug as string,
				id,
			);
			toast.success("Invitation revoked.");
			qc.invalidateQueries({
				queryKey: ["graph", username, slug, "invitations"],
			});
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to revoke.");
		}
	}

	return (
		<div className="max-w-3xl mx-auto px-6 py-10">
			<header className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">
						Invitations &mdash;{" "}
						<span className="text-muted-foreground font-normal">
							{membership.graph_name}
						</span>
					</h1>
					<p className="text-muted-foreground text-base">
						Invite developers and analysts to this Graph.
					</p>
				</div>
				<Button onClick={() => setOpen(true)}>New invitation</Button>
			</header>

			{isLoading ? (
				<div className="text-muted-foreground">Loading…</div>
			) : !invitations || invitations.length === 0 ? (
				<div className="text-muted-foreground italic">No invitations yet.</div>
			) : (
				<table className="w-full text-base">
					<thead className="text-left text-muted-foreground border-b">
						<tr>
							<th className="py-2">Email</th>
							<th className="py-2">Role</th>
							<th className="py-2">Status</th>
							<th className="py-2">Expires</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{invitations.map((inv) => (
							<tr key={inv.id} className="border-b">
								<td className="py-2">{inv.email}</td>
								<td className="py-2">
									<Badge variant="secondary">{inv.role}</Badge>
								</td>
								<td className="py-2">
									{inv.accepted_at ? (
										<Badge>Accepted</Badge>
									) : new Date(inv.expires_at) <= new Date() ? (
										<Badge variant="destructive">Expired</Badge>
									) : (
										<Badge variant="outline">Pending</Badge>
									)}
								</td>
								<td className="py-2 text-muted-foreground">
									{new Date(inv.expires_at).toLocaleDateString()}
								</td>
								<td className="py-2 text-right">
									{!inv.accepted_at && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onDelete(inv.id)}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			<NewInvitationDialog
				open={open}
				username={username}
				slug={slug}
				onClose={() => setOpen(false)}
				onCreated={(url) => setRedeemUrl(url)}
			/>

			<RedeemUrlDialog url={redeemUrl} onClose={() => setRedeemUrl(null)} />
		</div>
	);
}

function NewInvitationDialog({
	open,
	username,
	slug,
	onClose,
	onCreated,
}: {
	open: boolean;
	username: string;
	slug: string;
	onClose: () => void;
	onCreated: (url: string) => void;
}) {
	const qc = useQueryClient();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<GraphRole>("developer");
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const inv = await graphMembershipApi.createInvitation(username, slug, {
				email,
				role,
			});
			qc.invalidateQueries({
				queryKey: ["graph", username, slug, "invitations"],
			});
			onClose();
			setEmail("");
			setRole("developer");
			onCreated(inv.redeem_url);
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to create invitation.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Invite to Graph</DialogTitle>
						<DialogDescription>
							The invitation URL will be shown once — copy it and share with the
							invitee.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="invEmail">Email</Label>
							<Input
								id="invEmail"
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="invRole">Role</Label>
							<Select
								value={role}
								onValueChange={(v) => setRole(v as GraphRole)}
							>
								<SelectTrigger id="invRole">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="developer">developer</SelectItem>
									<SelectItem value="analyst">analyst</SelectItem>
									<SelectItem value="admin">admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={onClose} type="button">
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? "Creating…" : "Create invitation"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function RedeemUrlDialog({
	url,
	onClose,
}: {
	url: string | null;
	onClose: () => void;
}) {
	return (
		<Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invitation created</DialogTitle>
					<DialogDescription>
						Send this URL to the invitee. It will be shown only once.
					</DialogDescription>
				</DialogHeader>
				{url && (
					<div className="flex items-center gap-2 mt-2">
						<Input value={url} readOnly />
						<Button
							onClick={() => {
								navigator.clipboard.writeText(url);
								toast.success("Copied.");
							}}
						>
							<Copy className="w-4 h-4 mr-1" />
							Copy
						</Button>
					</div>
				)}
				<DialogFooter>
					<Button onClick={onClose}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
