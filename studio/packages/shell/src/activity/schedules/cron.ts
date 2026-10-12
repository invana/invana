/**
 * A schedule's cron, the way Studio reads and writes it.
 *
 * The engine stores a 5-field cron — `minute hour day-of-month month
 * day-of-week` — where each field is `*`, a number, a range `a-b`, a list
 * `a,b`, or any of those with a step `/n`, and day-of-week `0-7` has both `0`
 * and `7` meaning Sunday. Three readings live here:
 *
 * | Function | What it answers |
 * |---|---|
 * | `cronWords` | The cron as words: *Daily 07:00 · Weekdays 08:00 · Mondays 09:00 · 1st of the month 06:00*, else the cron itself |
 * | `repeatOf` / `cronOf` | The dialog's *Repeat* control and the cron it writes, both ways |
 * | `firesOn` | Whether the cron fires at some minute of one calendar day — what *Coming up* draws a dot for |
 *
 * `firesOn` reads days the way the engine does: when both day fields are
 * restricted, a day matches either.
 */

export type RepeatKind = "daily" | "weekdays" | "weekly" | "monthly" | "custom";

export interface Repeat {
	kind: RepeatKind;
	/** `HH:MM`, 24-hour. */
	time: string;
	/** Weekly: 0 = Sunday … 6 = Saturday. */
	weekday: number;
	/** Monthly: the day of the month, 1–31. */
	day: number;
	/** Custom: the raw 5-field cron. */
	cron: string;
}

export const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

const BOUNDS: readonly [number, number][] = [
	[0, 59],
	[0, 23],
	[1, 31],
	[1, 12],
	[0, 7],
];

const INT = /^\d+$/;

/** The values one field allows, or null when the field does not parse. */
function field(text: string, index: number): Set<number> | null {
	const [low, high] = BOUNDS[index];
	const values = new Set<number>();
	for (const part of text.split(",")) {
		const [base, stepText] = part.split("/", 2);
		if (stepText !== undefined && !INT.test(stepText)) return null;
		const step = stepText ? Number(stepText) : 1;
		if (step < 1) return null;
		let start: number;
		let end: number;
		if (base === "*") {
			start = low;
			end = high;
		} else if (base.includes("-")) {
			const [a, b] = base.split("-", 2);
			if (!INT.test(a) || !INT.test(b)) return null;
			start = Number(a);
			end = Number(b);
		} else {
			if (!INT.test(base)) return null;
			start = Number(base);
			end = stepText ? high : start;
		}
		if (start < low || end > high || start > end) return null;
		for (let v = start; v <= end; v += step) values.add(v);
	}
	return values;
}

interface Parsed {
	minutes: Set<number>;
	hours: Set<number>;
	days: Set<number>;
	months: Set<number>;
	weekdays: Set<number>;
	anyDay: boolean;
	anyWeekday: boolean;
}

/** The cron's five fields as sets, or null for anything that is not one. */
function parseCron(expr: string): Parsed | null {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return null;
	const sets = parts.map((p, i) => field(p, i));
	if (sets.some((s) => s === null)) return null;
	const [minutes, hours, days, months, rawWeekdays] = sets as Set<number>[];
	return {
		minutes,
		hours,
		days,
		months,
		weekdays: new Set([...rawWeekdays].map((d) => d % 7)),
		anyDay: parts[2] === "*",
		anyWeekday: parts[4] === "*",
	};
}

/** Whether the cron fires at any minute of `day`, read in the browser's zone. */
export function firesOn(expr: string, day: Date): boolean {
	const c = parseCron(expr);
	if (!c || c.minutes.size === 0 || c.hours.size === 0) return false;
	if (!c.months.has(day.getMonth() + 1)) return false;
	const inDays = c.days.has(day.getDate());
	const inWeekdays = c.weekdays.has(day.getDay());
	return c.anyDay || c.anyWeekday ? inDays && inWeekdays : inDays || inWeekdays;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `1st`, `2nd`, `3rd`, `11th`, `21st`. */
function ordinal(n: number): string {
	const teen = n % 100 >= 11 && n % 100 <= 13;
	const suffix = teen
		? "th"
		: (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
			"th");
	return `${n}${suffix}`;
}

/** The dialog's Repeat for a cron; anything it cannot say is Custom. */
export function repeatOf(expr: string): Repeat {
	const parts = expr.trim().split(/\s+/);
	const base: Repeat = {
		kind: "custom",
		time: "08:00",
		weekday: 1,
		day: 1,
		cron: expr.trim(),
	};
	if (parts.length !== 5) return base;
	const [m, h, dom, mon, dow] = parts;
	if (!INT.test(m) || !INT.test(h) || mon !== "*") return base;
	const minute = Number(m);
	const hour = Number(h);
	if (minute > 59 || hour > 23) return base;
	const time = `${pad(hour)}:${pad(minute)}`;
	if (dom === "*" && dow === "*") return { ...base, kind: "daily", time };
	if (dom === "*" && dow === "1-5") return { ...base, kind: "weekdays", time };
	if (dom === "*" && INT.test(dow) && Number(dow) <= 7)
		return { ...base, kind: "weekly", time, weekday: Number(dow) % 7 };
	if (dow === "*" && INT.test(dom) && Number(dom) >= 1 && Number(dom) <= 31)
		return { ...base, kind: "monthly", time, day: Number(dom) };
	return base;
}

/** The cron a Repeat writes. Custom writes its cron as typed. */
export function cronOf(r: Repeat): string {
	if (r.kind === "custom") return r.cron.trim();
	const [h, m] = r.time.split(":").map((x) => Number(x) || 0);
	const at = `${m} ${h}`;
	if (r.kind === "daily") return `${at} * * *`;
	if (r.kind === "weekdays") return `${at} * * 1-5`;
	if (r.kind === "weekly") return `${at} * * ${r.weekday}`;
	return `${at} ${r.day} * *`;
}

/** The cron as words — *Daily 07:00*, *Mondays 09:00* — else the cron itself. */
export function cronWords(expr: string): string {
	const r = repeatOf(expr);
	if (r.kind === "daily") return `Daily ${r.time}`;
	if (r.kind === "weekdays") return `Weekdays ${r.time}`;
	if (r.kind === "weekly") return `${WEEKDAYS[r.weekday]}s ${r.time}`;
	if (r.kind === "monthly") return `${ordinal(r.day)} of the month ${r.time}`;
	return expr.trim();
}

/** *next in 25 min · 14 h · 3 d* from an instant, or *due now* once passed. */
export function nextIn(iso: string | null, now: Date = new Date()): string {
	if (!iso) return "not due";
	const ms = new Date(iso).getTime() - now.getTime();
	if (ms <= 0) return "due now";
	const min = Math.ceil(ms / 60_000);
	if (min < 60) return `next in ${min} min`;
	const h = Math.round(min / 60);
	if (h < 48) return `next in ${h} h`;
	return `next in ${Math.round(h / 24)} d`;
}
