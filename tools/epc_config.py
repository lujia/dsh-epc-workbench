# -*- coding: utf-8 -*-
"""Project configuration for the EPC workbench extractor.

Nothing about a particular project lives in the extractor itself: the parties,
the contract numbers, the letter and meeting series and the folder layout are
all read from a JSON configuration file, so the same code builds a workbench for
any EPC package laid out the documented way.

The file is looked up in this order:

  1. the path given as the first command-line argument
  2. the WORKBENCH_CONFIG environment variable
  3. workbench.config.json next to the package root
  4. workbench.config.example.json next to the package root

See docs/CONFIGURATION.md for the schema, and workbench.config.example.json for
a complete worked example.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)

DEFAULT_NAMES = ("workbench.config.json", "workbench.config.example.json")

CONTRACT_KINDS = ("main", "sub")


class ConfigError(Exception):
    """A configuration file that cannot be used as given."""


def _pkg_path(*parts):
    return os.path.join(PKG, *parts)


def locate(argv=None):
    """Return the configuration path to use, or None when there is not one."""
    argv = list(argv if argv is not None else [])
    for a in argv[1:]:
        if a.lower().endswith(".json") and not a.startswith("-"):
            return os.path.abspath(a)
    env = os.environ.get("WORKBENCH_CONFIG")
    if env:
        return os.path.abspath(env)
    for name in DEFAULT_NAMES:
        p = _pkg_path(name)
        if os.path.isfile(p):
            return p
    return None


def load(path=None):
    """Load and normalise a configuration dictionary.

    Every value the extractor reads goes through this function, so a missing
    optional field is filled with a neutral default rather than crashing a long
    extraction run halfway through.
    """
    path = path or locate()
    if not path:
        raise ConfigError(
            "no configuration found — copy workbench.config.example.json to "
            "workbench.config.json and point sources.root at your corpus")
    if not os.path.isfile(path):
        raise ConfigError("configuration not found: %s" % path)
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    cfg = normalise(raw)
    cfg["_path"] = path
    cfg["_dir"] = os.path.dirname(path)
    return cfg


def normalise(raw):
    """Fill defaults and check the invariants the extractor relies on."""
    if not isinstance(raw, dict):
        raise ConfigError("configuration must be a JSON object")

    project = dict(raw.get("project") or {})
    project.setdefault("name", "EPC project")
    project.setdefault("short", project["name"])
    project.setdefault("mark", "EPC")
    project.setdefault("site", "")
    project.setdefault("standpoint", "")
    project.setdefault("currency", "")
    # The currencies the project is priced in. A contract can be certified in
    # more than one, and the slices add up to the price rather than convert into
    # each other, so both names have to travel with the data instead of being
    # assumed from the primary one alone.
    currencies = []
    for i, c in enumerate(raw.get("currencies") or []):
        if isinstance(c, str):
            c = {"code": c}
        code = (c.get("code") or "").upper()
        if not code:
            raise ConfigError("currencies[%d] has no code" % i)
        currencies.append({
            "code": code,
            "label": c.get("label") or code,
            "key": c.get("key") or (code[:1].upper() + code[1:].lower()),
            "primary": bool(c.get("primary")) if "primary" in c else i == 0,
        })
    if not currencies and project["currency"]:
        code = project["currency"].upper()
        currencies.append({"code": code, "label": code,
                           "key": code[:1].upper() + code[1:].lower(), "primary": True})
    if currencies and not any(c["primary"] for c in currencies):
        currencies[0]["primary"] = True
    project["currencies"] = currencies

    parties = []
    for i, p in enumerate(raw.get("parties") or []):
        if "id" not in p:
            raise ConfigError("parties[%d] has no id" % i)
        parties.append({
            "id": p["id"],
            "name": p.get("name") or p["id"],
            "former": p.get("former") or "",
            "abbr": p.get("abbr") or "",
            "role": p.get("role") or p["id"],
        })
    if not parties:
        parties = [
            {"id": "employer", "name": "Employer", "former": "", "abbr": "", "role": "employer"},
            {"id": "contractor", "name": "Contractor", "former": "", "abbr": "", "role": "contractor"},
            {"id": "subcontractor", "name": "Subcontractor", "former": "", "abbr": "", "role": "subcontractor"},
        ]
    party_ids = {p["id"] for p in parties}

    contracts = []
    for i, c in enumerate(raw.get("contracts") or []):
        if "id" not in c:
            raise ConfigError("contracts[%d] has no id" % i)
        kind = c.get("kind") or "sub"
        if kind not in CONTRACT_KINDS:
            raise ConfigError("contracts[%d].kind must be one of %s" % (i, CONTRACT_KINDS))
        counterparty = c.get("counterparty") or ("employer" if kind == "main" else "subcontractor")
        if counterparty not in party_ids:
            raise ConfigError("contracts[%d].counterparty %r is not a party id" % (i, counterparty))
        contracts.append({
            "id": c["id"],
            "kind": kind,
            "no": c.get("no") or c["id"],
            "label": c.get("label") or c["id"],
            # 'tag' is the token a document reference carries for this contract
            # ('…-P01-…'), which is how a letter is attributed to a package.
            "tag": c.get("tag") or c["id"],
            "counterparty": counterparty,
            "currency": c.get("currency") or project["currency"],
            "value": c.get("value"),
            "valueUsd": c.get("valueUsd"),
            "valueRevised": c.get("valueRevised"),
            "originalValue": c.get("originalValue"),
            "originalValueUsd": c.get("originalValueUsd"),
            "advancePct": c.get("advancePct"),
            "retentionPct": c.get("retentionPct"),
            "issuer": c.get("issuer") or "contractor",
            "dir": c.get("dir") or "",
            "file": c.get("file") or "",
            "has_period": bool(c.get("has_period", True)),
        })
    if not contracts:
        contracts = [{"id": "MAIN", "kind": "main", "no": "MAIN", "label": "Main contract",
                      "counterparty": parties[0]["id"], "currency": project["currency"],
                      "value": None, "issuer": "contractor", "dir": "", "file": "",
                      "has_period": True}]
    contract_ids = [c["id"] for c in contracts]
    main = next((c for c in contracts if c["kind"] == "main"), contracts[0])
    subs = [c for c in contracts if c["kind"] == "sub"]

    sources = dict(raw.get("sources") or {})
    sources.setdefault("root", "")
    sources.setdefault("defects", "")
    sources.setdefault("paymentsRegister", "")
    sources.setdefault("mainContractDir", "")
    sources.setdefault("mainContractSums", [])
    sources.setdefault("scanPattern", "")

    letters = []
    for i, s in enumerate(sources.get("letters") or []):
        if not s.get("dir"):
            raise ConfigError("sources.letters[%d] has no dir" % i)
        letters.append({
            "dir": s["dir"],
            "series": s.get("series") or s["dir"],
            "contract": s.get("contract") or main["id"],
            "side": s.get("side") or "issued",
            "label": s.get("label") or s["dir"],
        })
    for s in letters:
        if s["contract"] not in contract_ids:
            raise ConfigError("sources.letters entry %r names unknown contract %r"
                              % (s["dir"], s["contract"]))

    meetings = []
    for i, s in enumerate(sources.get("meetings") or []):
        if not s.get("dir"):
            raise ConfigError("sources.meetings[%d] has no dir" % i)
        meetings.append({
            "dir": s["dir"],
            "series": s.get("series") or s["dir"],
            "contract": s.get("contract") or main["id"],
            "label": s.get("label") or s["dir"],
        })
    for s in meetings:
        if s["contract"] not in contract_ids:
            raise ConfigError("sources.meetings entry %r names unknown contract %r"
                              % (s["dir"], s["contract"]))

    sheets = dict(sources.get("sheets") or {})
    sheets.setdefault("ipc", "")
    sheets.setdefault("employer", "")
    sheets.setdefault("monthly", "")
    sources["sheets"] = sheets

    latest = dict(sources.get("latestCertificate") or {})
    latest.setdefault("dir", "")
    latest.setdefault("file", "")
    latest.setdefault("sheet", "")
    sources["latestCertificate"] = latest

    docs = dict(sources.get("docs") or {})
    for k, v in (("contracts", ""), ("toc", ""), ("materials", ""),
                 ("photos", ""), ("videos", ""), ("pdfLetters", "")):
        docs.setdefault(k, v)
    sources["docs"] = docs

    return {
        "project": project,
        "parties": parties,
        "contracts": contracts,
        "sources": sources,
        "letters": letters,
        "meetings": meetings,
        "main": main,
        "subs": subs,
    }


# --------------------------------------------------------------------------- lookups
def party(cfg, pid):
    for p in cfg["parties"]:
        if p["id"] == pid:
            return p
    return {"id": pid, "name": pid, "former": "", "abbr": "", "role": pid}


def party_role(cfg, pid):
    return party(cfg, pid)["role"]


def contract(cfg, cid):
    for c in cfg["contracts"]:
        if c["id"] == cid:
            return c
    return None


def subsystem(cfg):
    """The subcontract a package-level source belongs to, by folder name."""
    for c in cfg["subs"]:
        if c["dir"] and c["dir"] in (c.get("no") or ""):
            return c
    return cfg["subs"][0] if cfg["subs"] else cfg["main"]


def root_of(cfg):
    """Absolute corpus root; relative roots resolve against the config file."""
    root = cfg["sources"]["root"]
    if not root:
        return ""
    if os.path.isabs(root):
        return root
    base = cfg.get("_dir") or PKG
    return os.path.abspath(os.path.join(base, root))


def out_of(cfg):
    out = cfg["sources"].get("out") or "data"
    if os.path.isabs(out):
        return out
    return os.path.abspath(os.path.join(cfg.get("_dir") or PKG, out))


def party_short(cfg, pid):
    p = party(cfg, pid)
    return p["abbr"] or p["name"]


def project_public(cfg):
    """The `project` block the client receives — identity only, no paths."""
    p = cfg["project"]
    by_role = {party_role(cfg, x["id"]): x for x in cfg["parties"]}
    out = dict(p)
    for role in ("employer", "contractor", "subcontractor"):
        src = by_role.get(role)
        out[role] = (src or {}).get("name", role.title())
        out[role + "Former"] = (src or {}).get("former", "")
    out["epcContract"] = cfg["subs"][0]["no"] if cfg["subs"] else cfg["main"]["no"]
    out["p02Contract"] = cfg["subs"][1]["no"] if len(cfg["subs"]) > 1 else ""
    out["mainContract"] = cfg["main"]["no"]
    out["client"] = out.get("employer", "")
    return out
