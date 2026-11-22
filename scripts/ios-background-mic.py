#!/usr/bin/env python3
"""Install Cantoria's Capacitor 8 local native microphone without Xcode project churn."""
from __future__ import annotations
import pathlib
import plistlib
import sys

MARKER = "CANTORIA_NATIVE_BACKGROUND_MIC_V40"
STOCK = 'customClass="CAPBridgeViewController" customModule="Capacitor"'
NATIVE = 'customClass="CantoriaBridgeViewController" customModule="App"'

def run(delegate: pathlib.Path, storyboard: pathlib.Path, plist: pathlib.Path, verify: bool) -> None:
    swift = delegate.read_text(encoding="utf-8")
    story = storyboard.read_text(encoding="utf-8")
    with plist.open("rb") as f:
        info = plistlib.load(f)
    if verify:
        assert swift.count(MARKER) == 1, "Native microphone plugin missing or duplicated"
        assert "bridge?.registerPluginInstance(CantoriaBackgroundMicPlugin())" in swift
        assert "AVAudioEngine()" in swift
        assert "session.setCategory(.record, mode: .measurement)" in swift
        assert story.count(NATIVE) == 1 and STOCK not in story, "Storyboard not using native subclass"
        assert "audio" in info.get("UIBackgroundModes", []), "Background audio capability missing"
        assert "NSMicrophoneUsageDescription" in info
        print("PASS: native iOS background mic, bridge, permissions, and background capability")
        return
    if MARKER not in swift:
        source = pathlib.Path("scripts/ios-background-mic.swift").read_text(encoding="utf-8")
        assert swift.count("import Capacitor") >= 1, "Expected Capacitor AppDelegate"
        swift += "\n// " + MARKER + "\n" + source + "\n"
        delegate.write_text(swift, encoding="utf-8")
    if STOCK in story:
        assert story.count(STOCK) == 1, "Unexpected stock controller storyboard"
        storyboard.write_text(story.replace(STOCK, NATIVE), encoding="utf-8")
    assert NATIVE in storyboard.read_text(encoding="utf-8"), "Storyboard controller mismatch"
    modes = info.setdefault("UIBackgroundModes", [])
    if "audio" not in modes:
        modes.append("audio")
    info["NSMicrophoneUsageDescription"] = (
        "Quando attivi Segui accordi, Cantoria ascolta la musica anche in "
        "background fino a quando premi Stop. Non salva registrazioni audio."
    )
    with plist.open("wb") as f:
        plistlib.dump(info, f)
    run(delegate, storyboard, plist, True)

if __name__ == "__main__":
    check = "--verify" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--verify"]
    if len(args) != 3:
        sys.exit("Usage: ios-background-mic.py [--verify] AppDelegate.swift Main.storyboard Info.plist")
    run(*(pathlib.Path(x) for x in args), check)
