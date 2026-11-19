"""Check capacity before authoring or publishing a standalone preview batch."""
import argparse
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SITE = "0cdfdb8b-14db-4ecc-8729-863567d34848"
TEAMS = {"preview": "695aea082932d05bd97b6eb2", "live": "6afaec6754539fa2b24d5814"}
FLOORS = {"codex_5h": .20, "codex_week": .20, "preview": .20, "live": .25}
DEPENDENCIES = {"crm": ("supabase_database", "supabase_storage", "supabase_egress", "supabase_logs"),
                "n8n": ("n8n_executions",), "gmail": ("gmail_daily",),
                "resend": ("resend_daily", "resend_monthly")}
TYPES = {".html", ".css", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".woff2"}


def check(snapshot, count, now):
    errors = []
    if not 1 <= count <= 10 or snapshot.get("batch_size") != count:
        errors.append("The snapshot must cover this batch of 1–10 sites.")
    if snapshot.get("paid_research_enabled") is not False:
        errors.append("Paid research and verification must be disabled.")
    floors = FLOORS.copy()
    for service, meters in DEPENDENCIES.items():
        enabled = snapshot.get("dependencies", {}).get(service)
        if type(enabled) is not bool:
            errors.append(f"Declare whether the batch uses {service}.")
        if enabled is True:
            floors.update(dict.fromkeys(meters, .20))
    for name, floor in floors.items():
        try:
            meter = snapshot["meters"][name]
            observed, reset = (datetime.fromisoformat(meter[k].replace("Z", "+00:00"))
                               for k in ("observed_at", "reset_at"))
            if not now - timedelta(minutes=30) <= observed <= now < reset:
                raise ValueError("stale reading or expired window")
            cap, left, cost, reserve = (meter["allowance"], meter["remaining"],
                                       meter["batch_estimate"], meter.get("reserve", floor))
            if any(type(x) not in (int, float) or not math.isfinite(x) or x < 0
                   for x in (cap, left, cost, reserve)):
                raise ValueError("invalid numeric values")
            if not 0 <= left <= cap or cap == 0 or reserve >= 1:
                raise ValueError("invalid allowance, remaining balance or reserve")
            if name in TEAMS:
                if meter.get("team") != TEAMS[name] or meter.get("billing_current") is not True:
                    errors.append(f"{name}: expected team and current billing status must be verified.")
                if meter.get("auto_recharge") is not False:
                    errors.append(f"{name}: auto-recharge must be verified off.")
            if name.startswith("codex_") and (cap != 100 or not cost):
                raise ValueError("use percentage points and a positive batch estimate")
            if name == "preview" and not cost:
                raise ValueError("include expected request and bandwidth credits")
            required = cap * max(reserve, floor)
            if left - cost < required:
                errors.append(f"{name}: {left - cost:g} projected remaining, {required:g} reserved.")
        except (KeyError, ValueError, TypeError, AttributeError) as exc:
            errors.append(f"{name}: invalid or missing usage reading ({exc}).")
    return errors


def require_capacity(snapshot, count):
    errors = check(snapshot, count, datetime.now(timezone.utc))
    if errors:
        raise SystemExit("Preview preflight blocked\n" + "\n".join(errors))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("check").add_argument("count", type=int)
    generate = commands.add_parser("generate")
    generate.add_argument("count", type=int)
    generate.add_argument("generator", nargs=argparse.REMAINDER)
    publish = commands.add_parser("publish")
    publish.add_argument("source", type=Path)
    publish.add_argument("slugs", nargs="+")
    publish.add_argument("--netlify", default="netlify")
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    count = len(args.slugs) if args.action == "publish" else args.count
    require_capacity(snapshot, count)
    if args.action == "check":
        print(f"Preview preflight passed for {count} site(s).")
        return

    if args.action == "generate":
        if not args.generator:
            parser.error("Supply the local preview generator command.")
        subprocess.run(args.generator, check=True)
        return

    if len(set(args.slugs)) != count or any(not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug)
                                            for slug in args.slugs):
        parser.error("Use distinct, lowercase URL slugs.")
    cli = shutil.which(args.netlify)
    if not cli:
        parser.error("Authenticated Netlify CLI executable not found.")
    cli = str(Path(cli).absolute())
    with tempfile.TemporaryDirectory(prefix="nonstop-preview-") as temp:
        stage = Path(temp)
        for name in ("assets", *args.slugs):
            source = args.source / name
            if source.is_symlink() or not source.is_dir():
                parser.error(f"Expected a regular source directory for {name}.")
            if name != "assets" and not (source / "index.html").is_file():
                parser.error(f"Missing index.html for {name}.")
            for file in source.rglob("*"):
                relative = file.relative_to(args.source)
                if file.is_symlink():
                    parser.error(f"Symlink in preview payload: {relative}")
                if file.is_file() and file.suffix.lower() in TYPES and not any(p.startswith(".") for p in relative.parts):
                    destination = stage / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(file, destination)
        (stage / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n")
        require_capacity(snapshot, count)
        result = subprocess.run([cli, "deploy", "--site", SITE, "--dir", ".",
                                 "--no-build", "--json"], cwd=stage, check=True,
                                stdout=subprocess.PIPE, text=True)
        deploy = json.loads(result.stdout)
        url = deploy.get("deploy_url", "")
        if deploy.get("site_id") != SITE or not re.fullmatch(
                r"https://[a-z0-9-]+--nonstop-previews\.netlify\.app", url):
            raise ValueError("Netlify did not return a standalone preview URL")
        for slug in args.slugs:
            print(f"{url}/{slug}/")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"Preview operation stopped: {exc}") from None
