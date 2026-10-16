"""Offline, bounded JSONL audit reporting for redacted pilot datasets."""
import argparse
import json
from collections import Counter
from auditor import preflight, MAX_BYTES


def audit_records(lines, audit=None, limit=1000, evidence_grade="USER_SUPPLIED"):
    if evidence_grade not in {"USER_SUPPLIED", "SYNTHETIC_DEMO"}:
        raise ValueError("Invalid evidence grade")
    outcomes = []
    for index, line in enumerate(lines):
        if index >= limit:
            raise ValueError('Dataset exceeds record limit')
        # Bound each physical line before JSON decoding.
        if len(line.encode('utf-8')) > MAX_BYTES:
            result = dict(status='INPUT_TOO_LARGE', g=None, execution='DISABLED')
        else:
            try:
                row = json.loads(line)
                if not isinstance(row, dict):
                    raise ValueError('Expected object')
                args = {k: row[k] for k in ('user_intent', 'service', 'action', 'payload')}
                if set(row) != set(args):
                    raise ValueError('Unexpected fields')
                if audit is None:
                    result, _ = preflight(**args)
                    if result['schema_status'] == 'VALID':
                        result['reason'] = 'SEMANTIC_ANALYSIS_NOT_REQUESTED'
                else:
                    result = audit(**args)
            except (ValueError, KeyError, TypeError, RecursionError):
                result = dict(status='INVALID_INPUT', g=None, execution='DISABLED')
        # Index only; never copy prompts, payloads or untrusted case IDs into reports.
        outcomes.append(dict(record_index=index, **result))
    return dict(evidence_grade=evidence_grade, total_records=len(outcomes),
                status_counts=dict(Counter(r['status'] for r in outcomes)),
                semantic_measured_count=sum(r.get('g') is not None for r in outcomes),
                net_savings='NOT_MEASURED', semantic_accuracy='NOT_MEASURED',
                execution='DISABLED', records=outcomes)


def bounded_lines(handle):
    while True:
        line = handle.readline(MAX_BYTES+1)
        if not line:
            return
        if len(line) > MAX_BYTES:
            raise ValueError('Dataset line exceeds byte limit')
        yield line.decode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', help='Redacted JSONL, at most 1,000 records')
    parser.add_argument('--semantic', action='store_true', help='Use separately provisioned local model')
    parser.add_argument('--synthetic-demo', action='store_true', help='Label illustrative data as synthetic')
    args = parser.parse_args()
    audit = None
    if args.semantic:
        from server import audit_tool_call
        audit = audit_tool_call.fn
    try:
        with open(args.input, 'rb') as handle:
            report = audit_records(bounded_lines(handle), audit=audit, evidence_grade="SYNTHETIC_DEMO" if args.synthetic_demo else "USER_SUPPLIED")
    except (OSError, ValueError, UnicodeError) as exc:
        parser.exit(2, f'Audit input rejected ({type(exc).__name__}).\n')
    print(json.dumps(report, sort_keys=True, allow_nan=False))

if __name__ == '__main__': main()
