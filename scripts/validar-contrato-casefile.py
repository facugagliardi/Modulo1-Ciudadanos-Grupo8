"""Valida el contrato publicado de caseFileResolved sin acceder a red ni bases."""
import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts/m1/v1.0"


def main():
    schema = json.loads((CONTRACT / "caseFileResolved.data.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    without_formats = Draft202012Validator(schema)
    examples = []
    for result in ("approved", "rejected"):
        envelope = json.loads((CONTRACT / f"examples/caseFileResolved.{result}.event.json").read_text(encoding="utf-8"))
        assert envelope["eventType"] == "caseFileResolved"
        assert envelope["sourceModule"] == "ciudadanos"
        assert envelope["eventVersion"] == "1.0"
        validator.validate(envelope["data"])
        assert envelope["data"]["resolution"] == result
        examples.append(envelope["data"])

    base = examples[0]
    invalid = []
    for name in schema["required"]:
        case = copy.deepcopy(base)
        del case[name]
        invalid.append((f"falta {name}", case))
        case = copy.deepcopy(base)
        case[name] = None
        invalid.append((f"null {name}", case))
    for name, value in [("state", "RESOLVED"), ("resolution", "APPROVED"), ("resolution", "pending"),
                        ("caseFileId", 1042), ("caseFileId", "EXP-2026-001042"),
                        ("caseFileId", "d40e20ba-e2a8-4dd0-a11f-b6d6b58c68az"),
                        ("caseFileNumber", ""), ("caseFileNumber", " \t\n"),
                        ("resolutionSummary", ""), ("resolutionSummary", " \t\n"),
                        ("externalReference", [])]:
        case = copy.deepcopy(base)
        case[name] = value
        invalid.append((f"valor invalido {name}: {value!r}", case))
    for name, value in [("type", "WORK_ORDER"), ("id", "OBRA-8832"), ("id", 8832), ("extra", True)]:
        case = copy.deepcopy(base)
        case["externalReference"][name] = value
        invalid.append((f"referencia invalida {name}", case))
    for name in ("id", "type"):
        case = copy.deepcopy(base)
        del case["externalReference"][name]
        invalid.append((f"falta externalReference.{name}", case))
    for name in ("citizenId", "eventVersion", "sourceModule"):
        case = copy.deepcopy(base)
        case[name] = "dato fuera del contrato de data"
        invalid.append((f"campo extra {name}", case))
    for description, case in invalid:
        assert list(validator.iter_errors(case)), description
        assert list(without_formats.iter_errors(case)), f"depende de format: {description}"
    print(json.dumps({"schema": "caseFileResolved.data v1.0", "validos": len(examples),
                      "invalidos_rechazados": len(invalid), "metaschema": "correcto"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
