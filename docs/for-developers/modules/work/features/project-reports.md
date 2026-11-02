# Project reports

A report is the project written up from its records — drafted, edited by a person, and published as
frozen versions that cite the dataset versions behind them.

| | |
|---|---|
| Index | [9.6](../../../README.md#9--work) · B05 |
| Module | [Work](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Product | [PJ-F05 · Project reports](../../../../../specs/products/projects/features/PJ-F05-project-reports/feature.md) · PJ-14 |
| Related | [branches-and-decisions](branches-and-decisions.md) · [retract-and-refresh](../../bring-data-in/features/retract-and-refresh.md) |

Product spec: [PJ-F05 · Project reports](../../../../../specs/products/projects/features/PJ-F05-project-reports/feature.md) — PJ-14; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `project_reports` | `project_id` (unique) · `draft` · `draft_updated_by_id?` · `draft_updated_at?` |
| `project_report_versions` | `report_id` · `version` · `body` · `cites[]` (`{ref, version_id}`) · `published_by_id` · `published_at` |
| `ReportVersionRead.retracted[]` | The cited dataset refs whose version is retracted, read when the version is read |
| Events | `report.generate` · `report.publish` |

## Decisions

Engine and code rows; the product decisions are PJ-F05's.

| # | Decision |
|---|---|
| RP4 | The retraction notice is read, never stored: a version read names every cited dataset version retracted since. |
