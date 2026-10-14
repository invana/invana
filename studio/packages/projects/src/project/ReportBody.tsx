/**
 * A report as it reads — the Markdown the engine drafts and a person edits,
 * drawn with the kit's typography, its cites numbered.
 *
 * The report is a small, fixed shape: `#` the project, `##` a branch, `###`
 * a stance, `- fN. statement (cites)` a finding, `**Decision …**` a decision,
 * and plain paragraphs. That subset is what is drawn; anything else reads as
 * a paragraph, exactly as written. A finding's trailing `(ref, ref)` becomes
 * numbered marks — `[1] [2]` — and the refs are listed once, in order of
 * first use, under **Cites**, so a reader can follow every claim to its data.
 */

import {
	TypographyH4,
	TypographyH5,
	TypographyH6,
	TypographyList,
	TypographyMuted,
	TypographyP,
} from "@invana/ui";
import { Fragment, type ReactNode } from "react";

type Block =
	| { kind: "h1" | "h2" | "h3" | "p"; text: string }
	| { kind: "ul"; items: { text: string; cites: string[] }[] };

const CITES = /\s+\(([^()]+)\)\s*$/;
/** A run is cited by its id; it reads as `run 8195c5e8`, the full id on hover. */
const RUN_ID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parse(body: string): Block[] {
	const blocks: Block[] = [];
	let para: string[] = [];
	const flush = () => {
		if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
		para = [];
	};
	for (const raw of body.split("\n")) {
		const line = raw.trimEnd();
		const heading = line.match(/^(#{1,3})\s+(.*)$/);
		if (heading) {
			flush();
			const kind = (["h1", "h2", "h3"] as const)[heading[1].length - 1];
			blocks.push({ kind, text: heading[2] });
		} else if (/^[-*]\s+/.test(line)) {
			flush();
			const text = line.replace(/^[-*]\s+/, "");
			const m = text.match(CITES);
			const item = m
				? {
						text: text.slice(0, m.index),
						cites: m[1].split(",").map((c) => c.trim()),
					}
				: { text, cites: [] };
			const last = blocks.at(-1);
			if (last?.kind === "ul") last.items.push(item);
			else blocks.push({ kind: "ul", items: [item] });
		} else if (line.trim() === "") flush();
		else para.push(line.trim());
	}
	flush();
	return blocks;
}

/** `**bold**` inside a line; everything else as written. */
function inline(text: string): ReactNode {
	return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
		part.startsWith("**") && part.endsWith("**") ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: a line's parts never reorder
			<strong key={i}>{part.slice(2, -2)}</strong>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: a line's parts never reorder
			<Fragment key={i}>{part}</Fragment>
		),
	);
}

export function ReportBody({ body }: { body: string }) {
	const blocks = parse(body);
	const order: string[] = [];
	const number = (ref: string) => {
		const at = order.indexOf(ref);
		if (at >= 0) return at + 1;
		order.push(ref);
		return order.length;
	};

	return (
		<article aria-label="Report">
			{blocks.map((b, i) => {
				const key = `${b.kind}-${i}`;
				if (b.kind !== "ul") {
					const Text =
						b.kind === "h1"
							? TypographyH4
							: b.kind === "h2"
								? TypographyH5
								: b.kind === "h3"
									? TypographyH6
									: TypographyP;
					return <Text key={key}>{inline(b.text)}</Text>;
				}
				return (
					<TypographyList key={key}>
						{b.items.map((item, j) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a list's items never reorder
							<li key={j}>
								{inline(item.text)}
								{item.cites.map((c) => (
									<sup key={c} title={c}>
										[{number(c)}]
									</sup>
								))}
							</li>
						))}
					</TypographyList>
				);
			})}
			{order.length ? (
				<>
					<TypographyH6>Cites</TypographyH6>
					<ol>
						{order.map((ref, i) => (
							<li key={ref}>
								<TypographyMuted title={ref}>
									[{i + 1}] {RUN_ID.test(ref) ? `run ${ref.slice(0, 8)}` : ref}
								</TypographyMuted>
							</li>
						))}
					</ol>
				</>
			) : null}
		</article>
	);
}
