#!/usr/bin/env python3
"""Apply and verify Cantoria's native iOS foreground screen-awake policy.

Capacitor generates ios/App/App/AppDelegate.swift in the CI runner. The patch is
intentionally applied *after* cap sync so it is present in every signed IPA.
Keep UIKit's existing lifecycle and CAPBridgeViewController unchanged.
"""
from __future__ import annotations
import pathlib
import re
import sys

MARKER = "CANTORIA_FOREGROUND_SCREEN_AWAKE_V38"
SIGNATURE = re.compile(
    r"func\s+application\s*\(\s*_\s+application\s*:\s*UIApplication\s*,\s*"
    r"didFinishLaunchingWithOptions\s+launchOptions\s*:\s*"
    r"\[\s*UIApplication\.LaunchOptionsKey\s*:\s*Any\s*\]\s*\?\s*\)"
    r"\s*->\s*Bool\s*\{"
)
SNIPPET = """
        // CANTORIA_FOREGROUND_SCREEN_AWAKE_V38
        // The score must remain readable during a whole liturgy, even without
        // touches. Re-enable the iOS idle timer when Cantoria is not active.
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            UIApplication.shared.isIdleTimerDisabled = true
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            UIApplication.shared.isIdleTimerDisabled = false
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            UIApplication.shared.isIdleTimerDisabled = false
        }
        if application.applicationState == .active {
            application.isIdleTimerDisabled = true
        }
"""

def is_patched(source: str) -> bool:
    return (
        source.count(MARKER) == 1
        and "UIApplication.didBecomeActiveNotification" in source
        and "UIApplication.willResignActiveNotification" in source
        and "UIApplication.didEnterBackgroundNotification" in source
        and "UIApplication.shared.isIdleTimerDisabled = true" in source
        and source.count("UIApplication.shared.isIdleTimerDisabled = false") >= 2
        and "application.isIdleTimerDisabled = true" in source
    )

def main() -> int:
    args = sys.argv[1:]
    verify = "--verify" in args
    args = [arg for arg in args if arg != "--verify"]
    if len(args) != 1:
        print("Usage: ios-screen-awake.py [--verify] ios/App/App/AppDelegate.swift", file=sys.stderr)
        return 2
    path = pathlib.Path(args[0])
    if not path.is_file():
        print("Missing Capacitor AppDelegate: " + str(path), file=sys.stderr)
        return 1
    current = path.read_text(encoding="utf-8")
    if verify:
        if not is_patched(current):
            print("FAIL: iOS foreground screen-awake policy absent or incomplete", file=sys.stderr)
            return 1
        print("PASS: native iOS awake foreground/background lifecycle verified")
        return 0
    if MARKER in current:
        if is_patched(current):
            print("Native screen-awake policy already installed; leaving AppDelegate unchanged")
            return 0
        print("FAIL: partial/modified native screen-awake policy", file=sys.stderr)
        return 1
    matches = list(SIGNATURE.finditer(current))
    if len(matches) != 1:
        print("FAIL: unexpected Capacitor AppDelegate template: cannot inject safely", file=sys.stderr)
        return 1
    at = matches[0].end()
    patched = current[:at] + "\n" + SNIPPET + current[at:]
    if not is_patched(patched):
        print("FAIL: native screen-awake postcondition", file=sys.stderr)
        return 1
    path.write_text(patched, encoding="utf-8")
    print("Enabled iOS keep-screen-awake for all foreground Cantoria screens")
    return 0

if __name__ == "__main__":
    sys.exit(main())
