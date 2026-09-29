"""Product-facing CLI wrapper.

Existing research commands remain delegated to the historical CLI. The assurance
commands are intentionally data-in/data-out and preserve NOT_MEASURED values.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import List, Optional

from .cli import main as research_main
from .benchmark import compare_route_losses
from .migration import audit_from_json


def _write_or_print(value, output: Optional[str]) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True)
    if output:
        with open(output, "w", encoding="utf-8") as handle:
            handle.write(rendered + "\n")
    else:
        print(rendered)


def main(argv: Optional[List[str]] = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if args and args[0] in {"migration-audit", "benchmark-mel"}:
        parser = argparse.ArgumentParser(prog=f"vector-tongue {args[0]}")
        parser.add_argument("input_path", help="JSON input file")
        parser.add_argument("--output", default=None, help="optional JSON output path")
        namespace = parser.parse_args(args[1:])
        with open(namespace.input_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if args[0] == "migration-audit":
            result = audit_from_json(payload)
        else:
            result = compare_route_losses(payload.get("cases", []))
        _write_or_print(result, namespace.output)
        return 0 if result.get("release_gate", {}).get("status", "PASS") != "FAIL" else 2
    return research_main(args)


if __name__ == "__main__":
    raise SystemExit(main())
