/**
 * `@invana-studio/iam` — the IAM product's public surface: the section pages
 * the rail opens as tabs (`sections/`), Home's tiles, the record pages a row
 * opens beside them — a policy, an agent's access, a group — the engine's
 * shapes, and the product's `ProductDefinition`
 * (the-iam-product.md, iam.md).
 *
 * Nothing outside this package reaches past this file. What the product
 * borrows from its host comes through `IamSlotsContext`; how a page opens a
 * record comes through `IamOpenContext`.
 */

export { AgentAccessPanel } from "./agents/AgentAccessPanel";
export { IamAgentPage } from "./agents/IamAgentPage";
export { GroupPage } from "./groups/GroupPage";
export { IamHomeTiles } from "./home/IamHomeTiles";
export { IamSlotsContext } from "./IamSlots";
export { type IamOpen, IamOpenContext } from "./open";
export { PolicyPage } from "./policies/PolicyPage";
export { iam } from "./product";
export { IamSectionBody } from "./sections/IamSectionBody";
export {
	type IamSectionKey,
	panelOf,
	SECTIONS,
	sectionOfPanel,
} from "./sections/spec";
export type * from "./types";
