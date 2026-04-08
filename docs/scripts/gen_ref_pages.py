"""Auto-generate API reference pages from the engine source tree.

This script is executed by mkdocs-gen-files during `mkdocs build`.
It walks the `invana` package, creates a markdown page per module with
a `:::` mkdocstrings directive, and builds a SUMMARY.md for literate-nav.
"""

from pathlib import Path

import mkdocs_gen_files

nav = mkdocs_gen_files.Nav()

SRC_DIR = Path("../engine/src")
REFERENCE_DIR = "api-reference"

for path in sorted(SRC_DIR.rglob("*.py")):
    module_path = path.relative_to(SRC_DIR)
    # Convert path to module dotted name
    parts = list(module_path.with_suffix("").parts)

    # Skip empty __init__.py and test files
    if parts[-1] == "__init__":
        # Use the package itself — render as the index page for the directory
        parts = parts[:-1]
        if not parts:
            continue
        doc_path = Path(REFERENCE_DIR, *parts, "index.md")
    else:
        doc_path = Path(REFERENCE_DIR, *parts).with_suffix(".md")

    full_doc_path = doc_path
    module_name = ".".join(parts)

    # Only include the invana.graph module tree for now
    if not module_name.startswith("invana.graph"):
        continue

    # Nav entry: use the last part as the display name
    nav_parts = list(full_doc_path.relative_to(REFERENCE_DIR).with_suffix("").parts)
    nav[nav_parts] = str(full_doc_path.relative_to(REFERENCE_DIR))

    with mkdocs_gen_files.open(full_doc_path, "w") as f:
        # Title from module name
        f.write(f"# `{module_name}`\n\n")
        f.write(f"::: {module_name}\n")
        f.write("    options:\n")
        f.write("      show_if_no_docstring: true\n")
        f.write("      inherited_members: true\n")
        f.write("      members_order: source\n")

    # Map the generated doc page back to the source file for edit links
    mkdocs_gen_files.set_edit_path(full_doc_path, Path("../") / path)

# Write the navigation summary for literate-nav
with mkdocs_gen_files.open(f"{REFERENCE_DIR}/SUMMARY.md", "w") as nav_file:
    nav_file.writelines(nav.build_literate_nav())
