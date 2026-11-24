import pathlib, plistlib, re, sys, json
root = pathlib.Path(sys.argv[1])
app = root / "App"
delegate = app / "AppDelegate.swift"
source = delegate.read_text()
source = re.sub(r"(?m)^\s*var window: UIWindow\?\s*$", "", source, count=1) if "class SceneDelegate" not in source else source
if "class SceneDelegate" not in source:
    source += "\n" + pathlib.Path("scripts/ios-scene.swift").read_text()
delegate.write_text(source)
plist = app / "Info.plist"
with plist.open("rb") as f:
    data = plistlib.load(f)
data.pop("UIMainStoryboardFile", None)
data["UIApplicationSceneManifest"] = {"UIApplicationSupportsMultipleScenes": False, "UISceneConfigurations": {"UIWindowSceneSessionRoleApplication": [{"UISceneConfigurationName": "Default Configuration", "UISceneDelegateClassName": "$(PRODUCT_MODULE_NAME).SceneDelegate", "UISceneStoryboardFile": "Main"}]}}
data["NSMicrophoneUsageDescription"] = "Cantoria usa il microfono per riconoscere gli accordi durante la lettura degli spartiti."
with plist.open("wb") as f:
    plistlib.dump(data, f)
release = json.loads(pathlib.Path("release.json").read_text())
project = root / "App.xcodeproj/project.pbxproj"
s = project.read_text()
for key, value in [("MARKETING_VERSION", release["version"]), ("CURRENT_PROJECT_VERSION", release["build"])]:
    s = re.sub(r"(?m)(\b" + key + r"\s*=\s*)[^;]+;", lambda m: m[1] + str(value) + ";", s)
s = re.sub(r"(?m)^\s*INFOPLIST_KEY_UIMainStoryboardFile\s*=.*;\n", "\n", s)
project.write_text(s)
