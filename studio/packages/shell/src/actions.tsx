/**
 * The action registry — how one product invokes another without importing it.
 *
 * A product lists what others may call in its definition's `actions`, keyed
 * by a full id (`projects.addFinding`). A caller asks for it by that id:
 *
 * ```tsx
 * const addFinding = useAction<{ text: string }>("projects.addFinding");
 * return addFinding ? <Button onClick={() => addFinding.invoke({ text })}>{addFinding.label}</Button> : null;
 * ```
 *
 * When the product that owns the id is not registered, `useAction` returns
 * `null` and the caller renders nothing — a missing product is an absent
 * button, never a dead one. An action either navigates or opens a dialog;
 * `<ActionDialogHost>` (mounted once by `<StudioShell>`) draws the dialog.
 */
import type {
	ActionContext,
	ActionDef,
	ProductIcon,
} from "@invana-studio/core";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "./products";

type DialogRender = (close: () => void) => ReactNode;

const DialogContext = createContext<ActionContext["openDialog"]>(() => {});

/** Hosts the one dialog an action may open, over whatever page is beneath. */
export function ActionDialogHost({ children }: { children: ReactNode }) {
	const [render, setRender] = useState<DialogRender | null>(null);
	const close = useCallback(() => setRender(null), []);
	const open = useCallback((next: DialogRender) => setRender(() => next), []);
	return (
		<DialogContext.Provider value={open}>
			{children}
			{render?.(close)}
		</DialogContext.Provider>
	);
}

/** An action resolved for a caller. */
export interface ResolvedAction<A> {
	label: string;
	icon?: ProductIcon;
	invoke: (args: A) => void;
}

/** The action registered under `id`, or `null` when no registered product offers it. */
export function useAction<A = unknown>(id: string): ResolvedAction<A> | null {
	const products = useProducts();
	const navigate = useNavigate();
	const openDialog = useContext(DialogContext);

	const def = useMemo(() => {
		for (const product of products) {
			const found = product.actions?.[id];
			if (found) return found as ActionDef<A>;
		}
		return null;
	}, [products, id]);

	return useMemo(
		() =>
			def && {
				label: def.label,
				icon: def.icon,
				invoke: (args: A) => def.run({ args, navigate, openDialog }),
			},
		[def, navigate, openDialog],
	);
}
